import { useState } from 'react';
import {
  ROOM_TYPES, BLOCKING_STATUSES,
  formatCurrency, todayStr, addDays, toLocalDateStr
} from '../data/initialData';
import { exportToCsv } from '../utils/exportCsv';

const ROOM_STATUS_STYLE = {
  available: {
    emoji: '🟢',
    label: 'ຫ້ອງວ່າງ',
    color: '#15803d',
    bg: '#dcfce7',
    border: '#86efac',
    cellBg: '#f0fdf4',
  },
  booked: {
    emoji: '🔵',
    label: 'ຈອງແລ້ວ (ຍັງບໍ່ເຂົ້າພັກ)',
    color: '#1d4ed8',
    bg: '#dbeafe',
    border: '#93c5fd',
    cellBg: '#dbeafe',
  },
  occupied: {
    emoji: '🔴',
    label: 'ເຂົ້າພັກແລ້ວ',
    color: '#b91c1c',
    bg: '#fee2e2',
    border: '#fca5a5',
    cellBg: '#fee2e2',
  },
  waiting_checkin: {
    emoji: '🟡',
    label: 'ລໍຢືນຢັນ',
    color: '#b45309',
    bg: '#fef3c7',
    border: '#fcd34d',
    cellBg: '#fef3c7',
  },
  cleaning: {
    emoji: '🟣',
    label: 'ອະນາໄມ',
    color: '#7e22ce',
    bg: '#f3e8ff',
    border: '#d8b4fe',
    cellBg: '#f3e8ff',
  },
  maintenance: {
    emoji: '⚫',
    label: 'ປິດສ້ອມແປງ',
    color: '#475569',
    bg: '#e2e8f0',
    border: '#cbd5e1',
    cellBg: '#e2e8f0',
  },
};

const BOOKING_BADGE_STYLE = {
  pending: { emoji: '🟡', label: 'ລໍຢືນຢັນ', color: '#b45309', bg: '#fef3c7', border: '#fcd34d' },
  booked: { emoji: '🔵', label: 'ຈອງແລ້ວ (ຍັງບໍ່ເຂົ້າພັກ)', color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' },
  checked_in: { emoji: '🟢', label: 'ເຂົ້າພັກແລ້ວ', color: '#15803d', bg: '#dcfce7', border: '#86efac' },
  checked_out: { emoji: '⚫', label: 'ອອກແລ້ວ', color: '#475569', bg: '#e2e8f0', border: '#cbd5e1' },
};

const WEEKDAY_LO = ['ອາທິດ', 'ຈັນ', 'ອັງຄານ', 'ພຸດ', 'ພະຫັດ', 'ສຸກ', 'ເສົາ'];
const MONTHS_LO = [
  'ມັງກອນ', 'ກຸມພາ', 'ມີນາ', 'ເມສາ', 'ພຶດສະພາ', 'ມິຖຸນາ',
  'ກໍລະກົດ', 'ສິງຫາ', 'ກັນຍາ', 'ຕຸລາ', 'ພະຈິກ', 'ທັນວາ'
];

function shortDate(dateStr) {
  if (!dateStr || !dateStr.includes('-')) return dateStr || '-';
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

function fullLaoDate(dateStr) {
  if (!dateStr || !dateStr.includes('-')) return dateStr || '-';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = WEEKDAY_LO[dt.getDay()] || '';
  const mo = MONTHS_LO[m - 1] || m;
  return `ວັນ${wd}, ${d} ${mo} ${y}`;
}

function getWeekdayLabel(dateStr) {
  if (!dateStr || !dateStr.includes('-')) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return WEEKDAY_LO[dt.getDay()] || '';
}

function sortRoomsByNumber(list) {
  return [...list].sort((a, b) =>
    String(a.number).localeCompare(String(b.number), undefined, { numeric: true })
  );
}

function shiftYearMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  return toLocalDateStr(new Date(y, m - 1 + delta, 1)).slice(0, 7);
}

/**
 * ຕາຕະລາງສະແດງເບີຫ້ອງທັງໝົດແບບລາຍວັນ (1 ແຖວ = 1 ຫ້ອງ)
 */
export function RoomStatusTable({
  rooms,
  bookings,
  targetDate,
  getRoomStatusOnDate,
  isOwnerOrReception = true,
  isHousekeeping = false,
  onOpenRoom,
  onQuickCheckIn,
  onQuickCheckOut,
  onConfirmPending,
  onCleanRoom,
  onNoShow,
  onCancelBooking,
}) {
  const today = todayStr();
  const sortedRooms = sortRoomsByNumber(rooms);

  if (sortedRooms.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '44px 20px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔍</div>
        <div style={{ fontWeight: 700 }}>ບໍ່ພົບຫ້ອງຕາມເງື່ອນໄຂທີ່ເລືອກ</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ເບີຫ້ອງ</th>
              <th>ຊັ້ນ / ປະເພດ</th>
              <th>ລາຄາ/ຄືນ</th>
              <th>ສະຖານະ ({shortDate(targetDate)})</th>
              <th>ລູກຄ້າ / ຄິວຖັດໄປ</th>
              <th>ວັນເຂົ້າ - ອອກ</th>
              <th>ຍອດ / ຄ້າງຈ່າຍ</th>
              <th>ຈັດການ</th>
            </tr>
          </thead>
          <tbody>
            {sortedRooms.map(room => {
              const { status, booking } = getRoomStatusOnDate(room.id, targetDate);
              const meta = ROOM_STATUS_STYLE[status] || ROOM_STATUS_STYLE.available;

              const upcoming = !booking
                ? bookings
                    .filter(b =>
                      b.roomId === room.id &&
                      BLOCKING_STATUSES.includes(b.status) &&
                      b.checkIn > targetDate
                    )
                    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0] || null
                : null;

              const shownBooking = booking || upcoming;
              const extraSum = (shownBooking?.extraCharges || []).reduce((s, e) => s + (e.amount || 0), 0);
              const grandTotal = shownBooking ? (shownBooking.finalTotal || ((shownBooking.totalAmount || 0) + extraSum)) : 0;
              const remaining = shownBooking ? Math.max(0, grandTotal - (shownBooking.paidAmount || 0)) : 0;

              return (
                <tr key={room.id} style={{ background: status === 'occupied' ? '#FFF8F8' : status === 'booked' ? '#F7FAFF' : undefined }}>
                  <td>
                    <button
                      type="button"
                      onClick={() => onOpenRoom(room, 'detail', targetDate)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'var(--bg-surface)',
                        border: `1.5px solid ${meta.border}`,
                        borderRadius: '8px',
                        padding: '5px 10px',
                        fontWeight: 800,
                        fontSize: '0.95rem',
                        color: 'var(--primary)',
                        cursor: 'pointer',
                      }}
                      title="ກົດເພື່ອເບິ່ງລາຍລະອຽດຫ້ອງ"
                    >
                      <span>{meta.emoji}</span>
                      <span>ຫ້ອງ {room.number}</span>
                    </button>
                  </td>

                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>{ROOM_TYPES[room.type] || room.type}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>ຊັ້ນ {room.floor}</div>
                  </td>

                  <td style={{ fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                    {formatCurrency(room.price)}
                  </td>

                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        background: meta.bg,
                        color: meta.color,
                        border: `1px solid ${meta.border}`,
                        borderRadius: '999px',
                        padding: '3px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {meta.emoji} {meta.label}
                    </span>
                  </td>

                  <td>
                    {booking ? (
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>👤 {booking.guestName}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {booking.guestPhone || booking.id}
                        </div>
                      </div>
                    ) : upcoming ? (
                      <div
                        style={{ cursor: 'pointer' }}
                        onClick={() => onOpenRoom(room, 'detail', upcoming.checkIn)}
                        title="ກົດເພື່ອເບິ່ງການຈອງຖັດໄປ"
                      >
                        <div style={{ fontSize: '0.76rem', fontWeight: 700, color: upcoming.status === 'pending' ? '#b45309' : '#1d4ed8' }}>
                          {upcoming.status === 'pending' ? '🟡 ລໍຢືນຢັນ' : '📅 ຄິວຕໍ່'}: {upcoming.guestName}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          ເຂົ້າ {shortDate(upcoming.checkIn)} · {upcoming.id}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>— ພ້ອມຮັບແຂກ —</span>
                    )}
                  </td>

                  <td style={{ whiteSpace: 'nowrap' }}>
                    {shownBooking ? (
                      <div style={{ opacity: booking ? 1 : 0.8 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          {shortDate(shownBooking.checkIn)} → {shortDate(shownBooking.checkOut)}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {shownBooking.nights || 1} ຄືນ {!booking ? '(ຄິວຈອງ)' : ''}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>-</span>
                    )}
                  </td>

                  <td style={{ whiteSpace: 'nowrap' }}>
                    {shownBooking ? (
                      <div style={{ opacity: booking ? 1 : 0.85 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{formatCurrency(grandTotal)}</div>
                        {remaining > 0 ? (
                          <div style={{ fontSize: '0.73rem', color: '#b45309', fontWeight: 700 }}>
                            ຄ້າງ {formatCurrency(remaining)}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.73rem', color: '#15803d', fontWeight: 700 }}>✅ ຈ່າຍຄົບ</div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>-</span>
                    )}
                  </td>

                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {status === 'available' && isOwnerOrReception && (
                        <>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => onOpenRoom(room, 'booking', targetDate)}
                          >
                            📝 ຈອງຫ້ອງ
                          </button>
                          {targetDate === today && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => onOpenRoom(room, 'quick_pay', targetDate)}
                            >
                              ⚡ ເຂົ້າພັກ
                            </button>
                          )}
                          {upcoming && upcoming.status === 'booked' && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => onOpenRoom(room, 'detail', upcoming.checkIn)}
                              title={`ເບິ່ງຄິວ ${shortDate(upcoming.checkIn)}`}
                            >
                              📅 ຄິວຕໍ່
                            </button>
                          )}
                          {upcoming && upcoming.status === 'pending' && onConfirmPending && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => onConfirmPending(upcoming)}
                            >
                              ✅ ຢືນຢັນຄິວ
                            </button>
                          )}
                        </>
                      )}

                      {status === 'booked' && isOwnerOrReception && booking && (
                        <>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => onQuickCheckIn ? onQuickCheckIn(booking, room) : onOpenRoom(room, 'checkin', targetDate)}
                          >
                            🛎️ Check-in
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => onOpenRoom(room, 'edit', targetDate)}
                            title="ແກ້ໄຂ"
                          >
                            ✏️
                          </button>
                          {onNoShow && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => onNoShow(booking)}
                              title="ໝາຍ No-Show"
                            >
                              👻
                            </button>
                          )}
                          {onCancelBooking && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => onCancelBooking(booking)}
                              title="ຍົກເລີກ"
                            >
                              ❌
                            </button>
                          )}
                        </>
                      )}

                      {status === 'occupied' && isOwnerOrReception && booking && (
                        <>
                          <button
                            className="btn btn-warning btn-sm"
                            onClick={() => onQuickCheckOut ? onQuickCheckOut(booking, room) : onOpenRoom(room, 'checkout', targetDate)}
                          >
                            🚪 Check-out
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => onOpenRoom(room, 'edit', targetDate)}
                            title="ແກ້ໄຂ"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => onOpenRoom(room, 'detail', targetDate)}
                            title="ລາຍລະອຽດ"
                          >
                            👁️
                          </button>
                        </>
                      )}

                      {status === 'waiting_checkin' && isOwnerOrReception && booking && (
                        <>
                          {onConfirmPending && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => onConfirmPending(booking)}
                            >
                              ✅ ຢືນຢັນ
                            </button>
                          )}
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => onOpenRoom(room, 'detail', targetDate)}
                          >
                            👁️ ກວດສອບ
                          </button>
                        </>
                      )}

                      {status === 'cleaning' && (isOwnerOrReception || isHousekeeping) && (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ background: '#7e22ce', borderColor: '#7e22ce' }}
                          onClick={() => onCleanRoom(room)}
                        >
                          ✨ ອະນາໄມແລ້ວ
                        </button>
                      )}

                      {(status === 'maintenance' || (!isOwnerOrReception && !(status === 'cleaning' && isHousekeeping))) && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onOpenRoom(room, 'detail', targetDate)}
                        >
                          👁️ ເບິ່ງ
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * ຕາຕະລາງປະຕິທິນຫ້ອງພັກ (ແຖວ = ເບີຫ້ອງ, ຖັນ = ແຕ່ລະວັນທີ 7 / 14 / 30 ມື້)
 */
