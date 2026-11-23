import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { validatePasswordStrength } from '../utils/security';

/** ໜ້າຕ່າງປ່ຽນລະຫັດຜ່ານ. ຖ້າ forced=true ຈະປິດບໍ່ໄດ້ຈົນກວ່າຈະປ່ຽນ */
export default function ChangePasswordModal({ forced = false, onClose }) {
  const { changePassword, currentUser, logout } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const pwErr = validatePasswordStrength(form.next, currentUser?.username);
    if (pwErr) return setError(pwErr);
    if (form.next !== form.confirm) return setError('ຢືນຢັນລະຫັດຜ່ານໃໝ່ບໍ່ກົງກັນ');
    setLoading(true);
    const res = await changePassword(form.current, form.next);
    setLoading(false);
    if (!res.success) return setError(res.message);
    setDone(true);
    setTimeout(() => onClose?.(), 1200);
  };

  return (
    <div className="modal-overlay" onClick={(e) => !forced && e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <span className="modal-title">🔑 {forced ? 'ກະລຸນາປ່ຽນລະຫັດຜ່ານກ່ອນໃຊ້ງານ' : 'ປ່ຽນລະຫັດຜ່ານ'}</span>
          {!forced && <button className="modal-close" onClick={onClose}>✕</button>}
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {forced && (
              <div className="alert alert-warning" style={{ marginBottom: '16px', fontSize: '0.82rem' }}>
                ⚠️ ບັນຊີຂອງທ່ານໃຊ້ລະຫັດຜ່ານເລີ່ມຕົ້ນ ຫຼື ຖືກຣີເຊັດ. ເພື່ອຄວາມປອດໄພ ກະລຸນາຕັ້ງລະຫັດຜ່ານໃໝ່.
              </div>
            )}
            {error && <div className="alert alert-error" style={{ marginBottom: '12px' }}>❌ {error}</div>}
            {done && <div className="alert alert-success" style={{ marginBottom: '12px' }}>✅ ປ່ຽນລະຫັດຜ່ານສຳເລັດ!</div>}
            <div className="form-group">
              <label className="form-label">ລະຫັດຜ່ານປັດຈຸບັນ</label>
              <input className="form-input" type="password" autoComplete="current-password" value={form.current} onChange={e => set('current', e.target.value)} required autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">ລະຫັດຜ່ານໃໝ່ (≥ 8 ຕົວ, ມີຕົວອັກສອນ + ຕົວເລກ)</label>
              <input className="form-input" type="password" autoComplete="new-password" value={form.next} onChange={e => set('next', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">ຢືນຢັນລະຫັດຜ່ານໃໝ່</label>
              <input className="form-input" type="password" autoComplete="new-password" value={form.confirm} onChange={e => set('confirm', e.target.value)} required />
            </div>
          </div>
          <div className="modal-footer">
            {forced
              ? <button type="button" className="btn btn-ghost" onClick={logout}>🚪 ອອກຈາກລະບົບ</button>
              : <button type="button" className="btn btn-ghost" onClick={onClose}>ຍົກເລີກ</button>}
            <button type="submit" className="btn btn-primary" disabled={loading || done}>
              {loading ? '⏳...' : '💾 ບັນທຶກລະຫັດຜ່ານໃໝ່'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
