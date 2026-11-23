import { useState } from 'react';
import { useHotel } from '../context/HotelContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import {
  ROOM_TYPES, BLOCKING_STATUSES,
  formatCurrency, formatDate, todayStr, addDays
} from '../data/initialData';
import RoomModal from '../components/RoomModal';
import BookingForm from '../components/BookingForm';
import CheckInModal from '../components/CheckInModal';
import CheckOutModal from '../components/CheckOutModal';
import { RoomStatusTable } from '../components/RoomTableViews';

const ALL_STATUS = 'all';

const ROOM_DISPLAY_META = {
  available: {
    emoji: '🟢',
    shortLabel: 'ຫ້ອງວ່າງ',
    subLabel: 'ພ້ອມຂາຍ',
    color: '#15803d',
    bg: '#dcfce7',
    border: '#86efac',
  },
  booked: {
    emoji: '🔵',
    shortLabel: 'ຈອງແລ້ວ',
    subLabel: 'ຍັງບໍ່ເຂົ້າພັກ',
    color: '#1d4ed8',
    bg: '#dbeafe',
    border: '#93c5fd',
  },
  occupied: {
    emoji: '🔴',
    shortLabel: 'ເຂົ້າພັກແລ້ວ',
    subLabel: 'ກຳລັງພັກຢູ່',
    color: '#b91c1c',
    bg: '#fee2e2',
    border: '#fca5a5',
  },
  waiting_checkin: {
    emoji: '🟡',
    shortLabel: 'ຈອງອອນລາຍ',
    subLabel: 'ລໍຢືນຢັນ',
    color: '#b45309',
    bg: '#fef3c7',
    border: '#fcd34d',
  },
  cleaning: {
    emoji: '🟣',
    shortLabel: 'ລໍອະນາໄມ',
    subLabel: 'ກຳລັງທຳຄວາມສະອາດ',
    color: '#7e22ce',
    bg: '#f3e8ff',
    border: '#d8b4fe',
  },
  maintenance: {
    emoji: '⚫',
    shortLabel: 'ປິດສ້ອມແປງ',
    subLabel: 'ງົດໃຫ້ບໍລິການ',
    color: '#475569',
    bg: '#e2e8f0',
    border: '#cbd5e1',
  },
};

