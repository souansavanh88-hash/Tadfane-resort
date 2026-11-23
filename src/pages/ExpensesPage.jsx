import { useState, useMemo } from 'react';
import { useHotel } from '../context/HotelContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import { formatCurrency, formatDateTime, formatDate, todayStr, EXPENSE_CATEGORIES } from '../data/initialData';
import { exportToCsv } from '../utils/exportCsv';


export default function ExpensesPage() {
  const { expenses, addExpense, updateExpense, deleteExpense } = useHotel();
  const { currentUser, hasRole } = useAuth();
  const { toast } = useToast();

  const isOwner = hasRole('owner');

  // Filters
  const [period, setPeriod] = useState('month'); // today | month | all | custom
  const [customStart, setCustomStart] = useState(todayStr());
  const [customEnd, setCustomEnd] = useState(todayStr());
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Modal / Form state
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [form, setForm] = useState({
    date: todayStr(),
    category: 'supplies',
    description: '',
    amount: '',
    paymentMethod: 'cash',
    vendor: '',
    note: '',
  });

  const openAddModal = () => {
    setEditingExpense(null);
    setForm({
      date: todayStr(),
      category: 'supplies',
      description: '',
      amount: '',
      paymentMethod: 'cash',
      vendor: '',
      note: '',
    });
    setShowModal(true);
  };

  const openEditModal = (exp) => {
    setEditingExpense(exp);
    setForm({
      date: exp.date || todayStr(),
      category: exp.category || 'other',
      description: exp.description || '',
      amount: String(exp.amount || ''),
      paymentMethod: exp.paymentMethod || 'cash',
      vendor: exp.vendor || '',
      note: exp.note || '',
    });
    setShowModal(true);
  };

  const canModify = (exp) => {
    if (isOwner) return true;
    // Reception can only modify own entries created today
    const createdByMe = exp.createdBy === currentUser?.name || exp.createdBy === currentUser?.username;
    const isToday = exp.date === todayStr();
    return createdByMe && isToday;
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.description.trim()) {
      toast('ກະລຸນາໃສ່ລາຍລະອຽດລາຍຈ່າຍ', 'warning');
      return;
    }
    const num = Number(form.amount);
    if (!num || num <= 0) {
      toast('ກະລຸນາໃສ່ຈຳນວນເງິນທີ່ຖືກຕ້ອງ (> 0)', 'warning');
      return;
    }

    const payload = {
      date: form.date,
      category: form.category,
      description: form.description.trim(),
      amount: num,
      paymentMethod: form.paymentMethod,
      vendor: form.vendor.trim(),
      note: form.note.trim(),
    };

    if (editingExpense) {
      updateExpense(editingExpense.id, payload);
      toast('✅ ແກ້ໄຂລາຍຈ່າຍສຳເລັດ', 'success');
    } else {
      addExpense(payload);
      toast('✅ ບັນທຶກລາຍຈ່າຍໃໝ່ສຳເລັດ', 'success');
    }
    setShowModal(false);
  };

  const handleDelete = (exp) => {
    if (!window.confirm(`ຕ້ອງການລຶບລາຍຈ່າຍ "${exp.description}" (${formatCurrency(exp.amount)}) ແທ້ບໍ່?`)) {
      return;
    }
    deleteExpense(exp.id);
    toast('🗑️ ລຶບລາຍຈ່າຍແລ້ວ', 'info');
  };

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    const today = todayStr();
    const curYearMonth = today.slice(0, 7);

    return (expenses || []).filter(e => {
      // Period filter
      if (period === 'today') {
        if (e.date !== today) return false;
      } else if (period === 'month') {
        if (!e.date?.startsWith(curYearMonth)) return false;
      } else if (period === 'custom') {
        if (e.date < customStart || e.date > customEnd) return false;
      }

      // Category filter
      if (categoryFilter !== 'all' && e.category !== categoryFilter) {
        return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const descMatch = (e.description || '').toLowerCase().includes(q);
        const vendorMatch = (e.vendor || '').toLowerCase().includes(q);
        const noteMatch = (e.note || '').toLowerCase().includes(q);
        const userMatch = (e.createdBy || '').toLowerCase().includes(q);
        if (!descMatch && !vendorMatch && !noteMatch && !userMatch) return false;
      }

      return true;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [expenses, period, customStart, customEnd, categoryFilter, search]);

  // Aggregate stats
  const { totalAmount, byCategory } = useMemo(() => {
    let sum = 0;
    const catMap = {};
    Object.keys(EXPENSE_CATEGORIES).forEach(k => { catMap[k] = 0; });

    filteredExpenses.forEach(e => {
      const amt = Number(e.amount) || 0;
      sum += amt;
      catMap[e.category] = (catMap[e.category] || 0) + amt;
    });

    return { totalAmount: sum, byCategory: catMap };
  }, [filteredExpenses]);

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      { label: 'ລະຫັດ', accessor: 'id' },
      { label: 'ວັນທີ', accessor: 'date' },
      { label: 'ໝວດໝູ່', accessor: (r) => EXPENSE_CATEGORIES[r.category]?.label || r.category },
      { label: 'ລາຍລະອຽດ', accessor: 'description' },
      { label: 'ຈຳນວນເງິນ (₭)', accessor: 'amount' },
      { label: 'ຮູບແບບການຈ່າຍ', accessor: (r) => r.paymentMethod === 'cash' ? 'ເງິນສົດ' : r.paymentMethod === 'transfer' ? 'ໂອນ' : r.paymentMethod === 'qr' ? 'QR' : 'ບັດ' },
      { label: 'ຮ້ານຄ້າ / ຜູ້ສະໜອງ', accessor: (r) => r.vendor || '-' },
      { label: 'ໝາຍເຫດ', accessor: (r) => r.note || '-' },
      { label: 'ຜູ້ບັນທຶກ', accessor: (r) => r.createdBy || '-' },
      { label: 'ເວລາບັນທຶກ', accessor: (r) => r.createdAt ? formatDateTime(r.createdAt) : '-' },
    ];
    exportToCsv(`expenses_${todayStr()}`, headers, filteredExpenses);
    toast('📤 Export ໄຟລ໌ Excel/CSV ສຳເລັດ', 'success');
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="section-header" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="section-title">📉 ລາຍຈ່າຍທັງໝົດ (Resort Expenses)</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            ບັນທຶກ ແລະ ຕິດຕາມຄ່າໃຊ້ຈ່າຍຂອງຣີສອດ ເພື່ອຄວບຄຸມຕົ້ນທຶນ ແລະ ຄຳນວນກຳໄລສຸດທິ
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline-primary btn-sm" onClick={handleExportCsv}>
            📤 Export CSV
          </button>
          <button className="btn btn-primary btn-sm" onClick={openAddModal}>
            ➕ ບັນທຶກລາຍຈ່າຍໃໝ່
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card" style={{ borderTop: '3px solid #ef4444' }}>
          <div className="stat-label">💸 ລາຍຈ່າຍລວມ (ໄລຍະທີ່ເລືອກ)</div>
          <div className="stat-value" style={{ color: '#ef4444' }}>{formatCurrency(totalAmount)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            ທັງໝົດ {filteredExpenses.length} ລາຍການ
          </div>
        </div>

        {Object.entries(EXPENSE_CATEGORIES).map(([catKey, catMeta]) => {
          const amt = byCategory[catKey] || 0;
          if (amt === 0 && categoryFilter !== catKey) return null;
          return (
            <div
              key={catKey}
              className="stat-card"
              style={{ cursor: 'pointer', outline: categoryFilter === catKey ? '2px solid var(--primary)' : 'none' }}
              onClick={() => setCategoryFilter(categoryFilter === catKey ? 'all' : catKey)}
              title="ກົດເພື່ອ Filter ສະເພາະໝວດນີ້"
            >
              <div className="stat-label">{catMeta.icon} {catMeta.label}</div>
              <div className="stat-value" style={{ fontSize: '1.15rem' }}>{formatCurrency(amt)}</div>
            </div>
          );
        })}
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Period Tabs */}
          <div className="filter-tabs" style={{ marginBottom: 0 }}>
            <button className={`filter-tab ${period === 'today' ? 'active' : ''}`} onClick={() => setPeriod('today')}>ມື້ນີ້</button>
            <button className={`filter-tab ${period === 'month' ? 'active' : ''}`} onClick={() => setPeriod('month')}>ເດືອນນີ້</button>
            <button className={`filter-tab ${period === 'all' ? 'active' : ''}`} onClick={() => setPeriod('all')}>ທັງໝົດ</button>
            <button className={`filter-tab ${period === 'custom' ? 'active' : ''}`} onClick={() => setPeriod('custom')}>ກຳນົດເອງ</button>
          </div>

          {period === 'custom' && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input type="date" className="form-input" style={{ padding: '6px 10px', fontSize: '0.85rem' }} value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <span>ຫາ</span>
              <input type="date" className="form-input" style={{ padding: '6px 10px', fontSize: '0.85rem' }} value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          )}

          {/* Category Dropdown */}
          <div style={{ minWidth: '180px' }}>
            <select className="form-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="all">📁 ທຸກໝວດໝູ່</option>
              {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="🔍 ຄົ້ນຫາລາຍລະອຽດ, ຮ້ານຄ້າ, ຜູ້ບັນທຶກ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '110px' }}>ວັນທີ</th>
                <th>ໝວດໝູ່</th>
                <th>ລາຍລະອຽດ</th>
                <th>ຮ້ານຄ້າ / ຜູ້ສະໜອງ</th>
                <th style={{ textAlign: 'right' }}>ຈຳນວນເງິນ</th>
                <th style={{ textAlign: 'center' }}>ການຈ່າຍ</th>
                <th>ຜູ້ບັນທຶກ</th>
                <th style={{ textAlign: 'center', width: '100px' }}>ຈັດການ</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🧾</div>
                    ບໍ່ມີລາຍການລາຍຈ່າຍໃນຊ່ວງເວລານີ້
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(exp => {
                  const cat = EXPENSE_CATEGORIES[exp.category] || EXPENSE_CATEGORIES.other;
                  const allowed = canModify(exp);
                  return (
                    <tr key={exp.id}>
                      <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{formatDate(exp.date)}</td>
                      <td>
                        <span style={{ fontSize: '0.82rem', padding: '2px 8px', borderRadius: '4px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                          {cat.icon} {cat.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{exp.description}</div>
                        {exp.note && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{exp.note}</div>}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {exp.vendor || '-'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444', fontSize: '0.95rem', whiteSpace: 'nowrap' }}>
                        {formatCurrency(exp.amount)}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '0.8rem' }}>
                        {exp.paymentMethod === 'cash' ? '💵 ເງິນສົດ' : exp.paymentMethod === 'transfer' ? '🏦 ໂອນ' : exp.paymentMethod === 'qr' ? '📱 QR' : '💳 ບັດ'}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {exp.createdBy || '-'}
                      </td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {allowed ? (
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button className="btn btn-ghost btn-xs" onClick={() => openEditModal(exp)} title="ແກ້ໄຂ">✏️</button>
                            <button className="btn btn-ghost btn-xs" onClick={() => handleDelete(exp)} title="ລຶບ" style={{ color: '#ef4444' }}>🗑️</button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <span className="modal-title">
                {editingExpense ? '✏️ ແກ້ໄຂລາຍຈ່າຍ' : '➕ ບັນທຶກລາຍຈ່າຍໃໝ່'}
              </span>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">ວັນທີ <span className="required">*</span></label>
                    <input
                      type="date"
                      className="form-input"
                      value={form.date}
                      onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ໝວດໝູ່ <span className="required">*</span></label>
                    <select
                      className="form-select"
                      value={form.category}
                      onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    >
                      {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                        <option key={k} value={k}>{v.icon} {v.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">ລາຍລະອຽດລາຍຈ່າຍ <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ເຊັ່ນ: ຊື້ສະບູ່ ແລະ ຢາສີຟັນຫ້ອງ 101-106..."
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">ຈຳນວນເງິນ (₭) <span className="required">*</span></label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      placeholder="0"
                      value={form.amount}
                      onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ຈ່າຍດ້ວຍ</label>
                    <select
                      className="form-select"
                      value={form.paymentMethod}
                      onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value }))}
                    >
                      <option value="cash">💵 ເງິນສົດ</option>
                      <option value="transfer">🏦 ໂອນທະນາຄານ</option>
                      <option value="qr">📱 QR Code</option>
                      <option value="card">💳 ບັດເຄຣດິດ</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">ຮ້ານຄ້າ / ຜູ້ສະໜອງ (Vendor / Shop)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ເຊັ່ນ: ຮ້ານສະດວກຊື້ໜອງກົກ..."
                    value={form.vendor}
                    onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">ໝາຍເຫດເພີ່ມເຕີມ</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="ລາຍລະອຽດອື່ນໆ..."
                    value={form.note}
                    onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>ຍົກເລີກ</button>
                <button type="submit" className="btn btn-primary">
                  {editingExpense ? '💾 ບັນທຶກການແກ້ໄຂ' : '✅ ບັນທຶກລາຍຈ່າຍ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
