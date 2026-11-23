import CancelBookingModal from '../components/CancelBookingModal';
import { useState, useMemo } from 'react';
import { useHotel } from '../context/HotelContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import {
  ROOM_TYPES,
  BOOKING_STATUS_META,
  STATUS_EMOJI,
  STATUS_LABELS,
  PAYMENT_METHODS,
  formatCurrency,
  formatDate,
  daysBetween,
  todayStr,
  addDays,
} from '../data/initialData';
import PrintReceipt from '../components/PrintReceipt';
import CheckInModal from '../components/CheckInModal';
import CheckOutModal from '../components/CheckOutModal';
import CheckInRegistrationModal from '../components/CheckInRegistrationModal';
import CashierShiftCloseModal from '../components/CashierShiftCloseModal';

const EXTRA_PRESETS = [
  { desc: 'ຕຽງເສີມ (Extra Bed)', descEn: 'Extra Bed', amount: 100000 },
  { desc: 'ອາຫານເຊົ້າ (Breakfast)', descEn: 'Breakfast', amount: 50000 },
  { desc: 'ນ້ຳດື່ມ (Drinks)', descEn: 'Drinks', amount: 20000 },
];

const ROOM_TYPE_SHORT = {
  standard: 'Standard',
  superior: 'Superior',
  deluxe: 'Deluxe',
  suite: 'Suite',
  family: 'Family',
};

const STATUS_LABELS_EN = {
  available: 'Available',
  booked: 'Booked',
  occupied: 'Occupied',
  waiting_checkin: 'Pending',
  cleaning: 'Cleaning',
  maintenance: 'Maint.',
};

const BOOKING_STATUS_EN = {
  pending: 'Pending',
  booked: 'Booked',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled',
  no_show: 'No-Show',
};

const PAY_METHOD_EN = {
  cash: 'Cash',
  transfer: 'Transfer',
  qr: 'QR Code',
  card: 'Card',
};

const PAYMENT_OPTIONS = [
  { key: 'cash', icon: '💵', lo: 'ສົດ', en: 'Cash' },
  { key: 'transfer', icon: '🏦', lo: 'ໂອນ', en: 'Transfer' },
  { key: 'qr', icon: '📱', lo: 'QR', en: 'QR' },
  { key: 'card', icon: '💳', lo: 'ບັດ', en: 'Card' },
];

