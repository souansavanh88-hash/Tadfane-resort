import { useState } from 'react';
import { useHotel } from '../context/HotelContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastProvider';
import {
  ROOM_TYPES, AMENITIES_LIST, BLOCKING_STATUSES,
  formatCurrency, formatDate, todayStr
} from '../data/initialData';
import BookingForm from './BookingForm';
import CheckInModal from './CheckInModal';
import CheckOutModal from './CheckOutModal';
import CheckInRegistrationModal from './CheckInRegistrationModal';

const STATUS_DISPLAY_MAP = {
  available: { label: 'ຫ້ອງວ່າງ', emoji: '🟢', badgeClass: 'badge-available', color: '#22c55e' },
  booked: { label: 'ຈອງແລ້ວ (ຍັງບໍ່ເຂົ້າພັກ)', emoji: '🔵', badgeClass: 'badge-booked', color: '#3b82f6' },
  waiting_checkin: { label: 'ຈອງອອນລາຍ (ລໍຢືນຢັນ)', emoji: '🟡', badgeClass: 'badge-waiting', color: '#eab308' },
  occupied: { label: 'ກຳລັງພັກ (ເຂົ້າພັກແລ້ວ)', emoji: '🔴', badgeClass: 'badge-occupied', color: '#ef4444' },
  cleaning: { label: 'ກຳລັງອະນາໄມ', emoji: '🟣', badgeClass: 'badge-cleaning', color: '#a855f7' },
  maintenance: { label: 'ປິດສ້ອມແປງ', emoji: '⚫', badgeClass: 'badge-maintenance', color: '#6b7280' },
};

