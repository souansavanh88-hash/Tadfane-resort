import { useState } from 'react';
import { useHotel } from '../context/HotelContext';
import { useToast } from '../components/ToastProvider';
import {
  ROOM_TYPES, BOOKING_STATUS_META,
  formatCurrency, formatDate, todayStr, addDays
} from '../data/initialData';
import BookingForm from '../components/BookingForm';
import CheckInModal from '../components/CheckInModal';
import CheckOutModal from '../components/CheckOutModal';
import RoomModal from '../components/RoomModal';
import PrintReceipt from '../components/PrintReceipt';
import CheckInRegistrationModal from '../components/CheckInRegistrationModal';
import ShareBookingModal from '../components/ShareBookingModal';
import CancelBookingModal from '../components/CancelBookingModal';
import { RoomCalendarTable, DateByDateBookingsView, DailyLedgerSheet } from '../components/RoomTableViews';

const TABLE_STATUS_COLORS = {
  pending: { text: '#b45309', bg: '#fef3c7', border: '#fcd34d', label: '🟡 ລໍຢືນຢັນ' },
  booked: { text: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd', label: '🔵 ຈອງແລ້ວ (ຍັງບໍ່ເຂົ້າພັກ)' },
  checked_in: { text: '#15803d', bg: '#dcfce7', border: '#86efac', label: '🟢 ເຂົ້າພັກແລ້ວ' },
  checked_out: { text: '#475569', bg: '#e2e8f0', border: '#cbd5e1', label: '⚫ ອອກແລ້ວ' },
  no_show: { text: '#7e22ce', bg: '#f3e8ff', border: '#d8b4fe', label: '👻 ບໍ່ມາ (No-Show)' },
  cancelled: { text: '#b91c1c', bg: '#fee2e2', border: '#fca5a5', label: '❌ ຍົກເລີກ' },
};

const REFUND_METHOD_LABELS = { cash: 'ເງິນສົດ', transfer: 'ໂອນ', qr: 'QR', card: 'ບັດ' };

export default function BookingPage({ navigate }) {
  const {
    rooms, bookings, hotelInfo, getRoomStatusOnDate,
    markNoShow, confirmBooking, markClean, t
  } = useHotel();
  const { toast } = useToast();

  const today = todayStr();
  const tomorrow = addDays(today, 1);

  // Default to 'daily_sheet' (Excel-like day tabs 1..31 showing all rooms)
  const [viewMode, setViewMode] = useState('daily_sheet'); // 'daily_sheet' | 'by_date' | 'calendar' | 'table' | 'list' | 'rooms'
  const [selectedDate, setSelectedDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [floorFilter, setFloorFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Modals
  const [bookingFormState, setBookingFormState] = useState(null); // { preselectedRoom, defaultCheckIn, directCheckIn, bookingToEdit }
  const [checkInTarget, setCheckInTarget] = useState(null); // { booking, room }
  const [checkOutTarget, setCheckOutTarget] = useState(null); // { booking, room }
  const [roomModalTarget, setRoomModalTarget] = useState(null); // { room, initialView, dateOverride }
  const [regTarget, setRegTarget] = useState(null); // { booking, room }
  const [receiptTarget, setReceiptTarget] = useState(null); // { booking, room }
  const [shareTarget, setShareTarget] = useState(null); // { booking, room }
  const [proofPreview, setProofPreview] = useState(null); // booking
  const [cancelTarget, setCancelTarget] = useState(null); // { booking, mode: 'cancel' | 'reject' }

  const gridDate = selectedDate || today;
  const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);

  // Filter rooms for calendar matrix view
  const filteredRoomsForGrid = rooms.filter(room => {
    if (floorFilter !== 'all' && room.floor !== Number(floorFilter)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchRoom = String(room.number).toLowerCase().includes(q) || (ROOM_TYPES[room.type] || '').toLowerCase().includes(q);
      if (!matchRoom) return false;
    }
    return true;
  });

  const handleSwitchViewMode = (mode) => {
    setViewMode(mode);
    if (!['list', 'by_date', 'daily_sheet'].includes(mode) && !selectedDate) {
      setSelectedDate(today);
    }
  };

  // Base list filtered by selectedDate (if set) + search query (before status tab filtering)
  const baseBookings = bookings
    .filter(b => {
      if (selectedDate) {
        const coversDate = b.checkIn <= selectedDate && selectedDate < b.checkOut;
        const arrivesOrDepartsOnDate = b.checkIn === selectedDate || b.checkOut === selectedDate;
        if (!coversDate && !arrivesOrDepartsOnDate) return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchId = (b.id || '').toLowerCase().includes(q);
        const matchGuest = (b.guestName || '').toLowerCase().includes(q);
        const matchPhone = (b.guestPhone || '').toLowerCase().includes(q);
        const rm = rooms.find(r => r.id === b.roomId);
        const matchRoom = (rm?.number || b.roomNumber || '').toLowerCase().includes(q);
        if (!matchId && !matchGuest && !matchPhone && !matchRoom) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const priority = { pending: 0, booked: 1, checked_in: 2, checked_out: 3, no_show: 4, cancelled: 5 };
      const pa = priority[a.status] ?? 9;
      const pb = priority[b.status] ?? 9;
      if (pa !== pb) return pa - pb;
      return (b.createdAt || b.checkIn || '').localeCompare(a.createdAt || a.checkIn || '');
    });

  const counts = {
    all: baseBookings.length,
    pending: baseBookings.filter(b => b.status === 'pending').length,
    booked: baseBookings.filter(b => b.status === 'booked').length,
    checked_in: baseBookings.filter(b => b.status === 'checked_in').length,
    checked_out: baseBookings.filter(b => b.status === 'checked_out').length,
    no_show: baseBookings.filter(b => b.status === 'no_show').length,
    cancelled: baseBookings.filter(b => b.status === 'cancelled').length,
  };

  const visibleBookings = statusFilter === 'all'
    ? baseBookings
    : baseBookings.filter(b => b.status === statusFilter);

  const openNewBooking = (preselectedRoom = null, directCheckIn = false) => {
    setBookingFormState({
      preselectedRoom,
      defaultCheckIn: selectedDate || today,
      directCheckIn,
      bookingToEdit: null,
    });
  };

  const openEditBooking = (booking) => {
    const rm = rooms.find(r => r.id === booking.roomId) || null;
    setBookingFormState({
      preselectedRoom: rm,
      defaultCheckIn: booking.checkIn,
      directCheckIn: false,
      bookingToEdit: booking,
    });
  };

  const handleConfirmPending = (b) => {
    confirmBooking(b.id);
    toast(`✅ ຢືນຢັນການຈອງ ${b.id} (${b.guestName}) ສຳເລັດ!`, 'success');
  };

  const handleRejectPending = (b) => {
    setCancelTarget({ booking: b, mode: 'reject' });
  };

  const handleNoShow = (b) => {
    if (window.confirm(`ໝາຍລູກຄ້າ "${b.guestName}" (${b.id}) ເປັນ No-Show (ບໍ່ມາເຂົ້າພັກ)?`)) {
      markNoShow(b.id, 'ລູກຄ້າບໍ່ມາເຂົ້າພັກ');
      toast(`👻 ໝາຍ No-Show ສຳເລັດ!`, 'warning');
    }
  };

  const handleCancel = (b) => {
    setCancelTarget({ booking: b, mode: 'cancel' });
  };

  const handleCancelDone = ({ refundAmount } = {}) => {
    const tg = cancelTarget;
    if (!tg) return;
    const refundText = refundAmount > 0 ? ` · ຄືນເງິນ ${formatCurrency(refundAmount)}` : '';
    toast(
      tg.mode === 'reject'
        ? `🚫 ປະຕິເສດການຈອງ ${tg.booking.id} ແລ້ວ${refundText}`
        : `❌ ຍົກເລີກການຈອງ ${tg.booking.id} ແລ້ວ${refundText}`,
      'info'
    );
  };

  const findRoomForBooking = (b) => {
    return rooms.find(r => r.id === b.roomId) || {
      id: b.roomId,
      number: b.roomNumber || '?',
      type: b.roomType || 'standard',
      price: b.roomPrice || 0,
    };
  };

  return (
    <div className="page-container">
      {/* Top Page Header */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
              📋 {t('bookingTitle') || 'ຈັດການການຈອງຫ້ອງ'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              ທັງໝົດ {rooms.length} ຫ້ອງ · ການຈອງ {bookings.length} ລາຍການ
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {navigate && (
              <button className="btn btn-warning" style={{ fontWeight: 700 }} onClick={() => navigate('cashier')}>
                🧾 ໜ້າແຄັດເຊຍ (POS)
              </button>
            )}
            <button className="btn btn-primary" onClick={() => openNewBooking(null, false)}>
              ➕ ຈອງຫ້ອງໃໝ່ {selectedDate ? `(${formatDate(selectedDate)})` : ''}
            </button>
          </div>
        </div>

        {/* View Mode & Date Filter Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '10px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)'
        }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${viewMode === 'daily_sheet' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleSwitchViewMode('daily_sheet')}
            >
              📑 ຕາຕະລາງລາຍວັນ (1..31)
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'by_date' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleSwitchViewMode('by_date')}
            >
              📆 ປະຕິທິນລາຍເດືອນ
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'calendar' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleSwitchViewMode('calendar')}
            >
              📅 ຫ້ອງ × ວັນທີ
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleSwitchViewMode('list')}
            >
              📋 ລາຍການຈອງ ({counts.all})
            </button>
          </div>

          {!['by_date', 'daily_sheet'].includes(viewMode) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                📅 ວັນທີ:
              </span>
              {viewMode === 'list' && (
                <button
                  className={`btn btn-sm ${!selectedDate ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedDate('')}
                >
                  📋 ທຸກວັນທີ
                </button>
              )}
              <button
                className={`btn btn-sm ${(viewMode === 'list' ? selectedDate === today : gridDate === today) ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedDate(today)}
              >
                ມື້ນີ້
              </button>
              <button
                className={`btn btn-sm ${(viewMode === 'list' ? selectedDate === tomorrow : gridDate === tomorrow) ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedDate(tomorrow)}
              >
                ມື້ອື່ນ
              </button>
              <input
                type="date"
                className="form-control"
                style={{ width: 'auto', padding: '4px 9px', fontSize: '0.8rem' }}
                value={viewMode === 'list' ? selectedDate : gridDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              {selectedDate && viewMode === 'list' && (
                <button className="btn btn-sm btn-secondary" onClick={() => setSelectedDate('')}>
                  ✕ ລ້າງວັນທີ
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {viewMode === 'daily_sheet' ? (
        <DailyLedgerSheet
          rooms={rooms}
          bookings={bookings}
          getRoomStatusOnDate={getRoomStatusOnDate}
          isOwnerOrReception={true}
          onOpenRoom={(room, initialView, dateOverride) =>
            setRoomModalTarget({ room, initialView: initialView || 'detail', dateOverride: dateOverride || today })
          }
          onQuickCheckIn={(booking, room) => setCheckInTarget({ booking, room })}
          onQuickCheckOut={(booking, room) => setCheckOutTarget({ booking, room })}
          onConfirmPending={handleConfirmPending}
          onCleanRoom={(rm) => {
            markClean(rm.id);
            toast(`✨ ຫ້ອງ ${rm.number} ສະອາດພ້ອມຂາຍແລ້ວ!`, 'success');
          }}
        />
      ) : viewMode === 'by_date' ? (
        <DateByDateBookingsView
          rooms={rooms}
          bookings={bookings}
          isOwnerOrReception={true}
          onNewBookingForDate={(d) =>
            setBookingFormState({
              preselectedRoom: null,
              defaultCheckIn: d,
              directCheckIn: false,
              bookingToEdit: null,
            })
          }
          onOpenRoom={(room, initialView, dateOverride) =>
            setRoomModalTarget({ room, initialView: initialView || 'detail', dateOverride: dateOverride || today })
          }
          onQuickCheckIn={(booking, room) => setCheckInTarget({ booking, room })}
          onQuickCheckOut={(booking, room) => setCheckOutTarget({ booking, room })}
          onEditBooking={openEditBooking}
          onConfirmPending={handleConfirmPending}
          onRejectPending={handleRejectPending}
          onNoShow={handleNoShow}
          onCancelBooking={handleCancel}
          onOpenReceipt={(booking, room) => setReceiptTarget({ booking, room })}
        />
      ) : viewMode === 'calendar' ? (
        /* ROOM × DATE CALENDAR MATRIX */
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-control"
                style={{ width: '240px' }}
                placeholder="🔍 ຄົ້ນຫາເບີຫ້ອງ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="form-control"
                style={{ width: 'auto' }}
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
              >
                <option value="all">🏢 ທຸກຊັ້ນ</option>
                {floors.map(f => (
                  <option key={f} value={f}>ຊັ້ນ {f}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              📅 ຕາຕະລາງຫ້ອງລ່ວງໜ້າ ເລີ່ມ {formatDate(gridDate)}
            </div>
          </div>

          <RoomCalendarTable
            rooms={filteredRoomsForGrid}
            startDate={gridDate}
            onChangeStartDate={(d) => setSelectedDate(d)}
            getRoomStatusOnDate={getRoomStatusOnDate}
            isOwnerOrReception={true}
            onOpenRoom={(room, initialView, dateOverride) =>
              setRoomModalTarget({ room, initialView: initialView || 'detail', dateOverride: dateOverride || gridDate })
            }
          />
        </div>
      ) : (
        /* LIST VIEW */
        <div>
          {/* Search + Status Filter Tabs */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-control"
              style={{ maxWidth: '320px' }}
              placeholder="🔍 ຄົ້ນຫາຊື່, ເບີໂທ, ເລກຫ້ອງ, ຫຼື ເລກທີ BK..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {selectedDate && (
              <div style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 700 }}>
                📌 ກຳລັງສະແດງສະເພາະວັນທີ {formatDate(selectedDate)}
              </div>
            )}
          </div>

          {/* Unmistakable Status Tabs with Live Counts */}
          <div className="filter-tabs" style={{ marginBottom: '14px' }}>
            <button
              className={`filter-tab ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              ທັງໝົດ <span className="filter-tab-count">{counts.all}</span>
            </button>
            <button
              className={`filter-tab ${statusFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pending')}
            >
              🟡 ລໍຢືນຢັນ (ອອນລາຍ) <span className="filter-tab-count">{counts.pending}</span>
            </button>
            <button
              className={`filter-tab ${statusFilter === 'booked' ? 'active' : ''}`}
              onClick={() => setStatusFilter('booked')}
            >
              🔵 ຈອງແລ້ວ (ຍັງບໍ່ເຂົ້າພັກ) <span className="filter-tab-count">{counts.booked}</span>
            </button>
            <button
              className={`filter-tab ${statusFilter === 'checked_in' ? 'active' : ''}`}
              onClick={() => setStatusFilter('checked_in')}
            >
              🟢 ເຂົ້າພັກແລ້ວ (ກຳລັງພັກ) <span className="filter-tab-count">{counts.checked_in}</span>
            </button>
            <button
              className={`filter-tab ${statusFilter === 'checked_out' ? 'active' : ''}`}
              onClick={() => setStatusFilter('checked_out')}
            >
              ⚫ ອອກແລ້ວ <span className="filter-tab-count">{counts.checked_out}</span>
            </button>
            <button
              className={`filter-tab ${statusFilter === 'no_show' ? 'active' : ''}`}
              onClick={() => setStatusFilter('no_show')}
            >
              👻 ບໍ່ມາ (No-show) <span className="filter-tab-count">{counts.no_show}</span>
            </button>
            <button
              className={`filter-tab ${statusFilter === 'cancelled' ? 'active' : ''}`}
              onClick={() => setStatusFilter('cancelled')}
            >
              ❌ ຍົກເລີກ <span className="filter-tab-count">{counts.cancelled}</span>
            </button>
          </div>

          {/* Bookings Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {visibleBookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>📭</div>
                <div style={{ fontWeight: 700, marginBottom: '6px' }}>ບໍ່ພົບລາຍການຈອງໃນໝວດນີ້</div>
                {selectedDate && (
                  <button className="btn btn-sm btn-secondary" onClick={() => setSelectedDate('')}>
                    📋 ເບິ່ງທຸກວັນທີ
                  </button>
                )}
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ເລກທີ</th>
                      <th>ລູກຄ້າ</th>
                      <th>ຫ້ອງ</th>
                      <th>ວັນເຂົ້າ - ອອກ</th>
                      <th>ຍອດລວມ</th>
                      <th>ຄ້າງຈ່າຍ</th>
                      <th>ສະຖານະ</th>
                      <th>ຈັດການ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleBookings.map(b => {
                      const rm = findRoomForBooking(b);
                      const extraSum = (b.extraCharges || []).reduce((s, e) => s + (e.amount || 0), 0);
                      const grandTotal = b.finalTotal || ((b.totalAmount || 0) + extraSum);
                      const remaining = Math.max(0, grandTotal - (b.paidAmount || 0));
                      const st = TABLE_STATUS_COLORS[b.status] || {
                        text: BOOKING_STATUS_META[b.status]?.color || '#475569',
                        bg: '#f1f5f9',
                        border: '#cbd5e1',
                        label: `${BOOKING_STATUS_META[b.status]?.emoji || '⚪'} ${BOOKING_STATUS_META[b.status]?.label || b.status}`,
                      };

                      return (
                        <tr key={b.id}>
                          <td>
                            <div style={{ fontFamily: 'monospace', fontSize: '0.76rem', fontWeight: 700 }}>{b.id}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{b.channel || 'walkin'}</div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 700 }}>{b.guestName}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {b.guestPhone || '-'}
                              {b.signatureDataUrl && (
                                <span style={{ marginLeft: '6px', color: '#15803d', fontWeight: 700 }}>✍️ ເຊັນແລ້ວ</span>
                              )}
                            </div>
                            {b.paymentProof && (
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                style={{ marginTop: '4px', padding: '2px 7px', fontSize: '0.7rem' }}
                                onClick={() => setProofPreview(b)}
                              >
                                🖼️ ສະລິບໂອນເງິນ
                              </button>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                textAlign: 'left',
                                cursor: 'pointer',
                                color: 'var(--primary)',
                              }}
                              onClick={() => setRoomModalTarget({ room: rm, initialView: 'detail', dateOverride: b.checkIn })}
                              title="ເປີດຂໍ້ມູນຫ້ອງ"
                            >
                              <div style={{ fontWeight: 800 }}>ຫ້ອງ {rm.number}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {ROOM_TYPES[rm.type] || rm.type}
                              </div>
                            </button>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                              {formatDate(b.checkIn)}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              → {formatDate(b.checkOut)} ({b.nights || 1} ຄືນ)
                            </div>
                          </td>
                          <td style={{ fontWeight: 700 }}>
                            {formatCurrency(grandTotal)}
                          </td>
                          <td>
                            {remaining > 0 ? (
                              <span style={{ color: '#b45309', fontWeight: 700 }}>
                                {formatCurrency(remaining)}
                              </span>
                            ) : (
                              <span style={{ color: '#15803d', fontWeight: 700 }}>✅ ຄົບ</span>
                            )}
                          </td>
                          <td>
                            <span
                              style={{
                                display: 'inline-block',
                                background: st.bg,
                                color: st.text,
                                border: `1px solid ${st.border}`,
                                padding: '3px 10px',
                                borderRadius: '999px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {st.label}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {b.status === 'pending' && (
                                <>
                                  <button className="btn btn-success btn-sm" onClick={() => handleConfirmPending(b)}>
                                    ✅ ຢືນຢັນ
                                  </button>
                                  <button className="btn btn-secondary btn-sm" onClick={() => openEditBooking(b)}>
                                    ✏️ ແກ້ໄຂ
                                  </button>
                                  <button className="btn btn-danger btn-sm" onClick={() => handleRejectPending(b)}>
                                    🚫 ປະຕິເສດ
                                  </button>
                                </>
                              )}

                              {b.status === 'booked' && (
                                <>
                                  <button className="btn btn-primary btn-sm" onClick={() => setCheckInTarget({ booking: b, room: rm })}>
                                    🛎️ Check-in
                                  </button>
                                  <button
                                    className="btn btn-sm"
                                    style={{ background: '#d96528', color: '#fff' }}
                                    onClick={() => setRegTarget({ booking: b, room: rm })}
                                    title="ເປີດໃບຢືນຢັນ & ລົງທະບຽນ"
                                  >
                                    📱 ຟອມ iPad
                                  </button>
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    style={{ color: '#1d4ed8', borderColor: '#93c5fd', background: '#eff6ff', fontWeight: 700 }}
                                    onClick={() => setShareTarget({ booking: b, room: rm })}
                                    title="ສົ່ງລິ້ງ & QR Code ໃຫ້ລູກຄ້າໂຫຼດເຂົ້າໂທລະສັບ"
                                  >
                                    🔗 ລິ້ງໃຫ້ແຂກ
                                  </button>
                                  <button className="btn btn-secondary btn-sm" onClick={() => setReceiptTarget({ booking: b, room: rm })}>
                                    🧾 ໃບບິນ
                                  </button>
                                  <button className="btn btn-secondary btn-sm" onClick={() => openEditBooking(b)}>
                                    ✏️ ແກ້ໄຂ
                                  </button>
                                  <button className="btn btn-secondary btn-sm" onClick={() => handleNoShow(b)}>
                                    👻 No-Show
                                  </button>
                                  <button className="btn btn-danger btn-sm" onClick={() => handleCancel(b)}>
                                    ❌ ຍົກເລີກ
                                  </button>
                                </>
                              )}

                              {b.status === 'checked_in' && (
                                <>
                                  <button className="btn btn-warning btn-sm" onClick={() => setCheckOutTarget({ booking: b, room: rm })}>
                                    🚪 Check-out
                                  </button>
                                  <button
                                    className="btn btn-sm"
                                    style={{ background: '#d96528', color: '#fff' }}
                                    onClick={() => setRegTarget({ booking: b, room: rm })}
                                  >
                                    📱 ຟອມ iPad
                                  </button>
                                  <button className="btn btn-secondary btn-sm" onClick={() => setReceiptTarget({ booking: b, room: rm })}>
                                    🧾 ໃບບິນ
                                  </button>
                                  <button className="btn btn-secondary btn-sm" onClick={() => openEditBooking(b)}>
                                    ✏️ ແກ້ໄຂ
                                  </button>
                                </>
                              )}

                              {b.status === 'checked_out' && (
                                <button className="btn btn-secondary btn-sm" onClick={() => setReceiptTarget({ booking: b, room: rm })}>
                                  🧾 ໃບບິນ
                                </button>
                              )}

                              {(b.status === 'cancelled' || b.status === 'no_show') && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  <div>{b.cancelReason || b.noShowReason || b.status}</div>
                                  {Number(b.refundAmount) > 0 && (
                                    <div style={{ color: '#b45309', fontWeight: 700, marginTop: 2 }}>
                                      💸 ຄືນເງິນ {formatCurrency(b.refundAmount)} ({REFUND_METHOD_LABELS[b.refundMethod] || b.refundMethod || 'ເງິນສົດ'})
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Booking Create / Edit Modal */}
      {bookingFormState && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setBookingFormState(null)}>
          <div className="modal modal-lg">
            <BookingForm
              preselectedRoom={bookingFormState.preselectedRoom}
              defaultCheckIn={bookingFormState.defaultCheckIn}
              initialDirectCheckIn={bookingFormState.directCheckIn}
              bookingToEdit={bookingFormState.bookingToEdit}
              onClose={() => setBookingFormState(null)}
              onBack={() => setBookingFormState(null)}
            />
          </div>
        </div>
      )}

      {/* Direct Check-In Modal */}
      {checkInTarget && (
        <CheckInModal
          booking={checkInTarget.booking}
          room={checkInTarget.room}
          onClose={() => setCheckInTarget(null)}
          onBack={() => setCheckInTarget(null)}
        />
      )}

      {/* Direct Check-Out Modal */}
      {checkOutTarget && (
        <CheckOutModal
          booking={checkOutTarget.booking}
          room={checkOutTarget.room}
          onClose={() => setCheckOutTarget(null)}
          onBack={() => setCheckOutTarget(null)}
        />
      )}

      {/* Room Detail Modal */}
      {roomModalTarget && (
        <RoomModal
          room={rooms.find(r => r.id === roomModalTarget.room.id) || roomModalTarget.room}
          selectedDate={roomModalTarget.dateOverride}
          initialView={roomModalTarget.initialView || 'detail'}
          onClose={() => setRoomModalTarget(null)}
        />
      )}

      {/* iPad Check-in Registration Modal */}
      {regTarget && (
        <CheckInRegistrationModal
          booking={bookings.find(item => item.id === regTarget.booking?.id) || regTarget.booking}
          room={regTarget.room}
          onClose={() => setRegTarget(null)}
          onBack={() => setRegTarget(null)}
        />
      )}

      {/* Checkout Receipt Print Modal */}
      {shareTarget && (
        <ShareBookingModal
          booking={shareTarget.booking}
          room={shareTarget.room}
          hotelInfo={hotelInfo}
          onClose={() => setShareTarget(null)}
        />
      )}

      {receiptTarget && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setReceiptTarget(null)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title">🧾 ໃບບິນ / Receipt ({receiptTarget.booking.id})</div>
              <button className="modal-close" onClick={() => setReceiptTarget(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
              <PrintReceipt
                booking={receiptTarget.booking}
                room={receiptTarget.room}
                type={
                  receiptTarget.booking.status === 'checked_out'
                    ? 'checkout'
                    : receiptTarget.booking.status === 'checked_in'
                      ? 'checkin'
                      : 'booking'
                }
                paidAmount={
                  receiptTarget.booking.status === 'checked_out'
                    ? (receiptTarget.booking.finalPaymentAmount ?? 0)
                    : (Number(receiptTarget.booking.deposit || 0) + Number(receiptTarget.booking.remainingPaid || 0))
                }
                payMethod={
                  receiptTarget.booking.finalPaymentMethod
                  || receiptTarget.booking.remainingPaymentMethod
                  || receiptTarget.booking.paymentMethod
                }
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setReceiptTarget(null)}>ປິດ</button>
              <button className="btn btn-primary" onClick={() => window.print()}>🖨️ ພິມໃບບິນ</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel / Reject Booking Modal (with refund) */}
      {cancelTarget && (
        <CancelBookingModal
          booking={cancelTarget.booking}
          mode={cancelTarget.mode}
          defaultReason={cancelTarget.mode === 'reject' ? 'ຫ້ອງບໍ່ວ່າງ / ບໍ່ພົບຫຼັກຖານໂອນເງິນ' : 'ລູກຄ້າຂໍຍົກເລີກ'}
          onClose={() => setCancelTarget(null)}
          onDone={handleCancelDone}
        />
      )}

      {/* Payment Proof Preview Modal */}
      {proofPreview && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setProofPreview(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">🖼️ ຫຼັກຖານໂອນເງິນ — {proofPreview.guestName}</div>
              <button className="modal-close" onClick={() => setProofPreview(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <img
                src={proofPreview.paymentProof}
                alt="Payment proof"
                style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: '8px', border: '1px solid var(--border)' }}
              />
              {proofPreview.transferRef && (
                <div style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  ເລກອ້າງອີງ: <strong>{proofPreview.transferRef}</strong>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {proofPreview.status === 'pending' && (
                <button
                  className="btn btn-success"
                  onClick={() => {
                    handleConfirmPending(proofPreview);
                    setProofPreview(null);
                  }}
                >
                  ✅ ຢືນຢັນການຈອງນີ້
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setProofPreview(null)}>ປິດ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
