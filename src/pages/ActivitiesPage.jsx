import { useState } from 'react';
import { useHotel } from '../context/HotelContext';
import { useToast } from '../components/ToastProvider';
import { formatCurrency, formatDateTime } from '../data/initialData';

export default function ActivitiesPage() {
  const {
    guestActivities, activitySales, addActivitySale, cancelActivitySale,
    bookings, rooms
  } = useHotel();
  const { toast } = useToast();

  // Only activities that have a price (tickets / services)
  const sellableActivities = guestActivities.filter(a => a.price !== null && a.id !== 'resort');

  const [form, setForm] = useState({
    activityId: sellableActivities[0]?.id || 'zipline',
    customerName: '',
    customerPhone: '',
    quantity: 1,
    paymentMethod: 'cash', // 'cash' | 'transfer' | 'qr' | 'room'
    chargeToBookingId: '',
  });

  const [filter, setFilter] = useState('all'); // 'all' | 'paid' | 'cancelled'

  // Currently checked-in rooms that can receive room charges
  const checkedInBookings = bookings.filter(b => b.status === 'checked_in');

  const selectedActivity = sellableActivities.find(a => a.id === form.activityId) || sellableActivities[0];
  const totalAmount = (selectedActivity?.price || 0) * Number(form.quantity || 1);

  const handleChargeToRoomChange = (bookingId) => {
    const b = checkedInBookings.find(x => x.id === bookingId);
    setForm(p => ({
      ...p,
      chargeToBookingId: bookingId,
      customerName: b ? b.guestName : p.customerName,
      customerPhone: b ? (b.guestPhone || p.customerPhone) : p.customerPhone,
      paymentMethod: bookingId ? 'room' : 'cash',
    }));
  };

  const handleSale = (e) => {
    e.preventDefault();
    if (!form.customerName.trim()) {
      toast('ກະລຸນາໃສ່ຊື່ລູກຄ້າ', 'warning');
      return;
    }

    if (form.paymentMethod === 'room' && !form.chargeToBookingId) {
      toast('ກະລຸນາເລືອກຫ້ອງພັກທີ່ຕ້ອງການລົງບິນ', 'warning');
      return;
    }

    addActivitySale({
      activityId: selectedActivity.id,
      activityLabel: selectedActivity.label,
      price: selectedActivity.price,
      quantity: Number(form.quantity),
      totalAmount,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      paymentMethod: form.paymentMethod,
      chargeToBookingId: form.chargeToBookingId || null,
    });

    // Reset
    setForm(p => ({
      ...p,
      customerName: '',
      customerPhone: '',
      quantity: 1,
      paymentMethod: 'cash',
      chargeToBookingId: '',
    }));
    toast('✅ ອອກປີ້ກິດຈະກຳສຳເລັດ!', 'success');
  };

  const handleCancelSale = (id) => {
    const reason = window.prompt('ເຫດຜົນໃນການຍົກເລີກ / ຄືນເງິນ:', 'ລູກຄ້າຂໍຍົກເລີກ');
    if (reason !== null) {
      cancelActivitySale(id, reason);
      toast('ຍົກເລີກປີ້ກິດຈະກຳສຳເລັດ', 'info');
    }
  };

  const filteredSales = activitySales.filter(s => {
    if (filter === 'paid') return s.status !== 'cancelled';
    if (filter === 'cancelled') return s.status === 'cancelled';
    return true;
  });

  const activeSales = activitySales.filter(s => s.status !== 'cancelled');
  const totalRevenue = activeSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalTickets = activeSales.reduce((sum, s) => sum + s.quantity, 0);

  return (
    <div className="page-container">
      <div className="section-header" style={{ marginBottom: '24px' }}>
        <div>
          <div className="section-title">🎡 ການບໍລິການ & ກິດຈະກຳຕ່າງໆ</div>
          <div className="section-subtitle">ຈອງ ແລະ ຂາຍປີ້ກິດຈະກຳ (ລາຄາອັບເດດຕາມໜ້າຕັ້ງຄ່າ)</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px', alignItems: 'start' }}>

        {/* Sales Form */}
        <div className="card">
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary-light)', marginBottom: '16px' }}>
            🎟️ ອອກປີ້ / ຂາຍກິດຈະກຳ
          </div>
          <form onSubmit={handleSale}>
            <div className="form-group">
              <label className="form-label">ເລືອກກິດຈະກຳ</label>
              <select
                className="form-select"
                value={form.activityId}
                onChange={e => setForm(p => ({ ...p, activityId: e.target.value }))}
              >
                {sellableActivities.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.emoji} {a.label} — {formatCurrency(a.price)}
                  </option>
                ))}
              </select>
            </div>

            {/* Charge to checked-in Room Option */}
            <div style={{
              background: 'var(--bg-elevated)',
              padding: '12px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              marginBottom: '16px'
            }}>
              <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--primary-light)' }}>
                🏨 ລົງບິນລວມກັບຫ້ອງພັກ (Charge to Room)
              </label>
              <select
                className="form-select"
                value={form.chargeToBookingId}
                onChange={e => handleChargeToRoomChange(e.target.value)}
              >
                <option value="">— ຈ່າຍແຍກ (ບໍ່ລົງບິນຫ້ອງ) —</option>
                {checkedInBookings.map(b => {
                  const r = rooms.find(room => room.id === b.roomId);
                  return (
                    <option key={b.id} value={b.id}>
                      ຫ້ອງ {r?.number || b.roomId} — {b.guestName} ({b.id})
                    </option>
                  );
                })}
              </select>
              {form.chargeToBookingId && (
                <div style={{ fontSize: '0.72rem', color: 'var(--success)', marginTop: '4px' }}>
                  ✓ ຍອດເງິນຈະຖືກເພີ່ມເຂົ້າໃນບິນຫ້ອງພັກອັດຕະໂນມັດ (Check-out ຈຶ່ງຄິດເງິນ)
                </div>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">ຊື່ລູກຄ້າ <span className="required">*</span></label>
                <input
                  className="form-input"
                  value={form.customerName}
                  onChange={e => setForm(p => ({ ...p, customerName: e.target.value }))}
                  placeholder="ຊື່ລູກຄ້າ..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">ເບີໂທ</label>
                <input
                  className="form-input"
                  value={form.customerPhone}
                  onChange={e => setForm(p => ({ ...p, customerPhone: e.target.value }))}
                  placeholder="020..."
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">ຈຳນວນປີ້/ເທື່ອ</label>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={e => setForm(p => ({ ...p, quantity: Math.max(1, Number(e.target.value)) }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">ຊຳລະຜ່ານ</label>
                <select
                  className="form-select"
                  value={form.paymentMethod}
                  disabled={Boolean(form.chargeToBookingId)}
                  onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value }))}
                >
                  <option value="cash">💵 ເງິນສົດ</option>
                  <option value="transfer">🏦 ໂອນເງິນ</option>
                  <option value="qr">📱 BCEL One QR</option>
                  <option value="card">💳 ບັດ</option>
                  {form.chargeToBookingId && <option value="room">🏨 ລົງບິນຫ້ອງພັກ</option>}
                </select>
              </div>
            </div>

            <div style={{
              background: 'var(--bg-elevated)', borderRadius: 'var(--radius)',
              padding: '16px', marginBottom: '20px', marginTop: '10px',
              border: '1px solid var(--border)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <span>ລາຄາຕໍ່ໜ່ວຍ:</span>
                <span>{formatCurrency(selectedActivity?.price)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                <span>ຈຳນວນ:</span>
                <span>{form.quantity} ປີ້</span>
              </div>
              <hr className="divider" style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.2rem' }}>
                <span>ຍອດລວມ:</span>
                <span style={{ color: 'var(--success)' }}>{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
              ✅ ອອກປີ້ກິດຈະກຳ
            </button>
          </form>
        </div>

        {/* Sales List */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary-light)' }}>
              📋 ປະຫວັດການຂາຍ & ຍອດລວມ
            </div>
            <div className="filter-tabs" style={{ marginBottom: 0 }}>
              <button className={`filter-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
                ທັງໝົດ
              </button>
              <button className={`filter-tab ${filter === 'paid' ? 'active' : ''}`} onClick={() => setFilter('paid')}>
                🟢 ສຳເລັດ
              </button>
              <button className={`filter-tab ${filter === 'cancelled' ? 'active' : ''}`} onClick={() => setFilter('cancelled')}>
                🔴 ຍົກເລີກແລ້ວ
              </button>
            </div>
          </div>

          <div className="stats-grid" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="stat-card" style={{ padding: '14px', borderTop: '3px solid var(--success)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>💰 ລາຍຮັບກິດຈະກຳລວມ</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--success)', marginTop: '4px' }}>
                {formatCurrency(totalRevenue)}
              </div>
            </div>
            <div className="stat-card" style={{ padding: '14px', borderTop: '3px solid var(--primary)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>🎟️ ປີ້ທີ່ຂາຍແລ້ວ</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                {totalTickets} ປີ້
              </div>
            </div>
          </div>

          <div className="table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
            {filteredSales.length === 0 ? (
              <div style={{ padding: '40px 0', color: 'var(--text-muted)', textAlign: 'center' }}>
                ຍັງບໍ່ມີປະຫວັດການຂາຍ
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ກິດຈະກຳ</th>
                    <th>ລູກຄ້າ</th>
                    <th>ຈຳນວນ</th>
                    <th>ຍອດລວມ</th>
                    <th>ສະຖານະ</th>
                    <th>ຈັດການ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map(s => {
                    const payLabels = { cash: '💵 ສົດ', transfer: '🏦 ໂອນ', qr: '📱 QR', card: '💳 ບັດ', room: '🏨 ລົງຫ້ອງ' };
                    const isCancelled = s.status === 'cancelled';
                    return (
                      <tr key={s.id} style={{ opacity: isCancelled ? 0.6 : 1 }}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{s.activityLabel}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            {s.id} · {formatDateTime(s.createdAt)}
                          </div>
                        </td>
                        <td>
                          <div>{s.customerName}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{s.customerPhone || '-'}</div>
                        </td>
                        <td>{s.quantity} ປີ້</td>
                        <td style={{ fontWeight: 600, color: isCancelled ? 'var(--text-muted)' : 'var(--accent)' }}>
                          {formatCurrency(s.totalAmount)}
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {payLabels[s.paymentMethod] || s.paymentMethod}
                          </div>
                        </td>
                        <td>
                          {isCancelled ? (
                            <span style={{ color: 'var(--error)', fontSize: '0.72rem', fontWeight: 700 }}>
                              🔴 ຍົກເລີກ ({s.cancelReason || '-'})
                            </span>
                          ) : (
                            <span style={{ color: 'var(--success)', fontSize: '0.72rem', fontWeight: 700 }}>
                              🟢 ສຳເລັດ
                            </span>
                          )}
                        </td>
                        <td>
                          {!isCancelled && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleCancelSale(s.id)}
                              title="ຍົກເລີກການຂາຍ / ຄືນເງິນ"
                            >
                              ❌ ຍົກເລີກ
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