export default function RoomModal({ room, selectedDate, initialView = 'detail', onClose }) {
  const {
    bookings, getRoomStatusOnDate,
    cancelBooking, markNoShow, confirmBooking, rejectBooking,
    markClean, setRoomStatus
  } = useHotel();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [view, setView] = useState(initialView); // detail | booking | quick_pay | edit | checkin | checkout | registration
  const [imgIndex, setImgIndex] = useState(0);

  const today = todayStr();
  const targetDate = selectedDate || today;
  const { status: displayStatus, booking: activeBooking } = getRoomStatusOnDate(room.id, targetDate);
  const statusMeta = STATUS_DISPLAY_MAP[displayStatus] || STATUS_DISPLAY_MAP.available;

  // Upcoming bookings for this room (starting after targetDate)
  const upcomingBookings = bookings
    .filter(b =>
      b.roomId === room.id &&
      BLOCKING_STATUSES.includes(b.status) &&
      b.checkIn > targetDate
    )
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  const isOwnerOrReception = ['owner', 'reception'].includes(currentUser?.role);
  const isHousekeeping = currentUser?.role === 'housekeeping';
  const amenitiesEnabled = AMENITIES_LIST.filter(a => room.amenities?.[a.key]);

  const handleMarkClean = () => {
    markClean(room.id);
    toast(`ຫ້ອງ ${room.number} ສະອາດແລ້ວ! ✨`, 'success');
    onClose();
  };

  const handleSetMaintenance = () => {
    setRoomStatus(room.id, 'maintenance');
    toast(`ຫ້ອງ ${room.number} ປ່ຽນເປັນ "ປິດສ້ອມແປງ"`, 'warning');
    onClose();
  };

  const handleSetAvailable = () => {
    setRoomStatus(room.id, 'available');
    toast(`ຫ້ອງ ${room.number} ພ້ອມຂາຍແລ້ວ! ✅`, 'success');
    onClose();
  };

  const handleConfirmPending = () => {
    if (!activeBooking) return;
    confirmBooking(activeBooking.id);
    toast(`✅ ຢືນຢັນການຈອງ ${activeBooking.id} ສຳເລັດ!`, 'success');
    onClose();
  };

  const handleRejectPending = () => {
    if (!activeBooking) return;
    const reason = window.prompt('ເຫດຜົນໃນການປະຕິເສດ:', 'ຫ້ອງບໍ່ວ່າງ / ບໍ່ພົບຫຼັກຖານໂອນເງິນ');
    if (reason !== null) {
      rejectBooking(activeBooking.id, reason);
      toast(`🚫 ປະຕິເສດການຈອງ ${activeBooking.id}`, 'info');
      onClose();
    }
  };

  const handleNoShow = () => {
    if (!activeBooking) return;
    if (window.confirm(`ໝາຍລູກຄ້າ "${activeBooking.guestName}" ເປັນ No-Show (ບໍ່ມາເຂົ້າພັກ)?`)) {
      markNoShow(activeBooking.id);
      toast(`👻 ໝາຍ No-Show ສຳເລັດ! ຫ້ອງ ${room.number} ກັບມາວ່າງແລ້ວ`, 'warning');
      onClose();
    }
  };

  const handleCancelBooking = () => {
    if (!activeBooking) return;
    const reason = window.prompt('ເຫດຜົນໃນການຍົກເລີກ:', 'ຍົກເລີກຈາກໜ້າຫ້ອງ');
    if (reason !== null) {
      cancelBooking(activeBooking.id, reason);
      toast('ຍົກເລີກການຈອງສຳເລັດ! 🚫', 'info');
      onClose();
    }
  };

  if (view === 'booking' || view === 'quick_pay' || view === 'edit') {
    return (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal modal-lg">
          <BookingForm
            preselectedRoom={room}
            defaultCheckIn={targetDate}
            initialDirectCheckIn={view === 'quick_pay'}
            bookingToEdit={view === 'edit' ? activeBooking : null}
            onClose={onClose}
            onBack={() => setView('detail')}
          />
        </div>
      </div>
    );
  }

  if (view === 'checkin') {
    return (
      <CheckInModal booking={activeBooking} room={room} onClose={onClose} onBack={() => setView('detail')} />
    );
  }

  if (view === 'registration') {
    return (
      <CheckInRegistrationModal booking={activeBooking} room={room} onClose={onClose} onBack={() => setView('detail')} />
    );
  }

  if (view === 'checkout') {
    return (
      <CheckOutModal booking={activeBooking} room={room} onClose={onClose} onBack={() => setView('detail')} />
    );
  }

  const channelLabels = {
    walkin: '🚶 Walk-in (ໜ້າເຄົາເຕີ)',
    online: '🌐 ລູກຄ້າຈອງອອນລາຍ',
    phone: '📞 ໂທລະສັບ / WhatsApp',
    facebook: '📱 Facebook / Line',
    agoda: '🏨 Agoda / Booking.com',
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div>
            <div className="modal-title">
              {statusMeta.emoji} ຫ້ອງ {room.number} — {ROOM_TYPES[room.type]}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              ຊັ້ນ {room.floor} · {room.size} · ວັນທີ {formatDate(targetDate)}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Room info & Status */}
          <div className="form-row" style={{ marginBottom: '16px', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>ລາຄາ/ຄືນ</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent)' }}>{formatCurrency(room.price)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>ສະຖານະ</div>
              <span className={`badge ${statusMeta.badgeClass}`}>
                {statusMeta.emoji} {statusMeta.label}
              </span>
            </div>
          </div>

          {/* Active Booking Info */}
          {activeBooking && (
            <div style={{
              background: 'var(--bg-elevated)',
              border: `1.5px solid ${statusMeta.color}55`,
              borderRadius: 'var(--radius)',
              padding: '16px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: statusMeta.color }}>
                  📋 ຂໍ້ມູນການຈອງ ({activeBooking.id})
                </div>
                <span className={`badge ${statusMeta.badgeClass}`}>
                  {activeBooking.status === 'checked_in'
                    ? '🟢 ເຂົ້າພັກແລ້ວ'
                    : activeBooking.status === 'pending'
                      ? '🟡 ລໍຢືນຢັນ'
                      : '🔵 ຈອງແລ້ວ (ຍັງບໍ່ເຂົ້າພັກ)'}
                </span>
              </div>
              <div className="form-row">
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ຊື່ລູກຄ້າ</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>{activeBooking.guestName}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ເບີໂທ</div>
                  <div style={{ fontWeight: 600 }}>{activeBooking.guestPhone || '-'}</div>
                </div>
              </div>
              <div className="form-row" style={{ marginTop: '10px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>🌐 ຊ່ອງທາງ</div>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                    {channelLabels[activeBooking.bookingChannel] || activeBooking.bookingChannel || 'Walk-in'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>👨‍💼 ຜູ້ຮັບຈອງ</div>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{activeBooking.bookedByStaff || 'ພະນັກງານຕ້ອນຮັບ'}</div>
                </div>
              </div>
              <div className="form-row" style={{ marginTop: '10px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ວັນເຂົ້າ (Check-in)</div>
                  <div style={{ fontWeight: 600 }}>{formatDate(activeBooking.checkIn)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ວັນອອກ (Check-out)</div>
                  <div style={{ fontWeight: 600 }}>{formatDate(activeBooking.checkOut)}</div>
                </div>
              </div>

              <hr className="divider" />
              <div className="calc-box" style={{ padding: '12px' }}>
                <div className="calc-row">
                  <span>ຍອດຄ່າຫ້ອງ ({activeBooking.nights} ຄືນ)</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(activeBooking.totalAmount)}</span>
                </div>
                {activeBooking.extraCharges?.length > 0 && (
                  <div className="calc-row" style={{ color: 'var(--warning)' }}>
                    <span>ຄ່າບໍລິການເພີ່ມ ({activeBooking.extraCharges.length} ລາຍການ)</span>
                    <span>
                      +{formatCurrency(activeBooking.extraCharges.reduce((s, e) => s + Number(e.amount || 0), 0))}
                    </span>
                  </div>
                )}
                <div className="calc-row calc-row-deposit">
                  <span>ຊຳລະແລ້ວ (ມັດຈຳ)</span>
                  <span>−{formatCurrency((activeBooking.deposit || 0) + (activeBooking.remainingPaid || 0))}</span>
                </div>
                <div className="calc-row calc-row-remaining">
                  <span>ຍອດຄ້າງຈ່າຍ</span>
                  <span>{formatCurrency(activeBooking.remainingAmount || 0)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' }}>
            {isHousekeeping && displayStatus === 'cleaning' && (
              <button className="btn btn-success" onClick={handleMarkClean} style={{ flex: 1 }}>
                ✨ ອະນາໄມສຳເລັດ (ຫ້ອງວ່າງ)
              </button>
            )}

            {isOwnerOrReception && (
              <>
                {!activeBooking && displayStatus === 'available' && (
                  <>
                    <button className="btn btn-success" onClick={() => setView('quick_pay')} style={{ flex: 1 }}>
                      💵 ຄິດເງິນ & ເຂົ້າພັກທັນທີ (Walk-in)
                    </button>
                    <button className="btn btn-primary" onClick={() => setView('booking')} style={{ flex: 1 }}>
                      📋 ຈອງຫ້ອງລ່ວງໜ້າ
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={handleSetMaintenance}>
                      🔧 ປິດສ້ອມແປງ
                    </button>
                  </>
                )}

                {activeBooking && activeBooking.status === 'pending' && (
                  <>
                    <button className="btn btn-success" onClick={handleConfirmPending} style={{ flex: 1 }}>
                      ✅ ຢືນຢັນການຈອງ
                    </button>
                    <button className="btn btn-outline-primary" onClick={() => setView('edit')}>
                      ✏️ ແກ້ໄຂ
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={handleRejectPending}>
                      🚫 ປະຕິເສດ
                    </button>
                  </>
                )}

                {activeBooking && activeBooking.status === 'booked' && (
                  <>
                    <button className="btn btn-success" onClick={() => setView('checkin')} style={{ flex: 1 }}>
                      🛎️ Check-in (ຮັບເຂົ້າພັກ)
                    </button>
                    <button
                      className="btn"
                      style={{ background: '#d96528', color: '#fff' }}
                      onClick={() => setView('registration')}
                    >
                      📱 ຟອມ iPad {activeBooking.signatureDataUrl ? '✅' : ''}
                    </button>
                    <button className="btn btn-outline-primary" onClick={() => setView('edit')}>
                      ✏️ ແກ້ໄຂ / ຍ້າຍຫ້ອງ
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={handleNoShow}>
                      👻 ບໍ່ມາ
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={handleCancelBooking}>
                      ❌ ຍົກເລີກ
                    </button>
                  </>
                )}

                {activeBooking && activeBooking.status === 'checked_in' && (
                  <>
                    <button className="btn btn-warning" onClick={() => setView('checkout')} style={{ flex: 1 }}>
                      🚪 Check-out (ຄິດເງິນອອກ)
                    </button>
                    <button
                      className="btn"
                      style={{ background: '#d96528', color: '#fff' }}
                      onClick={() => setView('registration')}
                    >
                      📱 ໃບລົງທະບຽນ iPad {activeBooking.signatureDataUrl ? '✅' : ''}
                    </button>
                    <button className="btn btn-outline-primary" onClick={() => setView('edit')}>
                      ✏️ ແກ້ໄຂການຈອງ
                    </button>
                  </>
                )}

                {!activeBooking && displayStatus === 'cleaning' && (
                  <button className="btn btn-success" onClick={handleMarkClean} style={{ flex: 1 }}>
                    ✨ ອະນາໄມສຳເລັດ (ຫ້ອງວ່າງ)
                  </button>
                )}

                {displayStatus === 'maintenance' && (
                  <button className="btn btn-success" onClick={handleSetAvailable} style={{ flex: 1 }}>
                    ✅ ສ້ອມແປງສຳເລັດ (ເປີດຂາຍ)
                  </button>
                )}
              </>
            )}
          </div>

          {/* Upcoming Bookings Notice */}
          {upcomingBookings.length > 0 && (
            <div className="alert alert-info" style={{ flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                📅 ການຈອງລ່ວງໜ້າຂອງຫ້ອງ {room.number} ({upcomingBookings.length} ລາຍການ):
              </div>
              {upcomingBookings.slice(0, 3).map(ub => (
                <div key={ub.id} style={{ fontSize: '0.78rem' }}>
                  • <strong>{formatDate(ub.checkIn)}</strong> ຫາ {formatDate(ub.checkOut)} — {ub.guestName} ({ub.id})
                </div>
              ))}
            </div>
          )}

          {/* Room Images (Compact) */}
          {room.images && room.images.length > 0 && (
            <div className="carousel" style={{ marginBottom: '16px' }}>
              {room.images.map((img, i) => (
                <img key={i} src={img} alt={`ຫ້ອງ ${room.number}`} className={`carousel-img ${i === imgIndex ? 'active' : ''}`} />
              ))}
              {room.images.length > 1 && (
                <>
                  <button className="carousel-btn carousel-btn-prev" onClick={() => setImgIndex(i => (i - 1 + room.images.length) % room.images.length)}>‹</button>
                  <button className="carousel-btn carousel-btn-next" onClick={() => setImgIndex(i => (i + 1) % room.images.length)}>›</button>
                </>
              )}
            </div>
          )}

          {/* Amenities */}
          {amenitiesEnabled.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
                ສິ່ງອຳນວຍຄວາມສະດວກ
              </div>
              <div className="amenity-tags">
                {amenitiesEnabled.map(a => (
                  <span key={a.key} className="amenity-tag">{a.icon} {a.label}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
