import { useState, useMemo } from 'react';
import { useHotel } from '../../context/HotelContext';
import { useToast } from '../ToastProvider';
import { ROOM_TYPES, formatCurrency, formatDate, todayStr, addDays } from '../../data/initialData';
import { nightlyRate, weekdayOf } from '../../utils/pricing';

// 0 = ອາທິດ ... 6 = ເສົາ (ຄືກັບ Date.getDay())
export const WEEKDAYS = [
  { short: 'ອາ', full: 'ອາທິດ' },
  { short: 'ຈ', full: 'ຈັນ' },
  { short: 'ອ', full: 'ອັງຄານ' },
  { short: 'ພ', full: 'ພຸດ' },
  { short: 'ພຫ', full: 'ພະຫັດ' },
  { short: 'ສຸ', full: 'ສຸກ' },
  { short: 'ສ', full: 'ເສົາ' },
];

const ADJUST_TYPES = {
  percent: 'ເປີເຊັນ (%)',
  amount: 'ບວກ/ລົບ ເປັນກີບ',
  fixed: 'ລາຄາຄົງທີ່ (ກີບ/ຄືນ)',
};

function describeAdjust(p) {
  const v = Number(p.value) || 0;
  if (p.adjustType === 'percent') return v >= 0 ? `+${v}%` : `${v}%`;
  if (p.adjustType === 'amount') return `${v >= 0 ? '+' : '−'}${formatCurrency(Math.abs(v))}`;
  if (p.adjustType === 'fixed') return `= ${formatCurrency(v)} / ຄືນ`;
  return '-';
}

function describeDays(days) {
  if (!Array.isArray(days) || days.length === 0) return 'ທຸກວັນ';
  return [...days].sort((a, b) => a - b).map(d => WEEKDAYS[d]?.full).join(', ');
}

function describeRange(p) {
  if (!p.startDate && !p.endDate) return 'ທຸກຊ່ວງເວລາ';
  if (p.startDate && p.endDate) return `${formatDate(p.startDate)} → ${formatDate(p.endDate)}`;
  if (p.startDate) return `ຕັ້ງແຕ່ ${formatDate(p.startDate)}`;
  return `ຮອດ ${formatDate(p.endDate)}`;
}

function describeRoomTypes(types) {
  if (!Array.isArray(types) || types.length === 0) return 'ທຸກປະເພດຫ້ອງ';
  return types.map(t => ROOM_TYPES[t] || t).join(', ');
}

