import { useState, useMemo } from 'react';
import { useHotel } from '../context/HotelContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDateTime, formatDate, todayStr, toLocalDateStr } from '../data/initialData';
import { useToast } from './ToastProvider';

/** ວັນທີທ້ອງຖິ່ນ 'YYYY-MM-DD' ຂອງ ISO timestamp (ຫຼື ວັນທີທີ່ເປັນ 'YYYY-MM-DD' ຢູ່ແລ້ວ) */
const localDayOf = (v) => {
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return toLocalDateStr(v);
};

const normMethod = (m) => {
  const k = String(m || 'cash').toLowerCase();
  return ['cash', 'transfer', 'qr', 'card'].includes(k) ? k : 'cash';
};

export default function CashierShiftCloseModal({ onClose, viewDate, onShiftClosed }) {
  const { toast } = useToast();
  const { bookings = [], activitySales = [], hotelInfo, shiftCloses = [], addShiftClose, getBookingPayments } = useHotel();
  const { currentUser } = useAuth();
  const targetDate = viewDate || todayStr();

  // Closing cash count state
  const [openingFloat, setOpeningFloat] = useState(0); // ເງິນທອນຕອນເປີດກະ
  const [countedCash, setCountedCash] = useState(''); // ເງິນສົດຕົວຈິງໃນລິ້ນຊັກ
  const [notes, setNotes] = useState('');
  // ປະຫວັດການປິດກະ (ແບ່ງປັນທຸກເຄື່ອງຜ່ານ server)
  const savedRecords = useMemo(
    () => [...shiftCloses].sort((a, b) => String(b.closedAt || '').localeCompare(String(a.closedAt || ''))),
    [shiftCloses]
  );
  const [isClosedSuccess, setIsClosedSuccess] = useState(false);

  // ສະຫຼຸບເງິນທີ່ຮັບແທ້ໃນວັນທີ targetDate (ຕາມ payment ledger)
  const summary = useMemo(() => {
    const totals = { cash: 0, transfer: 0, qr: 0, card: 0 };
    let refundTotal = 0;
    let roomTotal = 0;

    // ຫ້ອງພັກ: ທຸກການຮັບ/ຄືນເງິນທີ່ເກີດຂຶ້ນໃນວັນນີ້ (ລວມທັງການຈອງທີ່ຍົກເລີກແລ້ວ ແຕ່ມີການຄືນເງິນ)
    const dayBookings = [];
    bookings.forEach(b => {
      const pays = (getBookingPayments ? getBookingPayments(b) : (b.payments || []))
        .filter(p => p && p.at && localDayOf(p.at) === targetDate);
      if (!pays.length) return;
      let dayPaid = 0;
      let dayRefund = 0;
      const methods = [];
      pays.forEach(p => {
        const amt = Number(p.amount || 0);
        const m = normMethod(p.method);
        totals[m] += amt;
        dayPaid += amt;
        if (amt < 0) dayRefund += -amt;
        if (!methods.includes(m)) methods.push(m);
      });
      refundTotal += dayRefund;
      roomTotal += dayPaid;
      dayBookings.push({ ...b, dayPaid, dayRefund, dayMethods: methods });
    });

    // ກິດຈະກຳ (ຂາຍແຍກ) ທີ່ຮັບເງິນໃນວັນນີ້
    const dayActs = activitySales.filter(s => {
      if (s.status && s.status !== 'paid') return false;
      if (s.chargeToBookingId) return false; // charged to room already
      return localDayOf(s.paidAt || s.createdAt || s.date) === targetDate;
    });

    let actTotal = 0;
    dayActs.forEach(a => {
      const amt = Number(a.totalAmount || 0);
      actTotal += amt;
      totals[normMethod(a.paymentMethod)] += amt;
    });

    const grandTotal = roomTotal + actTotal;
    const expectedCashInDrawer = Number(openingFloat || 0) + totals.cash;

    return {
      billCount: dayBookings.length + dayActs.length,
      roomBookingsCount: dayBookings.length,
      actSalesCount: dayActs.length,
      grandTotal,
      roomTotal,
      actTotal,
      refundTotal,
      cashTotal: totals.cash,
      transferTotal: totals.transfer,
      qrTotal: totals.qr,
      cardTotal: totals.card,
      expectedCashInDrawer,
      dayBookings,
      dayActs,
    };
  }, [bookings, activitySales, targetDate, openingFloat, getBookingPayments]);

  const countedCashNum = countedCash === '' ? summary.expectedCashInDrawer : Number(countedCash);
  const diff = countedCashNum - summary.expectedCashInDrawer;

  const handleConfirmCloseShift = () => {
    const record = {
      id: `SHIFT-${Date.now()}`,
      date: targetDate,
      closedAt: new Date().toISOString(),
      closedBy: currentUser?.name || 'Cashier',
      openingFloat: Number(openingFloat || 0),
      roomTotal: summary.roomTotal,
      actTotal: summary.actTotal,
      refundTotal: summary.refundTotal,
      grandTotal: summary.grandTotal,
      cashTotal: summary.cashTotal,
      transferTotal: summary.transferTotal,
      qrTotal: summary.qrTotal,
      cardTotal: summary.cardTotal,
      expectedCash: summary.expectedCashInDrawer,
      countedCash: countedCashNum,
      difference: diff,
      notes,
    };

    const saved = addShiftClose ? addShiftClose(record) : record;
    if (onShiftClosed) {
      onShiftClosed(saved);
    }
    toast('✅ ປິດກະ ແລະ ບັນທຶກຍອດເງິນປະຈຳວັນສຳເລັດແລ້ວ!', 'success');
    setIsClosedSuccess(saved);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isClosedSuccess) {
    const rec = typeof isClosedSuccess === 'object' ? isClosedSuccess : (savedRecords[0] || {});
    return (
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
        <div
          className="modal"
          onClick={e => e.stopPropagation()}
          style={{ maxWidth: '640px', width: '92%', padding: '0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)' }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
              color: '#fff',
              padding: '24px 20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '3.2rem', marginBottom: '8px' }}>🎉</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>ປິດກະ ແລະ ບັນທຶກຍອດເງິນສຳເລັດແລ້ວ!</div>
            <div style={{ fontSize: '0.88rem', opacity: 0.9, marginTop: '4px' }}>
              ວັນທີ: <strong>{formatDate(targetDate)}</strong> · ພະນັກງານ: <strong>{rec.closedBy || currentUser?.name || 'admin'}</strong>
            </div>
          </div>

          <div style={{ padding: '24px' }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px dashed #cbd5e1', fontSize: '0.9rem' }}>
                <span style={{ color: '#64748b' }}>ເລກທີໃບປິດກະ:</span>
                <strong style={{ fontFamily: 'monospace' }}>{rec.id || 'SHIFT-RECORD'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px dashed #cbd5e1', fontSize: '0.9rem' }}>
                <span style={{ color: '#64748b' }}>ເວລາປິດກະ:</span>
                <strong>{formatDateTime(rec.closedAt || new Date().toISOString())}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px dashed #cbd5e1', fontSize: '0.9rem' }}>
                <span style={{ color: '#64748b' }}>ຍອດຮັບລວມທັງໝົດ:</span>
                <strong style={{ color: '#15803d', fontSize: '1.05rem' }}>{formatCurrency(rec.grandTotal || summary.grandTotal)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px dashed #cbd5e1', fontSize: '0.9rem' }}>
                <span style={{ color: '#64748b' }}>ເງິນສົດນັບຕົວຈິງໃນລິ້ນຊັກ:</span>
                <strong style={{ color: '#0f172a' }}>{formatCurrency(rec.countedCash !== undefined ? rec.countedCash : countedCashNum)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: '0.9rem' }}>
                <span style={{ color: '#64748b' }}>ສະພາບຍອດເງິນສົດ:</span>
                <strong style={{ color: (rec.difference || diff) === 0 ? '#15803d' : '#b91c1c' }}>
                  {(rec.difference || diff) === 0 ? '✓ ກົງກັນພໍດີ (Balanced)' : `ຜົນຕ່າງ: ${formatCurrency(rec.difference || diff)}`}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, minWidth: '140px', fontWeight: 700, padding: '12px' }}
                onClick={() => setIsClosedSuccess(false)}
              >
                📋 ເບິ່ງໃບສະຫຼຸບລະອຽດ
              </button>
              <button
                type="button"
                className="btn btn-outline-primary"
                style={{ flex: 1, minWidth: '140px', fontWeight: 700, padding: '12px' }}
                onClick={handlePrint}
              >
                🖨️ ພິມໃບສະຫຼຸບປິດກະ
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1.2, minWidth: '160px', fontWeight: 800, background: '#15803d', border: 'none', padding: '12px' }}
                onClick={onClose}
              >
                ✅ ສຳເລັດ & ອອກຈາກໜ້າປິດກະ
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal modal-lg"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '820px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', padding: '16px 20px' }}>
          <div>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem' }}>
              <span>🔒 ປິດກະ & ໄລ່ເງິນປະຈຳວັນ (Daily Shift Closing)</span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              ວັນທີ: <strong>{formatDate(targetDate)}</strong> · ພະນັກງານ: <strong>{currentUser?.name || 'Cashier'}</strong>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ overflowY: 'auto', padding: '20px' }}>
          {isClosedSuccess && (
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #86efac',
              borderRadius: 'var(--radius)',
              padding: '14px 18px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}>
              <div>
                <div style={{ fontWeight: 800, color: '#15803d', fontSize: '1rem' }}>
                  ✅ ປິດກະ ແລະ ບັນທຶກຍອດເງິນປະຈຳວັນຮຽບຮ້ອຍແລ້ວ!
                </div>
                <div style={{ fontSize: '0.8rem', color: '#166534', marginTop: '2px' }}>
                  ທ່ານສາມາດກົດ <strong>ພິມໃບສະຫຼຸບປິດກະ (Print Shift Report)</strong> ເພື່ອສົ່ງໃຫ້ຫົວໜ້າ ຫຼື ບັນຊີໄດ້
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handlePrint}
                style={{ whiteSpace: 'nowrap', fontWeight: 800 }}
              >
                🖨️ ພິມໃບປິດກະ
              </button>
            </div>
          )}

          {/* Printable Report Section */}
          <div id="shift-close-printable" className="shift-printable" style={{
            background: 'var(--bg-card2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px',
            marginBottom: '20px',
          }}>
            {/* Header info for printable receipt */}
            <div style={{ textAlign: 'center', borderBottom: '2px dashed var(--border)', paddingBottom: '14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                {hotelInfo?.name || 'ຣີສອດຕາດຟານ'}
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, marginTop: '2px' }}>
                ໃບສະຫຼຸບປິດກະ & ໄລ່ເງິນປະຈຳວັນ (Daily Cashier Shift Report)
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                ວັນທີ: {formatDate(targetDate)} · ເວລາພິມ: {formatDateTime(new Date().toISOString())}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                ແຄັດເຊຍ / ຜູ້ປິດກະ: <strong>{currentUser?.name || 'Receptionist'}</strong> ({currentUser?.role || 'staff'})
              </div>
            </div>

            {/* Total Grand Revenue Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '10px',
              marginBottom: '16px',
            }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 14px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>💰 ລາຍຮັບລວມທັງໝົດ</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>
                  {formatCurrency(summary.grandTotal)}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {summary.billCount} ລາຍການບິນ
                </div>
              </div>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.74rem', color: '#166534' }}>💵 ເງິນສົດ (Cash)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
                  {formatCurrency(summary.cashTotal)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#166534' }}>ຕ້ອງມີໃນລິ້ນຊັກ</div>
              </div>

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '10px 14px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.74rem', color: '#1e40af' }}>📲 ເງິນໂອນ / QR</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>
                  {formatCurrency(summary.transferTotal + summary.qrTotal)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#1e40af' }}>ເຂົ້າບັນຊີທະນາຄານ</div>
              </div>

              <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', padding: '10px 14px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.74rem', color: '#6b21a8' }}>💳 ບັດຮູດ (Card)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#7e22ce', marginTop: '2px' }}>
                  {formatCurrency(summary.cardTotal)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#6b21a8' }}>EDC Terminal</div>
              </div>

              {summary.refundTotal > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.74rem', color: '#991b1b' }}>↩️ ຄືນເງິນລູກຄ້າ (Refunds)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#b91c1c', marginTop: '2px' }}>
                    − {formatCurrency(summary.refundTotal)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#991b1b' }}>ຫັກອອກຈາກຍອດຮັບແລ້ວ</div>
                </div>
              )}
            </div>

            {/* Shift Cash Balancing Calculator Table */}
            <div style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '14px 16px',
              marginBottom: '16px',
            }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>⚖️ ຕາຕະລາງກວດໄລ່ເງິນສົດ (Cash Reconciliation)</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>
                    1. ເງິນທອນເລີ່ມຕົ້ນ (Opening Float)
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={openingFloat}
                    onChange={e => setOpeningFloat(e.target.value)}
                    placeholder="0 ₭"
                    style={{ fontSize: '0.9rem', fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>
                    2. ເງິນສົດຮັບຈາກການຂາຍມື້ນີ້
                  </label>
                  <div style={{ padding: '8px 12px', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontWeight: 800, color: '#15803d' }}>
                    + {formatCurrency(summary.cashTotal)}
                  </div>
                </div>
              </div>

              <div style={{
                marginTop: '12px',
                paddingTop: '10px',
                borderTop: '1px dashed var(--border)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    👉 ຍອດເງິນສົດທີ່ຄວນມີໃນລິ້ນຊັກ (System Expected):
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--primary)' }}>
                    {formatCurrency(summary.expectedCashInDrawer)}
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', color: 'var(--primary)' }}>
                    3. ເງິນສົດນັບຕົວຈິງໃນລິ້ນຊັກ (Actual Counted Cash) <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={countedCash}
                    onChange={e => setCountedCash(e.target.value)}
                    placeholder={`${summary.expectedCashInDrawer}`}
                    style={{ fontSize: '1.05rem', fontWeight: 900, borderColor: diff === 0 ? '#86efac' : diff < 0 ? '#fca5a5' : '#93c5fd' }}
                  />
                </div>
              </div>

              {/* Difference Status */}
              <div style={{
                marginTop: '12px',
                padding: '8px 12px',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: diff === 0 ? '#ecfdf5' : diff < 0 ? '#fef2f2' : '#eff6ff',
                border: `1px solid ${diff === 0 ? '#86efac' : diff < 0 ? '#fca5a5' : '#bfdbfe'}`,
              }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: diff === 0 ? '#15803d' : diff < 0 ? '#b91c1c' : '#1d4ed8' }}>
                  {diff === 0 ? '✨ ຍອດເງິນສົດກົງກັນພໍດີ (Balanced)' : diff < 0 ? `⚠️ ເງິນຂາດ (Shortage): ${formatCurrency(Math.abs(diff))}` : `⚠️ ເງິນເກີນ (Overage): ${formatCurrency(diff)}`}
                </span>
                <span style={{ fontSize: '0.92rem', fontWeight: 800 }}>
                  ຜົນຕ່າງ: {formatCurrency(diff)}
                </span>
              </div>

              <div style={{ marginTop: '12px' }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>
                  ໝາຍເຫດ / ລາຍລະອຽດເພີ່ມເຕີມ
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="ເຊັ່ນ: ເງິນທອນຄົບຖ້ວນ, ໂອນເງິນເຂົ້າບັນຊີເຈົ້າຂອງແລ້ວ..."
                />
              </div>
            </div>

            {/* Breakdown List */}
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '8px' }}>
              📋 ລາຍການຂາຍຫ້ອງ ແລະ ໃບບິນລະອຽດ ({summary.billCount} ລາຍການ)
            </div>
            <div className="shift-table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                  <tr>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>ລ/ດ</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>ເລກບິນ / ຫ້ອງ</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>ຊື່ລູກຄ້າ & ເບີໂທ</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>ວັນທີພັກ</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>ຊ່ອງທາງຈ່າຍ</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>ຍອດເງິນ (₭)</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.dayBookings.map((b, idx) => {
                    const amt = b.dayPaid;
                    const methods = b.dayMethods && b.dayMethods.length ? b.dayMethods : ['cash'];
                    return (
                      <tr key={b.id} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#fff' : '#fafaf9' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 800 }}>
                          <div>{b.id}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--primary-light)', fontWeight: 600 }}>
                            🏨 ຫ້ອງ {b.roomNumber || b.roomId}
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ fontWeight: 700 }}>{b.guestName || 'ລູກຄ້າ Walk-in'}</div>
                          {b.guestPhone && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>📞 {b.guestPhone}</div>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: '0.75rem' }}>
                          <div>{b.checkIn} ຫາ {b.checkOut}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                            ({b.status === 'checked_in' ? 'ກຳລັງພັກ' : b.status === 'checked_out' ? 'ອອກແລ້ວ' : b.status === 'cancelled' ? 'ຍົກເລີກ' : b.status === 'no_show' ? 'No-Show' : 'ຈອງແລ້ວ'})
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          {methods.map(method => (
                            <span key={method} style={{
                              display: 'inline-block', margin: '1px 2px',
                              padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700,
                              background: method === 'cash' ? '#dcfce7' : method === 'transfer' ? '#dbeafe' : method === 'qr' ? '#fef3c7' : '#f3e8ff',
                              color: method === 'cash' ? '#166534' : method === 'transfer' ? '#1e40af' : method === 'qr' ? '#92400e' : '#6b21a8'
                            }}>
                              {method === 'cash' ? '💵 ເງິນສົດ' : method === 'transfer' ? '📲 ເງິນໂອນ' : method === 'qr' ? '📱 QR Code' : '💳 ບັດ'}
                            </span>
                          ))}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: amt < 0 ? '#b91c1c' : 'var(--primary)', fontSize: '0.88rem' }}>
                          {formatCurrency(amt)}
                          {b.dayRefund > 0 && (
                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#b91c1c' }}>
                              (ຄືນເງິນ {formatCurrency(b.dayRefund)})
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {summary.dayActs.map((a, idx) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #e2e8f0', background: '#fffbeb' }}>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{summary.dayBookings.length + idx + 1}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 800 }}>
                        <div>🎟️ {a.id}</div>
                        <div style={{ fontSize: '0.74rem', color: '#b45309' }}>ປີ້ກິດຈະກຳ</div>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ fontWeight: 700 }}>{a.activityName || 'ກິດຈະກຳ'}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ລູກຄ້າ: {a.customerName || '-'}</div>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: '0.75rem' }}>
                        {a.quantity} ປີ້
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, background: '#fef3c7', color: '#92400e' }}>
                          {(a.paymentMethod || 'cash').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#b45309', fontSize: '0.88rem' }}>
                        {formatCurrency(a.totalAmount)}
                      </td>
                    </tr>
                  ))}
                  {summary.billCount === 0 && (
                    <tr>
                      <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        ບໍ່ພົບລາຍການຂາຍຫ້ອງ ຫຼື ບິນໃນວັນທີ {formatDate(targetDate)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Signature Area for Print */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '24px', paddingTop: '16px', borderTop: '1px dashed var(--border)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>ລາຍເຊັນພະນັກງານແຄັດເຊຍ</div>
                <div style={{ height: '50px' }}></div>
                <div style={{ borderTop: '1px solid #94a3b8', width: '160px', margin: '0 auto', paddingTop: '4px', fontSize: '0.75rem' }}>
                  ({currentUser?.name || 'ພະນັກງານແຄັດເຊຍ'})
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>ລາຍເຊັນຫົວໜ້າ / ຜູ້ກວດຮັບເງິນ</div>
                <div style={{ height: '50px' }}></div>
                <div style={{ borderTop: '1px solid #94a3b8', width: '160px', margin: '0 auto', paddingTop: '4px', fontSize: '0.75rem' }}>
                  (........................................)
                </div>
              </div>
            </div>
          </div>

          {/* Past Closing History */}
          {savedRecords.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                📜 ປະຫວັດການປິດກະທີ່ຜ່ານມາ ({savedRecords.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '140px', overflowY: 'auto' }}>
                {savedRecords.slice(0, 5).map(rec => (
                  <div
                    key={rec.id}
                    style={{
                      background: '#fff',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem',
                    }}
                  >
                    <div>
                      <strong>{formatDate(rec.date)}</strong> · ປິດໂດຍ: {rec.closedBy} · {formatDateTime(rec.closedAt)}
                      <div style={{ color: 'var(--text-muted)' }}>
                        ຍອດລວມ: {formatCurrency(rec.grandTotal)} | ເງິນສົດ: {formatCurrency(rec.cashTotal)}
                      </div>
                    </div>
                    <span style={{
                      fontWeight: 800,
                      color: rec.difference === 0 ? '#15803d' : rec.difference < 0 ? '#b91c1c' : '#1d4ed8'
                    }}>
                      {rec.difference === 0 ? '✓ ຄົບຖ້ວນ' : `ຜົນຕ່າງ: ${formatCurrency(rec.difference)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            ✕ ປິດໜ້າຕ່າງ
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={handlePrint}
            >
              🖨️ ພິມໃບສະຫຼຸບປິດກະ
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontWeight: 800, background: '#15803d' }}
              onClick={handleConfirmCloseShift}
            >
              🔒 ຢືນຢັນປິດກະ & ບັນທຶກຍອດເງິນ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