export default function CashierPage({ navigate }) {
  const {
    rooms,
    bookings,
    activitySales,
    shiftCloses,
    quoteStay,
    getBookingPayments,
    getRoomStatusOnDate,
    isRoomAvailableForDates,
    createBooking,
    cancelBooking,
    markClean,
    confirmBooking,
    lang,
  } = useHotel();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const isEn = lang === 'en';
  const L = (lo, en) => (isEn ? en : lo);

  const today = todayStr();
  const tomorrow = addDays(today, 1);

  // Left view switch & filters
  const [leftTab, setLeftTab] = useState('rooms'); // 'rooms' | 'bills'
  const [viewDate, setViewDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchRoom, setSearchRoom] = useState('');
  const [billSearch, setBillSearch] = useState('');

  // Active selected room & mode
  const [selectedRoomId, setSelectedRoomId] = useState(() => {
    const firstAvail = rooms.find(r => getRoomStatusOnDate(r.id, today).status === 'available');
    return firstAvail?.id || rooms[0]?.id || '';
  });
  const [extraRoomIds, setExtraRoomIds] = useState([]);
  const [showMultiRoomPicker, setShowMultiRoomPicker] = useState(false);
  const [forceBookingForm, setForceBookingForm] = useState(false);

  // POS checkout fields
  const [saleMode, setSaleMode] = useState('checkin'); // 'checkin' | 'booking'
  const [checkInDate, setCheckInDate] = useState(today);
  const [checkOutDate, setCheckOutDate] = useState(tomorrow);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [passportNo, setPassportNo] = useState('');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [guestNationality, setGuestNationality] = useState('ລາວ');
  const [guestCount, setGuestCount] = useState(2);
  const [channel, setChannel] = useState('walkin');
  const [discount, setDiscount] = useState('');
  const [deposit, setDeposit] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [extras, setExtras] = useState([]);
  const [notes, setNotes] = useState('');
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Modals
  const [receiptModal, setReceiptModal] = useState(null);
  const [checkInTarget, setCheckInTarget] = useState(null);
  const [checkOutTarget, setCheckOutTarget] = useState(null);
  const [regTarget, setRegTarget] = useState(null);
  const [cancelTargetBooking, setCancelTargetBooking] = useState(null);
  const [showShiftCloseModal, setShowShiftCloseModal] = useState(false);
  const [shiftRefresh, setRefreshShift] = useState(0);

  const closedShiftForDate = useMemo(() => {
    return (shiftCloses || []).find(s => s.date === viewDate) || null;
  }, [viewDate, shiftCloses]);

  const roomEntries = useMemo(() => {
    return rooms.map(room => {
      const info = getRoomStatusOnDate(room.id, viewDate);
      return { room, status: info.status, booking: info.booking };
    });
  }, [rooms, viewDate, getRoomStatusOnDate]);

  const counts = useMemo(() => {
    const res = { all: roomEntries.length, available: 0, occupied: 0, booked: 0, cleaning: 0 };
    roomEntries.forEach(e => {
      if (e.status === 'waiting_checkin') res.booked += 1;
      else if (res[e.status] !== undefined) res[e.status] += 1;
    });
    return res;
  }, [roomEntries]);

  const filteredRoomEntries = useMemo(() => {
    const q = searchRoom.trim().toLowerCase();
    return roomEntries.filter(({ room, status, booking }) => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'booked') {
          if (status !== 'booked' && status !== 'waiting_checkin') return false;
        } else if (status !== statusFilter) {
          return false;
        }
      }
      if (q) {
        const hay = `${room.number} ${ROOM_TYPES[room.type] || ''} ${booking?.guestName || ''} ${booking?.id || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [roomEntries, statusFilter, searchRoom]);

  const todayStats = useMemo(() => {
    const todayBookings = bookings.filter(b => {
      if (['cancelled', 'no_show', 'pending'].includes(b.status)) return false;
      const ref = (b.checkedInAt || b.createdAt || '').slice(0, 10);
      return ref === today;
    });
    const roomRevenue = todayBookings.reduce((sum, b) => {
      if (b.finalTotal !== undefined && b.finalTotal !== null) return sum + b.finalTotal;
      const ex = (b.extraCharges || []).reduce((s, e) => s + Number(e.amount || 0), 0);
      return sum + (b.totalAmount || 0) + ex;
    }, 0);
    const actTotal = activitySales
      .filter(s => s.status !== 'cancelled' && !s.chargeToBookingId && (s.createdAt || s.date || '').slice(0, 10) === today)
      .reduce((s, a) => s + (a.totalAmount || 0), 0);
    return {
      billCount: todayBookings.length,
      totalRevenue: roomRevenue + actTotal,
    };
  }, [bookings, activitySales, today]);

  const selectedEntry = roomEntries.find(e => e.room.id === selectedRoomId) || roomEntries[0] || null;
  const selectedRoom = selectedEntry?.room || null;
  const selectedStatus = selectedEntry?.status || 'available';
  const selectedBooking = selectedEntry?.booking || null;

  const nights = checkInDate && checkOutDate && checkOutDate > checkInDate
    ? Math.max(1, daysBetween(checkInDate, checkOutDate))
    : 1;

  const allSelectedRooms = useMemo(() => {
    if (!selectedRoom) return [];
    const extrasList = extraRoomIds
      .filter(id => id !== selectedRoom.id)
      .map(id => rooms.find(r => r.id === id))
      .filter(r => r && isRoomAvailableForDates(r.id, checkInDate, checkOutDate));
    return [selectedRoom, ...extrasList];
  }, [selectedRoom, extraRoomIds, rooms, isRoomAvailableForDates, checkInDate, checkOutDate]);

  const roomSubtotal = allSelectedRooms.reduce((sum, r) => sum + (quoteStay ? quoteStay(r, checkInDate, checkOutDate).total : (r.price || 0) * nights), 0);
  const validExtras = extras.filter(e => e.desc.trim() && Number(e.amount) > 0);
  const extrasTotal = validExtras.reduce((sum, e) => sum + Number(e.amount), 0);
  const discountNum = Math.max(0, Number(discount || 0));
  const roomNetTotal = Math.max(0, roomSubtotal - discountNum);
  const grandTotal = roomNetTotal + extrasTotal;

  const isSelectedRoomAvailable = selectedRoom
    ? isRoomAvailableForDates(selectedRoom.id, checkInDate, checkOutDate)
    : false;

  const effectiveDeposit = saleMode === 'checkin'
    ? grandTotal
    : Math.min(grandTotal, Math.max(0, Number(deposit || 0)));
  const dueNow = saleMode === 'checkin' ? grandTotal : effectiveDeposit;
  const remainingLater = Math.max(0, grandTotal - dueNow);

  const cashReceivedNum = Number(cashReceived || 0);
  const changeDue = payMethod === 'cash' && cashReceivedNum > 0
    ? cashReceivedNum - dueNow
    : 0;

  const recentBills = useMemo(() => {
    const q = billSearch.trim().toLowerCase();
    return [...bookings]
      .filter(b => !['cancelled', 'no_show'].includes(b.status))
      .filter(b => {
        if (!q) return true;
        return `${b.id} ${b.guestName} ${b.roomId} ${b.guestPhone || ''}`.toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 25);
  }, [bookings, billSearch]);

  const setNightsCount = (n) => {
    const clamped = Math.max(1, Math.min(30, n));
    const base = checkInDate || today;
    setCheckInDate(base);
    setCheckOutDate(addDays(base, clamped));
  };

  const handleSelectRoom = (entry) => {
    setSelectedRoomId(entry.room.id);
    setExtraRoomIds(prev => prev.filter(id => id !== entry.room.id));
    setForceBookingForm(false);
    if (entry.status === 'available' && viewDate >= today) {
      setCheckInDate(viewDate);
      setCheckOutDate(addDays(viewDate, nights));
    }
  };

  const resetPosForm = (excludeIds = []) => {
    const excluded = Array.isArray(excludeIds) ? excludeIds : [excludeIds];
    setGuestName('');
    setGuestPhone('');
    setPassportNo('');
    setDob('');
    setEmail('');
    setAddress('');
    setDiscount('');
    setDeposit('');
    setCashReceived('');
    setExtras([]);
    setNotes('');
    setExtraRoomIds([]);
    setShowMultiRoomPicker(false);
    setShowMoreOptions(false);
    setForceBookingForm(false);
    setCheckInDate(today);
    setCheckOutDate(addDays(today, 1));
    const nextAvail = rooms.find(r => !excluded.includes(r.id) && isRoomAvailableForDates(r.id, today, addDays(today, 1)));
    if (nextAvail) setSelectedRoomId(nextAvail.id);
  };

  const handleCompleteSale = (e) => {
    e.preventDefault();
    if (!selectedRoom) {
      toast(L('ກະລຸນາເລືອກຫ້ອງກ່ອນ', 'Please select a room first'), 'warning');
      return;
    }
    if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) {
      toast(L('ວັນອອກຕ້ອງຫຼັງວັນເຂົ້າພັກ', 'Check-out must be after Check-in'), 'warning');
      return;
    }
    if (!isSelectedRoomAvailable) {
      toast(L(`ຫ້ອງ ${selectedRoom.number} ບໍ່ວ່າງໃນວັນທີນີ້`, `Room ${selectedRoom.number} unavailable for these dates`), 'error');
      return;
    }
    if (saleMode === 'checkin' && payMethod === 'cash' && cashReceived !== '' && cashReceivedNum < dueNow) {
      toast(L('ເງິນສົດທີ່ຮັບມາຍັງບໍ່ພໍ', 'Cash received is less than total due'), 'warning');
      return;
    }

    const isDirectCheckIn = saleMode === 'checkin';
    const isMulti = allSelectedRooms.length > 1;
    const groupId = isMulti ? `GRP-${Date.now().toString().slice(-6)}` : null;
    const groupRoomsMeta = isMulti
      ? allSelectedRooms.map(r => ({
        roomId: r.id,
        number: r.number,
        type: r.type,
        price: r.price,
        nights,
        subtotal: r.price * nights,
      }))
      : null;

    let primaryCreated = null;
    allSelectedRooms.forEach((rm, idx) => {
      const rmQuote = quoteStay ? quoteStay(rm, checkInDate, checkOutDate) : { nights, total: rm.price * nights, hasAdjustment: false, nightly: [] };
      const rmSubtotal = rmQuote.total;
      const rmDiscount = idx === 0 ? discountNum : 0;
      const rmNet = Math.max(0, rmSubtotal - rmDiscount);
      const rmExtras = idx === 0 ? validExtras.map(ex => ({ desc: ex.desc.trim(), amount: Number(ex.amount) })) : [];
      const rmExtrasSum = rmExtras.reduce((s, x) => s + Number(x.amount || 0), 0);
      const rmTotalWithExtras = rmNet + rmExtrasSum;
      const rmDeposit = isDirectCheckIn
        ? rmTotalWithExtras
        : (idx === 0 ? Math.min(rmTotalWithExtras, dueNow) : 0);

      const b = createBooking({
        guestName: guestName.trim() || (isEn ? 'Walk-in Guest' : 'ແຂກ Walk-in'),
        guestPhone: guestPhone.trim() || '-',
        passportNo: passportNo.trim().toUpperCase(),
        dob,
        email: email.trim(),
        address: address.trim(),
        guestNationality: guestNationality || 'ລາວ',
        guestCount: Number(guestCount) || 1,
        roomId: rm.id,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        nights,
        roomPrice: rm.price,
        nightlyRates: rmQuote?.hasAdjustment ? rmQuote.nightly.map(n => ({ date: n.date, price: n.price, plan: n.plan?.name || null })) : undefined,
        discount: rmDiscount,
        totalAmount: rmNet,
        deposit: rmDeposit,
        remainingAmount: isDirectCheckIn ? 0 : Math.max(0, rmTotalWithExtras - rmDeposit),
        paymentMethod: payMethod,
        bookedByStaff: currentUser?.name || (isEn ? 'Cashier' : 'ແຄັດເຊຍ'),
        bookingChannel: channel,
        notes: notes.trim(),
        isDirectCheckIn,
        status: isDirectCheckIn ? 'checked_in' : 'booked',
        extraCharges: rmExtras,
        ...(isMulti ? {
          groupId,
          groupRooms: groupRoomsMeta,
          groupTotalAmount: grandTotal,
          groupDiscount: discountNum,
          groupPaidAmount: dueNow,
          groupRemainingAmount: isDirectCheckIn ? 0 : remainingLater,
        } : {}),
      });
      if (idx === 0) primaryCreated = b;
    });

    const roomNumsStr = allSelectedRooms.map(r => r.number).join(', ');
    toast(
      isEn
        ? `✅ ${isDirectCheckIn ? 'Sold' : 'Booked'} Room ${roomNumsStr} (${primaryCreated.id})`
        : `✅ ${isDirectCheckIn ? 'ຂາຍຫ້ອງ' : 'ຈອງຫ້ອງ'} ${roomNumsStr} ສຳເລັດ!`,
      'success'
    );

    if (saleMode === 'booking') {
      // ຍືນຢັນການຈອງ: ເປີດໃບຢືນຢັນການຈອງ ແລະ ໃບລົງທະບຽນ A4 ພ້ອມລາຍເຊັນທັນທີ (ເພື່ອເຊັນ ແລະ ສົ່ງໃຫ້ແຂກ)
      setRegTarget({ booking: primaryCreated, room: selectedRoom });
    } else {
      setReceiptModal({
        booking: primaryCreated,
        room: selectedRoom,
        type: 'sale',
        paidAmount: dueNow,
        payMethod,
        cashReceived: payMethod === 'cash' && cashReceivedNum > 0 ? cashReceivedNum : 0,
        changeAmount: payMethod === 'cash' && cashReceivedNum > 0 ? Math.max(0, cashReceivedNum - dueNow) : 0,
      });
    }

    resetPosForm(allSelectedRooms.map(r => r.id));
  };

  const openExistingReceipt = (booking, roomObj = null) => {
    const rm = roomObj || rooms.find(r => r.id === booking.roomId);
    const receiptType = booking.status === 'checked_out'
      ? 'checkout'
      : booking.status === 'checked_in'
        ? 'checkin'
        : 'booking';
    const paid = booking.status === 'checked_out'
      ? (booking.finalPaymentAmount ?? 0)
      : (Number(booking.deposit || 0) + Number(booking.remainingPaid || 0));
    setReceiptModal({
      booking,
      room: rm,
      type: receiptType,
      paidAmount: paid,
      payMethod: booking.finalPaymentMethod || booking.remainingPaymentMethod || booking.paymentMethod || 'cash',
      cashReceived: 0,
      changeAmount: 0,
    });
  };

  const showRoomStatusActions = selectedRoom && !forceBookingForm && selectedStatus !== 'available';

  return (
    <div className="page-container">
      <div className="cashier-pos-layout">
        {/* LEFT COLUMN: Clean 24-Room Grid or Bills Tab */}
        <div className="card" style={{ padding: '14px 16px', minWidth: 0 }}>
          {/* Compact Top Tabs + Date + Daily Total */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            paddingBottom: '12px',
            marginBottom: '12px',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className={`btn btn-sm ${leftTab === 'rooms' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setLeftTab('rooms')}
              >
                🏨 {L(`ຂາຍຫ້ອງ (${rooms.length})`, `Rooms (${rooms.length})`)}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${leftTab === 'bills' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setLeftTab('bills')}
              >
                🧾 {L('ບິນ / ພິມຄືນ', 'Bills / Reprint')}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="date"
                className="form-input"
                style={{ width: 'auto', padding: '4px 9px', fontSize: '0.82rem' }}
                value={viewDate}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setViewDate(e.target.value);
                  setCheckInDate(e.target.value);
                  setCheckOutDate(addDays(e.target.value, nights));
                }}
              />
              <span style={{
                padding: '4px 10px',
                borderRadius: '8px',
                background: '#ecfdf5',
                border: '1px solid #86efac',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#15803d',
              }}>
                💵 {formatCurrency(todayStats.totalRevenue)} ({todayStats.billCount})
              </span>
              {closedShiftForDate ? (
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    background: '#ecfdf5',
                    color: '#15803d',
                    border: '1.5px solid #86efac',
                    fontWeight: 800,
                    boxShadow: '0 2px 6px rgba(21, 128, 61, 0.15)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  onClick={() => setShowShiftCloseModal(true)}
                  title="ວັນທີນີ້ປິດກະແລ້ວ — ກົດເພື່ອເບິ່ງ/ພິມໃບສະຫຼຸບປິດກະ"
                >
                  ✅ {L('ປິດກະແລ້ວ', 'Shift Closed')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    background: 'linear-gradient(135deg, #15803d, #166534)',
                    color: '#fff',
                    fontWeight: 800,
                    boxShadow: '0 2px 6px rgba(21, 128, 61, 0.25)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  onClick={() => setShowShiftCloseModal(true)}
                  title="ປິດກະ ແລະ ໄລ່ເງິນປະຈຳວັນ"
                >
                  🔒 {L('ປິດກະ / ໄລ່ເງິນ', 'Close Shift')}
                </button>
              )}
              {navigate && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('booking')}>
                  📋 {L('ຕາຕະລາງ 1..31', 'Sheet 1..31')}
                </button>
              )}
            </div>
          </div>

          {leftTab === 'rooms' ? (
            <>
              {/* Friendly Staff Quick Guide Banner */}
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: '8px',
                padding: '7px 12px',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                fontSize: '0.8rem',
                color: '#166534',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.1rem' }}>💡</span>
                  <strong style={{ color: '#14532d' }}>{L('ວິທີຂາຍງ່າຍໆ 3 ຂັ້ນຕອນ:', '3 Simple Steps:')}</strong>
                  <span>{L('① ກົດເລືອກຫ້ອງສີຂຽວ', '① Click Green Room')}</span>
                  <span>➜</span>
                  <span>{L('② ປ້ອນຊື່ລູກຄ້າ (ເບື້ອງຂວາ)', '② Enter Guest Name')}</span>
                  <span>➜</span>
                  <span>{L('③ ກົດປຸ່ມໃຫຍ່ສີຂຽວຮັບເງິນ & ປິ່ນບິນ!', '③ Click Green Button to Pay & Print!')}</span>
                </div>
              </div>

              {/* Slim Status Pills + Search */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                <div className="filter-tabs" style={{ marginBottom: 0 }}>
                  <button type="button" className={`filter-tab ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>
                    {L('ທັງໝົດ', 'All')} <span className="filter-tab-count">{counts.all}</span>
                  </button>
                  <button type="button" className={`filter-tab ${statusFilter === 'available' ? 'active' : ''}`} onClick={() => setStatusFilter('available')}>
                    🟢 {L('ວ່າງ', 'Avail')} <span className="filter-tab-count">{counts.available}</span>
                  </button>
                  <button type="button" className={`filter-tab ${statusFilter === 'occupied' ? 'active' : ''}`} onClick={() => setStatusFilter('occupied')}>
                    🔴 {L('ພັກຢູ່', 'Busy')} <span className="filter-tab-count">{counts.occupied}</span>
                  </button>
                  <button type="button" className={`filter-tab ${statusFilter === 'booked' ? 'active' : ''}`} onClick={() => setStatusFilter('booked')}>
                    🔵 {L('ຈອງ', 'Booked')} <span className="filter-tab-count">{counts.booked}</span>
                  </button>
                  {counts.cleaning > 0 && (
                    <button type="button" className={`filter-tab ${statusFilter === 'cleaning' ? 'active' : ''}`} onClick={() => setStatusFilter('cleaning')}>
                      🟣 {counts.cleaning}
                    </button>
                  )}
                </div>

                <input
                  className="form-input"
                  style={{ width: '160px', padding: '5px 10px', fontSize: '0.82rem' }}
                  placeholder={L('🔍 ຄົ້ນຫາຫ້ອງ/ແຂກ...', '🔍 Room/Guest...')}
                  value={searchRoom}
                  onChange={(e) => setSearchRoom(e.target.value)}
                />
              </div>

              {/* Clean Minimal 24-Room Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))',
                gap: '8px',
              }}>
                {filteredRoomEntries.map((entry) => {
                  const { room, status, booking } = entry;
                  const isSelected = selectedRoom?.id === room.id;
                  const statusColor = status === 'available'
                    ? '#16a34a'
                    : status === 'occupied'
                      ? '#dc2626'
                      : status === 'booked'
                        ? '#2563eb'
                        : status === 'waiting_checkin'
                          ? '#d97706'
                          : status === 'cleaning'
                            ? '#9333ea'
                            : '#64748b';
                  const tileBg = isSelected
                    ? '#ecfdf5'
                    : status === 'available'
                      ? '#ffffff'
                      : status === 'occupied'
                        ? '#fef2f2'
                        : status === 'booked'
                          ? '#eff6ff'
                          : '#f8fafc';

                  return (
                    <div
                      key={room.id}
                      onClick={() => handleSelectRoom(entry)}
                      style={{
                        borderRadius: '10px',
                        borderStyle: 'solid',
                        borderWidth: isSelected ? '3px 2px 2px 2px' : '3px 1px 1px 1px',
                        borderColor: isSelected
                          ? `${statusColor} #183D2D #183D2D #183D2D`
                          : `${statusColor} ${statusColor}33 ${statusColor}33 ${statusColor}33`,
                        background: tileBg,
                        padding: '8px 10px',
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 0 0 2px rgba(24, 61, 45, 0.2)' : 'none',
                        transition: 'transform 0.1s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.02rem', color: 'var(--text-primary)' }}>
                          {room.number}
                        </span>
                        <span style={{ fontSize: '0.78rem' }} title={isEn ? STATUS_LABELS_EN[status] : STATUS_LABELS[status]}>
                          {STATUS_EMOJI[status]}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                        {ROOM_TYPE_SHORT[room.type] || room.type}
                      </div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#b45309', marginTop: '2px' }}>
                        {formatCurrency(room.price)}
                      </div>
                      {booking && (
                        <div style={{
                          marginTop: '3px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: statusColor,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {booking.guestName}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Bills / Reprint Tab */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  {L('ກົດ 🖨️ ພິມບິນ ເພື່ອອອກໃບບິນ 2 ພາສາ (ລາວ + EN)', 'Click 🖨️ Print to print bilingual Lao + English receipt')}
                </span>
                <input
                  className="form-input"
                  style={{ width: '200px', padding: '5px 10px', fontSize: '0.82rem' }}
                  placeholder={L('🔍 ຄົ້ນຫາບິນ/ຊື່ແຂກ...', '🔍 Search bill/guest...')}
                  value={billSearch}
                  onChange={(e) => setBillSearch(e.target.value)}
                />
              </div>

              {recentBills.length === 0 ? (
                <div className="empty-state" style={{ padding: '32px 12px' }}>
                  <div>{L('ຍັງບໍ່ມີບິນ', 'No bills yet')}</div>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{L('ເລກບິນ', 'Bill ID')}</th>
                        <th>{L('ຫ້ອງ', 'Room')}</th>
                        <th>{L('ລູກຄ້າ', 'Guest')}</th>
                        <th>{L('ຍອດລວມ', 'Total')}</th>
                        <th>{L('ສະຖານະ', 'Status')}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentBills.map(b => {
                        const rm = rooms.find(r => r.id === b.roomId);
                        const meta = BOOKING_STATUS_META[b.status] || { label: b.status, color: '#64748b' };
                        const exSum = (b.extraCharges || []).reduce((s, x) => s + Number(x.amount || 0), 0);
                        const billTotal = b.finalTotal ?? ((b.totalAmount || 0) + exSum);
                        const methodKey = b.finalPaymentMethod || b.paymentMethod || 'cash';
                        return (
                          <tr key={b.id}>
                            <td style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.78rem' }}>{b.id}</td>
                            <td style={{ fontWeight: 700 }}>{rm?.number || b.roomId}</td>
                            <td>{b.guestName}</td>
                            <td style={{ fontWeight: 700, color: '#b45309' }}>
                              {formatCurrency(billTotal)}
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                {isEn ? (PAY_METHOD_EN[methodKey] || methodKey) : (PAYMENT_METHODS[methodKey] || 'ເງິນສົດ')}
                              </div>
                            </td>
                            <td style={{ fontSize: '0.76rem', fontWeight: 700, color: meta.color }}>
                              {isEn ? (BOOKING_STATUS_EN[b.status] || b.status) : meta.label}
                            </td>
                            <td>
                              <button type="button" className="btn btn-primary btn-sm" onClick={() => openExistingReceipt(b, rm)}>
                                🖨️ {L('ພິມບິນ', 'Print')}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Compact 1-Screen POS Counter */}
        <div className="card cashier-pos-counter" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: '12px' }}>
          {/* Compact Room Header */}
          <div style={{
            background: '#183D2D',
            color: '#fff',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}>
            <div>
              <div style={{ fontSize: '1.08rem', fontWeight: 800 }}>
                {allSelectedRooms.length > 1
                  ? `${L('ຫ້ອງ', 'Rooms')} ${allSelectedRooms.map(r => r.number).join(', ')} (${allSelectedRooms.length} ${L('ຫ້ອງ', 'Rms')})`
                  : selectedRoom
                    ? `${L(`ຫ້ອງ ${selectedRoom.number}`, `Room ${selectedRoom.number}`)} · ${ROOM_TYPE_SHORT[selectedRoom.type] || selectedRoom.type}`
                    : L('ເລືອກຫ້ອງ', 'Select Room')}
              </div>
              <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>
                {allSelectedRooms.length > 1
                  ? `${formatCurrency(allSelectedRooms.reduce((s, r) => s + r.price, 0))} / ${L('ຄືນ (ລວມ)', 'night (total)')}`
                  : selectedRoom ? `${formatCurrency(selectedRoom.price)} / ${L('ຄືນ', 'night')}` : '-'}
              </div>
            </div>
            <span style={{
              padding: '3px 9px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.16)',
              fontSize: '0.76rem',
              fontWeight: 700,
            }}>
              {STATUS_EMOJI[selectedStatus]} {isEn ? STATUS_LABELS_EN[selectedStatus] : STATUS_LABELS[selectedStatus]}
            </span>
          </div>

          {/* CASE A: Occupied / Booked / Pending / Cleaning Quick Action Panel */}
          {showRoomStatusActions ? (
            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {selectedStatus === 'cleaning' ? (
                <>
                  <div style={{ padding: '14px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.6rem', marginBottom: '4px' }}>🧹</div>
                    <div style={{ fontWeight: 700, color: '#6b21a8' }}>
                      {L(`ຫ້ອງ ${selectedRoom.number} ກຳລັງອະນາໄມ`, `Room ${selectedRoom.number} is Cleaning`)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    style={{ width: '100%', fontWeight: 700 }}
                    onClick={() => {
                      markClean(selectedRoom.id);
                      toast(L(`✨ ຫ້ອງ ${selectedRoom.number} ພ້ອມຂາຍແລ້ວ`, `✨ Room ${selectedRoom.number} ready`), 'success');
                    }}
                  >
                    ✨ {L('ໝາຍສະອາດ — ພ້ອມຂາຍ', 'Mark Clean & Ready')}
                  </button>
                </>
              ) : selectedStatus === 'maintenance' ? (
                <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  ⚫ {L('ຫ້ອງປິດສ້ອມແປງ', 'Room Under Maintenance')}
                </div>
              ) : selectedBooking ? (
                <>
                  <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>#{selectedBooking.id}</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>👤 {selectedBooking.guestName}</div>
                    {selectedBooking.guestPhone && selectedBooking.guestPhone !== '-' && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>📞 {selectedBooking.guestPhone}</div>
                    )}
                    <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                      📅 {formatDate(selectedBooking.checkIn)} → {formatDate(selectedBooking.checkOut)} ({selectedBooking.nights} {L('ຄືນ', 'N')})
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed var(--border)', fontWeight: 700 }}>
                      <span>{L('ຍອດລວມ:', 'Total:')}</span>
                      <span style={{ color: '#b45309' }}>{formatCurrency(selectedBooking.totalAmount)}</span>
                    </div>
                    {selectedBooking.remainingAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#dc2626', fontSize: '0.84rem' }}>
                        <span>{L('ຄ້າງຈ່າຍ:', 'Balance Due:')}</span>
                        <span>{formatCurrency(selectedBooking.remainingAmount)}</span>
                      </div>
                    )}
                  </div>

                  {selectedStatus === 'occupied' && (
                    <button
                      type="button"
                      className="btn btn-warning btn-lg"
                      style={{ width: '100%', fontWeight: 800 }}
                      onClick={() => setCheckOutTarget({ booking: selectedBooking, room: selectedRoom })}
                    >
                      🚪 {L('ກົດ Check-out', 'Check-out Room')}
                    </button>
                  )}

                  {selectedStatus === 'booked' && (
                    <>
                      <button
                        type="button"
                        className="btn"
                        style={{ width: '100%', fontWeight: 800, background: '#d96528', color: '#fff', padding: '11px', fontSize: '0.92rem' }}
                        onClick={() => setRegTarget({ booking: selectedBooking, room: selectedRoom })}
                      >
                        📝 {selectedBooking.signatureDataUrl
                          ? L('ໃບຢືນຢັນການຈອງ (✅ ເຊັນແລ້ວ - ສົ່ງໃຫ້ແຂກ)', 'Booking Confirmation (✅ Signed - Send to Guest)')
                          : L('ເປີດໃບຢືນຢັນການຈອງ & ລາຍເຊັນ (ສົ່ງໃຫ້ແຂກ)', 'Open Booking Confirmation & Sign (Send to Guest)')}
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary btn-lg"
                        style={{ width: '100%', fontWeight: 800 }}
                        onClick={() => setCheckInTarget({ booking: selectedBooking, room: selectedRoom })}
                      >
                        🛎️ {L('Check-in ຮັບຫ້ອງ & ພິມໃບບິນ', 'Check-in & Receipt')}
                      </button>
                    </>
                  )}

                  {selectedStatus === 'waiting_checkin' && (
                    <button
                      type="button"
                      className="btn btn-success btn-lg"
                      style={{ width: '100%', fontWeight: 800 }}
                      onClick={() => {
                        confirmBooking(selectedBooking.id);
                        toast(`✅ ${L('ຢືນຢັນແລ້ວ', 'Confirmed')} (${selectedBooking.id})`, 'success');
                      }}
                    >
                      ✅ {L('ຢືນຢັນການຈອງ', 'Confirm Booking')}
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ width: '100%', fontWeight: 700 }}
                    onClick={() => openExistingReceipt(selectedBooking, selectedRoom)}
                  >
                    🖨️ {L('ພິມໃບບິນ (ລາວ + English)', 'Print Receipt (Lao + EN)')}
                  </button>

                  {selectedStatus === 'occupied' && (
                    <button
                      type="button"
                      className="btn"
                      style={{ width: '100%', fontWeight: 700, background: '#d96528', color: '#fff' }}
                      onClick={() => setRegTarget({ booking: selectedBooking, room: selectedRoom })}
                    >
                      📱 {selectedBooking.signatureDataUrl
                        ? L('ໃບລົງທະບຽນ iPad (✅ ເຊັນແລ້ວ)', 'iPad Registration (✅ Signed)')
                        : L('ເປີດຟອມລົງທະບຽນ iPad & ເຊັນຊື່', 'Open iPad Registration & Sign')}
                    </button>
                  )}

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ flex: 1, border: '1px solid var(--border)' }}
                      onClick={() => {
                        setForceBookingForm(true);
                        setSaleMode('booking');
                        const nextFree = selectedBooking.checkOut > today ? selectedBooking.checkOut : tomorrow;
                        setCheckInDate(nextFree);
                        setCheckOutDate(addDays(nextFree, 1));
                      }}
                    >
                      ➕ {L('ຈອງວັນຕໍ່ໄປ', 'Book Next Dates')}
                    </button>
                    {selectedStatus === 'booked' && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => setCancelTargetBooking(selectedBooking)}
                      >
                        ✕ {L('ຍົກເລີກ', 'Cancel')}
                      </button>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          ) : (
                        /* CASE B: Easy 3-Step Guided POS Form */
            <form onSubmit={handleCompleteSale} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {forceBookingForm && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ alignSelf: 'flex-start', padding: '2px 8px' }}
                  onClick={() => setForceBookingForm(false)}
                >
                  ← {L('ກັບໄປເບິ່ງຂໍ້ມູນແຂກປັດຈຸບັນ', 'Back to current stay')}
                </button>
              )}

              {/* Mode Selection: Walk-in vs Advance Booking */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setSaleMode('checkin')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '10px',
                    border: saleMode === 'checkin' ? '2px solid #16a34a' : '1px solid var(--border)',
                    background: saleMode === 'checkin' ? '#dcfce7' : '#fff',
                    color: saleMode === 'checkin' ? '#14532d' : 'var(--text-secondary)',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    boxShadow: saleMode === 'checkin' ? '0 2px 8px rgba(22, 163, 74, 0.2)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span style={{ fontSize: '0.92rem' }}>⚡ {L('ເຂົ້າພັກເລີຍ', 'Check-in Now')}</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, opacity: 0.85 }}>
                    {L('(ແຂກ Walk-in ມາຮອດມື້ນີ້)', '(Guest arrived today)')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSaleMode('booking')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '10px',
                    border: saleMode === 'booking' ? '2px solid #2563eb' : '1px solid var(--border)',
                    background: saleMode === 'booking' ? '#dbeafe' : '#fff',
                    color: saleMode === 'booking' ? '#1e3a8a' : 'var(--text-secondary)',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    boxShadow: saleMode === 'booking' ? '0 2px 8px rgba(37, 99, 235, 0.2)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span style={{ fontSize: '0.92rem' }}>📝 {L('ຈອງລ່ວງໜ້າ', 'Advance Booking')}</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, opacity: 0.85 }}>
                    {L('(ຈອງວັນໜ້າ / ໂທຈອງ)', '(Future dates / Phone)')}
                  </span>
                </button>
              </div>

              {/* STEP 1: DATES & NIGHTS */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '10px 12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      background: '#183D2D', color: '#fff',
                      width: '18px', height: '18px', borderRadius: '50%',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.7rem', fontWeight: 800,
                    }}>1</span>
                    <span>{L('ວັນທີເຂົ້າພັກ & ຈຳນວນຄືນ', 'Check-in Dates & Nights')}</span>
                  </div>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: isSelectedRoomAvailable ? '#15803d' : '#dc2626' }}>
                    {isSelectedRoomAvailable
                      ? L('✅ ວ່າງພ້ອມຂາຍ', '✅ Available')
                      : L('❌ ບໍ່ວ່າງໃນວັນນີ້', '❌ Unavailable')}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', alignItems: 'center' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 600 }}>
                      📅 {L('ວັນເຂົ້າພັກ:', 'Check-in:')}
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      style={{ padding: '6px 8px', fontSize: '0.84rem', fontWeight: 600 }}
                      value={checkInDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        setCheckInDate(val);
                        setCheckOutDate(addDays(val, nights));
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 600 }}>
                      🌙 {L('ຈຳນວນຄືນ:', 'Nights:')}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '5px 10px', fontWeight: 800 }}
                        onClick={() => setNightsCount(nights - 1)}
                      >
                        −
                      </button>
                      <span style={{
                        fontWeight: 800,
                        fontSize: '0.86rem',
                        flex: 1,
                        textAlign: 'center',
                        background: '#fff',
                        padding: '5px 2px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                      }}>
                        {nights} {L('ຄືນ', 'N')}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '5px 10px', fontWeight: 800 }}
                        onClick={() => setNightsCount(nights + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.73rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    🚪 {L(`ອອກວັນທີ: ${formatDate(checkOutDate)}`, `Out: ${checkOutDate}`)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    style={{ fontSize: '0.7rem', color: 'var(--primary)', padding: '2px 6px', fontWeight: 700 }}
                    onClick={() => setShowMultiRoomPicker(v => !v)}
                  >
                    {showMultiRoomPicker ? L('▴ ປິດເລືອກຫຼາຍຫ້ອງ', '▴ Close') : L('➕ ເລືອກຫຼາຍຫ້ອງ (ກຸ່ມ)', '➕ Multi-room')}
                  </button>
                </div>

                {/* Multi-Room Group Booking Selector (collapsible) */}
                {showMultiRoomPicker && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 700 }}>
                      {L('ເລືອກຫ້ອງເພີ່ມເຕີມໃນບິນດຽວກັນ:', 'Select extra rooms:')}
                    </div>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {rooms
                        .filter(r => r.id !== selectedRoom?.id && isRoomAvailableForDates(r.id, checkInDate, checkOutDate))
                        .map(r => {
                          const picked = extraRoomIds.includes(r.id);
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => setExtraRoomIds(prev => picked ? prev.filter(id => id !== r.id) : [...prev, r.id])}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '0.73rem',
                                fontWeight: 700,
                                border: picked ? '2px solid #2563eb' : '1px solid var(--border)',
                                background: picked ? '#dbeafe' : '#fff',
                                color: picked ? '#1e3a8a' : 'var(--text-primary)',
                              }}
                            >
                              {picked ? '✓ ' : '+ '}{r.number} ({ROOM_TYPE_SHORT[r.type]})
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 2: GUEST INFO */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '10px 12px',
              }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    background: '#183D2D', color: '#fff',
                    width: '18px', height: '18px', borderRadius: '50%',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 800,
                  }}>2</span>
                  <span>{L('ຂໍ້ມູນລູກຄ້າ (Guest Info)', 'Guest Info')}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 600 }}>
                      👤 {L('ຊື່ລູກຄ້າ (ແຂກ):', 'Guest Name:')}
                    </label>
                    <input
                      className="form-input"
                      style={{ padding: '7px 10px', fontSize: '0.85rem' }}
                      placeholder={L('ຊື່ແຂກ... (ຫຼື ປະວ່າງ)', 'Guest name (or empty)')}
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 600 }}>
                      📞 {L('ເບີໂທລະສັບ:', 'Phone:')}
                    </label>
                    <input
                      className="form-input"
                      style={{ padding: '7px 10px', fontSize: '0.85rem' }}
                      placeholder="020..."
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                    />
                  </div>
                </div>

                {/* Optional Extras, Passport, Discount Collapsible */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowMoreOptions(v => !v)}
                    style={{
                      width: '100%',
                      padding: '5px 8px',
                      borderRadius: '6px',
                      border: '1px dashed var(--border)',
                      background: showMoreOptions ? '#fff' : 'transparent',
                      color: 'var(--text-secondary)',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>
                      ⚙️ {L('+ ເພີ່ມເລກບັດ/Passport, ສ່ວນຫຼຸດ, ຄ່າເສີມ', '+ Passport, Discount, Extras')}
                      {(discountNum > 0 || validExtras.length > 0 || passportNo) && (
                        <strong style={{ color: '#b45309', marginLeft: '6px' }}>(ມີຂໍ້ມູນ)</strong>
                      )}
                    </span>
                    <span>{showMoreOptions ? '▴' : '▾'}</span>
                  </button>

                  {showMoreOptions && (
                    <div style={{ marginTop: '8px', padding: '8px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '6px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                            🪪 {L('ເລກບັດປະຈຳຕົວ / ພາສປອດ:', 'ID / Passport:')}
                          </label>
                          <input
                            className="form-input"
                            style={{ padding: '5px 8px', fontSize: '0.8rem' }}
                            placeholder="ເລກບັດ..."
                            value={passportNo}
                            onChange={(e) => setPassportNo(e.target.value)}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                            🌍 {L('ສັນຊາດ:', 'Nationality:')}
                          </label>
                          <select
                            className="form-select"
                            style={{ padding: '5px 6px', fontSize: '0.8rem' }}
                            value={guestNationality}
                            onChange={(e) => setGuestNationality(e.target.value)}
                          >
                            {['ລາວ', 'ໄທ', 'ຈີນ', 'ຫວຽດນາມ', 'ເກົາຫຼີ', 'ຍີ່ປຸ່ນ', 'ຝຣັ່ງ', 'ອາເມຣິກາ', 'ອື່ນໆ'].map(n => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                            🏷️ {L('ສ່ວນຫຼຸດ (₭):', 'Discount:')}
                          </label>
                          <input
                            className="form-input"
                            type="number"
                            min="0"
                            style={{ padding: '5px 7px', fontSize: '0.8rem' }}
                            placeholder="0 ₭"
                            value={discount}
                            onChange={(e) => setDiscount(e.target.value)}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                            👥 {L('ຈຳນວນແຂກ:', 'Guests:')}
                          </label>
                          <select
                            className="form-select"
                            style={{ padding: '5px 6px', fontSize: '0.8rem' }}
                            value={guestCount}
                            onChange={(e) => setGuestCount(Number(e.target.value))}
                          >
                            {[1, 2, 3, 4, 5, 6].map(c => <option key={c} value={c}>{c} {L('ຄົນ', 'pax')}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                            📡 {L('ຊ່ອງທາງ:', 'Channel:')}
                          </label>
                          <select
                            className="form-select"
                            style={{ padding: '5px 6px', fontSize: '0.8rem' }}
                            value={channel}
                            onChange={(e) => setChannel(e.target.value)}
                          >
                            <option value="walkin">Walk-in</option>
                            <option value="phone">{L('ໂທລະສັບ', 'Phone')}</option>
                            <option value="facebook">FB/Line</option>
                            <option value="online">Online</option>
                            <option value="agoda">Agoda</option>
                          </select>
                        </div>
                      </div>

                      {/* Extra charges presets */}
                      <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '6px' }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          ➕ {L('ເພີ່ມຄ່າບໍລິການເສີມ:', 'Add Extras:')}
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                          {EXTRA_PRESETS.map((p, idx) => (
                            <button
                              key={idx}
                              type="button"
                              className="btn btn-secondary btn-xs"
                              style={{ fontSize: '0.7rem', padding: '2px 7px' }}
                              onClick={() => setExtras(prev => [...prev, { desc: isEn ? p.descEn : p.desc, amount: p.amount }])}
                            >
                              + {isEn ? p.descEn : p.desc.split(' ')[0]}
                            </button>
                          ))}
                        </div>
                        {extras.map((ex, i) => (
                          <div key={i} style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                            <input
                              className="form-input"
                              style={{ flex: 2, padding: '4px 6px', fontSize: '0.76rem' }}
                              placeholder={L('ລາຍການ...', 'Item...')}
                              value={ex.desc}
                              onChange={(e) => setExtras(prev => prev.map((x, idx) => idx === i ? { ...x, desc: e.target.value } : x))}
                            />
                            <input
                              className="form-input"
                              type="number"
                              style={{ flex: 1, padding: '4px 6px', fontSize: '0.76rem' }}
                              placeholder="₭"
                              value={ex.amount}
                              onChange={(e) => setExtras(prev => prev.map((x, idx) => idx === i ? { ...x, amount: e.target.value } : x))}
                            />
                            <button type="button" className="btn btn-danger btn-xs" onClick={() => setExtras(prev => prev.filter((_, idx) => idx !== i))}>✕</button>
                          </div>
                        ))}
                      </div>

                      <input
                        className="form-input"
                        style={{ padding: '5px 7px', fontSize: '0.78rem' }}
                        placeholder={L('📝 ໝາຍເຫດ...', '📝 Notes...')}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* STEP 3: PAYMENT & CONFIRMATION */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '10px 12px',
              }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    background: '#183D2D', color: '#fff',
                    width: '18px', height: '18px', borderRadius: '50%',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 800,
                  }}>3</span>
                  <span>{L('ຊຳລະເງິນ & ປິ່ນບິນ (Payment)', 'Payment')}</span>
                </div>

                {/* Deposit Line ONLY when Booking mode */}
                {saleMode === 'booking' && (
                  <div style={{ background: '#eff6ff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #bfdbfe', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#1e3a8a' }}>
                        💰 {L('ຄ່າມັດຈຳ (Deposit):', 'Deposit Amount:')}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#1e3a8a' }}>
                        {L(`ຍອດລວມທັງໝົດ: ${formatCurrency(grandTotal)}`, `Total: ${formatCurrency(grandTotal)}`)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        style={{ padding: '5px 8px', fontSize: '0.86rem', flex: 1, fontWeight: 700 }}
                        placeholder="0"
                        value={deposit}
                        onChange={(e) => setDeposit(e.target.value)}
                      />
                      <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem', padding: '4px 7px' }} onClick={() => setDeposit('0')}>0%</button>
                      <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem', padding: '4px 7px' }} onClick={() => setDeposit(String(Math.round(grandTotal * 0.5)))}>50%</button>
                      <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem', padding: '4px 7px' }} onClick={() => setDeposit(String(grandTotal))}>100%</button>
                    </div>
                  </div>
                )}

                {/* Payment Method 4 Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px', marginBottom: '8px' }}>
                  {PAYMENT_OPTIONS.map(m => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setPayMethod(m.key)}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '8px',
                        border: payMethod === m.key ? '2px solid #183D2D' : '1px solid var(--border)',
                        background: payMethod === m.key ? '#ecfdf5' : '#fff',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        color: payMethod === m.key ? '#183D2D' : 'var(--text-secondary)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '2px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ fontSize: '1.05rem' }}>{m.icon}</span>
                      <span>{isEn ? m.en : m.lo}</span>
                    </button>
                  ))}
                </div>

                {/* Cash Tendered & Change Calculation */}
                {payMethod === 'cash' && dueNow > 0 && (
                  <div style={{ background: '#fffbeb', padding: '8px 10px', borderRadius: '8px', border: '1px solid #fde68a', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#92400e' }}>
                        💵 {L('ຮັບເງິນສົດ:', 'Cash Tendered:')}
                      </span>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        style={{ flex: 1, minWidth: '95px', padding: '4px 8px', fontSize: '0.86rem', fontWeight: 700 }}
                        placeholder={formatCurrency(dueNow)}
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                      />
                      <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem', padding: '3px 8px' }} onClick={() => setCashReceived(String(dueNow))}>
                        {L('ພໍດີ', 'Exact')}
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem', padding: '3px 6px' }} onClick={() => setCashReceived(String(Math.ceil(dueNow / 100000) * 100000))}>
                        +ປັດ
                      </button>
                    </div>

                    {cashReceivedNum > 0 && (
                      <div style={{
                        fontSize: '0.86rem',
                        fontWeight: 800,
                        color: changeDue >= 0 ? '#15803d' : '#dc2626',
                        textAlign: 'right',
                        paddingTop: '4px',
                        borderTop: '1px dashed #fde68a',
                      }}>
                        {changeDue >= 0
                          ? `💰 ${L('ເງິນທອນ:', 'Change:')} ${formatCurrency(changeDue)}`
                          : `⚠️ ${L('ຍັງຂາດ:', 'Still Due:')} ${formatCurrency(Math.abs(changeDue))}`}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Total Due & Big Action Button */}
              <div style={{ borderTop: '2px solid var(--border)', paddingTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {saleMode === 'booking'
                      ? L(`ຍອດຊຳລະຕອນນີ້:`, `Due Now:`)
                      : L('ຍອດຕ້ອງຊຳລະ:', 'Total Due:')}
                  </span>
                  <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#183D2D' }}>
                    {formatCurrency(dueNow)}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={!selectedRoom || !isSelectedRoomAvailable}
                  className={`btn btn-lg ${saleMode === 'checkin' ? 'btn-success' : 'btn-primary'}`}
                  style={{
                    width: '100%',
                    padding: '13px',
                    fontSize: '1.05rem',
                    fontWeight: 900,
                    borderRadius: '10px',
                    boxShadow: saleMode === 'checkin'
                      ? '0 4px 14px rgba(22, 163, 74, 0.35)'
                      : '0 4px 14px rgba(37, 99, 235, 0.35)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                  }}
                >
                  <span>
                    {saleMode === 'checkin'
                      ? `🟢 ${L('ຂາຍຫ້ອງເຂົ້າພັກເລີຍ & ປິ່ນໃບບິນ', 'Check-in Now & Print Bill')}`
                      : `🔵 ${L('ຢືນຢັນການຈອງ & ປິ່ນໃບບິນ', 'Save Booking & Print Bill')}`}
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 500, opacity: 0.9 }}>
                    {saleMode === 'checkin'
                      ? L(`(ຮັບເງິນ ${formatCurrency(dueNow)} + ອອກໃບບິນຮັບເງິນທັນທີ)`, `(Collect ${formatCurrency(dueNow)} + Print Receipt)`)
                      : L(`(ບັນທຶກການຈອງ + ພິມໃບບິນມັດຈຳ/ຈອງ)`, `(Save Booking + Print Confirmation)`)}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Receipt Preview & Print Modal */}
      {receiptModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setReceiptModal(null)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">
                🧾 {L('ໃບບິນ / Receipt', 'Receipt')} ({receiptModal.booking.id})
              </span>
              <button type="button" className="modal-close" onClick={() => setReceiptModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <PrintReceipt
                booking={receiptModal.booking}
                room={receiptModal.room}
                type={receiptModal.type}
                paidAmount={receiptModal.paidAmount}
                payMethod={receiptModal.payMethod}
                cashReceived={receiptModal.cashReceived}
                changeAmount={receiptModal.changeAmount}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setReceiptModal(null)}>
                ✅ {L('ປິດ', 'Close')}
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: '#d96528', color: '#fff', fontWeight: 700 }}
                onClick={() => {
                  const target = { booking: receiptModal.booking, room: receiptModal.room };
                  setReceiptModal(null);
                  setRegTarget(target);
                }}
              >
                📱 {L('ໃຫ້ແຂກເຊັນຟອມ iPad', 'Open iPad Sign Form')}
              </button>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => window.print()}>
                🖨️ ພິມໃບບິນ / Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {checkInTarget && (
        <CheckInModal
          booking={checkInTarget.booking}
          room={checkInTarget.room}
          onClose={() => setCheckInTarget(null)}
        />
      )}

      {checkOutTarget && (
        <CheckOutModal
          booking={checkOutTarget.booking}
          room={checkOutTarget.room}
          onClose={() => setCheckOutTarget(null)}
        />
      )}

      {regTarget && (
        <CheckInRegistrationModal
          booking={bookings.find(item => item.id === regTarget.booking?.id) || regTarget.booking}
          room={regTarget.room}
          onClose={() => setRegTarget(null)}
          onBack={() => setRegTarget(null)}
        />
      )}

      {cancelTargetBooking && (
        <CancelBookingModal
          booking={cancelTargetBooking}
          mode="cancel"
          defaultReason={L('ຍົກເລີກຈາກໜ້າແຄັດເຊຍ', 'Cancelled at cashier')}
          onClose={() => setCancelTargetBooking(null)}
          onDone={() => {
            setCancelTargetBooking(null);
            setSelectedRoomId(null);
            toast(L('ຍົກເລີກການຈອງສຳເລັດ', 'Booking cancelled'), 'info');
          }}
        />
      )}

      {showShiftCloseModal && (
        <CashierShiftCloseModal
          viewDate={viewDate}
          onShiftClosed={() => setRefreshShift(c => c + 1)}
          onClose={() => setShowShiftCloseModal(false)}
        />
      )}
    </div>
  );
}
