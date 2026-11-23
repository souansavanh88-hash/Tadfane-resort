import { useState } from 'react';
import { useHotel } from '../context/HotelContext';
import { formatCurrency } from '../data/initialData';

/**
 * ໜ້າຕ່າງຍົກເລີກ / ປະຕິເສດການຈອງ ພ້ອມຄືນເງິນ (ຖ້າລູກຄ້າຈ່າຍແລ້ວ)
 *
 * <CancelBookingModal booking={b} mode="cancel" | "reject" onClose={() => ...} onDone={() => ...} />
 */
export default function CancelBookingModal({ booking, mode = 'cancel', defaultReason = '', onClose, onDone }) {
  const { cancelBooking, rejectBooking, getPaidTotal } = useHotel();
  const paid = Math.max(0, getPaidTotal(booking));
  const [reason, setReason] = useState(defaultReason);
  const [refundType, setRefundType] = useState(paid > 0 ? 'none' : 'none'); // none | full | partial
  const [partialAmount, setPartialAmount] = useState('');
  const [method, setMethod] = useState(booking?.paymentMethod || 'cash');
  const [error, setError] = useState('');

  if (!booking) return null;
  const isReject = mode === 'reject';
  const refundAmount = refundType === 'full' ? paid : refundType === 'partial' ? Math.min(paid, Number(partialAmount) || 0) : 0;

  const handleConfirm = () => {
    setError('');
    if (!reason.trim()) return setError('ກະລຸນາໃສ່ເຫດຜົນ');
    if (refundType === 'partial' && !(Number(partialAmount) > 0)) return setError('ກະລຸນາໃສ່ຈຳນວນເງິນທີ່ຄືນ');
    const refund = refundAmount > 0 ? { amount: refundAmount, method } : null;
    if (isReject) rejectBooking(booking.id, reason.trim(), refund);
    else cancelBooking(booking.id, reason.trim(), refund);
    onDone?.({ refundAmount });
    onClose?.();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <span className="modal-title">{isReject ? '🚫 ປະຕິເສດການຈອງ' : '❌ ຍົກເລີກການຈອງ'} {booking.id}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: '0.85rem', marginBottom: '14px', color: 'var(--text-secondary)' }}>
            👤 <strong>{booking.guestName}</strong> • ຫ້ອງ {booking.roomId} • {booking.checkIn} → {booking.checkOut}
          </div>
          {error && <div className="alert alert-error" style={{ marginBottom: '12px' }}>❌ {error}</div>}
          <div className="form-group">
            <label className="form-label">ເຫດຜົນ <span className="required">*</span></label>
            <input className="form-input" value={reason} onChange={e => setReason(e.target.value)} placeholder="ເຊັ່ນ: ລູກຄ້າປ່ຽນແຜນ, ຫ້ອງເຕັມ..." autoFocus />
          </div>

          {paid > 0 ? (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 'var(--radius)', padding: '14px' }}>
              <div style={{ fontWeight: 700, marginBottom: '8px', fontSize: '0.88rem' }}>
                💰 ລູກຄ້າຈ່າຍແລ້ວ: {formatCurrency(paid)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                  <input type="radio" checked={refundType === 'none'} onChange={() => setRefundType('none')} /> ບໍ່ຄືນເງິນ (ຮິບມັດຈຳ)
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                  <input type="radio" checked={refundType === 'full'} onChange={() => setRefundType('full')} /> ຄືນເຕັມຈຳນວນ ({formatCurrency(paid)})
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                  <input type="radio" checked={refundType === 'partial'} onChange={() => setRefundType('partial')} /> ຄືນບາງສ່ວນ
                </label>
                {refundType === 'partial' && (
                  <input className="form-input" type="number" min="0" max={paid} value={partialAmount} onChange={e => setPartialAmount(e.target.value)} placeholder="ຈຳນວນເງິນ (₭)" />
                )}
                {refundAmount > 0 && (
                  <div className="form-group" style={{ marginTop: 6, marginBottom: 0 }}>
                    <label className="form-label">ຄືນເງິນຜ່ານ</label>
                    <select className="form-select" value={method} onChange={e => setMethod(e.target.value)}>
                      <option value="cash">💵 ເງິນສົດ</option>
                      <option value="transfer">🏦 ໂອນ</option>
                      <option value="qr">📱 QR</option>
                      <option value="card">💳 ບັດ</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ການຈອງນີ້ຍັງບໍ່ມີການຈ່າຍເງິນ</div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>ປິດ</button>
          <button className="btn btn-danger" onClick={handleConfirm}>
            {isReject ? '🚫 ປະຕິເສດ' : '❌ ຢືນຢັນຍົກເລີກ'}{refundAmount > 0 ? ` + ຄືນ ${formatCurrency(refundAmount)}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