export default function DashboardPage({ navigate }) {
  const { rooms, bookings, getRoomStatusOnDate, confirmBooking, markClean, t } = useHotel();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const today = todayStr();
  const tomorrow = addDays(today, 1);

  const [checkDate, setCheckDate] = useState(today);
  const [filter, setFilter] = useState(ALL_STATUS);
  const [floorFilter, setFloorFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table' | 'calendar'

  // Active modals
  const [modalState, setModalState] = useState(null); // { room, initialView, dateOverride }
  const [newBookingMode, setNewBookingMode] = useState(null); // null | { directCheckIn: boolean }
  const [directCheckInBooking, setDirectCheckInBooking] = useState(null);
  const [directCheckOutBooking, setDirectCheckOutBooking] = useState(null);

  const isOwnerOrReception = ['owner', 'reception'].includes(currentUser?.role);
  const isHousekeeping = currentUser?.role === 'housekeeping';

  const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);

  // Enrich each room with accurate date-based status
  const roomsWithStatus = rooms.map(room => {
    const { status, booking } = getRoomStatusOnDate(room.id, checkDate);
    const meta = ROOM_DISPLAY_META[status] || ROOM_DISPLAY_META.available;

    // Also find next upcoming booking if available on checkDate
    const nextBooking = !booking
      ? bookings
          .filter(b =>
            b.roomId === room.id &&
            BLOCKING_STATUSES.includes(b.status) &&
            b.checkIn > checkDate
          )
          .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0] || null
      : null;

    return {
      ...room,
      displayStatus: status,
      meta,
      activeBooking: booking,
      nextBooking,
    };
  });

  const statusCounts = {
    available: roomsWithStatus.filter(r => r.displayStatus === 'available').length,
    booked: roomsWithStatus.filter(r => r.displayStatus === 'booked').length,
    occupied: roomsWithStatus.filter(r => r.displayStatus === 'occupied').length,
    waiting_checkin: roomsWithStatus.filter(r => r.displayStatus === 'waiting_checkin').length,
    cleaning: roomsWithStatus.filter(r => r.displayStatus === 'cleaning').length,
    maintenance: roomsWithStatus.filter(r => r.displayStatus === 'maintenance').length,
  };

  const totalRooms = rooms.length;
  const activeCount = statusCounts.occupied + statusCounts.booked;
  const occupancyRate = totalRooms > 0 ? Math.round((activeCount / totalRooms) * 100) : 0;

  // Front Desk Quick Bar queues
  const pendingOnlineBookings = bookings
    .filter(b => b.status === 'pending')
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  const arrivalBookings = bookings
    .filter(b =>
      b.status === 'booked' &&
      (checkDate === today ? b.checkIn <= checkDate : b.checkIn === checkDate)
    )
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  const departureBookings = bookings
    .filter(b =>
      b.status === 'checked_in' &&
      (checkDate === today ? b.checkOut <= checkDate : b.checkOut === checkDate)
    )
    .sort((a, b) => a.checkOut.localeCompare(b.checkOut));

  // Filter rooms for grid display
  const filteredRooms = roomsWithStatus.filter(room => {
    if (filter !== ALL_STATUS && room.displayStatus !== filter) return false;
    if (floorFilter !== 'all' && room.floor !== Number(floorFilter)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchRoom = room.number.toLowerCase().includes(q) || (ROOM_TYPES[room.type] || '').toLowerCase().includes(q);
      const matchGuest = room.activeBooking?.guestName?.toLowerCase().includes(q) ||
        room.activeBooking?.guestPhone?.includes(q) ||
        room.activeBooking?.id?.toLowerCase().includes(q);
      if (!matchRoom && !matchGuest) return false;
    }
    return true;
  });

  const visibleFloors = floorFilter === 'all' ? floors : [Number(floorFilter)];

  const openRoomModal = (room, initialView = 'detail', dateOverride = null) => {
    setModalState({ room, initialView, dateOverride });
  };

  const handleQuickClean = (e, room) => {
    e.stopPropagation();
    markClean(room.id);
    toast(`✨ ຫ້ອງ ${room.number} ສະອາດພ້ອມຂາຍແລ້ວ!`, 'success');
  };

  const handleQuickConfirm = (e, booking) => {
    e.stopPropagation();
    confirmBooking(booking.id);
    toast(`✅ ຢືນຢັນການຈອງ ${booking.id} (${booking.guestName}) ສຳເລັດ!`, 'success');
  };

  const toggleFilter = (next) => {
    setFilter(prev => (prev === next && next !== ALL_STATUS ? ALL_STATUS : next));
  };

  return (
    <div className="page-container">
      {/* Top Action & Date Toolbar */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
              🏨 ຜັງຫ້ອງພັກປະຈຳວັນ ({formatDate(checkDate)})
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              ກົດໃສ່ກາດຫ້ອງ ຫຼື ປຸ່ມລັດດ້ານລຸ່ມເພື່ອ <strong>ຈອງຫ້ອງ</strong>, <strong>ກົດ Check-in</strong>, ຫຼື <strong>ກົດ Check-out</strong> ໄດ້ທັນທີ
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Quick Date Switchers */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-surface)', padding: '4px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <button
                className={`btn btn-sm ${checkDate === today ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCheckDate(today)}
              >
                ມື້ນີ້
              </button>
              <button
                className={`btn btn-sm ${checkDate === tomorrow ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCheckDate(tomorrow)}
              >
                ມື້ອື່ນ
              </button>
              <input
                type="date"
                className="form-control"
                style={{ width: 'auto', padding: '5px 10px', fontSize: '0.82rem' }}
                value={checkDate}
                onChange={(e) => e.target.value && setCheckDate(e.target.value)}
              />
            </div>

            {isOwnerOrReception && navigate && (
              <button
                className="btn btn-warning"
                style={{ fontWeight: 700 }}
                onClick={() => navigate('cashier')}
              >
                🧾 ແຄັດເຊຍຂາຍຫ້ອງ & ພິມບິນ
              </button>
            )}
            {isOwnerOrReception && (
              <button
                className="btn btn-primary"
                onClick={() => setNewBookingMode({ directCheckIn: false })}
              >
                ➕ ຈອງຫ້ອງໃໝ່
              </button>
            )}
            {navigate && (
              <button className="btn btn-secondary" onClick={() => navigate('booking')}>
                📑 ຕາຕະລາງລາຍວັນ (1..31)
              </button>
            )}
            {navigate && (
              <button
                className="btn btn-outline-primary"
                style={{ fontWeight: 700 }}
                onClick={() => navigate('housekeeping')}
              >
                🧹 ໜ້າແມ່ບ້ານ & ສ້ອມແປງ
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Prominent Pending Online Bookings Banner */}
      {isOwnerOrReception && pendingOnlineBookings.length > 0 && (
        <div
          style={{
            background: 'linear-gradient(90deg, #fef3c7, #fde68a)',
            border: '2px solid #f59e0b',
            borderRadius: 'var(--radius)',
            padding: '12px 18px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem' }}>🌐</span>
            <div>
              <div style={{ fontWeight: 800, color: '#92400e', fontSize: '0.95rem' }}>
                ມີການຈອງອອນລາຍລໍຢືນຢັນ {pendingOnlineBookings.length} ລາຍການ
              </div>
              <div style={{ fontSize: '0.78rem', color: '#b45309' }}>
                ລູກຄ້າໄດ້ສົ່ງການຈອງຜ່ານມືຖື/ເວັບໄຊ ກະລຸນາກວດສອບ ແລະ ກົດຢືນຢັນຫ້ອງ
              </div>
            </div>
          </div>
          {navigate && (
            <button
              className="btn btn-warning btn-sm"
              style={{ fontWeight: 800, padding: '8px 16px' }}
              onClick={() => navigate('booking')}
            >
              📋 ໄປຈັດການການຈອງ →
            </button>
          )}
        </div>
      )}

      {/* Clickable Summary Stat Cards */}
      <div className="stats-grid" style={{ marginBottom: '16px' }}>
        <div
          className="stat-card"
          onClick={() => toggleFilter(ALL_STATUS)}
          style={{
            cursor: 'pointer',
            borderTop: '3px solid var(--primary)',
            outline: filter === ALL_STATUS ? '2px solid var(--primary)' : 'none',
          }}
        >
          <div className="stat-value">{totalRooms}</div>
          <div className="stat-label">🏨 {t('totalRooms')}</div>
        </div>

        <div
          className="stat-card"
          onClick={() => toggleFilter('available')}
          style={{
            cursor: 'pointer',
            borderTop: `3px solid ${ROOM_DISPLAY_META.available.color}`,
            outline: filter === 'available' ? `2px solid ${ROOM_DISPLAY_META.available.color}` : 'none',
          }}
        >
          <div className="stat-value" style={{ color: ROOM_DISPLAY_META.available.color }}>{statusCounts.available}</div>
          <div className="stat-label">🟢 ຫ້ອງວ່າງ (ພ້ອມຂາຍ)</div>
        </div>

        <div
          className="stat-card"
          onClick={() => toggleFilter('booked')}
          style={{
            cursor: 'pointer',
            borderTop: `3px solid ${ROOM_DISPLAY_META.booked.color}`,
            outline: filter === 'booked' ? `2px solid ${ROOM_DISPLAY_META.booked.color}` : 'none',
          }}
        >
          <div className="stat-value" style={{ color: ROOM_DISPLAY_META.booked.color }}>{statusCounts.booked}</div>
          <div className="stat-label">🔵 ຈອງແລ້ວ (ຍັງບໍ່ເຂົ້າພັກ)</div>
        </div>

        <div
          className="stat-card"
          onClick={() => toggleFilter('occupied')}
          style={{
            cursor: 'pointer',
            borderTop: `3px solid ${ROOM_DISPLAY_META.occupied.color}`,
            outline: filter === 'occupied' ? `2px solid ${ROOM_DISPLAY_META.occupied.color}` : 'none',
          }}
        >
          <div className="stat-value" style={{ color: ROOM_DISPLAY_META.occupied.color }}>{statusCounts.occupied}</div>
          <div className="stat-label">🔴 ເຂົ້າພັກແລ້ວ (ພັກຢູ່)</div>
        </div>

        {statusCounts.waiting_checkin > 0 && (
          <div
            className="stat-card"
            onClick={() => toggleFilter('waiting_checkin')}
            style={{
              cursor: 'pointer',
              borderTop: `3px solid ${ROOM_DISPLAY_META.waiting_checkin.color}`,
              outline: filter === 'waiting_checkin' ? `2px solid ${ROOM_DISPLAY_META.waiting_checkin.color}` : 'none',
            }}
          >
            <div className="stat-value" style={{ color: ROOM_DISPLAY_META.waiting_checkin.color }}>{statusCounts.waiting_checkin}</div>
            <div className="stat-label">🟡 ຈອງອອນລາຍ (ລໍຢືນຢັນ)</div>
          </div>
        )}

        {statusCounts.cleaning > 0 && (
          <div
            className="stat-card"
            onClick={() => toggleFilter('cleaning')}
            style={{
              cursor: 'pointer',
              borderTop: `3px solid ${ROOM_DISPLAY_META.cleaning.color}`,
              outline: filter === 'cleaning' ? `2px solid ${ROOM_DISPLAY_META.cleaning.color}` : 'none',
            }}
          >
            <div className="stat-value" style={{ color: ROOM_DISPLAY_META.cleaning.color }}>{statusCounts.cleaning}</div>
            <div className="stat-label">🟣 ລໍອະນາໄມ</div>
          </div>
        )}

        {statusCounts.maintenance > 0 && (
          <div
            className="stat-card"
            onClick={() => toggleFilter('maintenance')}
            style={{
              cursor: 'pointer',
              borderTop: `3px solid ${ROOM_DISPLAY_META.maintenance.color}`,
              outline: filter === 'maintenance' ? `2px solid ${ROOM_DISPLAY_META.maintenance.color}` : 'none',
            }}
          >
            <div className="stat-value" style={{ color: ROOM_DISPLAY_META.maintenance.color }}>{statusCounts.maintenance}</div>
            <div className="stat-label">⚫ ປິດສ້ອມແປງ</div>
          </div>
        )}

        <div className="stat-card" style={{ borderTop: '3px solid var(--accent)' }}>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{occupancyRate}%</div>
          <div className="stat-label">📈 ອັດຕາການເຂົ້າພັກ</div>
        </div>
      </div>

      {/* Front Desk Quick Action Bar */}
      {isOwnerOrReception && (pendingOnlineBookings.length > 0 || arrivalBookings.length > 0 || departureBookings.length > 0) && (
        <div
          className="card"
          style={{
            padding: '14px 18px',
            marginBottom: '16px',
            background: '#FFFDF7',
            border: '1px solid #E5D4B3',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--primary)' }}>
              ⚡ ວຽກດ່ວນໜ້າເຄົາເຕີ ({checkDate === today ? 'ມື້ນີ້' : formatDate(checkDate)})
            </div>
            <div style={{ display: 'flex', gap: '10px', fontSize: '0.78rem', fontWeight: 600 }}>
              {pendingOnlineBookings.length > 0 && (
                <span style={{ color: '#b45309' }}>🟡 ລໍຢືນຢັນ {pendingOnlineBookings.length}</span>
              )}
              <span style={{ color: '#1d4ed8' }}>📥 ລໍ Check-in {arrivalBookings.length}</span>
              <span style={{ color: '#b91c1c' }}>📤 ກຳນົດ Check-out {departureBookings.length}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            {/* Pending Online Confirmations */}
            {pendingOnlineBookings.length > 0 && (
              <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#92400e', marginBottom: '8px' }}>
                  🟡 ຈອງອອນລາຍລໍຢືນຢັນ ({pendingOnlineBookings.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {pendingOnlineBookings.slice(0, 4).map(b => {
                    const rm = rooms.find(r => r.id === b.roomId);
                    return (
                      <div
                        key={b.id}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
                          background: '#fff', padding: '6px 8px', borderRadius: '6px', border: '1px solid #FDE68A', fontSize: '0.8rem'
                        }}
                      >
                        <div
                          style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
                          onClick={() => rm && openRoomModal(rm, 'detail', b.checkIn)}
                        >
                          <strong>ຫ້ອງ {rm?.number || b.roomNumber}</strong> · {b.guestName}
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            ເຂົ້າ {formatDate(b.checkIn)} · {formatCurrency(b.totalAmount)}
                          </div>
                        </div>
                        <button
                          className="btn btn-sm btn-success"
                          style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                          onClick={(e) => handleQuickConfirm(e, b)}
                        >
                          ✅ ຢືນຢັນ
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Expected Check-ins (Reserved, not checked in yet) */}
            {arrivalBookings.length > 0 && (
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1e40af', marginBottom: '8px' }}>
                  📥 ລໍ Check-in / ຍັງບໍ່ເຂົ້າພັກ ({arrivalBookings.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {arrivalBookings.slice(0, 4).map(b => {
                    const rm = rooms.find(r => r.id === b.roomId);
                    const isOverdue = b.checkIn < today;
                    return (
                      <div
                        key={b.id}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
                          background: '#fff', padding: '6px 8px', borderRadius: '6px', border: '1px solid #DBEAFE', fontSize: '0.8rem'
                        }}
                      >
                        <div
                          style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
                          onClick={() => rm && openRoomModal(rm, 'detail', b.checkIn)}
                        >
                          <strong>ຫ້ອງ {rm?.number || b.roomNumber}</strong> · {b.guestName}
                          <div style={{ fontSize: '0.72rem', color: isOverdue ? '#b91c1c' : 'var(--text-muted)' }}>
                            {isOverdue ? `⚠️ ກາຍກຳນົດ (${formatDate(b.checkIn)})` : `ເຂົ້າ ${formatDate(b.checkIn)}`} · {b.guestPhone || b.id}
                          </div>
                        </div>
                        {rm && (
                          <button
                            className="btn btn-sm btn-primary"
                            style={{ padding: '4px 9px', fontSize: '0.75rem' }}
                            onClick={() => setDirectCheckInBooking({ booking: b, room: rm })}
                          >
                            🛎️ Check-in
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Expected Check-outs (Checked in) */}
            {departureBookings.length > 0 && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#991b1b', marginBottom: '8px' }}>
                  📤 ກຳນົດ Check-out ({departureBookings.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {departureBookings.slice(0, 4).map(b => {
                    const rm = rooms.find(r => r.id === b.roomId);
                    const isOverdue = b.checkOut < today;
                    return (
                      <div
                        key={b.id}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
                          background: '#fff', padding: '6px 8px', borderRadius: '6px', border: '1px solid #FEE2E2', fontSize: '0.8rem'
                        }}
                      >
                        <div
                          style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
                          onClick={() => rm && openRoomModal(rm, 'detail', today)}
                        >
                          <strong>ຫ້ອງ {rm?.number || b.roomNumber}</strong> · {b.guestName}
                          <div style={{ fontSize: '0.72rem', color: isOverdue ? '#b91c1c' : 'var(--text-muted)' }}>
                            {isOverdue ? `⚠️ ກາຍກຳນົດອອກ (${formatDate(b.checkOut)})` : `ອອກ ${formatDate(b.checkOut)}`}
                          </div>
                        </div>
                        {rm && (
                          <button
                            className="btn btn-sm btn-warning"
                            style={{ padding: '4px 9px', fontSize: '0.75rem' }}
                            onClick={() => setDirectCheckOutBooking({ booking: b, room: rm })}
                          >
                            🚪 Check-out
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter Tabs + Floor Filter + Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div className="filter-tabs" style={{ marginBottom: 0 }}>
          <button
            className={`filter-tab ${filter === ALL_STATUS ? 'active' : ''}`}
            onClick={() => setFilter(ALL_STATUS)}
          >
            ທັງໝົດ <span className="filter-tab-count">{totalRooms}</span>
          </button>
          <button
            className={`filter-tab ${filter === 'available' ? 'active' : ''}`}
            onClick={() => setFilter('available')}
          >
            🟢 ຫ້ອງວ່າງ <span className="filter-tab-count">{statusCounts.available}</span>
          </button>
          <button
            className={`filter-tab ${filter === 'booked' ? 'active' : ''}`}
            onClick={() => setFilter('booked')}
          >
            🔵 ຈອງແລ້ວ (ຍັງບໍ່ເຂົ້າພັກ) <span className="filter-tab-count">{statusCounts.booked}</span>
          </button>
          <button
            className={`filter-tab ${filter === 'occupied' ? 'active' : ''}`}
            onClick={() => setFilter('occupied')}
          >
            🔴 ເຂົ້າພັກແລ້ວ <span className="filter-tab-count">{statusCounts.occupied}</span>
          </button>
          {statusCounts.waiting_checkin > 0 && (
            <button
              className={`filter-tab ${filter === 'waiting_checkin' ? 'active' : ''}`}
              onClick={() => setFilter('waiting_checkin')}
            >
              🟡 ລໍຢືນຢັນ <span className="filter-tab-count">{statusCounts.waiting_checkin}</span>
            </button>
          )}
          {statusCounts.cleaning > 0 && (
            <button
              className={`filter-tab ${filter === 'cleaning' ? 'active' : ''}`}
              onClick={() => setFilter('cleaning')}
            >
              🟣 ອະນາໄມ <span className="filter-tab-count">{statusCounts.cleaning}</span>
            </button>
          )}
          {statusCounts.maintenance > 0 && (
            <button
              className={`filter-tab ${filter === 'maintenance' ? 'active' : ''}`}
              onClick={() => setFilter('maintenance')}
            >
              ⚫ ສ້ອມແປງ <span className="filter-tab-count">{statusCounts.maintenance}</span>
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <button
              className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('cards')}
            >
              🪪 ແບບກາດ
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('table')}
            >
              📊 ຕາຕະລາງເບີຫ້ອງ
            </button>
          </div>
          <input
            type="text"
            className="form-control"
            style={{ width: '200px', padding: '6px 12px', fontSize: '0.82rem' }}
            placeholder="🔍 ຄົ້ນຫາເລກຫ້ອງ ຫຼື ຊື່ແຂກ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-control"
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.82rem' }}
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
          >
            <option value="all">🏢 ທຸກຊັ້ນ</option>
            {floors.map(f => (
              <option key={f} value={f}>ຊັ້ນ {f}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Rooms View: All-Rooms Table or Cards by Floor */}
      {viewMode === 'table' ? (
        <RoomStatusTable
          rooms={filteredRooms}
          bookings={bookings}
          targetDate={checkDate}
          getRoomStatusOnDate={getRoomStatusOnDate}
          isOwnerOrReception={isOwnerOrReception}
          isHousekeeping={isHousekeeping}
          onOpenRoom={openRoomModal}
          onQuickCheckIn={(b, rm) => setDirectCheckInBooking({ booking: b, room: rm })}
          onQuickCheckOut={(b, rm) => setDirectCheckOutBooking({ booking: b, room: rm })}
          onConfirmPending={(b) => {
            confirmBooking(b.id);
            toast(`✅ ຢືນຢັນການຈອງ ${b.id} (${b.guestName}) ສຳເລັດ!`, 'success');
          }}
          onCleanRoom={(rm) => {
            markClean(rm.id);
            toast(`✨ ຫ້ອງ ${rm.number} ສະອາດພ້ອມຂາຍແລ້ວ!`, 'success');
          }}
        />
      ) : filteredRooms.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>🔍</div>
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>ບໍ່ພົບຫ້ອງຕາມເງື່ອນໄຂທີ່ເລືອກ</div>
          <button
            className="btn btn-sm btn-secondary"
            style={{ marginTop: '10px' }}
            onClick={() => { setFilter(ALL_STATUS); setFloorFilter('all'); setSearch(''); }}
          >
            🔄 ສະແດງທຸກຫ້ອງ
          </button>
        </div>
      ) : (
        visibleFloors.map(floor => {
          const floorRooms = filteredRooms.filter(r => r.floor === floor);
          if (floorRooms.length === 0) return null;
          return (
            <div key={floor} style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--primary)' }}>
                  🏢 ຊັ້ນ {floor}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  ({floorRooms.length} ຫ້ອງ)
                </span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))', gap: '14px' }}>
                {floorRooms.map(room => (
                  <RoomCardItem
                    key={room.id}
                    room={room}
                    checkDate={checkDate}
                    today={today}
                    isOwnerOrReception={isOwnerOrReception}
                    isHousekeeping={isHousekeeping}
                    onOpenDetail={() => openRoomModal(room, 'detail')}
                    onBook={() => openRoomModal(room, 'booking')}
                    onQuickCheckIn={() => openRoomModal(room, 'quick_pay')}
                    onCheckIn={() => openRoomModal(room, 'checkin')}
                    onCheckOut={() => openRoomModal(room, 'checkout')}
                    onEdit={() => openRoomModal(room, 'edit')}
                    onConfirm={(e) => handleQuickConfirm(e, room.activeBooking)}
                    onClean={(e) => handleQuickClean(e, room)}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Room Detail / Quick Action Modal */}
      {modalState && (
        <RoomModal
          room={rooms.find(r => r.id === modalState.room.id) || modalState.room}
          selectedDate={modalState.dateOverride || checkDate}
          initialView={modalState.initialView || 'detail'}
          onClose={() => setModalState(null)}
        />
      )}

      {/* New General Booking Modal (not preselected room) */}
      {newBookingMode && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setNewBookingMode(null)}>
          <div className="modal modal-lg">
            <BookingForm
              preselectedRoom={null}
              defaultCheckIn={newBookingMode.defaultCheckIn || checkDate}
              initialDirectCheckIn={newBookingMode.directCheckIn}
              bookingToEdit={newBookingMode.bookingToEdit || null}
              onClose={() => setNewBookingMode(null)}
              onBack={() => setNewBookingMode(null)}
            />
          </div>
        </div>
      )}

      {/* Direct Check-In Modal from Quick Bar */}
      {directCheckInBooking && (
        <CheckInModal
          booking={directCheckInBooking.booking}
          room={directCheckInBooking.room}
          onClose={() => setDirectCheckInBooking(null)}
          onBack={() => setDirectCheckInBooking(null)}
        />
      )}

      {/* Direct Check-Out Modal from Quick Bar */}
      {directCheckOutBooking && (
        <CheckOutModal
          booking={directCheckOutBooking.booking}
          room={directCheckOutBooking.room}
          onClose={() => setDirectCheckOutBooking(null)}
          onBack={() => setDirectCheckOutBooking(null)}
        />
      )}
    </div>
  );
}

function RoomCardItem({
  room,
  checkDate,
  today,
  isOwnerOrReception,
  isHousekeeping,
  onOpenDetail,
  onBook,
  onQuickCheckIn,
  onCheckIn,
  onCheckOut,
  onEdit,
  onConfirm,
  onClean,
}) {
  const { meta, activeBooking, nextBooking, displayStatus } = room;

  const extraSum = (activeBooking?.extraCharges || []).reduce((s, e) => s + (e.amount || 0), 0);
  const totalDue = (activeBooking?.totalAmount || 0) + extraSum;
  const remaining = Math.max(0, totalDue - (activeBooking?.paidAmount || 0));

  return (
    <div
      className="room-card"
      style={{
        '--status-color': meta.color,
        borderTop: `4px solid ${meta.color}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textAlign: 'left',
        padding: '14px',
        minHeight: '195px',
      }}
      onClick={onOpenDetail}
    >
      <div>
        {/* Card Header: Room Number & Emoji */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              ຫ້ອງ {room.number}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {ROOM_TYPES[room.type] || room.type}
            </div>
          </div>
          <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>{meta.emoji}</span>
        </div>

        {/* Status Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: meta.bg,
            color: meta.color,
            border: `1px solid ${meta.border}`,
            borderRadius: '999px',
            padding: '3px 9px',
            fontSize: '0.73rem',
            fontWeight: 700,
            marginBottom: '8px',
          }}
        >
          {meta.shortLabel} · {meta.subLabel}
        </div>

        {/* Booking Info OR Availability Info */}
        {activeBooking ? (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', background: 'var(--bg-surface)', padding: '7px 9px', borderRadius: '6px', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              👤 {activeBooking.guestName}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              📅 {formatDate(activeBooking.checkIn)} → {formatDate(activeBooking.checkOut)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '0.72rem' }}>
              {remaining > 0 ? (
                <span style={{ color: '#b45309', fontWeight: 700 }}>
                  ຄ້າງ {formatCurrency(remaining)}
                </span>
              ) : (
                <span style={{ color: '#15803d', fontWeight: 700 }}>
                  ✅ ຈ່າຍຄົບ
                </span>
              )}
              {displayStatus === 'booked' && activeBooking.checkIn === today && (
                <span style={{ color: '#1d4ed8', fontWeight: 700 }}>ເຂົ້າມື້ນີ້</span>
              )}
              {displayStatus === 'occupied' && activeBooking.checkOut <= checkDate && (
                <span style={{ color: '#b91c1c', fontWeight: 700 }}>ກຳນົດອອກ</span>
              )}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '4px 0' }}>
            <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '0.88rem' }}>
              {formatCurrency(room.price)} / ຄືນ
            </div>
            {nextBooking ? (
              <div style={{ fontSize: '0.72rem', color: '#1d4ed8', marginTop: '3px', fontWeight: 600 }}>
                📅 ຄິວຕໍ່: {formatDate(nextBooking.checkIn)}
              </div>
            ) : (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                {displayStatus === 'available' ? '✨ ວ່າງພ້ອມຮັບແຂກ' : meta.subLabel}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div
        style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}
        onClick={(e) => e.stopPropagation()}
      >
        {displayStatus === 'available' && isOwnerOrReception && (
          <>
            <button
              className="room-card-quick-btn"
              style={{ flex: 1, background: '#183D2D', color: '#fff', borderColor: '#183D2D' }}
              onClick={onBook}
            >
              📝 ຈອງຫ້ອງ
            </button>
            <button
              className="room-card-quick-btn"
              style={{ background: '#dcfce7', color: '#15803d', borderColor: '#86efac' }}
              onClick={onQuickCheckIn}
              title="ຂາຍຫ້ອງ & ພິມໃບບິນທັນທີ"
            >
              ⚡ {checkDate === today ? 'ຂາຍ/ເຂົ້າພັກ' : 'ຂາຍເລີຍ'}
            </button>
          </>
        )}

        {displayStatus === 'booked' && isOwnerOrReception && (
          <>
            <button
              className="room-card-quick-btn"
              style={{ flex: 1, background: '#1d4ed8', color: '#fff', borderColor: '#1d4ed8' }}
              onClick={onCheckIn}
            >
              🛎️ ກົດ Check-in
            </button>
            <button
              className="room-card-quick-btn"
              onClick={onEdit}
              title="ແກ້ໄຂການຈອງ"
            >
              ✏️
            </button>
          </>
        )}

        {displayStatus === 'occupied' && isOwnerOrReception && (
          <>
            <button
              className="room-card-quick-btn"
              style={{ flex: 1, background: '#b91c1c', color: '#fff', borderColor: '#b91c1c' }}
              onClick={onCheckOut}
            >
              🚪 ກົດ Check-out
            </button>
            <button
              className="room-card-quick-btn"
              onClick={onOpenDetail}
              title="ເບິ່ງລາຍລະອຽດ"
            >
              👁️
            </button>
          </>
        )}

        {displayStatus === 'waiting_checkin' && isOwnerOrReception && (
          <>
            <button
              className="room-card-quick-btn"
              style={{ flex: 1, background: '#15803d', color: '#fff', borderColor: '#15803d' }}
              onClick={onConfirm}
            >
              ✅ ຢືນຢັນຈອງ
            </button>
            <button
              className="room-card-quick-btn"
              onClick={onOpenDetail}
              title="ເບິ່ງຫຼັກຖານ"
            >
              👁️
            </button>
          </>
        )}

        {displayStatus === 'cleaning' && (isOwnerOrReception || isHousekeeping) && (
          <button
            className="room-card-quick-btn"
            style={{ flex: 1, background: '#7e22ce', color: '#fff', borderColor: '#7e22ce' }}
            onClick={onClean}
          >
            ✨ ອະນາໄມແລ້ວ
          </button>
        )}

        {(displayStatus === 'maintenance' || (!isOwnerOrReception && !isHousekeeping)) && (
          <button
            className="room-card-quick-btn"
            style={{ flex: 1 }}
            onClick={onOpenDetail}
          >
            👁️ ເບິ່ງຂໍ້ມູນ
          </button>
        )}
      </div>
    </div>
  );
}
