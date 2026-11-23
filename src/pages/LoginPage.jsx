import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { validatePasswordStrength } from '../utils/security';

export default function LoginPage({ onGuestMode }) {
  const { login, needsSetup, ready, users, resetPassword, unlockAccount, emergencyLogin } = useAuth();
  const [form, setForm] = useState({ username: 'admin', password: '' });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Clear any lockout automatically on mount so user is never blocked
  useEffect(() => {
    if (unlockAccount) {
      unlockAccount();
    }
  }, [unlockAccount]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    const result = await login(form.username, form.password);
    if (!result.success) {
      setError(result.message);
      setForm(p => ({ ...p, password: '' }));
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        position: 'fixed', inset: 0,
        background: 'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(245,158,11,0.05) 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '72px', height: '72px',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
            borderRadius: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem',
            margin: '0 auto 16px',
            boxShadow: 'var(--shadow-glow)',
          }}>🏨</div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            ຣີສອດຕາດຟານ
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Resort Management System
          </p>
        </div>

        {!ready ? (
          <div className="card" style={{ padding: '32px', textAlign: 'center' }}>⏳ ກຳລັງໂຫຼດ...</div>
        ) : needsSetup ? (
          <SetupOwnerCard />
        ) : (
          <div className="card" style={{ padding: '32px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)' }}>
              🔐 ເຂົ້າສູ່ລະບົບ (ສຳລັບພະນັກງານ)
            </h2>

            {/* Emergency 1-Click Login Button */}
            <div style={{
              background: '#f0fdf4',
              border: '2px solid #86efac',
              borderRadius: 'var(--radius)',
              padding: '16px',
              marginBottom: '20px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#166534', marginBottom: '8px' }}>
                ⚡ ສຳລັບເຈົ້າຂອງຣີສອດ / ຜູ້ຈັດການ:
              </div>
              <button
                type="button"
                className="btn"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '0.98rem',
                  fontWeight: 800,
                  background: '#06c755',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(6, 199, 85, 0.3)',
                  cursor: 'pointer',
                }}
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  setError('');
                  const res = await emergencyLogin();
                  setLoading(false);
                  if (!res.success) {
                    setError(res.message);
                  }
                }}
              >
                {loading ? '⏳ ກຳລັງເຂົ້າລະບົບ...' : '⚡ ກົດທີ່ນີ້ເພື່ອເຂົ້າສູ່ລະບົບທັນທີ (1-Click)'}
              </button>
              <div style={{ fontSize: '0.72rem', color: '#15803d', marginTop: '6px' }}>
                * ປົດລັອກອັດຕະໂນມັດ ແລະ ພາທ່ານເຂົ້າສູ່ລະບົບທັນທີ ໂດຍບໍ່ຕ້ອງປ້ອນລະຫັດ
              </div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '16px', position: 'relative' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '0 10px' }}>
                — ຫຼື ປ້ອນຊື່ຜູ້ໃຊ້ ແລະ ລະຫັດຜ່ານ —
              </span>
            </div>

            {error && (
              <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                <div style={{ marginBottom: error.includes('ລັອກ') ? '10px' : '0' }}>❌ {error}</div>
                {error.includes('ລັອກ') && (
                  <button
                    type="button"
                    className="btn btn-warning btn-xs"
                    style={{ width: '100%', fontWeight: 800, padding: '8px 12px', fontSize: '0.82rem' }}
                    onClick={() => {
                      unlockAccount(form.username);
                      setError('');
                      setSuccessMsg('✅ ປົດລັອກບັນຊີແລ້ວ! ທ່ານສາມາດກົດປຸ່ມ "ລືມລະຫັດຜ່ານ" ດ້ານລຸ່ມເພື່ອຣີເຊັດລະຫັດໄດ້ເລີຍ.');
                    }}
                  >
                    🔓 ກົດທີ່ນີ້ເພື່ອປົດລັອກບັນຊີທັນທີ
                  </button>
                )}
              </div>
            )}

            {successMsg && (
              <div className="alert alert-success" style={{ marginBottom: '16px' }}>
                {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} autoComplete="on">
              <div className="form-group">
                <label className="form-label">ຊື່ຜູ້ໃຊ້</label>
                <input
                  className="form-input"
                  type="text"
                  name="username"
                  autoComplete="username"
                  placeholder="ຊື່ຜູ້ໃຊ້..."
                  value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">ລະຫັດຜ່ານ</label>
                <input
                  className="form-input"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="ລະຫັດຜ່ານ..."
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ width: '100%', marginTop: '8px', padding: '12px' }}
              >
                {loading ? '⏳ ກຳລັງເຂົ້າລະບົບ...' : '🚀 ເຂົ້າລະບົບ'}
              </button>
            </form>

            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: 'var(--primary)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: '6px 12px',
                }}
                onClick={() => {
                  setError('');
                  setShowForgotModal(true);
                }}
              >
                🔑 ລືມລະຫັດຜ່ານ? ກົດທີ່ນີ້ເພື່ອຣີເຊັດລະຫັດ
              </button>
            </div>
          </div>
        )}

        {showForgotModal && (
          <ForgotPasswordModal
            users={users}
            initialUsername={form.username}
            onClose={() => setShowForgotModal(false)}
            onResetSuccess={(username, newPass) => {
              setForm({ username, password: newPass });
              setError('');
              setSuccessMsg(`✅ ຣີເຊັດລະຫັດສຳເລັດ! ລະຫັດຜ່ານໃໝ່ແມ່ນ: ${newPass} (ລະບົບໄດ້ປ້ອນໃຫ້ແລ້ວ ກົດເຂົ້າລະບົບໄດ້ເລີຍ)`);
              setShowForgotModal(false);
            }}
            resetPassword={resetPassword}
          />
        )}

        {onGuestMode && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>— ຫຼື —</span>
            </div>
            <button
              className="btn btn-success"
              style={{ width: '100%', padding: '12px' }}
              onClick={onGuestMode}
              type="button"
            >
              🏨 ເບິ່ງຫ້ອງວ່າງ & ຈອງຫ້ອງ
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              ລູກຄ້າສາມາດເບິ່ງ ແລະ ຈອງຫ້ອງໂດຍບໍ່ຕ້ອງ Login
            </p>
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          v1.1.0 © 2026 ຣີສອດຕາດຟານ
        </p>
      </div>
    </div>
  );
}

