import { useState } from 'react';
import { useHotel } from '../context/HotelContext';
import { useToast } from './ToastProvider';
import { formatCurrency, formatDate } from '../data/initialData';

export default function CheckOutModal({ booking, room, onClose, onBack }) {
  const { checkOut, getPaidTotal } = useHotel();
  const { toast } = useToast();
  const [extras, setExtras] = useState(
    booking?.extraCharges?.length ? booking.extraCharges.map(e => ({ ...e })) : [{ desc: '', amount: 0 }]
  );
  const [payMethod, setPayMethod] = useState('cash');

  if (!booking) {
    return (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal">
          <div className="modal-header">
            <span className="modal-title">❌ ບໍ່ພົບຂໍ້ມູນ</span>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            <div className="empty-state"><div className="empty-state-icon">📋</div><div>ບໍ່ມີຂໍ້ມູນ</div></div>
          </div>
        </div>
      </div>
    );
  }

  const validExtras = extras.filter(e => e.desc && Number(e.amount) > 0);
  const extraTotal = validExtras.reduce((sum, e) => sum + Number(e.amount), 0);
  const alreadyPaid = getPaidTotal ? getPaidTotal(booking) : ((booking.deposit || 0) + (booking.remainingPaid || 0));
  const finalTotal = (booking.totalAmount || 0) + extraTotal;
  const finalRemaining = Math.max(0, finalTotal - alreadyPaid);

  const addExtra = () => setExtras(p => [...p, { desc: '', amount: 0 }]);
  const removeExtra = (i) => setExtras(p => p.filter((_, idx) => idx !== i));
  const setExtra = (i, field, val) => setExtras(p => p.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const handleCheckOut = () => {
    const finalData = {
      finalTotal,
      paymentMethod: payMethod,
      paymentAmount: finalRemaining,
    };
    checkOut(booking.id, validExtras, finalData);
    toast(`✅ Check-out ສຳເລັດ! ຫ້ອງ ${room?.number}`, 'success');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            {onBack && <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginRight: '8px' }}>← ກັບ</button>}
            <span className="modal-title">🚪 Check-out — ຫ້ອງ {room?.number}</span>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Guest info */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="form-row">
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ລູກຄ້າ</div>
                <div style={{ fontWeight: 700 }}>{booking.guestName}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ຫ້ອງ</div>
                <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{room?.number}</div>
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

          {/* Extra charges */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-accent)' }}>
                ➕ ຄ່າໃຊ້ຈ່າຍເສີມ
              </div>
              <button className="btn btn-ghost btn-sm" onClick={addExtra}>+ ເພີ່ມ</button>
            </div>
            {extras.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  className="form-input"
                  placeholder="ລາຍການ (ເຊັ່ນ: ອາຫານ, ໂທລະສັບ...)"
                  value={e.desc}
                  onChange={ev => setExtra(i, 'desc', ev.target.value)}
                  style={{ flex: 2 }}
                />
                <input
                  className="form-input"
                  type="number"
                  placeholder="ຈຳນວນ ₭"
                  value={e.amount || ''}
                  onChange={ev => setExtra(i, 'amount', ev.target.value)}
                  style={{ flex: 1 }}
                />
                {extras.length > 1 && (
                  <button className="btn btn-danger btn-icon btn-sm" onClick={() => removeExtra(i)}>✕</button>
                )}
              </div>
            ))}
          </div>

          {/* Final calculation */}
          <div className="calc-box" style={{ marginBottom: '16px' }}>
            <div className="calc-row">
              <span>ຄ່າຫ້ອງ ({booking.nights} ຄືນ)</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(booking.totalAmount)}</span>
            </div>
            {validExtras.map((e, i) => (
              <div key={i} className="calc-row">
                <span>{e.desc}</span>
                <span>{formatCurrency(Number(e.amount))}</span>
              </div>
            ))}
            {extraTotal > 0 && (
              <div className="calc-row" style={{ color: 'var(--warning)' }}>
                <span>ລວມຄ່າເສີມ</span>
                <span>{formatCurrency(extraTotal)}</span>
              </div>
            )}
            <div className="calc-row calc-row-total">
              <span>ຍອດລວມທັງໝົດ</span>
              <span>{formatCurrency(finalTotal)}</span>
            </div>
            <div className="calc-row calc-row-deposit">
              <span>ຊຳລະແລ້ວ</span>
              <span>−{formatCurrency(alreadyPaid)}</span>
            </div>
            <div className="calc-row calc-row-remaining">
              <span style={{ fontWeight: 700 }}>ຍັງຕ້ອງຈ່າຍ</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{formatCurrency(finalRemaining)}</span>
            </div>
          </div>

          {/* Payment */}
          {finalRemaining > 0 && (
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
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>ຍົກເລີກ</button>
          <button className="btn btn-warning btn-lg" onClick={handleCheckOut}>
            🚪 ຢືນຢັນ Check-out
          </button>
        </div>
      </div>
    </div>
  );
}
