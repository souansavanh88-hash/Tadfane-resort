import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  initialRooms, initialHotelInfo, generateBookingId, BLOCKING_STATUSES,
  todayStr, daysBetween
} from '../data/initialData';
import { TRANSLATIONS } from '../data/translations';
import { logAudit } from '../utils/audit';

const HotelContext = createContext(null);

export function HotelProvider({ children }) {
  // ================== ROOMS ==================
  const [rooms, setRooms] = useState(() => {
    const saved = localStorage.getItem('hotel_rooms');
    if (!saved) return initialRooms;
    const parsed = JSON.parse(saved);
    return parsed.map(savedRoom => {
      const init = initialRooms.find(r => r.id === savedRoom.id);
      return init ? { ...savedRoom, description: init.description } : savedRoom;
    });
  });

  // ================== BOOKINGS ==================
  const [bookings, setBookings] = useState(() => {
    const saved = localStorage.getItem('hotel_bookings');
    return saved ? JSON.parse(saved) : [];
  });

  // ================== HOTEL INFO ==================
  const [hotelInfo, setHotelInfoState] = useState(() => {
    const saved = localStorage.getItem('hotel_info');
    if (!saved) return initialHotelInfo;
    const parsed = JSON.parse(saved);
    const next = { ...parsed };
    if (next.address === 'ບ້ານ..., ເມືອງ..., ແຂວງ...') {
      next.address = initialHotelInfo.address;
    }
    if (!next.name || next.name === 'ໂຮງແຮມຕາດຟານ') {
      next.name = 'ຣີສອດຕາດຟານ';
    }
    if (!next.nameEn || next.nameEn === 'Tat Fan Hotel') {
      next.nameEn = 'Tad Fane Resort';
    }
    return next;
  });

  // ================== GUEST ACTIVITIES ==================
  const [guestActivities, setGuestActivities] = useState(() => {
    const saved = localStorage.getItem('guest_activities');
    const initialActivities = [
      {
        id: 'resort',
        label: 'ຣີສອດ ຫ້ອງພັກ (Resort)',
        emoji: '🏨',
        price: null,
        descKey: 'desc_resort',
        images: [],
        customDescriptionLo: `ຫຼີກໜີຄວາມວຸ້ນວາຍ ແລ້ວມາປ່ອຍໃຈໄປກັບຫ້ອງພັກທ່າມກາງຜືນປ່າທຳມະຊາດອັນອຸດົມສົມບູນ ທີ່ຕາດຟານ. ສຳຜັດກັບຄວາມງຽບສະຫງົບ ແລະ ຮັບອາກາດອັນບໍລິສຸດບໍລິເວນພູພຽງໂບລາເວນ.`,
        customDescriptionTh: `หลีกหนีความวุ่นวาย แล้วมาปล่อยใจไปกับห้องพักท่ามกลางผืนป่าธรรมชาติอันอุดมสมบูรณ์ที่ตาดฟาน สัมผัสความเงียบสงบและรับอากาศบริสุทธิ์ในบริเวณที่ราบสูงโบลาเวน`,
        customDescriptionEn: `Escape the bustle and immerse yourself in our sanctuary nestled within the lush rainforest of Tad Fane.`,
        customDescriptionVi: `Tránh xa sự ồn ào náo nhiệt để thả hồn vào không gian nghỉ dưỡng giữa đại ngàn xanh mướt tại Tad Fane.`
      },
      { id: 'zipline', label: 'ສະລິງ (Zipline)', emoji: '🪂', price: 120000, descKey: 'desc_zipline', images: [] },
      { id: 'rafting', label: 'ລ່ອງແກງ (Rafting)', emoji: '🚣', price: 180000, descKey: 'desc_rafting', images: [] },
      { id: 'tubing', label: 'ລອຍໂຕ (Tubing)', emoji: '🍩', price: 50000, descKey: 'desc_tubing', images: [] },
      { id: 'trekking', label: 'ຍ່າງປ່າ (Trekking)', emoji: '🥾', price: 250000, descKey: 'desc_trekking', images: [] },
      { id: 'entrance', label: 'ປີ້ເຂົ້າຊົມ (Entrance)', emoji: '🎟️', price: 20000, descKey: 'desc_entrance', images: [] },
      { id: 'cafe', label: 'ຄ່າເຟ (Cafe)', emoji: '☕', price: 25000, descKey: 'desc_cafe', images: [] },
      { id: 'restaurant', label: 'ຮ້ານອາຫານ (Restaurant)', emoji: '🍲', price: 80000, descKey: 'desc_restaurant', images: [] },
      { id: 'market', label: 'ຕະຫຼາດຊຸມຊົນ (Local Market)', emoji: '🛍️', price: 15000, descKey: 'desc_market', images: [] },
    ];
    if (!saved) return initialActivities;
    try {
      const parsed = JSON.parse(saved);
      return initialActivities.map(init => {
        const savedAct = parsed.find(a => a.id === init.id);
        return savedAct ? { ...init, ...savedAct } : init;
      });
    } catch {
      return initialActivities;
    }
  });

  // ================== ACTIVITY SALES ==================
  const [activitySales, setActivitySales] = useState(() => {
    try {
      const saved = localStorage.getItem('activities_sales');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persistence
  useEffect(() => { localStorage.setItem('hotel_rooms', JSON.stringify(rooms)); }, [rooms]);
  useEffect(() => { localStorage.setItem('hotel_bookings', JSON.stringify(bookings)); }, [bookings]);
  useEffect(() => { localStorage.setItem('hotel_info', JSON.stringify(hotelInfo)); }, [hotelInfo]);
  useEffect(() => { localStorage.setItem('guest_activities', JSON.stringify(guestActivities)); }, [guestActivities]);
  useEffect(() => { localStorage.setItem('activities_sales', JSON.stringify(activitySales)); }, [activitySales]);

  // ================== ROOM AVAILABILITY LOGIC ==================
  /**
   * ກວດສອບວ່າຫ້ອງ roomId ວ່າງໃນຊ່ວງ [checkIn, checkOut) ຫຼື ບໍ່
   * @param {string} roomId
   * @param {string} checkIn 'YYYY-MM-DD'
   * @param {string} checkOut 'YYYY-MM-DD'
   * @param {string} [excludeBookingId] ລະຫັດການຈອງທີ່ບໍ່ຕ້ອງນັບ (ເຊັ່ນ: ກໍລະນີແກ້ໄຂການຈອງເອງ)
   */
  const isRoomAvailableForDates = useCallback((roomId, checkIn, checkOut, excludeBookingId = null) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room || room.status === 'maintenance') return false;
    if (!checkIn || !checkOut || checkIn >= checkOut) return false;

    // ກວດສອບການຈອງທີ່ຊ້ອນກັນ
    const conflicts = bookings.filter(b => {
      if (b.roomId !== roomId) return false;
      if (excludeBookingId && b.id === excludeBookingId) return false;
      if (!BLOCKING_STATUSES.includes(b.status)) return false;
      return b.checkIn < checkOut && b.checkOut > checkIn;
    });

    return conflicts.length === 0;
  }, [rooms, bookings]);

  /**
   * ດຶງສະຖານະຫ້ອງ ແລະ ການຈອງໃນວັນທີໃດໜຶ່ງ (Dynamic Status)
   */
  const getRoomStatusOnDate = useCallback((roomId, dateStr) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return { status: 'available', booking: null };

    if (room.status === 'maintenance') {
      return { status: 'maintenance', booking: null };
    }

    const targetDate = dateStr || todayStr();
    if (targetDate === todayStr() && room.status === 'cleaning') {
      return { status: 'cleaning', booking: null };
    }

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

  const setRoomStatus = (id, status) => {
    setRooms(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    logAudit(null, 'room.status', `ປ່ຽນສະຖານະຫ້ອງ ${id} ເປັນ "${status}"`);
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
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, status: 'available' } : r));
    logAudit(null, 'room.status', `ຫ້ອງ ${roomId} ອະນາໄມສຳເລັດ (ວ່າງ)`);
  };

  // ================== BOOKING ACTIONS ==================
  const createBooking = (bookingData) => {
    const id = generateBookingId();
    const isDirectCheckIn = bookingData.isDirectCheckIn || bookingData.status === 'checked_in';
    const isPending = bookingData.status === 'pending';
    const finalStatus = isDirectCheckIn ? 'checked_in' : (isPending ? 'pending' : 'booked');

    const booking = {
      ...bookingData,
      id,
      status: finalStatus,
      createdAt: new Date().toISOString(),
      checkedInAt: isDirectCheckIn ? new Date().toISOString() : null,
      checkedOutAt: null,
      extraCharges: bookingData.extraCharges || [],
    };

    setBookings(prev => [booking, ...prev]);

    // ປັບສະຖານະຫ້ອງໃນ state ຖ້າເປັນ direct checkin ມື້ນີ້
    if (isDirectCheckIn) {
      setRooms(prev => prev.map(r => r.id === bookingData.roomId ? { ...r, status: 'occupied', currentBookingId: id } : r));
    }

    const action = isPending ? 'booking.online' : 'booking.create';
    logAudit(null, action, `${finalStatus === 'pending' ? 'ລູກຄ້າຈອງອອນລາຍ' : 'ສ້າງການຈອງ'} ${id}: ຫ້ອງ ${bookingData.roomId} ວັນທີ ${bookingData.checkIn} ຫາ ${bookingData.checkOut} (${bookingData.guestName})`);
    return booking;
  };

  const updateBooking = (bookingId, patchData) => {
    let updatedObj = null;
    setBookings(prev => prev.map(b => {
      if (b.id !== bookingId) return b;
      updatedObj = { ...b, ...patchData, updatedAt: new Date().toISOString() };
      return updatedObj;
    }));
    logAudit(null, 'booking.update', `ແກ້ໄຂການຈອງ ${bookingId}: ${patchData.roomId ? 'ປ່ຽນຫ້ອງ/ວັນທີ' : 'ແກ້ໄຂຂໍ້ມູນ'}`);
    return updatedObj;
  };

  const checkIn = (bookingId, paymentData, registrationData = null) => {
    const now = new Date().toISOString();
    let targetRoomId = null;
    setBookings(prev => prev.map(b => {
      if (b.id === bookingId) {
        targetRoomId = b.roomId;
        const paidNow = Number(paymentData?.amount || 0);
        const totalPaidSoFar = Number(b.deposit || 0) + paidNow;
        const nextRemaining = Math.max(0, Number(b.totalAmount || 0) - totalPaidSoFar);
        return {
          ...b,
          ...(registrationData || {}),
          status: 'checked_in',
          checkedInAt: b.checkedInAt || now,
          remainingPaid: paidNow,
          remainingPaymentMethod: paymentData?.method || b.remainingPaymentMethod || 'cash',
          remainingAmount: nextRemaining,
        };
      }
      return b;
    }));
    if (targetRoomId) {
      setRooms(prev => prev.map(r => r.id === targetRoomId ? { ...r, status: 'occupied', currentBookingId: bookingId } : r));
    }
    const signedNote = registrationData?.signatureDataUrl ? ' (ພ້ອມລາຍເຊັນ iPad)' : '';
    logAudit(null, 'booking.checkin', `Check-in ການຈອງ ${bookingId} (ຫ້ອງ ${targetRoomId})${signedNote}`);
  };

  const checkOut = (bookingId, extraCharges, finalData) => {
    const now = new Date().toISOString();
    let targetRoomId = null;
    setBookings(prev => prev.map(b => {
      if (b.id === bookingId) {
        targetRoomId = b.roomId;
        return {
          ...b,
          status: 'checked_out',
          checkedOutAt: now,
          extraCharges: extraCharges || [],
          finalTotal: finalData.finalTotal,
          finalPaymentMethod: finalData.paymentMethod,
          finalPaymentAmount: finalData.paymentAmount,
        };
      }
      return b;
    }));
    if (targetRoomId) {
      setRooms(prev => prev.map(r => r.id === targetRoomId ? { ...r, status: 'cleaning', currentBookingId: null } : r));
    }
    logAudit(null, 'booking.checkout', `Check-out ການຈອງ ${bookingId} (ຫ້ອງ ${targetRoomId}), ຍອດລວມ ${finalData.finalTotal} ₭`);
  };

  const cancelBooking = (bookingId, reason) => {
    const now = new Date().toISOString();
    let targetRoomId = null;
    setBookings(prev => prev.map(b => {
      if (b.id === bookingId) {
        targetRoomId = b.roomId;
        return { ...b, status: 'cancelled', cancelReason: reason, cancelledAt: now };
      }
      return b;
    }));
    if (targetRoomId) {
      setRooms(prev => prev.map(r => r.id === targetRoomId && r.currentBookingId === bookingId ? { ...r, status: 'available', currentBookingId: null } : r));
    }
    logAudit(null, 'booking.cancel', `ຍົກເລີກການຈອງ ${bookingId}: ${reason || '-'}`);
  };

  const markNoShow = (bookingId, reason = 'ລູກຄ້າບໍ່ມາເຂົ້າພັກ') => {
    const now = new Date().toISOString();
    let targetRoomId = null;
    setBookings(prev => prev.map(b => {
      if (b.id === bookingId) {
        targetRoomId = b.roomId;
        return { ...b, status: 'no_show', noShowReason: reason, noShowAt: now };
      }
      return b;
    }));
    if (targetRoomId) {
      setRooms(prev => prev.map(r => r.id === targetRoomId && r.currentBookingId === bookingId ? { ...r, status: 'available', currentBookingId: null } : r));
    }
    logAudit(null, 'booking.noshow', `ໝາຍ No-Show ການຈອງ ${bookingId}`);
  };

  const confirmBooking = (bookingId) => {
    setBookings(prev => prev.map(b =>
      b.id === bookingId ? { ...b, status: 'booked', confirmedAt: new Date().toISOString() } : b
    ));
    logAudit(null, 'booking.confirm', `ຢືນຢັນການຈອງອອນລາຍ ${bookingId}`);
  };

  const rejectBooking = (bookingId, reason = 'ປະຕິເສດການຈອງ') => {
    cancelBooking(bookingId, reason);
    logAudit(null, 'booking.reject', `ປະຕິເສດການຈອງອອນລາຍ ${bookingId}: ${reason}`);
  };

  const addExtraChargeToBooking = (bookingId, charge) => {
    setBookings(prev => prev.map(b => {
      if (b.id !== bookingId) return b;
      const currentExtras = b.extraCharges || [];
      return { ...b, extraCharges: [...currentExtras, charge] };
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
      id: `AC-${Date.now()}`,
      status: 'paid', // 'paid' | 'cancelled'
      createdAt: new Date().toISOString(),
      date: saleData.date || todayStr(),
      ...saleData,
    };
    setActivitySales(prev => [newSale, ...prev]);

    // ຖ້າເລືອກເອົາຄ່າກິດຈະກຳໄປລວມໃນບິນຫ້ອງ
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

  const cancelActivitySale = (saleId, reason = 'ຍົກເລີກການຂາຍ') => {
    setActivitySales(prev => prev.map(s => {
      if (s.id !== saleId) return s;
      return { ...s, status: 'cancelled', cancelReason: reason, cancelledAt: new Date().toISOString() };
    }));
    logAudit(null, 'activity.cancel', `ຍົກເລີກປີ້ກິດຈະກຳ ${saleId}: ${reason}`);
  };

  // ================== STATS ==================
  const getStats = (date = todayStr()) => {
    const total = rooms.length;
    let available = 0;
    let occupied = 0;
    let booked = 0;
    let cleaning = 0;
    let maintenance = 0;
    let pending = 0;

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

  // ================== REVENUE (ROOM + ACTIVITIES) ==================
  const getRevenue = (period, customStart = null, customEnd = null) => {
    const now = new Date();
    let startDate;
    let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (period === 'custom' && customStart && customEnd) {
      startDate = new Date(customStart + 'T00:00:00');
      endDate = new Date(customEnd + 'T23:59:59');
    } else {
      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
          break;
        default:
          startDate = new Date(0);
      }
    }

    // 1. Room Revenue
    const filteredBookings = bookings.filter(b => {
      if (['cancelled', 'no_show', 'pending'].includes(b.status)) return false;
      const refDate = new Date(b.checkedInAt || b.createdAt);
      return refDate >= startDate && refDate <= endDate;
    });

    const bookingGrandTotal = (b) => {
      if (b.finalTotal !== undefined && b.finalTotal !== null) return b.finalTotal;
      const extras = (b.extraCharges || []).reduce((s, e) => s + Number(e.amount || 0), 0);
      return (b.totalAmount || 0) + extras;
    };

    const roomTotal = filteredBookings.reduce((sum, b) => sum + bookingGrandTotal(b), 0);

    // 2. Activity Revenue (standalone only, avoid double count if charged to room)
    const filteredActivities = activitySales.filter(s => {
      if (s.status === 'cancelled') return false;
      if (s.chargeToBookingId) return false; // Already counted in room's finalTotal
      const refDate = new Date(s.createdAt || s.date);
      return refDate >= startDate && refDate <= endDate;
    });

    const activityTotal = filteredActivities.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

    const total = roomTotal + activityTotal;

    // Payment method breakdown
    const byMethod = { cash: 0, transfer: 0, qr: 0, card: 0 };
    filteredBookings.forEach(b => {
      const m = b.finalPaymentMethod || b.paymentMethod || 'cash';
      byMethod[m] = (byMethod[m] || 0) + bookingGrandTotal(b);
    });
    filteredActivities.forEach(s => {
      const m = s.paymentMethod || 'cash';
      byMethod[m] = (byMethod[m] || 0) + (s.totalAmount || 0);
    });

    return {
      total,
      roomTotal,
      activityTotal,
      count: filteredBookings.length,
      activityCount: filteredActivities.length,
      byMethod,
      bookings: filteredBookings,
      activities: filteredActivities,
      startDate,
      endDate,
    };
  };

  const updateActivity = (id, data) => {
    setGuestActivities(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
    logAudit(null, 'activity.update', `ແກ້ໄຂຂໍ້ມູນກິດຈະກຳ ${id}`);
  };

  const setHotelInfo = (data) => {
    setHotelInfoState(data);
    logAudit(null, 'hotel.update', 'ແກ້ໄຂຂໍ້ມູນຣີສອດ/ປະຫວັດ');
  };

  // ================== I18N ==================
  const [lang, setLangState] = useState(() => {
    return localStorage.getItem('app_lang') || 'lo';
  });

  const changeLang = (l) => {
    setLangState(l);
    localStorage.setItem('app_lang', l);
  };

  const t = (key, replaceObj = {}) => {
    let str = TRANSLATIONS[lang]?.[key] || TRANSLATIONS['lo']?.[key] || key;
    if (typeof str !== 'string') return key;
    Object.entries(replaceObj).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, v);
    });
    return str;
  };

  return (
    <HotelContext.Provider value={{
      rooms, bookings, hotelInfo, guestActivities, activitySales,
      updateRoom, setRoomStatus, addRoom, deleteRoom, markClean,
      isRoomAvailableForDates, getRoomStatusOnDate,
      createBooking, updateBooking, checkIn, checkOut, cancelBooking, markNoShow,
      confirmBooking, rejectBooking, addExtraChargeToBooking,
      getBookingForRoom, getActiveBookingForRoom,
      addActivitySale, cancelActivitySale, updateActivity,
      getStats, getRevenue,
      setHotelInfo,
      lang, changeLang, t
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