export default function RatePlansSection() {
  const { ratePlans = [], saveRatePlan, deleteRatePlan } = useHotel();
  const { toast } = useToast();
  const [editPlan, setEditPlan] = useState(null);

  const sorted = useMemo(
    () => [...ratePlans].sort((a, b) =>
      (b.active !== false) - (a.active !== false) || (Number(b.priority) || 0) - (Number(a.priority) || 0)),
    [ratePlans]
  );

  const toggleActive = (p) => {
    saveRatePlan({ ...p, active: p.active === false });
    toast(p.active === false ? `ເປີດໃຊ້ "${p.name}" ແລ້ວ` : `ປິດໃຊ້ "${p.name}" ແລ້ວ`, 'success');
  };

  const handleDelete = (p) => {
    if (!window.confirm(`ລຶບລາຄາລະດູການ "${p.name}"?`)) return;
    deleteRatePlan(p.id);
    toast('ລຶບລາຄາລະດູການສຳເລັດ', 'success');
  };

  return (
    <div>
      <div className="section-header" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div className="section-title">📅 ລາຄາລະດູການ / ທ້າຍອາທິດ</div>
          <div className="section-subtitle">{ratePlans.length} ແຜນລາຄາ</div>
        </div>
        <button className="btn btn-primary" onClick={() => setEditPlan({ ...emptyPlan() })}>➕ ເພີ່ມແຜນລາຄາ</button>
      </div>

      <div className="alert alert-warning" style={{ marginBottom: '16px', lineHeight: 1.6, fontSize: '0.85rem' }}>
        <div style={{ fontWeight: 700, marginBottom: '4px' }}>ℹ️ ວິທີຄິດລາຄາ</div>
        <div>• ລາຄາຈະຄິດຕາມ <b>“ຄືນ”</b> ຂອງວັນທີນັ້ນ — ຕົວຢ່າງ: Check-in ວັນສຸກ, Check-out ວັນອາທິດ = ຄືນວັນສຸກ + ຄືນວັນເສົາ (ວັນ Check-out ບໍ່ຄິດ).</div>
        <div>• ຖ້າມີຫຼາຍແຜນກົງກັບຄືນດຽວກັນ ລະບົບຈະໃຊ້ແຜນທີ່ມີ <b>ລຳດັບຄວາມສຳຄັນ (Priority) ສູງສຸດ</b> ພຽງແຜນດຽວ (ບໍ່ບວກຊ້ອນກັນ).</div>
        <div>• ລາຄາຖືກປັດເປັນຫຼັກພັນກີບ. ຄືນທີ່ບໍ່ກົງກັບແຜນໃດ ໃຊ້ລາຄາປົກກະຕິຂອງຫ້ອງ.</div>
      </div>

      {sorted.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📅</div>
            <div className="empty-state-text">ຍັງບໍ່ມີແຜນລາຄາ — ທຸກຄືນໃຊ້ລາຄາປົກກະຕິຂອງຫ້ອງ</div>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ຊື່ແຜນ</th>
                <th>ຊ່ວງວັນທີ</th>
                <th>ວັນ</th>
                <th>ປະເພດຫ້ອງ</th>
                <th>ປັບລາຄາ</th>
                <th>Priority</th>
                <th>ສະຖານະ</th>
                <th>ຈັດການ</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => (
                <tr key={p.id} style={{ opacity: p.active === false ? 0.55 : 1 }}>
                  <td className="td-name">{p.name}</td>
                  <td style={{ fontSize: '0.8rem' }}>{describeRange(p)}</td>
                  <td style={{ fontSize: '0.8rem' }}>{describeDays(p.daysOfWeek)}</td>
                  <td style={{ fontSize: '0.8rem' }}>{describeRoomTypes(p.roomTypes)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{describeAdjust(p)}</td>
                  <td>{Number(p.priority) || 0}</td>
                  <td>
                    <button
                      className={`btn btn-xs ${p.active === false ? 'btn-ghost' : 'btn-success'}`}
                      onClick={() => toggleActive(p)}
                      title="ກົດເພື່ອເປີດ/ປິດ"
                    >
                      {p.active === false ? '⚪ ປິດ' : '🟢 ເປີດ'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-outline-primary btn-sm" onClick={() => setEditPlan({ ...emptyPlan(), ...p })}>✏️</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RatePreview />

      {editPlan && (
        <RatePlanModal
          plan={editPlan}
          onClose={() => setEditPlan(null)}
          onSave={(plan) => {
            saveRatePlan(plan);
            toast('ບັນທຶກແຜນລາຄາສຳເລັດ! ✅', 'success');
            setEditPlan(null);
          }}
        />
      )}
    </div>
  );
}

function emptyPlan() {
  return {
    name: '',
    active: true,
    startDate: '',
    endDate: '',
    daysOfWeek: [],
    roomTypes: [],
    adjustType: 'percent',
    value: 20,
    priority: 0,
  };
}

function RatePreview() {
  const { rooms, quoteStay } = useHotel();
  const sortedRooms = useMemo(
    () => [...rooms].sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true })),
    [rooms]
  );
  const [roomId, setRoomId] = useState(sortedRooms[0]?.id || '');
  const [checkIn, setCheckIn] = useState(todayStr());
  const [checkOut, setCheckOut] = useState(addDays(todayStr(), 7));

  const room = rooms.find(r => r.id === roomId) || sortedRooms[0];
  const tooLong = checkIn && checkOut && checkOut > addDays(checkIn, 60);
  const quote = room && checkIn && checkOut && checkIn < checkOut && !tooLong
    ? quoteStay(room, checkIn, checkOut)
    : null;

  return (
    <div className="card" style={{ marginTop: '20px' }}>
      <div className="section-title" style={{ marginBottom: '12px' }}>🔍 ທົດລອງຄິດລາຄາ (Preview)</div>
      <div className="form-row" style={{ flexWrap: 'wrap' }}>
        <div className="form-group" style={{ minWidth: '160px' }}>
          <label className="form-label">ຫ້ອງ</label>
          <select className="form-select" value={room?.id || ''} onChange={e => setRoomId(e.target.value)}>
            {sortedRooms.map(r => (
              <option key={r.id} value={r.id}>
                ຫ້ອງ {r.number} — {ROOM_TYPES[r.type] || r.type} ({formatCurrency(r.price)})
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ minWidth: '140px' }}>
          <label className="form-label">Check-in</label>
          <input className="form-input" type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} />
        </div>
        <div className="form-group" style={{ minWidth: '140px' }}>
          <label className="form-label">Check-out</label>
          <input className="form-input" type="date" value={checkOut} min={checkIn} onChange={e => setCheckOut(e.target.value)} />
        </div>
      </div>

      {!room ? (
        <div className="empty-state-text">ຍັງບໍ່ມີຫ້ອງ</div>
      ) : tooLong ? (
        <div className="alert alert-warning">ກະລຸນາເລືອກບໍ່ເກີນ 60 ຄືນ</div>
      ) : !quote ? (
        <div className="alert alert-warning">ວັນ Check-out ຕ້ອງຫຼັງວັນ Check-in</div>
      ) : (
        <>
          <div className="table-container" style={{ maxHeight: '360px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ຄືນວັນທີ</th>
                  <th>ວັນ</th>
                  <th>ລາຄາປົກກະຕິ</th>
                  <th>ລາຄາຄືນນີ້</th>
                  <th>ແຜນທີ່ໃຊ້</th>
                </tr>
              </thead>
              <tbody>
                {quote.nightly.map(n => (
                  <tr key={n.date}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(n.date)}</td>
                    <td>{WEEKDAYS[weekdayOf(n.date)].full}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatCurrency(n.base)}</td>
                    <td style={{
                      fontWeight: 700,
                      color: n.price > n.base ? 'var(--error)' : n.price < n.base ? 'var(--success)' : 'var(--text-primary)',
                    }}>
                      {formatCurrency(n.price)}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{n.plan ? `📅 ${n.plan.name}` : <span style={{ color: 'var(--text-muted)' }}>— ລາຄາປົກກະຕິ</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', flexWrap: 'wrap', marginTop: '12px', fontSize: '0.9rem' }}>
            <span>{quote.nights} ຄືນ</span>
            {quote.hasAdjustment && (
              <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{formatCurrency(quote.baseTotal)}</span>
            )}
            <span style={{ fontWeight: 800, color: 'var(--accent)' }}>ລວມ: {formatCurrency(quote.total)}</span>
          </div>
        </>
      )}
    </div>
  );
}

function RatePlanModal({ plan, onSave, onClose }) {
  const { rooms } = useHotel();
  const [form, setForm] = useState({
    ...plan,
    daysOfWeek: Array.isArray(plan.daysOfWeek) ? plan.daysOfWeek : [],
    roomTypes: Array.isArray(plan.roomTypes) ? plan.roomTypes : [],
    startDate: plan.startDate || '',
    endDate: plan.endDate || '',
  });
  const [error, setError] = useState('');
  const set = (f, v) => { setForm(p => ({ ...p, [f]: v })); setError(''); };

  const toggleIn = (field, val) => {
    setForm(p => {
      const cur = p[field] || [];
      return { ...p, [field]: cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val] };
    });
    setError('');
  };

  const isWeekendPreset = form.daysOfWeek.length === 2 && form.daysOfWeek.includes(5) && form.daysOfWeek.includes(6);

  // ຕົວຢ່າງລາຄາຕໍ່ປະເພດຫ້ອງ (ຄິດສະເພາະການປັບລາຄາ, ບໍ່ສົນເງື່ອນໄຂວັນ)
  const samples = useMemo(() => {
    const types = form.roomTypes.length ? form.roomTypes : Object.keys(ROOM_TYPES);
    const probe = { ...form, id: 'preview', active: true, startDate: '', endDate: '', daysOfWeek: [], roomTypes: [] };
    return types.map(t => {
      const r = rooms.find(x => x.type === t);
      if (!r) return null;
      const res = nightlyRate(r, todayStr(), [probe]);
      return { type: t, base: res.base, price: res.price };
    }).filter(Boolean).slice(0, 5);
  }, [form, rooms]);

  const handleSave = () => {
    const name = (form.name || '').trim();
    if (!name) return setError('ກະລຸນາໃສ່ຊື່ແຜນລາຄາ');
    if (form.startDate && form.endDate && form.startDate > form.endDate) return setError('ວັນເລີ່ມຕ້ອງກ່ອນ ຫຼື ກົງກັບວັນສິ້ນສຸດ');
    const value = Number(form.value);
    if (form.value === '' || Number.isNaN(value)) return setError('ກະລຸນາໃສ່ຄ່າການປັບລາຄາ');
    if (form.adjustType === 'percent' && value < -100) return setError('ຫຼຸດໄດ້ສູງສຸດ -100%');
    if (form.adjustType === 'fixed' && value <= 0) return setError('ລາຄາຄົງທີ່ຕ້ອງຫຼາຍກວ່າ 0');

    const out = {
      ...form,
      name,
      value,
      priority: Number(form.priority) || 0,
      active: form.active !== false,
      daysOfWeek: [...form.daysOfWeek].sort((a, b) => a - b),
    };
    if (!out.startDate) delete out.startDate;
    if (!out.endDate) delete out.endDate;
    onSave(out);
  };

  const chip = (selected) => ({
    padding: '6px 12px',
    borderRadius: '999px',
    border: `1px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
    background: selected ? 'var(--primary)' : 'var(--bg-elevated)',
    color: selected ? '#fff' : 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: 600,
  });

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">{plan.id ? '✏️ ແກ້ໄຂແຜນລາຄາ' : '➕ ເພີ່ມແຜນລາຄາ'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
          {error && <div className="alert alert-error" style={{ marginBottom: '14px' }}>❌ {error}</div>}

          <div className="form-row" style={{ flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 2, minWidth: '200px' }}>
              <label className="form-label">ຊື່ແຜນ <span className="required">*</span></label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="ເຊັ່ນ: ທ້າຍອາທິດ, ລະດູທ່ອງທ່ຽວ, ປີໃໝ່ລາວ" />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
              <label className="form-label">ສະຖານະ</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', paddingTop: '8px' }}>
                <input type="checkbox" checked={form.active !== false} onChange={e => set('active', e.target.checked)}
                  style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }} />
                {form.active !== false ? '🟢 ເປີດໃຊ້' : '⚪ ປິດໃຊ້'}
              </label>
            </div>
          </div>

          <div className="form-row" style={{ flexWrap: 'wrap' }}>
            <div className="form-group" style={{ minWidth: '150px' }}>
              <label className="form-label">ວັນເລີ່ມ (ບໍ່ບັງຄັບ)</label>
              <input className="form-input" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div className="form-group" style={{ minWidth: '150px' }}>
              <label className="form-label">ວັນສິ້ນສຸດ (ບໍ່ບັງຄັບ, ລວມວັນນີ້)</label>
              <input className="form-input" type="date" value={form.endDate} min={form.startDate || undefined}
                onChange={e => set('endDate', e.target.value)} />
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '-8px', marginBottom: '14px' }}>
            ວ່າງໄວ້ = ໃຊ້ໄດ້ທຸກຊ່ວງເວລາ
          </div>

          <div className="form-group">
            <label className="form-label">ວັນຂອງຄືນທີ່ພັກ (ບໍ່ເລືອກ = ທຸກວັນ)</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              {WEEKDAYS.map((d, i) => (
                <button key={i} type="button" title={d.full} style={chip(form.daysOfWeek.includes(i))}
                  onClick={() => toggleIn('daysOfWeek', i)}>
                  {d.short}
                </button>
              ))}
              <button type="button" className={`btn btn-sm ${isWeekendPreset ? 'btn-primary' : 'btn-outline-primary'}`}
                style={{ marginLeft: '6px' }} onClick={() => set('daysOfWeek', [5, 6])}>
                ທ້າຍອາທິດ (ສຸກ-ເສົາ)
              </button>
              {form.daysOfWeek.length > 0 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('daysOfWeek', [])}>ລ້າງ</button>
              )}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              ເລືອກແລ້ວ: {describeDays(form.daysOfWeek)} — ຄືນວັນສຸກ ແລະ ຄືນວັນເສົາ ຄືຄືນທ້າຍອາທິດທີ່ນິຍົມ
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">ປະເພດຫ້ອງ (ບໍ່ເລືອກ = ທຸກປະເພດ)</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {Object.entries(ROOM_TYPES).map(([k, v]) => (
                <button key={k} type="button" style={chip(form.roomTypes.includes(k))} onClick={() => toggleIn('roomTypes', k)}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row" style={{ flexWrap: 'wrap' }}>
            <div className="form-group" style={{ minWidth: '170px' }}>
              <label className="form-label">ວິທີປັບລາຄາ</label>
              <select className="form-select" value={form.adjustType} onChange={e => set('adjustType', e.target.value)}>
                {Object.entries(ADJUST_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ minWidth: '140px' }}>
              <label className="form-label">
                {form.adjustType === 'percent' ? 'ຄ່າ (%)' : 'ຈຳນວນ (₭)'}
              </label>
              <input className="form-input" type="number" value={form.value}
                step={form.adjustType === 'percent' ? 1 : 1000}
                onChange={e => set('value', e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
            <div className="form-group" style={{ minWidth: '110px' }}>
              <label className="form-label">Priority</label>
              <input className="form-input" type="number" value={form.priority}
                onChange={e => set('priority', e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-8px', marginBottom: '14px', lineHeight: 1.6 }}>
            {form.adjustType === 'percent' && 'ຕົວຢ່າງ: 20 = ເພີ່ມ 20%, -10 = ຫຼຸດ 10%. '}
            {form.adjustType === 'amount' && 'ຕົວຢ່າງ: 100000 = ເພີ່ມ 100,000 ₭/ຄືນ, -50000 = ຫຼຸດ 50,000 ₭/ຄືນ. '}
            {form.adjustType === 'fixed' && 'ທຸກຫ້ອງທີ່ກົງເງື່ອນໄຂຈະໃຊ້ລາຄານີ້ຕໍ່ຄືນ (ບໍ່ສົນລາຄາປົກກະຕິ). '}
            Priority ສູງກວ່າ = ໃຊ້ກ່ອນ ເມື່ອມີຫຼາຍແຜນກົງກັບຄືນດຽວກັນ.
          </div>

          {samples.length > 0 && (
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px' }}>💡 ຕົວຢ່າງລາຄາ (ຄືນທີ່ເຂົ້າເງື່ອນໄຂ)</div>
              {samples.map(s => (
                <div key={s.type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '2px 0' }}>
                  <span>{ROOM_TYPES[s.type]}</span>
                  <span>
                    <span style={{ color: 'var(--text-muted)' }}>{formatCurrency(s.base)}</span>
                    {' → '}
                    <b style={{ color: 'var(--accent)' }}>{formatCurrency(s.price)}</b>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>ຍົກເລີກ</button>
          <button className="btn btn-primary" onClick={handleSave}>💾 ບັນທຶກ</button>
        </div>
      </div>
    </div>
  );
}
