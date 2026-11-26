import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  initialHotelInfo, initialActivities, generateBookingId, generatePublicToken,
  BLOCKING_STATUSES, todayStr,
} from '../data/initialData';
import { TRANSLATIONS } from '../data/translations';
import { logAudit } from '../utils/audit';
import { computeStayPrice } from '../utils/pricing';
import { api } from '../utils/api';
import * as engine from '../utils/syncEngine';
import { useAuth } from './AuthContext';
import { useToast } from '../components/ToastProvider';
import { getDocs, getDoc, collection, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

const HotelContext = createContext(null);

// ================== SYNCED STATE HOOKS ==================
/** ລາຍການ (array ຂອງ object ທີ່ມີ id) ທີ່ sync ກັບ server ອັດຕະໂນມັດ */
function useSyncedList(name) {
  const [items, setItems] = useState(() => engine.getCollection(name) || []);
  const lastRef = useRef(items);

  useEffect(() => engine.subscribe(name, (kind, payload) => {
    if (kind === 'replace') {
      const next = Array.isArray(payload) ? payload : [];
      lastRef.current = next;
      setItems(next);
    } else if (kind === 'ops') {
      lastRef.current = engine.applyOps(lastRef.current, payload);
      setItems(prev => engine.applyOps(prev, payload));
    }
  }), [name]);

  useEffect(() => {
    if (items === lastRef.current) return;
    const ops = engine.diffById(lastRef.current, items);
    lastRef.current = items;
    if (ops.length && engine.isLoaded()) engine.pushOps(name, ops);
  }, [items, name]);

  return [items, setItems];
}

/** object ດຽວ (ເຊັ່ນ ຂໍ້ມູນຣີສອດ) ທີ່ sync ກັບ server */
function useSyncedDoc(name, fallback) {
  const [value, setValue] = useState(() => engine.getDoc(name) ?? fallback);
  const lastRef = useRef(value);

  useEffect(() => engine.subscribe(`doc:${name}`, (kind, payload) => {
    const next = payload ?? fallback;
    lastRef.current = next;
    setValue(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [name]);

  useEffect(() => {
    if (value === lastRef.current) return;
    const changed = JSON.stringify(value) !== JSON.stringify(lastRef.current);
    lastRef.current = value;
    if (changed && engine.isLoaded()) engine.pushDoc(name, value);
  }, [value, name]);

  return [value, setValue];
}

const newId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ສຽງແຈ້ງເຕືອນສັ້ນໆ
function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.start(t); o.stop(t + 0.32);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch { /* ignore */ }
}

export function HotelProvider({ children }) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const isStaff = !!currentUser;

  // ================== STAFF DATA (sync ກັບ server) ==================
  const [syncedRooms, setRooms] = useSyncedList('rooms');
  const [syncedBookings, setBookings] = useSyncedList('bookings');
  const [syncedActivities, setGuestActivities] = useSyncedList('guestActivities');
  const [activitySales, setActivitySales] = useSyncedList('activitySales');
  const [shiftCloses, setShiftCloses] = useSyncedList('shiftCloses');
  const [expenses, setExpenses] = useSyncedList('expenses');
  const [maintenanceLogs, setMaintenanceLogs] = useSyncedList('maintenanceLogs');
  const [syncedRatePlans, setRatePlans] = useSyncedList('ratePlans');
  const [syncedHotelInfo, setHotelInfoState] = useSyncedDoc('hotelInfo', initialHotelInfo);

  const [dataReady, setDataReady] = useState(false);
  const [dataError, setDataError] = useState('');
  const [syncStatus, setSyncStatus] = useState(engine.getStatus());

  // ================== PUBLIC DATA (ລູກຄ້າ — ບໍ່ login) ==================
  const [catalog, setCatalog] = useState(null);

  const loadCatalog = useCallback(async () => {
    try {
      if (engine.isFirebase()) {
        const [roomsSnap, actsSnap, hDoc] = await Promise.all([
          getDocs(collection(db, 'hotel_rooms')),
          getDocs(collection(db, 'hotel_activities')),
          getDoc(doc(db, 'hotel_info', 'general')),
        ]);
        setCatalog({
          rooms: roomsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          guestActivities: actsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          hotelInfo: hDoc.exists() ? hDoc.data() : initialHotelInfo,
          ratePlans: [],
        });
        setDataError('');
        return;
      }
      const c = await api('/api/public/catalog', { auth: false });
      setCatalog(c);
      setDataError('');
    } catch (e) {
      setDataError(e.message);
    }
  }, []);

  const startSync = useCallback(() => {
    setDataReady(false);
    setDataError('');
    return engine.start()
      .then(() => setDataReady(true))
      .catch(e => setDataError(e.message));
  }, []);

  // ເລີ່ມ / ຢຸດ sync ຕາມການ login
  useEffect(() => {
    if (currentUser?.id) {
      startSync();
    } else {
      engine.stop();
      setDataReady(false);
      loadCatalog();
    }
  }, [currentUser?.id, loadCatalog, startSync]);

  // ລູກຄ້າ: ໂຫຼດຫ້ອງວ່າງໃໝ່ທຸກ 60 ວິນາທີ ແລະ ເມື່ອກັບມາເປີດແຖບ
  useEffect(() => {
    if (isStaff) return undefined;
    const timer = setInterval(loadCatalog, 60000);
    const onFocus = () => loadCatalog();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [isStaff, loadCatalog]);

  // ສະຖານະການເຊື່ອມຕໍ່ + ແຈ້ງເຕືອນ
  useEffect(() => engine.onGlobal((msg) => {
    if (msg.type === 'status') setSyncStatus(engine.getStatus());
    else if (msg.type === 'error') toast(msg.message, 'error', 5000);
    else if (msg.type === 'notify') {
      playChime();
      toast(`${msg.title} — ${msg.message}`, 'info', 10000);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
        try { new Notification(msg.title, { body: msg.message }); } catch { /* ignore */ }
      }
    }
  }), [toast]);

  // ຂໍອະນຸຍາດແຈ້ງເຕືອນຂອງ browser (ສຳລັບເຈົ້າຂອງ/ພະນັກງານຕ້ອນຮັບ)
  useEffect(() => {
    if (isStaff && currentUser.role !== 'housekeeping' && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [isStaff, currentUser?.role]);

  // ================== VIEW VALUES ==================
  const rooms = isStaff ? syncedRooms : (catalog?.rooms || []);
  const bookings = isStaff ? syncedBookings : (catalog?.busy || []);
  const activityList = isStaff ? syncedActivities : (catalog?.guestActivities || []);
  const guestActivities = activityList.length ? activityList : initialActivities;
  const hotelInfo = (isStaff ? syncedHotelInfo : catalog?.hotelInfo) || initialHotelInfo;
  const ratePlans = isStaff ? syncedRatePlans : (catalog?.ratePlans || []);
  const pendingOnlineCount = isStaff ? syncedBookings.filter(b => b.status === 'pending').length : 0;

  // ================== PRICING ==================
  const quoteStay = useCallback((roomOrId, checkIn, checkOut) => {
    const room = typeof roomOrId === 'string' ? rooms.find(r => r.id === roomOrId) : roomOrId;
    return computeStayPrice(room, checkIn, checkOut, ratePlans);
  }, [rooms, ratePlans]);

  // ================== ROOM AVAILABILITY LOGIC ==================
  /** ກວດສອບວ່າຫ້ອງ roomId ວ່າງໃນຊ່ວງ [checkIn, checkOut) ຫຼື ບໍ່ */
  const isRoomAvailableForDates = useCallback((roomId, checkIn, checkOut, excludeBookingId = null) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room || room.status === 'maintenance') return false;
    if (!checkIn || !checkOut || checkIn >= checkOut) return false;
    return !bookings.some(b => {
      if (b.roomId !== roomId) return false;
      if (excludeBookingId && b.id === excludeBookingId) return false;
      if (!BLOCKING_STATUSES.includes(b.status)) return false;
      return b.checkIn < checkOut && b.checkOut > checkIn;
    });
  }, [rooms, bookings]);

  /** ດຶງສະຖານະຫ້ອງ ແລະ ການຈອງໃນວັນທີໃດໜຶ່ງ (Dynamic Status) */
  const getRoomStatusOnDate = useCallback((roomId, dateStr) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return { status: 'available', booking: null };
    if (room.status === 'maintenance') return { status: 'maintenance', booking: null };

    const targetDate = dateStr || todayStr();
    if (targetDate === todayStr() && room.status === 'cleaning') return { status: 'cleaning', booking: null };

    const activeBooking = bookings.find(b =>
      b.roomId === roomId &&
      BLOCKING_STATUSES.includes(b.status) &&
      b.checkIn <= targetDate && targetDate < b.checkOut
    );
    if (activeBooking) {
      if (activeBooking.status === 'checked_in') return { status: 'occupied', booking: activeBooking };
      if (activeBooking.status === 'booked') return { status: 'booked', booking: activeBooking };
      if (activeBooking.status === 'pending') return { status: 'waiting_checkin', booking: activeBooking };
    }
    return { status: 'available', booking: null };
  }, [rooms, bookings]);

  // ================== ROOM ACTIONS ==================
  const updateRoom = (id, data) => {
    setRooms(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
    logAudit(null, 'room.update', `ແກ້ໄຂຫ້ອງ ${id}`);
  };

  const setRoomStatus = (id, status, note = '') => {
    setRooms(prev => prev.map(r => r.id === id ? { ...r, status, statusNote: note || undefined, statusChangedAt: new Date().toISOString() } : r));
    logAudit(null, 'room.status', `ປ່ຽນສະຖານະຫ້ອງ ${id} ເປັນ "${status}"${note ? ` (${note})` : ''}`);
  };

  const addRoom = (roomData) => {
    const newRoom = { ...roomData, id: roomData.number, currentBookingId: null, images: [] };
    setRooms(prev => [...prev, newRoom]);
    logAudit(null, 'room.create', `ເພີ່ມຫ້ອງໃໝ່ ${newRoom.number} (${newRoom.type})`);
  };

  const deleteRoom = (id) => {
    setRooms(prev => prev.filter(r => r.id !== id));
    logAudit(null, 'room.delete', `ລຶບຫ້ອງ ${id}`);
  };

  const markClean = (roomId) => {
    const by = currentUser?.name || '';
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, status: 'available', lastCleanedAt: new Date().toISOString(), lastCleanedBy: by } : r));
    logAudit(null, 'room.status', `ຫ້ອງ ${roomId} ອະນາໄມສຳເລັດ (ວ່າງ)`);
  };

  // ================== PAYMENTS LEDGER ==================
  // ທຸກຄັ້ງທີ່ຮັບ/ຄືນເງິນ ຈະບັນທຶກໃສ່ booking.payments ເພື່ອໃຫ້ລາຍງານລາຍຮັບຕາມ "ວັນທີ່ຮັບເງິນແທ້"
  const makePayment = (amount, method, type, note = '') => ({
    id: newId('PAY'),
    at: new Date().toISOString(),
    amount: Number(amount) || 0,
    method: method || 'cash',
    type, // deposit | checkin | checkout | adjust | refund
    note,
    by: currentUser?.name || '',
  });

  /** ເງິນທີ່ຮັບແລ້ວທັງໝົດຂອງການຈອງ (ຫັກເງິນທີ່ຄືນແລ້ວ) */
  const getPaidTotal = useCallback((b) => {
    if (!b) return 0;
    if (Array.isArray(b.payments) && b.payments.length) return b.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    return Number(b.deposit || 0) + Number(b.remainingPaid || 0) + Number(b.finalPaymentAmount || 0);
  }, []);

  // ================== BOOKING ACTIONS ==================
  const createBooking = (bookingData) => {
    let id = generateBookingId();
    while (syncedBookings.some(b => b.id === id)) id = generateBookingId();
    const isDirectCheckIn = bookingData.isDirectCheckIn || bookingData.status === 'checked_in';
    const isPending = bookingData.status === 'pending';
    const finalStatus = isDirectCheckIn ? 'checked_in' : (isPending ? 'pending' : 'booked');
    const deposit = Number(bookingData.deposit || 0);

    // eslint-disable-next-line no-unused-vars
    const { isDirectCheckIn: _omit, ...data } = bookingData;
    const booking = {
      ...data,
      id,
      publicToken: generatePublicToken(),
      status: finalStatus,
      createdAt: new Date().toISOString(),
      checkedInAt: isDirectCheckIn ? new Date().toISOString() : null,
      checkedOutAt: null,
      extraCharges: bookingData.extraCharges || [],
      payments: deposit > 0 ? [makePayment(deposit, bookingData.paymentMethod, isDirectCheckIn ? 'checkin' : 'deposit')] : [],
    };

    setBookings(prev => [booking, ...prev]);
    if (isDirectCheckIn) {
      setRooms(prev => prev.map(r => r.id === bookingData.roomId ? { ...r, status: 'occupied', currentBookingId: id } : r));
    }
    const action = isPending ? 'booking.online' : 'booking.create';
    logAudit(null, action, `${finalStatus === 'pending' ? 'ລູກຄ້າຈອງອອນລາຍ' : 'ສ້າງການຈອງ'} ${id}: ຫ້ອງ ${bookingData.roomId} ວັນທີ ${bookingData.checkIn} ຫາ ${bookingData.checkOut} (${bookingData.guestName})`);
    return booking;
  };

  const updateBooking = (bookingId, patchData) => {
    const nowIso = new Date().toISOString();
    const current = syncedBookings.find(b => b.id === bookingId);
    let adjust = null;
    if (current && patchData.deposit !== undefined && Number(patchData.deposit) !== Number(current.deposit || 0)) {
      const diff = Number(patchData.deposit || 0) - Number(current.deposit || 0);
      adjust = makePayment(diff, patchData.paymentMethod || current.paymentMethod, 'adjust', 'ປັບເງິນມັດຈຳ');
    }
    const apply = (b) => ({
      ...b,
      ...patchData,
      updatedAt: nowIso,
      ...(adjust ? { payments: [...(b.payments || []), adjust] } : {}),
    });
    setBookings(prev => prev.map(b => b.id === bookingId ? apply(b) : b));
    logAudit(null, 'booking.update', `ແກ້ໄຂການຈອງ ${bookingId}: ${patchData.roomId ? 'ປ່ຽນຫ້ອງ/ວັນທີ' : 'ແກ້ໄຂຂໍ້ມູນ'}`);
    return current ? apply(current) : null;
  };

  const checkIn = (bookingId, paymentData, registrationData = null) => {
    const now = new Date().toISOString();
    const snap = syncedBookings.find(x => x.id === bookingId);
    const paidNow = Number(paymentData?.amount || 0);
    const pay = paidNow > 0 ? makePayment(paidNow, paymentData?.method || 'cash', 'checkin') : null;
    setBookings(prev => prev.map(b => {
      if (b.id !== bookingId) return b;
      const totalPaidSoFar = Number(b.deposit || 0) + paidNow;
      return {
        ...b,
        ...(registrationData || {}),
        status: 'checked_in',
        checkedInAt: b.checkedInAt || now,
        remainingPaid: paidNow,
        remainingPaymentMethod: paymentData?.method || b.remainingPaymentMethod || 'cash',
        remainingAmount: Math.max(0, Number(b.totalAmount || 0) - totalPaidSoFar),
        payments: pay ? [...(b.payments || []), pay] : (b.payments || []),
      };
    }));
    const roomId = registrationData?.roomId || snap?.roomId;
    if (roomId) setRooms(prev => prev.map(r => r.id === roomId ? { ...r, status: 'occupied', currentBookingId: bookingId } : r));
    const signedNote = registrationData?.signatureDataUrl ? ' (ພ້ອມລາຍເຊັນ iPad)' : '';
    logAudit(null, 'booking.checkin', `Check-in ການຈອງ ${bookingId} (ຫ້ອງ ${roomId})${signedNote}`);
  };

  const checkOut = (bookingId, extraCharges, finalData) => {
    const now = new Date().toISOString();
    const snap = syncedBookings.find(x => x.id === bookingId);
    const paid = Number(finalData.paymentAmount || 0);
    const pay = paid > 0 ? makePayment(paid, finalData.paymentMethod, 'checkout') : null;
    setBookings(prev => prev.map(b => b.id !== bookingId ? b : {
      ...b,
      status: 'checked_out',
      checkedOutAt: now,
      extraCharges: extraCharges || [],
      finalTotal: finalData.finalTotal,
      finalPaymentMethod: finalData.paymentMethod,
      finalPaymentAmount: finalData.paymentAmount,
      payments: pay ? [...(b.payments || []), pay] : (b.payments || []),
    }));
    if (snap?.roomId) setRooms(prev => prev.map(r => r.id === snap.roomId ? { ...r, status: 'cleaning', currentBookingId: null } : r));
    logAudit(null, 'booking.checkout', `Check-out ການຈອງ ${bookingId} (ຫ້ອງ ${snap?.roomId}), ຍອດລວມ ${finalData.finalTotal} ₭`);
  };

  /**
   * ຍົກເລີກການຈອງ
   * @param {object} [refund] { amount, method, note } — ເງິນທີ່ຄືນໃຫ້ລູກຄ້າ (ຖ້າມີ)
   */
  const cancelBooking = (bookingId, reason, refund = null) => {
    const now = new Date().toISOString();
    const snap = syncedBookings.find(x => x.id === bookingId);
    const refundAmount = Math.max(0, Math.min(Number(refund?.amount || 0), getPaidTotal(snap)));
    const pay = refundAmount > 0 ? makePayment(-refundAmount, refund.method, 'refund', refund.note || reason || '') : null;
    setBookings(prev => prev.map(b => b.id !== bookingId ? b : {
      ...b,
      status: 'cancelled',
      cancelReason: reason,
      cancelledAt: now,
      ...(pay ? {
        refundAmount,
        refundMethod: refund.method || 'cash',
        refundedAt: now,
        payments: [...(b.payments || []), pay],
      } : {}),
    }));
    if (snap?.roomId) setRooms(prev => prev.map(r => r.id === snap.roomId && r.currentBookingId === bookingId ? { ...r, status: 'available', currentBookingId: null } : r));
    logAudit(null, 'booking.cancel', `ຍົກເລີກການຈອງ ${bookingId}: ${reason || '-'}`);
    if (pay) logAudit(null, 'booking.refund', `ຄືນເງິນ ${refundAmount} ₭ ໃຫ້ການຈອງ ${bookingId} (${refund.method || 'cash'})`);
  };

  const markNoShow = (bookingId, reason = 'ລູກຄ້າບໍ່ມາເຂົ້າພັກ') => {
    const now = new Date().toISOString();
    const snap = syncedBookings.find(x => x.id === bookingId);
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'no_show', noShowReason: reason, noShowAt: now } : b));
    if (snap?.roomId) setRooms(prev => prev.map(r => r.id === snap.roomId && r.currentBookingId === bookingId ? { ...r, status: 'available', currentBookingId: null } : r));
    logAudit(null, 'booking.noshow', `ໝາຍ No-Show ການຈອງ ${bookingId}`);
  };

  const confirmBooking = (bookingId) => {
    setBookings(prev => prev.map(b =>
      b.id === bookingId ? { ...b, status: 'booked', confirmedAt: new Date().toISOString() } : b
    ));
    logAudit(null, 'booking.confirm', `ຢືນຢັນການຈອງອອນລາຍ ${bookingId}`);
  };

  const rejectBooking = (bookingId, reason = 'ປະຕິເສດການຈອງ', refund = null) => {
    cancelBooking(bookingId, reason, refund);
    logAudit(null, 'booking.reject', `ປະຕິເສດການຈອງອອນລາຍ ${bookingId}: ${reason}`);
  };

  const addExtraChargeToBooking = (bookingId, charge) => {
    setBookings(prev => prev.map(b => {
      if (b.id !== bookingId) return b;
      return { ...b, extraCharges: [...(b.extraCharges || []), charge] };
    }));
  };

  const getBookingForRoom = (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room?.currentBookingId) return null;
    return bookings.find(b => b.id === room.currentBookingId);
  };

  const getActiveBookingForRoom = (roomId) => {
    const today = todayStr();
    return bookings.find(b =>
      b.roomId === roomId &&
      BLOCKING_STATUSES.includes(b.status) &&
      b.checkIn <= today && today < b.checkOut
    );
  };

  // ================== ACTIVITY SALES ACTIONS ==================
  const addActivitySale = (saleData) => {
    const newSale = {
      id: newId('AC'),
      status: 'paid', // 'paid' | 'booked' | 'cancelled'
      createdAt: new Date().toISOString(),
      date: saleData.date || todayStr(),
      soldBy: currentUser?.name || '',
      ...saleData,
    };
    setActivitySales(prev => [newSale, ...prev]);
    if (saleData.chargeToBookingId) {
      addExtraChargeToBooking(saleData.chargeToBookingId, {
        desc: `ກິດຈະກຳ: ${saleData.activityLabel} (${saleData.quantity} ປີ້)`,
        amount: saleData.totalAmount,
        activitySaleId: newSale.id,
      });
    }
    logAudit(null, 'activity.sale', `ຂາຍກິດຈະກຳ "${newSale.activityLabel}" ຈຳນວນ ${newSale.quantity} ປີ້ (${newSale.totalAmount} ₭) ໃຫ້ ${newSale.customerName || newSale.guestName}`);
    return newSale;
  };

  const updateActivitySale = (saleId, patch) => {
    setActivitySales(prev => prev.map(s => s.id === saleId ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s));
    if (patch.status === 'paid') logAudit(null, 'activity.confirm', `ຢືນຢັນ/ຮັບເງິນກິດຈະກຳ ${saleId}`);
  };

  const cancelActivitySale = (saleId, reason = 'ຍົກເລີກການຂາຍ') => {
    setActivitySales(prev => prev.map(s => {
      if (s.id !== saleId) return s;
      return { ...s, status: 'cancelled', cancelReason: reason, cancelledAt: new Date().toISOString() };
    }));
    logAudit(null, 'activity.cancel', `ຍົກເລີກປີ້ກິດຈະກຳ ${saleId}: ${reason}`);
  };

  // ================== SHIFT CLOSE ==================
  const addShiftClose = (record) => {
    const rec = { id: record.id || newId('SC'), closedBy: currentUser?.name || '', ...record };
    setShiftCloses(prev => [rec, ...prev]);
    logAudit(null, 'shift.close', `ປິດກະວັນທີ ${rec.date || '-'}`);
    return rec;
  };

  // ================== EXPENSES ==================
  const addExpense = (data) => {
    const exp = {
      id: newId('EX'),
      date: data.date || todayStr(),
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || '',
      ...data,
      amount: Number(data.amount) || 0,
    };
    setExpenses(prev => [exp, ...prev]);
    logAudit(null, 'expense.create', `ບັນທຶກລາຍຈ່າຍ "${exp.description || exp.category}" ${exp.amount} ₭`);
    return exp;
  };
  const updateExpense = (id, patch) => {
    const nowIso = new Date().toISOString();
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...patch, amount: Number(patch.amount ?? e.amount) || 0, updatedAt: nowIso } : e));
    logAudit(null, 'expense.update', `ແກ້ໄຂລາຍຈ່າຍ ${id}`);
  };
  const deleteExpense = (id) => {
    const e = expenses.find(x => x.id === id);
    setExpenses(prev => prev.filter(x => x.id !== id));
    logAudit(null, 'expense.delete', `ລຶບລາຍຈ່າຍ "${e?.description || id}" ${e?.amount || 0} ₭`);
  };

  // ================== MAINTENANCE / HOUSEKEEPING ==================
  const reportMaintenance = ({ roomId, issue, priority = 'normal', closeRoom = false }) => {
    const log = {
      id: newId('MT'),
      roomId,
      issue,
      priority, // low | normal | high
      status: 'open', // open | resolved
      reportedAt: new Date().toISOString(),
      reportedBy: currentUser?.name || '',
      closedRoom: !!closeRoom,
    };
    setMaintenanceLogs(prev => [log, ...prev]);
    if (closeRoom) setRooms(prev => prev.map(r => r.id === roomId ? { ...r, status: 'maintenance', statusNote: issue } : r));
    logAudit(null, 'maintenance.report', `ແຈ້ງສ້ອມແປງຫ້ອງ ${roomId}: ${issue}${closeRoom ? ' (ປິດຫ້ອງ)' : ''}`);
    return log;
  };
  const resolveMaintenance = (logId, resolutionNote = '', cost = 0) => {
    const log = maintenanceLogs.find(l => l.id === logId);
    if (!log) return;
    const nowIso = new Date().toISOString();
    const by = currentUser?.name || '';
    setMaintenanceLogs(prev => prev.map(l => l.id === logId ? {
      ...l, status: 'resolved', resolvedAt: nowIso, resolvedBy: by, resolutionNote, cost: Number(cost) || 0,
    } : l));
    // ເປີດຫ້ອງຄືນ (ໃຫ້ອະນາໄມກ່ອນ) ຖ້າບໍ່ມີລາຍການສ້ອມແປງອື່ນທີ່ປິດຫ້ອງຢູ່
    const stillOpen = maintenanceLogs.some(l => l.id !== logId && l.roomId === log.roomId && l.status === 'open' && l.closedRoom);
    if (log.closedRoom && !stillOpen) {
      setRooms(prev => prev.map(r => r.id === log.roomId && r.status === 'maintenance' ? { ...r, status: 'cleaning', statusNote: undefined } : r));
    }
    if (Number(cost) > 0) {
      addExpense({ category: 'maintenance', description: `ສ້ອມແປງຫ້ອງ ${log.roomId}: ${log.issue}`, amount: Number(cost), paymentMethod: 'cash', maintenanceLogId: logId });
    }
    logAudit(null, 'maintenance.resolve', `ສ້ອມແປງຫ້ອງ ${log.roomId} ສຳເລັດ${resolutionNote ? `: ${resolutionNote}` : ''}`);
  };

  // ================== RATE PLANS (ລາຄາລະດູການ) ==================
  const saveRatePlan = (plan) => {
    const p = { active: true, priority: 0, ...plan, id: plan.id || newId('RP'), updatedAt: new Date().toISOString() };
    setRatePlans(prev => prev.some(x => x.id === p.id) ? prev.map(x => x.id === p.id ? p : x) : [p, ...prev]);
    logAudit(null, 'rateplan.update', `ບັນທຶກລາຄາລະດູການ "${p.name}"`);
    return p;
  };
  const deleteRatePlan = (id) => {
    const p = syncedRatePlans.find(x => x.id === id);
    setRatePlans(prev => prev.filter(x => x.id !== id));
    logAudit(null, 'rateplan.delete', `ລຶບລາຄາລະດູການ "${p?.name || id}"`);
  };

  // ================== STATS ==================
  const getStats = (date = todayStr()) => {
    const total = rooms.length;
    let available = 0, occupied = 0, booked = 0, cleaning = 0, maintenance = 0, pending = 0;
    rooms.forEach(r => {
      const { status } = getRoomStatusOnDate(r.id, date);
      if (status === 'available') available++;
      else if (status === 'occupied') occupied++;
      else if (status === 'booked') booked++;
      else if (status === 'cleaning') cleaning++;
      else if (status === 'maintenance') maintenance++;
      else if (status === 'waiting_checkin') pending++;
    });
    const occupancyRate = total > 0 ? Math.round(((occupied + booked) / total) * 100) : 0;
    return { total, available, occupied, booked, cleaning, maintenance, pending, occupancyRate };
  };

  // ================== REVENUE (ຕາມວັນທີ່ຮັບເງິນແທ້) ==================
  const getPeriodRange = (period, customStart = null, customEnd = null) => {
    const now = new Date();
    let startDate;
    let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (period === 'custom' && customStart && customEnd) {
      startDate = new Date(customStart + 'T00:00:00');
      endDate = new Date(customEnd + 'T23:59:59.999');
    } else {
      switch (period) {
        case 'today': startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
        case 'week': startDate = new Date(now); startDate.setDate(now.getDate() - 7); startDate.setHours(0, 0, 0, 0); break;
        case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
        case 'year': startDate = new Date(now.getFullYear(), 0, 1); break;
        default: startDate = new Date(0);
      }
    }
    return { startDate, endDate };
  };

  /** ການຈ່າຍເງິນຂອງ booking (booking ເກົ່າທີ່ບໍ່ມີ ledger → ສ້າງຈາກຂໍ້ມູນເດີມ) */
  const getBookingPayments = useCallback((b) => {
    if (Array.isArray(b.payments)) return b.payments;
    if (['cancelled', 'no_show', 'pending'].includes(b.status)) return [];
    const extras = (b.extraCharges || []).reduce((s, e) => s + Number(e.amount || 0), 0);
    const total = b.finalTotal ?? ((b.totalAmount || 0) + extras);
    return [{ id: `legacy-${b.id}`, at: b.checkedInAt || b.createdAt, amount: total, method: b.finalPaymentMethod || b.paymentMethod || 'cash', type: 'legacy' }];
  }, []);

  const getRevenue = (period, customStart = null, customEnd = null) => {
    const { startDate, endDate } = getPeriodRange(period, customStart, customEnd);
    const inRange = (iso) => { const d = new Date(iso); return d >= startDate && d <= endDate; };
    const byMethod = { cash: 0, transfer: 0, qr: 0, card: 0 };

    // 1. ຫ້ອງພັກ: ລວມທຸກການຮັບ/ຄືນເງິນໃນຊ່ວງເວລາ
    let roomTotal = 0;
    let refundTotal = 0;
    const filteredBookings = [];
    syncedBookings.forEach(b => {
      const pays = getBookingPayments(b).filter(p => p.at && inRange(p.at));
      if (!pays.length) return;
      const sum = pays.reduce((s, p) => s + Number(p.amount || 0), 0);
      pays.forEach(p => {
        const m = p.method || 'cash';
        byMethod[m] = (byMethod[m] || 0) + Number(p.amount || 0);
        if (Number(p.amount) < 0) refundTotal += -Number(p.amount);
      });
      roomTotal += sum;
      filteredBookings.push({ ...b, periodPaid: sum });
    });

    // 2. ກິດຈະກຳ (ຂາຍແຍກ — ທີ່ລົງບິນຫ້ອງຈະຖືກນັບຕອນ check-out ແລ້ວ)
    const filteredActivities = activitySales.filter(s => {
      if (s.status && s.status !== 'paid') return false;
      if (s.chargeToBookingId) return false;
      return inRange(s.paidAt || s.createdAt || s.date);
    });
    const activityTotal = filteredActivities.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    filteredActivities.forEach(s => {
      const m = s.paymentMethod || 'cash';
      byMethod[m] = (byMethod[m] || 0) + (s.totalAmount || 0);
    });

    // 3. ລາຍຈ່າຍ
    const filteredExpenses = expenses.filter(e => e.date && inRange(e.date + 'T12:00:00'));
    const expenseTotal = filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

    const total = roomTotal + activityTotal;
    return {
      total,
      roomTotal,
      activityTotal,
      refundTotal,
      expenseTotal,
      profit: total - expenseTotal,
      count: filteredBookings.length,
      activityCount: filteredActivities.length,
      byMethod,
      bookings: filteredBookings,
      activities: filteredActivities,
      expenses: filteredExpenses,
      startDate,
      endDate,
    };
  };

  const updateActivity = (id, data) => {
    setGuestActivities(prev => {
      const base = prev.length ? prev : initialActivities;
      return base.map(a => a.id === id ? { ...a, ...data } : a);
    });
    logAudit(null, 'activity.update', `ແກ້ໄຂຂໍ້ມູນກິດຈະກຳ ${id}`);
  };

  const setHotelInfo = (data) => {
    setHotelInfoState(data);
    logAudit(null, 'hotel.update', 'ແກ້ໄຂຂໍ້ມູນຣີສອດ/ປະຫວັດ');
  };

  // ================== PUBLIC (ລູກຄ້າ) ACTIONS ==================
  const submitOnlineBooking = async (data) => {
    const res = await api('/api/public/bookings', { method: 'POST', body: data, auth: false });
    loadCatalog();
    return res.booking;
  };
  const submitOnlineActivityBooking = async (data) => {
    const res = await api('/api/public/activity-bookings', { method: 'POST', body: data, auth: false });
    return res.sale;
  };
  const fetchPublicBooking = async (id, token) => {
    const res = await api(`/api/public/bookings/${encodeURIComponent(id)}?t=${encodeURIComponent(token || '')}`, { auth: false });
    return res.booking;
  };
  const signPublicBooking = async (id, token, signatureDataUrl) => {
    const res = await api(`/api/public/bookings/${encodeURIComponent(id)}/signature?t=${encodeURIComponent(token || '')}`, {
      method: 'POST', body: { signatureDataUrl }, auth: false,
    });
    return res.booking;
  };

  // ================== I18N ==================
  const [lang, setLangState] = useState(() => localStorage.getItem('app_lang') || 'lo');
  const changeLang = (l) => {
    setLangState(l);
    localStorage.setItem('app_lang', l);
  };
  const t = (key, replaceObj = {}) => {
    let s = TRANSLATIONS[lang]?.[key] || TRANSLATIONS['lo']?.[key] || key;
    if (typeof s !== 'string') return key;
    Object.entries(replaceObj).forEach(([k, v]) => { s = s.replace(`{${k}}`, v); });
    return s;
  };

  return (
    <HotelContext.Provider value={{
      rooms, bookings, hotelInfo, guestActivities, activitySales, shiftCloses, expenses, maintenanceLogs, ratePlans,
      isStaff, dataReady, dataError, syncStatus, pendingOnlineCount, retrySync: startSync, loadCatalog,
      updateRoom, setRoomStatus, addRoom, deleteRoom, markClean,
      isRoomAvailableForDates, getRoomStatusOnDate, quoteStay,
      createBooking, updateBooking, checkIn, checkOut, cancelBooking, markNoShow,
      confirmBooking, rejectBooking, addExtraChargeToBooking, getPaidTotal, getBookingPayments,
      getBookingForRoom, getActiveBookingForRoom,
      addActivitySale, updateActivitySale, cancelActivitySale, updateActivity,
      addShiftClose,
      addExpense, updateExpense, deleteExpense,
      reportMaintenance, resolveMaintenance,
      saveRatePlan, deleteRatePlan,
      getStats, getRevenue, getPeriodRange,
      setHotelInfo,
      submitOnlineBooking, submitOnlineActivityBooking, fetchPublicBooking, signPublicBooking,
      lang, changeLang, t,
    }}>
      {children}
    </HotelContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useHotel = () => {
  const ctx = useContext(HotelContext);
  if (!ctx) throw new Error('useHotel must be inside HotelProvider');
  return ctx;
};