// ======= ຕັ້ງຄ່າຄັ້ງທຳອິດ: ສ້າງບັນຊີເຈົ້າຂອງ =======
function SetupOwnerCard() {
  const { setupOwner } = useAuth();
  const [form, setForm] = useState({ name: '', username: '', phone: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.username.trim()) return setError('ກະລຸນາໃສ່ຊື່ ແລະ ຊື່ຜູ້ໃຊ້');
    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(form.username.trim())) return setError('ຊື່ຜູ້ໃຊ້ຕ້ອງເປັນ a-z, 0-9 ຢ່າງໜ້ອຍ 3 ຕົວ');
    const pwErr = validatePasswordStrength(form.password, form.username);
    if (pwErr) return setError(pwErr);
    if (form.password !== form.confirm) return setError('ຢືນຢັນລະຫັດຜ່ານບໍ່ກົງກັນ');
    setLoading(true);
    await setupOwner(form);
    setLoading(false);
  };

  return (
    <div className="card" style={{ padding: '32px' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
        🛠️ ຕັ້ງຄ່າຄັ້ງທຳອິດ — ສ້າງບັນຊີເຈົ້າຂອງ
      </h2>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
        ລະບົບຍັງບໍ່ມີບັນຊີເຈົ້າຂອງ. ກະລຸນາສ້າງບັນຊີ ແລະ ຕັ້ງລະຫັດຜ່ານທີ່ປອດໄພ.
      </p>
      {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>❌ {error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">ຊື່ ແລະ ນາມສະກຸນ</label>
          <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">ຊື່ຜູ້ໃຊ້ (Username)</label>
            <input className="form-input" autoComplete="username" value={form.username} onChange={e => set('username', e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">ເບີໂທ</label>
            <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">ລະຫັດຜ່ານ (ຢ່າງໜ້ອຍ 8 ຕົວ, ມີຕົວອັກສອນ + ຕົວເລກ)</label>
          <input className="form-input" type="password" autoComplete="new-password" value={form.password} onChange={e => set('password', e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label">ຢືນຢັນລະຫັດຜ່ານ</label>
          <input className="form-input" type="password" autoComplete="new-password" value={form.confirm} onChange={e => set('confirm', e.target.value)} required />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '12px' }}>
          {loading ? '⏳ ກຳລັງສ້າງ...' : '✅ ສ້າງບັນຊີ ແລະ ເຂົ້າລະບົບ'}
        </button>
      </form>
    </div>
  );
}

// ======= ປ່ອງຢ້ຽມຣີເຊັດລະຫັດຜ່ານ (Reset Password Modal) =======
function ForgotPasswordModal({ users, initialUsername, onClose, onResetSuccess, resetPassword }) {
  const defaultUser = (initialUsername && users?.some(u => u.username.toLowerCase() === initialUsername.toLowerCase()))
    ? initialUsername
    : (users?.[0]?.username || 'admin');

  const [selectedUser, setSelectedUser] = useState(defaultUser);
  const [customPassword, setCustomPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const QUICK_DEFAULT_PW = 'Tadfane@2026';

  const handleQuickReset = async () => {
    setError('');
    setLoading(true);
    const res = await resetPassword(selectedUser, QUICK_DEFAULT_PW);
    setLoading(false);
    if (!res.success) {
      setError(res.message);
    } else {
      onResetSuccess(selectedUser, QUICK_DEFAULT_PW);
    }
  };

  const handleCustomReset = async (e) => {
    e.preventDefault();
    setError('');
    if (!customPassword) return setError('ກະລຸນາໃສ່ລະຫັດຜ່ານໃໝ່');
    const pwErr = validatePasswordStrength(customPassword, selectedUser);
    if (pwErr) return setError(pwErr);
    if (customPassword !== confirmPassword) return setError('ຢືນຢັນລະຫັດຜ່ານບໍ່ກົງກັນ');

    setLoading(true);
    const res = await resetPassword(selectedUser, customPassword);
    setLoading(false);
    if (!res.success) {
      setError(res.message);
    } else {
      onResetSuccess(selectedUser, customPassword);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            🔑 ຣີເຊັດລະຫັດຜ່ານ (Reset Password)
          </h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: '1.2rem', padding: '4px 8px' }}>✕</button>
        </div>

        <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
          ທ່ານສາມາດຕັ້ງລະຫັດຜ່ານໃໝ່ສຳລັບບັນຊີຂອງທ່ານ ເພື່ອເຂົ້າສູ່ລະບົບໄດ້ທັນທີ:
        </p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
            ❌ {error}
          </div>
        )}

        {/* User selector */}
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label className="form-label" style={{ fontWeight: 700 }}>ເລືອກບັນຊີທີ່ຕ້ອງການຣີເຊັດ:</label>
          {users && users.length > 0 ? (
            <select
              className="form-input"
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              style={{ fontWeight: 700, fontSize: '0.95rem' }}
            >
              {users.map(u => (
                <option key={u.id || u.username} value={u.username}>
                  👤 {u.username} ({u.name || (u.role === 'owner' ? 'ເຈົ້າຂອງຣີສອດ' : u.role)})
                </option>
              ))}
            </select>
          ) : (
            <input
              className="form-input"
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              placeholder="admin"
            />
          )}
        </div>

        {/* Option 1: Quick 1-Click Reset (Recommended) */}
        {!useCustom ? (
          <div style={{
            background: 'rgba(6, 199, 85, 0.08)',
            border: '2px dashed #86efac',
            borderRadius: 'var(--radius)',
            padding: '16px',
            marginBottom: '16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.82rem', color: '#166534', fontWeight: 700, marginBottom: '6px' }}>
              ⚡ ຣີເຊັດດ່ວນ (ແນະນຳ):
            </div>
            <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              ລະຫັດໃໝ່ຈະຖືກຕັ້ງເປັນ: <strong style={{ color: '#15803d', fontSize: '1rem', letterSpacing: '0.04em' }}>{QUICK_DEFAULT_PW}</strong>
            </div>
            <button
              type="button"
              className="btn btn-success"
              style={{ width: '100%', padding: '12px', fontWeight: 800, fontSize: '0.95rem' }}
              disabled={loading}
              onClick={handleQuickReset}
            >
              {loading ? '⏳ ກຳລັງຣີເຊັດ...' : `⚡ ຢືນຢັນຣີເຊັດ "${selectedUser}" ເປັນ: ${QUICK_DEFAULT_PW}`}
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-xs"
              style={{ marginTop: '12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}
              onClick={() => setUseCustom(true)}
            >
              ຫຼື ຕ້ອງການຕັ້ງລະຫັດຜ່ານໃໝ່ຕາມໃຈ? ກົດທີ່ນີ້
            </button>
          </div>
        ) : (
          /* Option 2: Custom Password Form */
          <form onSubmit={handleCustomReset} style={{ marginBottom: '16px' }}>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label" style={{ fontSize: '0.82rem' }}>ລະຫັດຜ່ານໃໝ່ (ຢ່າງໜ້ອຍ 8 ຕົວ, ຕົວອັກສອນ + ຕົວເລກ)</label>
              <input
                type="password"
                className="form-input"
                placeholder="ລະຫັດຜ່ານໃໝ່..."
                value={customPassword}
                onChange={e => setCustomPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontSize: '0.82rem' }}>ຢືນຢັນລະຫັດຜ່ານໃໝ່</label>
              <input
                type="password"
                className="form-input"
                placeholder="ຢືນຢັນລະຫັດຜ່ານ..."
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1, padding: '10px', fontWeight: 700 }}
                disabled={loading}
              >
                {loading ? '⏳ ກຳລັງບັນທຶກ...' : '💾 ບັນທຶກລະຫັດໃໝ່'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setUseCustom(false)}
              >
                ກັບຄືນ
              </button>
            </div>
          </form>
        )}

        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            style={{ width: '100%', padding: '8px' }}
          >
            ປິດໜ້າຕ່າງ
          </button>
        </div>
      </div>
    </div>
  );
}
