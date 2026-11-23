import { useState, useMemo } from 'react';
import { useHotel } from '../context/HotelContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { formatCurrency, formatDate, ROOM_TYPES, todayStr, EXPENSE_CATEGORIES } from '../data/initialData';
import { exportToCsv } from '../utils/exportCsv';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export default function ReportsPage() {
  const { getRevenue, getStats, rooms, t } = useHotel();
  const [period, setPeriod] = useState('month'); // 'today' | 'week' | 'month' | 'year' | 'custom'
  const today = todayStr();
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}-01`;
  });
  const [customEnd, setCustomEnd] = useState(today);
  const [tableTab, setTableTab] = useState('bookings'); // 'bookings' | 'activities' | 'expenses'

  const PERIODS = [
    { key: 'today', label: t('today', { defaultValue: 'ມື້ນີ້' }) },
    { key: 'week', label: t('last7Days', { defaultValue: '7 ວັນ' }) },
    { key: 'month', label: t('thisMonth', { defaultValue: 'ເດືອນນີ້' }) },
    { key: 'year', label: t('thisYear', { defaultValue: 'ປີນີ້' }) },
    { key: 'custom', label: t('customRange', { defaultValue: '📅 ເລືອກວັນທີເອງ' }) },
  ];

  const revenue = getRevenue(period, customStart, customEnd);
  const stats = getStats();

  // Daily revenue combining room bookings and activity sales (last 30 days)
  const last30Days = useMemo(() => {
    const days = [];
    const labels = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${d.getFullYear()}-${m}-${day}`;
      labels.push(d.toLocaleDateString('lo-LA', { month: 'short', day: 'numeric' }));

      // Room money received on this day
      let roomDay = 0;
      (revenue.bookings || []).forEach(b => {
        if (Array.isArray(b.payments)) {
          b.payments.forEach(p => {
            if (p.at?.startsWith(dateStr)) roomDay += Number(p.amount || 0);
          });
        } else if (b.checkedInAt?.startsWith(dateStr) || b.createdAt?.startsWith(dateStr)) {
          roomDay += Number(b.finalTotal || b.totalAmount || 0);
        }
      });

      // Activity revenue on this day
      const actDay = (revenue.activities || [])
        .filter(s => (s.date === dateStr || s.paidAt?.startsWith(dateStr) || s.createdAt?.startsWith(dateStr)))
        .reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);

      days.push(Math.max(0, roomDay + actDay));
    }
    return { labels, data: days };
  }, [revenue.bookings, revenue.activities]);

  // Breakdown: Room types + Activities
  const distributionData = useMemo(() => {
    const data = {};
    (revenue.bookings || []).forEach(b => {
      const room = rooms.find(r => r.id === b.roomId);
      const typeKey = room?.type ? (ROOM_TYPES[room.type] || room.type) : 'ອື່ນໆ';
      data[typeKey] = (data[typeKey] || 0) + Number(b.periodPaid ?? (b.finalTotal || b.totalAmount || 0));
    });

    if (revenue.activityTotal > 0) {
      data['🎡 ກິດຈະກຳ/ປີ້'] = revenue.activityTotal;
    }
    return data;
  }, [revenue.bookings, revenue.activityTotal, rooms]);

  const barChartData = {
    labels: last30Days.labels,
    datasets: [{
      label: `${t('revenue', { defaultValue: 'ລາຍຮັບ' })} (₭)`,
      data: last30Days.data,
      backgroundColor: 'rgba(99,102,241,0.6)',
      borderColor: 'rgba(99,102,241,1)',
      borderWidth: 1,
      borderRadius: 6,
    }]
  };

  const donutData = {
    labels: Object.keys(distributionData),
    datasets: [{
      data: Object.values(distributionData),
      backgroundColor: ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899'],
      borderWidth: 0,
    }]
  };

  const chartOptions = {
    responsive: true,
    plugins: { legend: { labels: { color: '#94a3b8' } } },
    scales: {
      x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: '#1e1e35' } },
      y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: '#1e1e35' } },
    }
  };

  // CSV Export Handlers
  const handleExportBookingsCsv = () => {
    const headers = [
      { label: 'ເລກທີ (ID)', accessor: 'id' },
      { label: 'ຊື່ລູກຄ້າ', accessor: 'guestName' },
      { label: 'ເບີໂທ', accessor: (b) => b.guestPhone || '-' },
      { label: 'ຫ້ອງ', accessor: (b) => {
        const r = rooms.find(room => room.id === b.roomId);
        return r ? `ຫ້ອງ ${r.number}` : b.roomId;
      }},
      { label: 'ປະເພດຫ້ອງ', accessor: (b) => {
        const r = rooms.find(room => room.id === b.roomId);
        return r ? ROOM_TYPES[r.type] || r.type : '-';
      }},
      { label: 'ວັນເຂົ້າ', accessor: 'checkIn' },
      { label: 'ວັນອອກ', accessor: 'checkOut' },
      { label: 'ຈຳນວນຄືນ', accessor: 'nights' },
      { label: 'ຮັບເງິນໃນຊ່ວງນີ້ (₭)', accessor: (b) => b.periodPaid ?? (b.finalTotal || b.totalAmount || 0) },
      { label: 'ຍອດບິນທັງໝົດ (₭)', accessor: (b) => b.finalTotal || b.totalAmount || 0 },
      { label: 'ມັດຈຳ (₭)', accessor: (b) => b.deposit || 0 },
      { label: 'ຄ້າງຈ່າຍ (₭)', accessor: (b) => b.remainingAmount || 0 },
      { label: 'ຊ່ອງທາງຈ່າຍ', accessor: (b) => b.finalPaymentMethod || b.paymentMethod || 'cash' },
      { label: 'ສະຖານະ', accessor: 'status' },
      { label: 'ວັນສ້າງ', accessor: 'createdAt' },
    ];
    exportToCsv(`hotel_bookings_${period}_${today}`, headers, revenue.bookings || []);
  };

  const handleExportActivitiesCsv = () => {
    const headers = [
      { label: 'ເລກທີ (ID)', accessor: 'id' },
      { label: 'ກິດຈະກຳ', accessor: 'activityLabel' },
      { label: 'ຊື່ລູກຄ້າ', accessor: (s) => s.customerName || s.guestName || '-' },
      { label: 'ເບີໂທ', accessor: (s) => s.customerPhone || s.guestPhone || '-' },
      { label: 'ຈຳນວນປີ້', accessor: 'quantity' },
      { label: 'ລາຄາຕໍ່ປີ້ (₭)', accessor: 'price' },
      { label: 'ຍອດລວມ (₭)', accessor: 'totalAmount' },
      { label: 'ຊ່ອງທາງຈ່າຍ', accessor: 'paymentMethod' },
      { label: 'ສະຖານະ', accessor: 'status' },
      { label: 'ວັນທີ', accessor: (s) => s.date || s.createdAt },
    ];
    exportToCsv(`activity_sales_${period}_${today}`, headers, revenue.activities || []);
  };

  const handleExportExpensesCsv = () => {
    const headers = [
      { label: 'ເລກທີ (ID)', accessor: 'id' },
      { label: 'ວັນທີ', accessor: 'date' },
      { label: 'ໝວດໝູ່', accessor: (r) => EXPENSE_CATEGORIES[r.category]?.label || r.category },
      { label: 'ລາຍລະອຽດ', accessor: 'description' },
      { label: 'ຈຳນວນເງິນ (₭)', accessor: 'amount' },
      { label: 'ຊ່ອງທາງຈ່າຍ', accessor: 'paymentMethod' },
      { label: 'ຮ້ານຄ້າ / ຜູ້ສະໜອງ', accessor: (r) => r.vendor || '-' },
      { label: 'ຜູ້ບັນທຶກ', accessor: (r) => r.createdBy || '-' },
    ];
    exportToCsv(`expenses_${period}_${today}`, headers, revenue.expenses || []);
  };

  return (
    <div className="page-container">
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        {/* Period Selector */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {PERIODS.map(p => (
            <button
              key={p.key}
              className={`btn ${period === p.key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Export & Print Buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-outline-primary btn-sm" onClick={handleExportBookingsCsv} title="ດາວໂຫຼດ Excel/CSV Bookings">
            📤 Export ຫ້ອງພັກ
          </button>
          <button className="btn btn-outline-primary btn-sm" onClick={handleExportActivitiesCsv} title="ດາວໂຫຼດ Excel/CSV Activities">
            📤 Export ກິດຈະກຳ
          </button>
          <button className="btn btn-outline-primary btn-sm" onClick={handleExportExpensesCsv} title="ດາວໂຫຼດ Excel/CSV Expenses">
            📤 Export ລາຍຈ່າຍ
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()} title="ພິມລາຍງານ ຫຼື ບັນທຶກເປັນ PDF">
            🖨️ ພິມ / PDF
          </button>
        </div>
      </div>

      {/* Custom Date Range Filter */}
      {period === 'custom' && (
        <div style={{
          background: 'var(--bg-elevated)',
          padding: '14px 18px',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          marginBottom: '20px',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>ເລືອກຊ່ວງວັນທີ:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ແຕ່ວັນທີ:</label>
            <input
              type="date"
              className="form-control"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              style={{ width: '150px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ຫາວັນທີ:</label>
            <input
              type="date"
              className="form-control"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              style={{ width: '150px' }}
            />
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            (ສະແດງຂໍ້ມູນຕັ້ງແຕ່ {formatDate(customStart)} ຫາ {formatDate(customEnd)})
          </span>
        </div>
      )}

      {/* Revenue & Profit Stats Grid */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card" style={{ borderTop: '3px solid var(--primary)' }}>
          <div className="stat-label">💰 ລາຍຮັບລວມ (Total Revenue)</div>
          <div className="stat-value" style={{ fontSize: '1.4rem', color: 'var(--primary-light)' }}>
            {formatCurrency(revenue.total)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            ຫ້ອງພັກ {formatCurrency(revenue.roomTotal)} • ກິດຈະກຳ {formatCurrency(revenue.activityTotal)}
          </div>
        </div>

        <div className="stat-card" style={{ borderTop: '3px solid #ef4444' }}>
          <div className="stat-label">💸 ລາຍຈ່າຍລວມ (Total Expenses)</div>
          <div className="stat-value" style={{ fontSize: '1.3rem', color: '#ef4444' }}>
            {formatCurrency(revenue.expenseTotal || 0)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {revenue.expenses?.length || 0} ລາຍການລາຍຈ່າຍ
          </div>
        </div>

        <div className="stat-card" style={{ borderTop: `3px solid ${(revenue.profit || 0) >= 0 ? '#10b981' : '#ef4444'}` }}>
          <div className="stat-label">📈 ກຳໄລສຸດທິ (Net Profit)</div>
          <div className="stat-value" style={{ fontSize: '1.4rem', color: (revenue.profit || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 800 }}>
            {formatCurrency(revenue.profit || 0)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            ລາຍຮັບ − ລາຍຈ່າຍ
          </div>
        </div>

        {revenue.refundTotal > 0 && (
          <div className="stat-card" style={{ borderTop: '3px solid #f97316' }}>
            <div className="stat-label">↩️ ຄືນເງິນມັດຈຳ/ການຈອງ</div>
            <div className="stat-value" style={{ fontSize: '1.2rem', color: '#f97316' }}>
              {formatCurrency(revenue.refundTotal)}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              ຫັກອອກຈາກລາຍຮັບແລ້ວ
            </div>
          </div>
        )}

        <div className="stat-card" style={{ borderTop: '3px solid var(--error)' }}>
          <div className="stat-label">📈 ອັດຕາການພັກ (Occupancy)</div>
          <div className="stat-value" style={{ color: 'var(--error)' }}>{stats.occupancyRate}%</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            ຫ້ອງວ່າງປັດຈຸບັນ: {stats.available} / {stats.total}
          </div>
        </div>

        <div className="stat-card" style={{ borderTop: '3px solid var(--status-booked)' }}>
          <div className="stat-label">💵 ຮັບເປັນເງິນສົດ (Cash)</div>
          <div className="stat-value" style={{ fontSize: '1.1rem', color: 'var(--status-booked)' }}>
            {formatCurrency(revenue.byMethod?.cash || 0)}
          </div>
        </div>

        <div className="stat-card" style={{ borderTop: '3px solid var(--status-cleaning)' }}>
          <div className="stat-label">🏦 ໂອນ / BCEL One QR / ບັດ</div>
          <div className="stat-value" style={{ fontSize: '1.1rem', color: 'var(--status-cleaning)' }}>
            {formatCurrency((revenue.byMethod?.transfer || 0) + (revenue.byMethod?.qr || 0) + (revenue.byMethod?.card || 0))}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="form-row" style={{ marginBottom: '24px' }}>
        <div className="card">
          <div className="section-title" style={{ marginBottom: '16px' }}>📊 ລາຍຮັບປະຈຳວັນ (30 ວັນຫຼ້າສຸດ)</div>
          <Bar data={barChartData} options={chartOptions} />
        </div>
        <div className="card">
          <div className="section-title" style={{ marginBottom: '16px' }}>🏨 ສັດສ່ວນລາຍຮັບ (ປະເພດຫ້ອງ & ກິດຈະກຳ)</div>
          {Object.keys(distributionData).length > 0 ? (
            <Doughnut
              data={donutData}
              options={{
                responsive: true,
                plugins: { legend: { labels: { color: '#94a3b8' } } }
              }}
            />
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-text">ຍັງບໍ່ມີຂໍ້ມູນລາຍຮັບໃນຊ່ວງນີ້</div>
            </div>
          )}
        </div>
      </div>

      {/* Data Tables with Tabs */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`btn btn-sm ${tableTab === 'bookings' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTableTab('bookings')}
            >
              📋 ລາຍການ Bookings ({revenue.bookings?.length || 0})
            </button>
            <button
              className={`btn btn-sm ${tableTab === 'activities' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTableTab('activities')}
            >
              🎟️ ລາຍການຂາຍກິດຈະກຳ ({revenue.activities?.length || 0})
            </button>
            <button
              className={`btn btn-sm ${tableTab === 'expenses' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTableTab('expenses')}
            >
              📉 ລາຍຈ່າຍໃນຊ່ວງນີ້ ({revenue.expenses?.length || 0})
            </button>
          </div>
        </div>

        {tableTab === 'bookings' && (
          (revenue.bookings || []).length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-text">ບໍ່ມີລາຍການ Booking ໃນຊ່ວງເວລານີ້</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ເລກທີ</th>
                    <th>ລູກຄ້າ</th>
                    <th>ຫ້ອງ</th>
                    <th>ວັນເຂົ້າ</th>
                    <th>ວັນອອກ</th>
                    <th style={{ textAlign: 'right' }}>ຮັບເງິນຊ່ວງນີ້</th>
                    <th style={{ textAlign: 'right' }}>ຍອດບິນທັງໝົດ</th>
                    <th>ຊ່ອງທາງ</th>
                    <th>ສະຖານະ</th>
                  </tr>
                </thead>
                <tbody>
                  {revenue.bookings.map(b => {
                    const room = rooms.find(r => r.id === b.roomId);
                    const methodLabels = { cash: '💵 ສົດ', transfer: '🏦 ໂອນ', qr: '📱 QR', card: '💳 ບັດ' };
                    const statusLabel = {
                      booked: '🔵 ຈອງ',
                      checked_in: '🟢 ພັກ',
                      checked_out: '⚫ ອອກ',
                      cancelled: '🔴 ຍົກເລີກ',
                      no_show: '👻 No-show',
                      pending: '🟡 ລໍຢືນຢັນ',
                    };
                    const periodPaid = b.periodPaid ?? (b.finalTotal || b.totalAmount || 0);
                    const grandBill = b.finalTotal || b.totalAmount || 0;
                    return (
                      <tr key={b.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{b.id}</td>
                        <td className="td-name">
                          <div>{b.guestName}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{b.guestPhone || '-'}</div>
                        </td>
                        <td>ຫ້ອງ {room?.number || b.roomId}</td>
                        <td>{formatDate(b.checkIn)}</td>
                        <td>{formatDate(b.checkOut)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                          {formatCurrency(periodPaid)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {formatCurrency(grandBill)}
                        </td>
                        <td>{methodLabels[b.finalPaymentMethod || b.paymentMethod] || b.paymentMethod}</td>
                        <td>{statusLabel[b.status] || b.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {tableTab === 'activities' && (
          (revenue.activities || []).length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🎟️</div>
              <div className="empty-state-text">ບໍ່ມີລາຍການຂາຍກິດຈະກຳໃນຊ່ວງເວລານີ້</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ເລກທີ</th>
                    <th>ກິດຈະກຳ</th>
                    <th>ລູກຄ້າ</th>
                    <th>ຈຳນວນ</th>
                    <th style={{ textAlign: 'right' }}>ຍອດລວມ</th>
                    <th>ຊ່ອງທາງ</th>
                    <th>ວັນທີ</th>
                  </tr>
                </thead>
                <tbody>
                  {revenue.activities.map(s => {
                    const payLabels = { cash: '💵 ສົດ', transfer: '🏦 ໂອນ', qr: '📱 QR', card: '💳 ບັດ', room: '🏨 ລົງຫ້ອງ' };
                    return (
                      <tr key={s.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{s.id}</td>
                        <td className="td-name">{s.activityLabel}</td>
                        <td>{s.customerName || s.guestName || '-'}</td>
                        <td>{s.quantity} ປີ້</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(s.totalAmount)}</td>
                        <td>{payLabels[s.paymentMethod] || s.paymentMethod}</td>
                        <td>{formatDate(s.date || s.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {tableTab === 'expenses' && (
          (revenue.expenses || []).length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📉</div>
              <div className="empty-state-text">ບໍ່ມີລາຍການລາຍຈ່າຍໃນຊ່ວງເວລານີ້</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ວັນທີ</th>
                    <th>ໝວດໝູ່</th>
                    <th>ລາຍລະອຽດ</th>
                    <th>ຮ້ານຄ້າ / ຜູ້ສະໜອງ</th>
                    <th style={{ textAlign: 'right' }}>ຈຳນວນເງິນ</th>
                    <th>ຊ່ອງທາງ</th>
                    <th>ຜູ້ບັນທຶກ</th>
                  </tr>
                </thead>
                <tbody>
                  {revenue.expenses.map(e => {
                    const cat = EXPENSE_CATEGORIES[e.category] || EXPENSE_CATEGORIES.other;
                    const payLabels = { cash: '💵 ສົດ', transfer: '🏦 ໂອນ', qr: '📱 QR', card: '💳 ບັດ' };
                    return (
                      <tr key={e.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(e.date)}</td>
                        <td>
                          <span style={{ fontSize: '0.82rem' }}>{cat.icon} {cat.label}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{e.description}</div>
                          {e.note && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{e.note}</div>}
                        </td>
                        <td>{e.vendor || '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>
                          {formatCurrency(e.amount)}
                        </td>
                        <td>{payLabels[e.paymentMethod] || e.paymentMethod}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.createdBy || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
