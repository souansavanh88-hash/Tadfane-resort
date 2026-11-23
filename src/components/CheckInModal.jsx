import { useState } from 'react';
import { useHotel } from '../context/HotelContext';
import { useToast } from './ToastProvider';
import { formatCurrency, formatDate } from '../data/initialData';
import PrintReceipt from './PrintReceipt';
import CheckInRegistrationModal from './CheckInRegistrationModal';

export default function CheckInModal({ booking, room, onClose, onBack }) {
  const { checkIn } = useHotel();
  const { toast } = useToast();
  const [payAmount, setPayAmount] = useState(booking?.remainingAmount || 0);
  const [payMethod, setPayMethod] = useState('cash');
  const [showReceipt, setShowReceipt] = useState(false);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [checkedInBooking, setCheckedInBooking] = useState(null);

  if (!booking) {
    return (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal">
          <div className="modal-header">
            <span className="modal-title">❌ ບໍ່ພົບຂໍ້ມູນການຈອງ</span>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            <div className="empty-state"><div className="empty-state-icon">📋</div><div>ບໍ່ມີຂໍ້ມູນ</div></div>
          </div>
        </div>
      </div>
    );
  }

  if (showRegistrationForm) {
    return (
      <CheckInRegistrationModal
        booking={checkedInBooking || booking}
        room={room}
        initialPayAmount={payAmount}
        initialPayMethod={payMethod}
        onBack={() => setShowRegistrationForm(false)}
        onClose={onClose}
        onCompleted={(updatedBooking) => {
          setCheckedInBooking(updatedBooking);
          setShowRegistrationForm(false);
          setShowReceipt(true);
        }}
      />
    );
  }

  const handleCheckIn = () => {
    checkIn(booking.id, { amount: payAmount, method: payMethod });
    setCheckedInBooking({ ...booking, remainingPaid: payAmount });
    setShowReceipt(true);
    toast(`✅ Check-in ສຳເລັດ! ຫ້ອງ ${room?.number}`, 'success');
  };

  if (showReceipt) {
    return (
      <div className="modal-overlay">
        <div className="modal modal-lg">
          <div className="modal-header">
            <span className="modal-title">🧾 ໃບຮັບເງິນ Check-in</span>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            <PrintReceipt booking={checkedInBooking} room={room} type="checkin" paidAmount={payAmount} payMethod={payMethod} />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>ປິດ</button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowRegistrationForm(true)}
            >
              📱 {checkedInBooking?.signatureDataUrl ? 'ເບິ່ງໃບລົງທະບຽນ (ເຊັນແລ້ວ)' : 'ເປີດຟອມລົງທະບຽນໃຫ້ແຂກເຊັນ (iPad)'}
            </button>
            <button className="btn btn-primary" onClick={() => window.print()}>🖨️ ພິມໃບຮັບເງິນ</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            {onBack && <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginRight: '8px' }}>← ກັບ</button>}
            <span className="modal-title">✅ Check-in — ຫ້ອງ {room?.number}</span>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Booking summary */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="form-row">
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ລູກຄ້າ</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{booking.guestName}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{booking.guestPhone}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ຫ້ອງ</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.2rem' }}>
                  {room?.number}
                </div>
              </div>
            </div>
            <hr className="divider" />
            <div className="form-row">
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ວັນເຂົ້າ</div>
                <div style={{ fontWeight: 600 }}>{formatDate(booking.checkIn)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ວັນອອກ</div>
                <div style={{ fontWeight: 600 }}>{formatDate(booking.checkOut)}</div>
              </div>
            </div>
          </div>

          {/* iPad Registration Card Callout */}
          <div style={{
            padding: '12px 14px',
            borderRadius: '10px',
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: '0.82rem', color: '#9a3412' }}>
              <strong>📱 ໃບລົງທະບຽນເຂົ້າພັກ (iPad)</strong>
              <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                {booking.signatureDataUrl
                  ? '✅ ລູກຄ້າເຊັນຊື່ລົງທະບຽນແລ້ວ'
                  : 'ໃຫ້ລູກຄ້າກວດຂໍ້ມູນ, ກົດລະບຽບ ແລະ ເຊັນຊື່ເທິງໜ້າຈໍ'}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              style={{ background: '#d96528', color: '#fff', fontWeight: 700 }}
              onClick={() => setShowRegistrationForm(true)}
            >
              ✍️ ເປີດຟອມ iPad
            </button>
          </div>

          {/* Payment summary */}
          <div className="calc-box" style={{ marginBottom: '16px' }}>
            <div className="calc-row">
              <span>ຍອດລວມ</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(booking.totalAmount)}</span>
            </div>
            <div className="calc-row calc-row-deposit">
              <span>ຊຳລະແລ້ວ (ມັດຈຳ)</span>
              <span>−{formatCurrency(booking.deposit)}</span>
            </div>
            <div className="calc-row calc-row-remaining">
              <span style={{ fontWeight: 700 }}>ຍອດຄ້າງ</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{formatCurrency(booking.remainingAmount)}</span>
            </div>
          </div>

          {/* Payment */}
          {booking.remainingAmount > 0 && (
            <>
              <div className="form-group">
                <label className="form-label">ຮັບຊຳລະ (₭)</label>
                <input
                  className="form-input"
                  type="number"
                  value={payAmount}
                  onChange={e => setPayAmount(Number(e.target.value))}
                  min="0"
                />
              </div>
              <div className="form-group">
                <label className="form-label">ຊ່ອງທາງຈ່າຍ</label>
                <div className="payment-options">
                  {[
                    { key: 'cash', icon: '💵', label: 'ເງິນສົດ' },
                    { key: 'transfer', icon: '🏦', label: 'ໂອນ' },
                    { key: 'qr', icon: '📱', label: 'QR' },
                    { key: 'card', icon: '💳', label: 'ບັດ' },
                  ].map(m => (
                    <div key={m.key} className={`payment-option ${payMethod === m.key ? 'selected' : ''}`}
                      onClick={() => setPayMethod(m.key)}>
                      <span className="payment-option-icon">{m.icon}</span>
                      <span className="payment-option-label">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>ຍົກເລີກ</button>
          <button className="btn btn-success btn-lg" onClick={handleCheckIn}>
            ✅ ຢືນຢັນ Check-in ດ່ວນ
          </button>
        </div>
      </div>
    </div>
  );
}