export function RoomCalendarTable({
  rooms,
  startDate,
  onChangeStartDate,
  getRoomStatusOnDate,
  isOwnerOrReception = true,
  onOpenRoom,
}) {
  const today = todayStr();
  const [dayCount, setDayCount] = useState(7);
  const [onlyWithBookings, setOnlyWithBookings] = useState(false);
  const sortedRooms = sortRoomsByNumber(rooms);

  const dates = Array.from({ length: dayCount }, (_, i) => addDays(startDate, i));

  // Filter rooms that have at least one active booking in this date window when toggled
  const roomsWithBookingInRange = sortedRooms.filter(room =>
    dates.some(d => Boolean(getRoomStatusOnDate(room.id, d).booking))
  );

  const displayedRooms = onlyWithBookings ? roomsWithBookingInRange : sortedRooms;

  // Daily summary counts across all filtered rooms
  const dailySummary = {};
  dates.forEach(d => {
    let busy = 0;
    let avail = 0;
    sortedRooms.forEach(rm => {
      const { status } = getRoomStatusOnDate(rm.id, d);
      if (status === 'available') avail++;
      else if (['booked', 'occupied', 'waiting_checkin'].includes(status)) busy++;
    });
    dailySummary[d] = { busy, avail };
  });

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Calendar Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '12px 16px',
          background: '#FFFDF7',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => onChangeStartDate(addDays(startDate, -dayCount))}
          >
            ◀ {dayCount} ມື້ກ່ອນ
          </button>
          <button
            className={`btn btn-sm ${startDate === today ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onChangeStartDate(today)}
          >
            📅 ມື້ນີ້
          </button>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => onChangeStartDate(addDays(startDate, dayCount))}
          >
            {dayCount} ມື້ໜ້າ ▶
          </button>
          <input
            type="date"
            className="form-control"
            style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}
            value={startDate}
            onChange={(e) => e.target.value && onChangeStartDate(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', fontSize: '0.73rem', flexWrap: 'wrap' }}>
            <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 7px', borderRadius: '6px', fontWeight: 700 }}>🟢 ວ່າງ (ກົດຈອງ)</span>
            <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '2px 7px', borderRadius: '6px', fontWeight: 700 }}>🔵 ຈອງແລ້ວ</span>
            <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 7px', borderRadius: '6px', fontWeight: 700 }}>🔴 ເຂົ້າພັກແລ້ວ</span>
            <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 7px', borderRadius: '6px', fontWeight: 700 }}>🟡 ລໍຢືນຢັນ</span>
          </div>

          <button
            className={`btn btn-sm ${onlyWithBookings ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setOnlyWithBookings(v => !v)}
            title="ສະແດງສະເພາະຫ້ອງທີ່ມີການຈອງໃນຊ່ວງວັນທີນີ້"
          >
            {onlyWithBookings ? `📌 ມີຄິວຈອງ (${roomsWithBookingInRange.length})` : `ທຸກຫ້ອງ (${sortedRooms.length})`}
          </button>

          <div style={{ display: 'flex', gap: '4px' }}>
            {[7, 14, 30].map(n => (
              <button
                key={n}
                className={`btn btn-sm ${dayCount === n ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDayCount(n)}
              >
                {n} ມື້
              </button>
            ))}
          </div>
        </div>
      </div>

      {displayedRooms.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '44px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</div>
          <div style={{ fontWeight: 700, marginBottom: '8px' }}>
            {onlyWithBookings ? 'ບໍ່ມີຫ້ອງທີ່ມີຄິວຈອງໃນຊ່ວງວັນທີທີ່ເລືອກ' : 'ບໍ່ພົບຫ້ອງຕາມເງື່ອນໄຂທີ່ເລືອກ'}
          </div>
          {onlyWithBookings && (
            <button className="btn btn-sm btn-secondary" onClick={() => setOnlyWithBookings(false)}>
              ສະແດງທຸກຫ້ອງ ({sortedRooms.length})
            </button>
          )}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: dayCount >= 30 ? '2500px' : dayCount >= 14 ? '1280px' : '100%',
              fontSize: '0.78rem',
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 3,
                    background: '#F4EDE0',
                    borderBottom: '2px solid var(--border)',
                    borderRight: '2px solid var(--border)',
                    padding: '10px 12px',
                    textAlign: 'left',
                    minWidth: '145px',
                    color: 'var(--primary)',
                  }}
                >
                  ເບີຫ້ອງ / ປະເພດ
                </th>
                {dates.map(d => {
                  const isTodayCol = d === today;
                  const sum = dailySummary[d] || { busy: 0, avail: 0 };
                  return (
                    <th
                      key={d}
                      style={{
                        padding: '7px 6px',
                        textAlign: 'center',
                        borderBottom: '2px solid var(--border)',
                        borderRight: '1px solid var(--border)',
                        background: isTodayCol ? '#183D2D' : '#F8F3E9',
                        color: isTodayCol ? '#FFF9F0' : 'var(--text-primary)',
                        minWidth: '94px',
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', opacity: isTodayCol ? 0.9 : 0.7 }}>
                        {isTodayCol ? '⭐ ມື້ນີ້' : getWeekdayLabel(d)}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '0.84rem' }}>{shortDate(d)}</div>
                      <div
                        style={{
                          fontSize: '0.66rem',
                          marginTop: '2px',
                          fontWeight: 700,
                          color: isTodayCol ? '#FDE68A' : sum.busy > 0 ? '#1d4ed8' : '#15803d',
                        }}
                      >
                        {sum.busy > 0 ? `ຈອງ ${sum.busy} · ວ່າງ ${sum.avail}` : `ວ່າງ ${sum.avail}`}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displayedRooms.map(room => (
                <tr key={room.id}>
                  <td
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      background: '#FFFDF8',
                      borderBottom: '1px solid var(--border)',
                      borderRight: '2px solid var(--border)',
                      padding: '8px 12px',
                      cursor: 'pointer',
                    }}
                    onClick={() => onOpenRoom(room, 'detail', startDate)}
                  >
                    <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.9rem' }}>
                      ຫ້ອງ {room.number}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {ROOM_TYPES[room.type] || room.type} · {formatCurrency(room.price)}
                    </div>
                  </td>

                  {dates.map(d => {
                    const { status, booking } = getRoomStatusOnDate(room.id, d);
                    const meta = ROOM_STATUS_STYLE[status] || ROOM_STATUS_STYLE.available;
                    const isCheckInDay = booking && booking.checkIn === d;
                    const isLastNight = booking && addDays(d, 1) === booking.checkOut;

                    return (
                      <td
                        key={d}
                        style={{
                          padding: '4px',
                          borderBottom: '1px solid var(--border)',
                          borderRight: '1px solid var(--border)',
                          background: d === today ? '#FFFBF0' : '#fff',
                          verticalAlign: 'middle',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (status === 'available' && isOwnerOrReception) {
                              onOpenRoom(room, 'booking', d);
                            } else {
                              onOpenRoom(room, 'detail', d);
                            }
                          }}
                          title={
                            booking
                              ? `ຫ້ອງ ${room.number} (${shortDate(d)}): ${booking.guestName} [${meta.label}] (${shortDate(booking.checkIn)}→${shortDate(booking.checkOut)})`
                              : `ຫ້ອງ ${room.number} (${shortDate(d)}): ${meta.label}`
                          }
                          style={{
                            width: '100%',
                            minHeight: '38px',
                            padding: '4px 6px',
                            borderRadius: '6px',
                            border: `1px solid ${meta.border}`,
                            background: meta.cellBg,
                            color: meta.color,
                            fontWeight: 700,
                            fontSize: '0.73rem',
                            cursor: 'pointer',
                            textAlign: booking ? 'left' : 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            gap: '1px',
                            overflow: 'hidden',
                          }}
                        >
                          {booking ? (
                            <>
                              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                                {meta.emoji} {booking.guestName}
                              </div>
                              <div style={{ fontSize: '0.65rem', opacity: 0.85 }}>
                                {isCheckInDay ? '📥 ເຂົ້າ' : isLastNight ? '📤 ຄືນສຸດທ້າຍ' : 'ພັກຕໍ່'}
                              </div>
                            </>
                          ) : (
                            <span>
                              {status === 'available' ? (isOwnerOrReception ? '+ ຈອງ' : '🟢 ວ່າງ') : `${meta.emoji} ${meta.label}`}
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * ມຸມມອງປະຕິທິນລາຍເດືອນ + ລາຍການຈອງແຍກຕາມແຕ່ລະວັນທີ (Daily Bookings View)
 */
export function DateByDateBookingsView({
  rooms,
  bookings,
  isOwnerOrReception = true,
  onNewBookingForDate,
  onOpenRoom,
  onQuickCheckIn,
  onQuickCheckOut,
  onEditBooking,
  onConfirmPending,
  onRejectPending,
  onNoShow,
  onCancelBooking,
  onOpenReceipt,
}) {
  const today = todayStr();
  const tomorrow = addDays(today, 1);

  const [yearMonth, setYearMonth] = useState(today.slice(0, 7)); // 'YYYY-MM'
  const [focusedDate, setFocusedDate] = useState(null); // null = show all dates with bookings in this month, or 'YYYY-MM-DD'
  const [showEmptyDays, setShowEmptyDays] = useState(false);

  const [yearNum, monthNum] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const firstWeekday = new Date(yearNum, monthNum - 1, 1).getDay();
  const monthLabel = `${MONTHS_LO[monthNum - 1] || monthNum} ${yearNum}`;

  const monthDates = Array.from({ length: daysInMonth }, (_, i) =>
    toLocalDateStr(new Date(yearNum, monthNum - 1, i + 1))
  );

  // Relevant bookings (exclude cancelled/no_show for calendar clarity)
  const validBookings = bookings.filter(b => !['cancelled', 'no_show'].includes(b.status));

  const getRoomFor = (b) => rooms.find(r => r.id === b.roomId) || {
    id: b.roomId,
    number: b.roomNumber || '?',
    type: b.roomType || 'standard',
    price: b.roomPrice || 0,
  };

  // Compute bookings touching each date d
  const getDayData = (d) => {
    // Active / pending / staying nights covering date d
    const stayingOrReserved = validBookings.filter(b => b.checkIn <= d && d < b.checkOut);
    // Guests checking out on morning d (and still checked_in)
    const departingToday = validBookings.filter(
      b => b.checkOut === d && b.status === 'checked_in'
    );

    const seen = new Set();
    const combined = [];
    stayingOrReserved.forEach(b => {
      seen.add(b.id);
      const dayRole = b.checkIn === d ? 'checkin' : 'staying';
      combined.push({ booking: b, dayRole, room: getRoomFor(b) });
    });
    departingToday.forEach(b => {
      if (!seen.has(b.id)) {
        combined.push({ booking: b, dayRole: 'checkout', room: getRoomFor(b) });
      }
    });

    combined.sort((a, b) =>
      String(a.room.number).localeCompare(String(b.room.number), undefined, { numeric: true })
    );

    const occupiedRoomCount = stayingOrReserved.filter(b => BLOCKING_STATUSES.includes(b.status)).length;
    const availableCount = Math.max(0, rooms.length - occupiedRoomCount);

    return { items: combined, stayingOrReserved, occupiedRoomCount, availableCount };
  };

  const dayLookup = {};
  monthDates.forEach(d => {
    dayLookup[d] = getDayData(d);
  });

  // Also capture bookings outside the month if none? No, month navigation lets user jump anywhere,
  // and if user clicks "today" it jumps to today's month.
  const datesToRender = focusedDate
    ? [focusedDate]
    : monthDates.filter(d => {
        if (showEmptyDays) return true;
        return dayLookup[d].items.length > 0 || d === today;
      });

  const handleSelectMonth = (delta) => {
    const nextYm = shiftYearMonth(yearMonth, delta);
    setYearMonth(nextYm);
    setFocusedDate(null);
  };

  const calendarCells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...monthDates,
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Monthly Calendar Card */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-sm btn-secondary" onClick={() => handleSelectMonth(-1)}>
              ◀ ເດືອນກ່ອນ
            </button>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary)', minWidth: '150px', textAlign: 'center' }}>
              📆 {monthLabel}
            </div>
            <button className="btn btn-sm btn-secondary" onClick={() => handleSelectMonth(1)}>
              ເດືອນໜ້າ ▶
            </button>
            <button
              className={`btn btn-sm ${yearMonth === today.slice(0, 7) && !focusedDate ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setYearMonth(today.slice(0, 7)); setFocusedDate(null); }}
            >
              📅 ເດືອນນີ້
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {focusedDate && (
              <button className="btn btn-sm btn-primary" onClick={() => setFocusedDate(null)}>
                ✕ ເບິ່ງທຸກວັນໃນເດືອນ ({monthLabel})
              </button>
            )}
            {!focusedDate && (
              <button
                className={`btn btn-sm ${showEmptyDays ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setShowEmptyDays(v => !v)}
              >
                {showEmptyDays ? '📌 ເບິ່ງສະເພາະວັນທີ່ມີຈອງ' : '📆 ສະແດງທຸກວັນໃນເດືອນ'}
              </button>
            )}
          </div>
        </div>

        {/* 7-Column Calendar Grid */}
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: '720px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '6px' }}>
              {WEEKDAY_LO.map((wd, idx) => (
                <div
                  key={wd}
                  style={{
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    padding: '6px 4px',
                    background: '#F4EDE0',
                    borderRadius: '6px',
                    color: idx === 0 ? '#b91c1c' : 'var(--primary)',
                  }}
                >
                  {wd}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
              {calendarCells.map((d, idx) => {
                if (!d) {
                  return <div key={`empty-${idx}`} style={{ minHeight: '88px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px' }} />;
                }
                const info = dayLookup[d] || getDayData(d);
                const dayNum = Number(d.split('-')[2]);
                const isToday = d === today;
                const isSelected = d === focusedDate;
                const activeStays = info.stayingOrReserved;

                return (
                  <div
                    key={d}
                    onClick={() => setFocusedDate(prev => (prev === d ? null : d))}
                    style={{
                      minHeight: '92px',
                      padding: '6px',
                      borderRadius: '8px',
                      border: isSelected
                        ? '2px solid var(--primary)'
                        : isToday
                          ? '2px solid #C99A55'
                          : '1px solid var(--border)',
                      background: isSelected
                        ? '#EEF6F0'
                        : isToday
                          ? '#FFFBEB'
                          : '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '0.84rem',
                          color: isToday ? '#183D2D' : 'var(--text-primary)',
                        }}
                      >
                        {dayNum} {isToday ? '· ມື້ນີ້' : d === tomorrow ? '· ມື້ອື່ນ' : ''}
                      </span>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          color: activeStays.length > 0 ? '#1d4ed8' : '#15803d',
                          background: activeStays.length > 0 ? '#dbeafe' : '#dcfce7',
                          padding: '1px 5px',
                          borderRadius: '999px',
                        }}
                      >
                        {activeStays.length > 0 ? `ຈອງ ${activeStays.length}` : 'ວ່າງ'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {activeStays.slice(0, 3).map(b => {
                        const rm = getRoomFor(b);
                        const st = BOOKING_BADGE_STYLE[b.status] || BOOKING_BADGE_STYLE.booked;
                        return (
                          <div
                            key={b.id}
                            style={{
                              fontSize: '0.67rem',
                              fontWeight: 700,
                              padding: '2px 5px',
                              borderRadius: '4px',
                              background: st.bg,
                              color: st.color,
                              border: `1px solid ${st.border}`,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={`ຫ້ອງ ${rm.number} - ${b.guestName} (${st.label})`}
                          >
                            {st.emoji} {rm.number} · {b.guestName}
                          </div>
                        );
                      })}
                      {activeStays.length > 3 && (
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                          + ອີກ {activeStays.length - 3} ຫ້ອງ
                        </div>
                      )}
                      {activeStays.length === 0 && (
                        <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                          ວ່າງ {info.availableCount} ຫ້ອງ
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Date-by-Date Agenda Breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {datesToRender.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</div>
            <div style={{ fontWeight: 700 }}>ຍັງບໍ່ມີລາຍການຈອງໃນເດືອນ {monthLabel}</div>
          </div>
        ) : (
          datesToRender.map(d => {
            const info = dayLookup[d] || getDayData(d);
            const tag = d === today ? '⭐ ມື້ນີ້' : d === tomorrow ? '📅 ມື້ອື່ນ' : '';

            return (
              <div key={d} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: d === today ? '4px solid #183D2D' : '4px solid var(--accent)' }}>
                {/* Date Section Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                    padding: '10px 16px',
                    background: d === today ? '#EEF6F0' : '#FFF9EC',
                    borderBottom: info.items.length > 0 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--primary)' }}>
                      📅 {fullLaoDate(d)}
                    </span>
                    {tag && (
                      <span style={{ background: '#183D2D', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px' }}>
                        {tag}
                      </span>
                    )}
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      · ມີຄິວ {info.items.length} ລາຍການ · ຫ້ອງວ່າງ {info.availableCount}/{rooms.length} ຫ້ອງ
                    </span>
                  </div>

                  {isOwnerOrReception && onNewBookingForDate && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => onNewBookingForDate(d)}
                    >
                      ➕ ຈອງວັນທີ {shortDate(d)}
                    </button>
                  )}
                </div>

                {/* Bookings under this date */}
                {info.items.length === 0 ? (
                  <div style={{ padding: '12px 16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    — ບໍ່ມີລາຍການເຂົ້າພັກ ຫຼື ຄິວຈອງໃນວັນທີນີ້ —
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>ເບີຫ້ອງ</th>
                          <th>ກິດຈະກຳວັນນີ້</th>
                          <th>ລູກຄ້າ</th>
                          <th>ຊ່ວງວັນພັກ</th>
                          <th>ຍອດ / ຄ້າງຈ່າຍ</th>
                          <th>ສະຖານະ</th>
                          <th>ຈັດການ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {info.items.map(({ booking: b, dayRole, room: rm }) => {
                          const st = BOOKING_BADGE_STYLE[b.status] || BOOKING_BADGE_STYLE.booked;
                          const extraSum = (b.extraCharges || []).reduce((s, e) => s + (e.amount || 0), 0);
                          const grandTotal = b.finalTotal || ((b.totalAmount || 0) + extraSum);
                          const remaining = Math.max(0, grandTotal - (b.paidAmount || 0));

                          return (
                            <tr key={`${d}-${b.id}`}>
                              <td>
                                <button
                                  type="button"
                                  onClick={() => onOpenRoom(rm, 'detail', b.checkIn)}
                                  style={{
                                    background: 'var(--bg-surface)',
                                    border: `1.5px solid ${st.border}`,
                                    borderRadius: '8px',
                                    padding: '4px 10px',
                                    fontWeight: 800,
                                    color: 'var(--primary)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  ຫ້ອງ {rm.number}
                                </button>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {ROOM_TYPES[rm.type] || rm.type}
                                </div>
                              </td>

                              <td style={{ whiteSpace: 'nowrap' }}>
                                {dayRole === 'checkin' && (
                                  <span style={{ color: '#1d4ed8', fontWeight: 700, fontSize: '0.8rem' }}>📥 ເຂົ້າພັກວັນນີ້</span>
                                )}
                                {dayRole === 'staying' && (
                                  <span style={{ color: '#15803d', fontWeight: 700, fontSize: '0.8rem' }}>🛏️ ພັກຕໍ່</span>
                                )}
                                {dayRole === 'checkout' && (
                                  <span style={{ color: '#b91c1c', fontWeight: 700, fontSize: '0.8rem' }}>📤 ກຳນົດອອກວັນນີ້</span>
                                )}
                              </td>

                              <td>
                                <div style={{ fontWeight: 700 }}>{b.guestName}</div>
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                  {b.guestPhone || b.id}
                                </div>
                              </td>

                              <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                                <div>{shortDate(b.checkIn)} → {shortDate(b.checkOut)}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{b.nights || 1} ຄືນ</div>
                              </td>

                              <td style={{ whiteSpace: 'nowrap' }}>
                                <div style={{ fontWeight: 700 }}>{formatCurrency(grandTotal)}</div>
                                {remaining > 0 ? (
                                  <div style={{ fontSize: '0.73rem', color: '#b45309', fontWeight: 700 }}>
                                    ຄ້າງ {formatCurrency(remaining)}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '0.73rem', color: '#15803d', fontWeight: 700 }}>✅ ຄົບ</div>
                                )}
                              </td>

                              <td>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    background: st.bg,
                                    color: st.color,
                                    border: `1px solid ${st.border}`,
                                    borderRadius: '999px',
                                    padding: '2px 9px',
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {st.emoji} {st.label}
                                </span>
                              </td>

                              <td>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                  {b.status === 'pending' && isOwnerOrReception && (
                                    <>
                                      {onConfirmPending && (
                                        <button className="btn btn-success btn-sm" onClick={() => onConfirmPending(b)}>
                                          ✅ ຢືນຢັນ
                                        </button>
                                      )}
                                      {onEditBooking && (
                                        <button className="btn btn-secondary btn-sm" onClick={() => onEditBooking(b)}>
                                          ✏️ ແກ້ໄຂ
                                        </button>
                                      )}
                                      {onRejectPending && (
                                        <button className="btn btn-danger btn-sm" onClick={() => onRejectPending(b)}>
                                          🚫 ປະຕິເສດ
                                        </button>
                                      )}
                                    </>
                                  )}

                                  {b.status === 'booked' && isOwnerOrReception && (
                                    <>
                                      <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => onQuickCheckIn ? onQuickCheckIn(b, rm) : onOpenRoom(rm, 'checkin', b.checkIn)}
                                      >
                                        🛎️ Check-in
                                      </button>
                                      {onEditBooking && (
                                        <button className="btn btn-secondary btn-sm" onClick={() => onEditBooking(b)}>
                                          ✏️ ແກ້ໄຂ
                                        </button>
                                      )}
                                      {onNoShow && (
                                        <button className="btn btn-secondary btn-sm" onClick={() => onNoShow(b)} title="No-Show">
                                          👻
                                        </button>
                                      )}
                                      {onCancelBooking && (
                                        <button className="btn btn-danger btn-sm" onClick={() => onCancelBooking(b)} title="ຍົກເລີກ">
                                          ❌
                                        </button>
                                      )}
                                    </>
                                  )}

                                  {b.status === 'checked_in' && isOwnerOrReception && (
                                    <>
                                      <button
                                        className="btn btn-warning btn-sm"
                                        onClick={() => onQuickCheckOut ? onQuickCheckOut(b, rm) : onOpenRoom(rm, 'checkout', d)}
                                      >
                                        🚪 Check-out
                                      </button>
                                      {onEditBooking && (
                                        <button className="btn btn-secondary btn-sm" onClick={() => onEditBooking(b)}>
                                          ✏️ ແກ້ໄຂ
                                        </button>
                                      )}
                                    </>
                                  )}

                                  {b.status === 'checked_out' && onOpenReceipt && (
                                    <button className="btn btn-secondary btn-sm" onClick={() => onOpenReceipt(b, rm)}>
                                      🧾 ໃບບິນ
                                    </button>
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
            );
          })
        )}
      </div>
    </div>
  );
}

const FX_STORAGE_KEY = 'tadfane_fx_rates';

function loadFxRates() {
  try {
    const raw = localStorage.getItem(FX_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        thb: Number(parsed.thb) > 0 ? Number(parsed.thb) : 700,
        usd: Number(parsed.usd) > 0 ? Number(parsed.usd) : 21500,
      };
    }
  } catch {
    // ignore storage errors
  }
  return { thb: 700, usd: 21500 };
}

function fmtNum(n) {
  return new Intl.NumberFormat('en-US').format(Math.round(n || 0));
}

/**
 * ຕາຕະລາງລາຍວັນແບບ Excel (ແຖບວັນທີ 1..31 + ເຫັນທຸກຫ້ອງພັກ + ສະຫຼຸບຍອດເງິນ)
 */
export function DailyLedgerSheet({
  rooms,
  bookings,
  getRoomStatusOnDate,
  isOwnerOrReception = true,
  isHousekeeping = false,
  onOpenRoom,
  onQuickCheckIn,
  onQuickCheckOut,
  onConfirmPending,
  onCleanRoom,
}) {
  const today = todayStr();
  const [yearMonth, setYearMonth] = useState(today.slice(0, 7)); // 'YYYY-MM'
  const [selectedDay, setSelectedDay] = useState(Number(today.split('-')[2]));
  const [showMultiCurrency, setShowMultiCurrency] = useState(false);
  const [fxRates, setFxRates] = useState(loadFxRates);
  const [statusFilter, setStatusFilter] = useState('all');

  const [yearNum, monthNum] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const safeDay = Math.min(Math.max(1, selectedDay), daysInMonth);
  const activeDate = toLocalDateStr(new Date(yearNum, monthNum - 1, safeDay));
  const monthLabel = `${MONTHS_LO[monthNum - 1] || monthNum} ${yearNum}`;

  const sortedRooms = sortRoomsByNumber(rooms);
  const thbRate = Number(fxRates.thb) > 0 ? Number(fxRates.thb) : 700;
  const usdRate = Number(fxRates.usd) > 0 ? Number(fxRates.usd) : 21500;

  const updateFx = (key, val) => {
    const num = Number(val);
    setFxRates(prev => {
      const next = { ...prev, [key]: Number.isFinite(num) && num > 0 ? num : prev[key] };
      try {
        localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const handleShiftMonth = (delta) => {
    const nextYm = shiftYearMonth(yearMonth, delta);
    setYearMonth(nextYm);
    setSelectedDay(1);
  };

  // Precompute booking count for every day tab 1..daysInMonth
  const dayCounts = {};
  for (let dNum = 1; dNum <= daysInMonth; dNum++) {
    const dStr = toLocalDateStr(new Date(yearNum, monthNum - 1, dNum));
    const count = bookings.filter(
      b => BLOCKING_STATUSES.includes(b.status) && b.checkIn <= dStr && dStr < b.checkOut
    ).length;
    dayCounts[dNum] = count;
  }

  // Build rows for ALL rooms on activeDate
  const ledgerRows = sortedRooms.map((room, idx) => {
    const { status, booking } = getRoomStatusOnDate(room.id, activeDate);
    const meta = ROOM_STATUS_STYLE[status] || ROOM_STATUS_STYLE.available;

    const extraSum = (booking?.extraCharges || []).reduce((s, e) => s + (e.amount || 0), 0);
    const grandTotalLak = booking ? (booking.finalTotal || ((booking.totalAmount || 0) + extraSum)) : 0;
    const paidLak = booking ? (booking.paidAmount ?? booking.deposit ?? 0) : 0;
    const remainingLak = booking ? Math.max(0, grandTotalLak - paidLak) : 0;

    return {
      index: idx + 1,
      room,
      status,
      meta,
      booking,
      nights: booking ? (booking.nights || 1) : 0,
      grandTotalLak,
      paidLak,
      remainingLak,
    };
  });

  const filteredRows = statusFilter === 'all'
    ? ledgerRows
    : ledgerRows.filter(r => r.status === statusFilter);

  const countAvail = ledgerRows.filter(r => r.status === 'available').length;
  const countBooked = ledgerRows.filter(r => r.status === 'booked').length;
  const countOccupied = ledgerRows.filter(r => r.status === 'occupied').length;
  const countWaiting = ledgerRows.filter(r => r.status === 'waiting_checkin').length;

  // Totals across active bookings on activeDate
  const totalNightsSum = filteredRows.reduce((s, r) => s + r.nights, 0);
  const totalAmountLakSum = filteredRows.reduce((s, r) => s + r.grandTotalLak, 0);
  const totalPaidLakSum = filteredRows.reduce((s, r) => s + r.paidLak, 0);
  const totalRemainingLakSum = filteredRows.reduce((s, r) => s + r.remainingLak, 0);

  const cashPaidSum = filteredRows
    .filter(r => r.booking && (r.booking.paymentMethod === 'cash' || !r.booking.paymentMethod))
    .reduce((s, r) => s + r.paidLak, 0);
  const bankPaidSum = filteredRows
    .filter(r => r.booking && r.booking.paymentMethod && r.booking.paymentMethod !== 'cash')
    .reduce((s, r) => s + r.paidLak, 0);

  const handleExportExcelCsv = () => {
    const headers = [
      { label: 'ລ/ດ', accessor: r => r.index },
      { label: 'ຊື່ລູກຄ້າ', accessor: r => r.booking?.guestName || '' },
      { label: 'ຊ່ອງທາງ/ID', accessor: r => r.booking ? `${r.booking.bookingChannel || r.booking.channel || 'walkin'} (${r.booking.id})` : '' },
      { label: 'ເລກຫ້ອງ', accessor: r => r.room.number },
      { label: 'ປະເພດຫ້ອງ', accessor: r => ROOM_TYPES[r.room.type] || r.room.type },
      { label: 'ຫ້ອງ/ຄົນ', accessor: r => r.booking ? (r.booking.guestCount || r.room.capacity || 2) : (r.room.capacity || 2) },
      { label: 'ວັນທີ Check-in', accessor: r => r.booking?.checkIn || '' },
      { label: 'ວັນທີ Check-out', accessor: r => r.booking?.checkOut || '' },
      { label: 'ຈຳນວນຄືນ', accessor: r => r.nights },
      { label: 'ລາຄາ ກີບ/ຄືນ', accessor: r => r.room.price },
      { label: 'ລາຄາ ບາດ/ຄືນ', accessor: r => Math.round(r.room.price / thbRate) },
      { label: 'ລາຄາ ດອນລ້າ/ຄືນ', accessor: r => (r.room.price / usdRate).toFixed(2) },
      { label: 'ລວມເງິນກີບ', accessor: r => r.grandTotalLak },
      { label: 'ລວມເງິນບາດ', accessor: r => Math.round(r.grandTotalLak / thbRate) },
      { label: 'ລວມດອນລ້າ', accessor: r => (r.grandTotalLak / usdRate).toFixed(2) },
      { label: 'ສະຖານະຫ້ອງ', accessor: r => r.meta.label },
      { label: 'ຈ່າຍແລ້ວ (ກີບ)', accessor: r => r.paidLak },
      { label: 'ຄ້າງຈ່າຍ (ກີບ)', accessor: r => r.remainingLak },
      { label: 'ໝາຍເຫດ', accessor: r => r.booking?.notes || '' },
    ];
    exportToCsv(`tadfane-daily-${activeDate}`, headers, filteredRows);
  };

  const cellBorder = '1px solid #D9CEBA';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Sheet Header & Controls */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary)' }}>
              📑 ຈອງຫ້ອງພັກ ແລະ ລາຍຮັບ — {fullLaoDate(activeDate)}
              {activeDate === today && (
                <span style={{ marginLeft: '8px', background: '#183D2D', color: '#fff', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '999px' }}>
                  ⭐ ມື້ນີ້
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px', fontSize: '0.76rem', fontWeight: 700 }}>
              <button
                type="button"
                className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter('all')}
              >
                ທຸກຫ້ອງ ({ledgerRows.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${statusFilter === 'available' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter('available')}
              >
                🟢 ຫວ່າງ ({countAvail})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${statusFilter === 'booked' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter('booked')}
              >
                🔵 ຈອງແລ້ວ ({countBooked})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${statusFilter === 'occupied' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter('occupied')}
              >
                🔴 ເຂົ້າພັກແລ້ວ ({countOccupied})
              </button>
              {countWaiting > 0 && (
                <button
                  type="button"
                  className={`btn btn-sm ${statusFilter === 'waiting_checkin' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setStatusFilter('waiting_checkin')}
                >
                  🟡 ລໍຢືນຢັນ ({countWaiting})
                </button>
              )}
            </div>
          </div>

          {/* Month & Exchange Rate Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button className="btn btn-sm btn-secondary" onClick={() => handleShiftMonth(-1)}>
              ◀ ເດືອນກ່ອນ
            </button>
            <div style={{ fontWeight: 800, color: 'var(--primary)', padding: '0 6px', fontSize: '0.9rem' }}>
              {monthLabel}
            </div>
            <button className="btn btn-sm btn-secondary" onClick={() => handleShiftMonth(1)}>
              ເດືອນໜ້າ ▶
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => {
                setYearMonth(today.slice(0, 7));
                setSelectedDay(Number(today.split('-')[2]));
              }}
            >
              📅 ມື້ນີ້
            </button>
            <button
              className={`btn btn-sm ${showMultiCurrency ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowMultiCurrency(v => !v)}
              title="ເປີດ/ປິດ ຊ່ອງເງິນບາດ & ດອນລ້າ"
            >
              💱 ₭/฿/$
            </button>
            <button className="btn btn-sm btn-success" onClick={handleExportExcelCsv}>
              📥 Export Excel
            </button>
          </div>
        </div>

        {/* FX Rate Bar (optional) */}
        {showMultiCurrency && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border)', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 700 }}>💱 ອັດຕາແລກປ່ຽນອ້າງອີງ:</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              1 ບາດ (฿) =
              <input
                type="number"
                className="form-control"
                style={{ width: '78px', padding: '2px 6px', fontSize: '0.76rem' }}
                value={fxRates.thb}
                onChange={(e) => updateFx('thb', e.target.value)}
              />
              ₭
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              1 ດອນລ້າ ($) =
              <input
                type="number"
                className="form-control"
                style={{ width: '90px', padding: '2px 6px', fontSize: '0.76rem' }}
                value={fxRates.usd}
                onChange={(e) => updateFx('usd', e.target.value)}
              />
              ₭
            </label>
          </div>
        )}
      </div>

      {/* Excel-Style Day Tabs 1..31 */}
      <div
        className="card"
        style={{
          padding: '8px 10px',
          background: '#F4EDE0',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '6px' }}>
          📅 ເລືອກແຖບວັນທີ ({monthLabel}) — ກົດເລກວັນທີເພື່ອເບິ່ງທຸກຫ້ອງຂອງວັນນັ້ນ:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(dayNum => {
            const dStr = toLocalDateStr(new Date(yearNum, monthNum - 1, dayNum));
            const isSelected = dayNum === safeDay;
            const isToday = dStr === today;
            const bookingCount = dayCounts[dayNum] || 0;

            return (
              <button
                key={dayNum}
                type="button"
                onClick={() => setSelectedDay(dayNum)}
                style={{
                  minWidth: bookingCount > 0 ? '44px' : '34px',
                  height: '34px',
                  padding: '0 7px',
                  borderRadius: '6px',
                  border: isSelected
                    ? '2px solid #183D2D'
                    : isToday
                      ? '2px solid #C99A55'
                      : '1px solid #D5C8B0',
                  background: isSelected
                    ? '#183D2D'
                    : bookingCount > 0
                      ? '#DBEAFE'
                      : '#FFFFFF',
                  color: isSelected
                    ? '#FFFFFF'
                    : bookingCount > 0
                      ? '#1E40AF'
                      : 'var(--text-primary)',
                  fontWeight: isSelected || isToday || bookingCount > 0 ? 800 : 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  flexShrink: 0,
                }}
                title={`${fullLaoDate(dStr)}${bookingCount > 0 ? ` — ມີ ${bookingCount} ຫ້ອງ` : ' — ວ່າງໝົດ'}`}
              >
                <span>{dayNum}</span>
                {bookingCount > 0 && (
                  <span
                    style={{
                      fontSize: '0.64rem',
                      background: isSelected ? '#FDE68A' : '#1D4ED8',
                      color: isSelected ? '#183D2D' : '#FFFFFF',
                      borderRadius: '999px',
                      padding: '0 4px',
                      lineHeight: 1.4,
                    }}
                  >
                    {bookingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Excel-Style All-Rooms Daily Ledger Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', width: '100%' }}>
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.76rem',
              minWidth: showMultiCurrency ? '1220px' : '100%',
            }}
          >
            <thead>
              <tr style={{ background: '#EFE6D5', color: 'var(--primary)' }}>
                <th style={{ border: cellBorder, padding: '7px 5px', textAlign: 'center', width: '36px' }}>ລ/ດ</th>
                <th style={{ border: cellBorder, padding: '7px 6px', textAlign: 'left' }}>ຊື່ລູກຄ້າ</th>
                <th style={{ border: cellBorder, padding: '7px 6px', textAlign: 'left' }}>ຊ່ອງທາງ / ID</th>
                <th style={{ border: cellBorder, padding: '7px 6px', textAlign: 'center', width: '64px' }}>ເລກຫ້ອງ</th>
                <th style={{ border: cellBorder, padding: '7px 6px', textAlign: 'left' }}>ປະເພດ</th>
                <th style={{ border: cellBorder, padding: '7px 5px', textAlign: 'center', width: '44px' }}>ຄົນ</th>
                <th style={{ border: cellBorder, padding: '7px 5px', textAlign: 'center', width: '68px' }}>Check-in</th>
                <th style={{ border: cellBorder, padding: '7px 5px', textAlign: 'center', width: '68px' }}>Check-out</th>
                <th style={{ border: cellBorder, padding: '7px 5px', textAlign: 'center', width: '44px' }}>ຄືນ</th>
                <th style={{ border: cellBorder, padding: '7px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>ລາຄາ/ຄືນ</th>
                {showMultiCurrency && (
                  <>
                    <th style={{ border: cellBorder, padding: '7px 5px', textAlign: 'right', whiteSpace: 'nowrap' }}>ບາດ/ຄືນ</th>
                    <th style={{ border: cellBorder, padding: '7px 5px', textAlign: 'right', whiteSpace: 'nowrap' }}>ດອນລ້າ/ຄືນ</th>
                  </>
                )}
                <th style={{ border: cellBorder, padding: '7px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>ລວມເງິນ</th>
                {showMultiCurrency && (
                  <>
                    <th style={{ border: cellBorder, padding: '7px 5px', textAlign: 'right', whiteSpace: 'nowrap' }}>ລວມບາດ</th>
                    <th style={{ border: cellBorder, padding: '7px 5px', textAlign: 'right', whiteSpace: 'nowrap' }}>ລວມດອນລ້າ</th>
                  </>
                )}
                <th style={{ border: cellBorder, padding: '7px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>ສະຖານະຫ້ອງ</th>
                <th style={{ border: cellBorder, padding: '7px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>ການຈ່າຍເງິນ</th>
                <th style={{ border: cellBorder, padding: '7px 6px', textAlign: 'left', whiteSpace: 'nowrap' }}>ໝາຍເຫດ & ຈັດການ</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map(({ index, room, status, meta, booking, nights, grandTotalLak, paidLak, remainingLak }) => {
                const channelName = booking ? (booking.bookingChannel || booking.channel || 'walkin') : '';
                const rowBg = status === 'occupied'
                  ? '#FFF5F5'
                  : status === 'booked'
                    ? '#F3F8FF'
                    : status === 'waiting_checkin'
                      ? '#FFFBEB'
                      : index % 2 === 0
                        ? '#FCFBF8'
                        : '#FFFFFF';

                return (
                  <tr key={room.id} style={{ background: rowBg }}>
                    <td style={{ border: cellBorder, padding: '6px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>
                      {index}
                    </td>

                    <td
                      style={{ border: cellBorder, padding: '6px 8px', fontWeight: booking ? 700 : 400, cursor: 'pointer' }}
                      onClick={() => onOpenRoom(room, booking ? 'detail' : (isOwnerOrReception ? 'booking' : 'detail'), activeDate)}
                    >
                      {booking ? (
                        <span>{booking.guestName}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>—</span>
                      )}
                    </td>

                    <td style={{ border: cellBorder, padding: '6px 8px', fontSize: '0.73rem' }}>
                      {booking ? (
                        <div>
                          <div style={{ fontWeight: 700 }}>{channelName}</div>
                          <div style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.68rem' }}>{booking.id}</div>
                        </div>
                      ) : ''}
                    </td>

                    <td style={{ border: cellBorder, padding: '6px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => onOpenRoom(room, 'detail', activeDate)}
                        style={{
                          background: meta.bg,
                          color: meta.color,
                          border: `1px solid ${meta.border}`,
                          borderRadius: '6px',
                          padding: '2px 8px',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                        }}
                      >
                        {room.number}
                      </button>
                    </td>

                    <td style={{ border: cellBorder, padding: '6px 6px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {(ROOM_TYPES[room.type] || room.type).replace(/^ຫ້ອງ\s+/i, '')}
                    </td>

                    <td style={{ border: cellBorder, padding: '6px', textAlign: 'center' }}>
                      {booking ? (booking.guestCount || room.capacity || 2) : (room.capacity || 2)}
                    </td>

                    <td style={{ border: cellBorder, padding: '6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {booking ? shortDate(booking.checkIn) : ''}
                    </td>

                    <td style={{ border: cellBorder, padding: '6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {booking ? shortDate(booking.checkOut) : ''}
                    </td>

                    <td style={{ border: cellBorder, padding: '6px', textAlign: 'center', fontWeight: nights > 0 ? 700 : 400 }}>
                      {nights}
                    </td>

                    <td style={{ border: cellBorder, padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {fmtNum(room.price)}
                    </td>

                    {showMultiCurrency && (
                      <>
                        <td style={{ border: cellBorder, padding: '6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {fmtNum(Math.round(room.price / thbRate))}
                        </td>
                        <td style={{ border: cellBorder, padding: '6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          ${(room.price / usdRate).toFixed(2)}
                        </td>
                      </>
                    )}

                    <td style={{ border: cellBorder, padding: '6px 8px', textAlign: 'right', fontWeight: booking ? 800 : 400, color: booking ? 'var(--primary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      ₭ {fmtNum(grandTotalLak)}
                    </td>

                    {showMultiCurrency && (
                      <>
                        <td style={{ border: cellBorder, padding: '6px', textAlign: 'right', fontWeight: booking ? 700 : 400, whiteSpace: 'nowrap' }}>
                          ฿ {fmtNum(Math.round(grandTotalLak / thbRate))}
                        </td>
                        <td style={{ border: cellBorder, padding: '6px', textAlign: 'right', fontWeight: booking ? 700 : 400, whiteSpace: 'nowrap' }}>
                          ${(grandTotalLak / usdRate).toFixed(2)}
                        </td>
                      </>
                    )}

                    <td style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          background: meta.bg,
                          color: meta.color,
                          border: `1px solid ${meta.border}`,
                          borderRadius: '999px',
                          padding: '2px 8px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                        }}
                      >
                        {meta.emoji} {status === 'available' ? 'ຫວ່າງ' : meta.label}
                      </span>
                    </td>

                    <td style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {!booking ? (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      ) : remainingLak <= 0 ? (
                        <span style={{ color: '#15803d', fontWeight: 700 }}>✅ ຈ່າຍຄົບ</span>
                      ) : paidLak > 0 ? (
                        <span style={{ color: '#b45309', fontWeight: 700 }}>
                          ⏳ ຄ້າງ {fmtNum(remainingLak)} ₭
                        </span>
                      ) : (
                        <span style={{ color: '#b91c1c', fontWeight: 700 }}>
                          ❌ ຍັງບໍ່ຈ່າຍ ({fmtNum(remainingLak)})
                        </span>
                      )}
                    </td>

                    <td style={{ border: cellBorder, padding: '5px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                        {booking?.notes && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }} title={booking.notes}>
                            📝 {booking.notes.slice(0, 16)}{booking.notes.length > 16 ? '…' : ''}
                          </span>
                        )}

                        {status === 'available' && isOwnerOrReception && (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                            onClick={() => onOpenRoom(room, 'booking', activeDate)}
                          >
                            ➕ ຈອງ
                          </button>
                        )}

                        {status === 'booked' && isOwnerOrReception && booking && (
                          <>
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                              onClick={() => onQuickCheckIn ? onQuickCheckIn(booking, room) : onOpenRoom(room, 'checkin', activeDate)}
                            >
                              🛎️ Check-in
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                              onClick={() => onOpenRoom(room, 'edit', activeDate)}
                              title="ແກ້ໄຂ"
                            >
                              ✏️
                            </button>
                          </>
                        )}

                        {status === 'occupied' && isOwnerOrReception && booking && (
                          <>
                            <button
                              className="btn btn-warning btn-sm"
                              style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                              onClick={() => onQuickCheckOut ? onQuickCheckOut(booking, room) : onOpenRoom(room, 'checkout', activeDate)}
                            >
                              🚪 Check-out
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                              onClick={() => onOpenRoom(room, 'edit', activeDate)}
                              title="ແກ້ໄຂ"
                            >
                              ✏️
                            </button>
                          </>
                        )}

                        {status === 'waiting_checkin' && isOwnerOrReception && booking && (
                          <>
                            {onConfirmPending && (
                              <button
                                className="btn btn-success btn-sm"
                                style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                                onClick={() => onConfirmPending(booking)}
                              >
                                ✅ ຢືນຢັນ
                              </button>
                            )}
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                              onClick={() => onOpenRoom(room, 'detail', activeDate)}
                            >
                              👁️
                            </button>
                          </>
                        )}

                        {status === 'cleaning' && (isOwnerOrReception || isHousekeeping) && (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ padding: '2px 8px', fontSize: '0.72rem', background: '#7e22ce', borderColor: '#7e22ce' }}
                            onClick={() => onCleanRoom(room)}
                          >
                            ✨ ສະອາດ
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Totals Row (Row 25 in user's Excel sheet) */}
            <tfoot>
              <tr style={{ background: '#EFE6D5', fontWeight: 800, color: 'var(--primary)' }}>
                <td colSpan={8} style={{ border: cellBorder, padding: '9px 12px', textAlign: 'right' }}>
                  ລວມຈຳນວນເງິນທັງໝົດ ({filteredRows.length} ຫ້ອງ):
                </td>
                <td style={{ border: cellBorder, padding: '9px 6px', textAlign: 'center' }}>
                  {totalNightsSum}
                </td>
                <td colSpan={showMultiCurrency ? 3 : 1} style={{ border: cellBorder, padding: '9px 8px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  ຍອດລວມ:
                </td>
                <td style={{ border: cellBorder, padding: '9px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  ₭ {fmtNum(totalAmountLakSum)}
                </td>
                {showMultiCurrency && (
                  <>
                    <td style={{ border: cellBorder, padding: '9px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      ฿ {fmtNum(Math.round(totalAmountLakSum / thbRate))}
                    </td>
                    <td style={{ border: cellBorder, padding: '9px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      ${(totalAmountLakSum / usdRate).toFixed(2)}
                    </td>
                  </>
                )}
                <td colSpan={3} style={{ border: cellBorder, padding: '9px 10px', fontSize: '0.75rem' }}>
                  ຮັບແລ້ວ <span style={{ color: '#15803d' }}>₭ {fmtNum(totalPaidLakSum)}</span> · ຄ້າງ <span style={{ color: '#b45309' }}>₭ {fmtNum(totalRemainingLakSum)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bottom Payment Method Summary Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '12px 16px',
            background: '#FFFDF7',
            borderTop: '1px solid var(--border)',
            fontSize: '0.84rem',
            fontWeight: 700,
          }}
        >
          <div>💵 ປະເພດເງິນສົດ: <span style={{ color: '#15803d' }}>₭ {fmtNum(cashPaidSum)}</span></div>
          <div>🏦 ໂອນ / QR / ບັດ: <span style={{ color: '#1d4ed8' }}>₭ {fmtNum(bankPaidSum)}</span></div>
          <div>💰 ລວມເງິນທີ່ໄດ້ຮັບແລ້ວ: <span style={{ color: 'var(--primary)' }}>₭ {fmtNum(totalPaidLakSum)}</span></div>
          <div>⏳ ຄ້າງຮັບ: <span style={{ color: '#b45309' }}>₭ {fmtNum(totalRemainingLakSum)}</span></div>
        </div>
      </div>
    </div>
  );
}

