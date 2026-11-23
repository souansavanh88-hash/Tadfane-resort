import { useState, useMemo } from 'react';
import { useHotel } from '../context/HotelContext';
import {
  ROOM_TYPES, formatCurrency, formatDate, todayStr, addDays
} from '../data/initialData';
import CheckInRegistrationModal from '../components/CheckInRegistrationModal';

export default function TabletCheckInPage() {
  const { rooms, bookings, getRoomStatusOnDate, isRoomAvailableForDates } = useHotel();
  const today = todayStr();
  const tomorrow = addDays(today, 1);

  const [activeTab, setActiveTab] = useState('active'); // active | booked | checked_in | walkin
  const [search, setSearch] = useState('');
  const [regTarget, setRegTarget] = useState(null); // { booking, room } | { booking: null, room }

  const activeBookings = useMemo(() => {
    const list = bookings.filter(b => b.status === 'booked' || b.status === 'checked_in');
    return list.sort((a, b) => {
      // Prioritize today's arrivals waiting for check-in, then unsigned checked_in, then rest
      const score = (item) => {
        if (item.status === 'booked' && item.checkIn <= today) return 0;
        if (item.status === 'booked') return 1;
        if (item.status === 'checked_in' && !item.signatureDataUrl) return 2;
        return 3;
      };
      const diff = score(a) - score(b);
      if (diff !== 0) return diff;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [bookings, today]);

  const bookedCount = activeBookings.filter(b => b.status === 'booked').length;
  const unsignedCheckedInCount = activeBookings.filter(b => b.status === 'checked_in' && !b.signatureDataUrl).length;
  const signedCount = activeBookings.filter(b => Boolean(b.signatureDataUrl)).length;

  const availableRoomsToday = useMemo(() => {
    return rooms.filter(r => {
      const { status } = getRoomStatusOnDate(r.id, today);
      return status === 'available' && isRoomAvailableForDates(r.id, today, tomorrow);
    });
  }, [rooms, getRoomStatusOnDate, isRoomAvailableForDates, today, tomorrow]);

  const filteredBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeBookings.filter(b => {
      if (activeTab === 'booked' && b.status !== 'booked') return false;
      if (activeTab === 'checked_in' && b.status !== 'checked_in') return false;
      if (!q) return true;
      const rm = rooms.find(r => r.id === b.roomId);
      return (
        (b.guestName || '').toLowerCase().includes(q) ||
        (b.id || '').toLowerCase().includes(q) ||
        (b.guestPhone || '').toLowerCase().includes(q) ||
        (b.passportNo || '').toLowerCase().includes(q) ||
        (rm?.number || '').toLowerCase().includes(q)
      );
    });
  }, [activeBookings, activeTab, search, rooms]);

  const filteredWalkInRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return availableRoomsToday.filter(r => {
      if (!q) return true;
      return (
        r.number.toLowerCase().includes(q) ||
        (ROOM_TYPES[r.type] || '').toLowerCase().includes(q)
      );
    });
  }, [availableRoomsToday, search]);

  return (
    <div className="page-container">
      {/* Header Banner */}
      <div className="card" style={{
        marginBottom: '18px',
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        flexWrap: 'wrap',
        background: 'linear-gradient(135deg, #FFFDF9 0%, #F5EFE4 100%)',
      }}>
        <div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            📱 ຟອມລົງທະບຽນ Check-in ສຳລັບ iPad / ແທັບເລັດ
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
            ເລືອກການຈອງ ຫຼື ຫ້ອງວ່າງ ເພື່ອເປີດໃບລົງທະບຽນຮັບຫ້ອງໃຫ້ລູກຄ້າກວດຂໍ້ມູນ ແລະ ເຊັນຊື່ຢູ່ເຄົາເຕີ້
          </div>
        </div>
        <button
          type="button"
          className="btn btn-lg"
          style={{
            background: '#d96528',
            color: '#fff',
            fontWeight: 800,
            padding: '12px 20px',
            boxShadow: '0 4px 14px rgba(217, 101, 40, 0.3)',
          }}
          onClick={() => setRegTarget({ booking: null, room: availableRoomsToday[0] || null })}
        >
          ✍️ Walk-in Check-in ໃໝ່ (iPad)
        </button>
      </div>

      {/* Quick Stats */}
      <div className="stats-grid" style={{ marginBottom: '18px' }}>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('booked')}>
          <div className="stat-label">🛎️ ລໍຖ້າ Check-in</div>
          <div className="stat-value" style={{ color: '#2563eb' }}>{bookedCount}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('checked_in')}>
          <div className="stat-label">⏳ ພັກຢູ່ (ລໍຖ້າລາຍເຊັນ)</div>
          <div className="stat-value" style={{ color: '#d97706' }}>{unsignedCheckedInCount}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('active')}>
          <div className="stat-label">✅ ເຊັນລົງທະບຽນແລ້ວ</div>
          <div className="stat-value" style={{ color: '#16a34a' }}>{signedCount}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('walkin')}>
          <div className="stat-label">🟢 ຫ້ອງວ່າງ Walk-in ມື້ນີ້</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{availableRoomsToday.length}</div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
        marginBottom: '16px',
      }}>
        <div className="filter-tabs" style={{ marginBottom: 0 }}>
          {[
            { key: 'active', label: '📋 ທັງໝົດ', count: activeBookings.length },
            { key: 'booked', label: '🛎️ ລໍຖ້າ Check-in', count: bookedCount },
            { key: 'checked_in', label: '🏨 ກຳລັງພັກ', count: activeBookings.filter(b => b.status === 'checked_in').length },
            { key: 'walkin', label: '🟢 Walk-in ຫ້ອງວ່າງ', count: availableRoomsToday.length },
          ].map(t => (
            <button
              key={t.key}
              type="button"
              className={`filter-tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              <span>{t.label}</span>
              <span className="filter-tab-count">{t.count}</span>
            </button>
          ))}
        </div>

        <input
          className="form-input"
          style={{ width: '280px', maxWidth: '100%' }}
          placeholder="🔍 ຄົ້ນຫາຊື່ແຂກ, ເບີຫ້ອງ, ເລກຈອງ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Walk-in Available Rooms Grid */}
      {activeTab === 'walkin' ? (
        filteredWalkInRooms.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">🏨</div>
              <div className="empty-state-text">ບໍ່ມີຫ້ອງວ່າງສຳລັບ Walk-in ມື້ນີ້</div>
            </div>
          </div>
        ) : (
          <div className="tablet-checkin-grid">
            {filteredWalkInRooms.map(rm => (
              <div key={rm.id} className="tablet-checkin-card">
                <div className="tablet-card-top">
                  <div className="tablet-room-badge" style={{ background: '#16a34a' }}>
                    ຫ້ອງ {rm.number}
                  </div>
                  <span className="badge badge-available">🟢 ວ່າງ</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                  {ROOM_TYPES[rm.type] || rm.type}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  ຊັ້ນ {rm.floor} · {rm.size} · ພັກໄດ້ {rm.capacity} ທ່ານ
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-dark)', marginTop: '4px' }}>
                  {formatCurrency(rm.price)} / ຄືນ
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 'auto', padding: '11px' }}
                  onClick={() => setRegTarget({ booking: null, room: rm })}
                >
                  📝 ເປີດຟອມລົງທະບຽນ Walk-in
                </button>
              </div>
            ))}
          </div>
        )
      ) : filteredBookings.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📱</div>
            <div className="empty-state-text">ບໍ່ພົບລາຍການລູກຄ້າ — ລອງກົດແຖບ "Walk-in ຫ້ອງວ່າງ" ເພື່ອລົງທະບຽນແຂກໃໝ່</div>
          </div>
        </div>
      ) : (
        <div className="tablet-checkin-grid">
          {filteredBookings.map(b => {
            const rm = rooms.find(r => r.id === b.roomId);
            const isCheckedIn = b.status === 'checked_in';
            const isSigned = Boolean(b.signatureDataUrl);
            const paidSoFar = Number(b.deposit || 0) + Number(b.remainingPaid || 0);
            const remaining = Math.max(0, Number(b.totalAmount || 0) - paidSoFar);

            return (
              <div key={b.id} className="tablet-checkin-card">
                <div className="tablet-card-top">
                  <div className="tablet-room-badge">
                    ຫ້ອງ {rm?.number || b.roomId}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span className={`badge ${isCheckedIn ? 'badge-occupied' : 'badge-booked'}`}>
                      {isCheckedIn ? '🟢 ກຳລັງພັກ' : '🔵 ລໍ Check-in'}
                    </span>
                    <span
                      className="badge"
                      style={isSigned
                        ? { background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }
                        : { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}
                    >
                      {isSigned ? '✍️ ເຊັນແລ້ວ' : '⏳ ຍັງບໍ່ເຊັນ'}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {b.id} · {ROOM_TYPES[rm?.type] || rm?.type}
                  </div>
                  <div style={{ fontSize: '1.08rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                    👤 {b.guestName}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    📞 {b.guestPhone || '-'} {b.passportNo ? `· 🪪 ${b.passportNo}` : ''}
                  </div>
                </div>

                <div style={{
                  background: 'var(--bg-base)',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}>
                  <span>📅 {formatDate(b.checkIn)} → {formatDate(b.checkOut)} ({b.nights || 1} ຄືນ)</span>
                  <span style={{ fontWeight: 700, color: remaining > 0 ? '#b45309' : '#15803d' }}>
                    {remaining > 0 ? `ຄ້າງ ${formatCurrency(remaining)}` : '✅ ຈ່າຍຄົບ'}
                  </span>
                </div>

                <button
                  type="button"
                  className={`btn ${isCheckedIn ? 'btn-secondary' : 'btn-primary'}`}
                  style={{ width: '100%', marginTop: 'auto', padding: '11px', fontWeight: 700 }}
                  onClick={() => setRegTarget({ booking: b, room: rm })}
                >
                  {isCheckedIn
                    ? (isSigned ? '📄 ເບິ່ງ / ພິມໃບລົງທະບຽນ' : '✍️ ໃຫ້ແຂກເຊັນໃບລົງທະບຽນ')
                    : '📱 ເປີດຟອມ Check-in (iPad)'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {regTarget && (
        <CheckInRegistrationModal
          booking={regTarget.booking}
          room={regTarget.room}
          onClose={() => setRegTarget(null)}
          onBack={() => setRegTarget(null)}
        />
      )}
    </div>
  );
}
