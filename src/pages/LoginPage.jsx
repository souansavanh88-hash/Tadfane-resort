import { useState, useMemo } from 'react';
import { useAuth, getLegacySummary } from '../context/AuthContext';
import { validatePasswordStrength } from '../utils/security';

export default function LoginPage({ onGuestMode }) {
  const { login, needsSetup, ready, serverError, retryConnect } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
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

      <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }}>
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
          <div className="card" style={{ padding: '32px', textAlign: 'center' }}>⏳ ກຳລັງເຊື່ອມຕໍ່ server...</div>
        ) : serverError ? (
          <ServerErrorCard message={serverError} onRetry={retryConnect} />
        ) : needsSetup ? (
          <SetupOwnerCard />
        ) : (
          <div className="card" style={{ padding: '32px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)' }}>
              🔐 ເຂົ້າສູ່ລະບົບ (ສຳລັບພະນັກງານ)
            </h2>

            {error && (
              <div className="alert alert-error" style={{ marginBottom: '16px' }}>❌ {error}</div>
            )}

            <form onSubmit={handleSubmit} autoComplete="on">
              <div className="form-group">
                <label className="form-label">ຊື່ຜູ້ໃຊ້</label>
                <input
                  className="form-input"
                  type="text"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
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
                style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)', textDecoration: 'underline' }}
                onClick={() => setShowForgot(true)}
              >
                🔑 ລືມລະຫັດຜ່ານ?
              </button>
            </div>
          </div>
        )}

        {showForgot && <ForgotPasswordInfo onClose={() => setShowForgot(false)} />}

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
              🏨 ເບິ່ງຫ້ອງວ່າງ &amp; ຈອງຫ້ອງ
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              ລູກຄ້າສາມາດເບິ່ງ ແລະ ຈອງຫ້ອງໂດຍບໍ່ຕ້ອງ Login
            </p>
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          v2.0.0 © 2026 ຣີສອດຕາດຟານ
        </p>
      </div>
    </div>
  );
}

// ======= ເຊື່ອມຕໍ່ server ບໍ່ໄດ້ =======
function ServerErrorCard({ message, onRetry }) {
  return (
    <div className="card" style={{ padding: '28px' }}>
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '10px', color: 'var(--danger, #dc2626)' }}>
        📡 ເຊື່ອມຕໍ່ server ບໍ່ໄດ້
      </h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>{message}</p>
      <ul style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '18px', marginBottom: '18px', lineHeight: 1.7 }}>
        <li>ກວດວ່າເຄື່ອງ server ເປີດຢູ່ ແລະ ແລ່ນຄຳສັ່ງ <code>npm start</code> ແລ້ວ</li>
        <li>ກວດວ່າເຄື່ອງນີ້ເຊື່ອມ Wi-Fi ດຽວກັນກັບເຄື່ອງ server</li>
      </ul>
      <button className="btn btn-primary" style={{ width: '100%' }} onClick={onRetry}>🔄 ລອງໃໝ່</button>
    </div>
  );
}

// ======= ລືມລະຫັດຜ່ານ: ຕ້ອງໃຫ້ເຈົ້າຂອງຣີເຊັດໃຫ້ (ປອດໄພ) =======
function ForgotPasswordInfo({ onClose }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <span className="modal-title">🔑 ລືມລະຫັດຜ່ານ</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ fontSize: '0.88rem', lineHeight: 1.7 }}>
          <p style={{ marginBottom: '12px' }}>
            <strong>👤 ພະນັກງານ:</strong> ກະລຸນາແຈ້ງເຈົ້າຂອງ ຫຼື ຜູ້ຈັດການ ໃຫ້ຣີເຊັດລະຫັດໃຫ້ ທີ່
            <em> ຕັ້ງຄ່າ → ຜູ້ໃຊ້ງານ → ແກ້ໄຂ</em>. ເມື່ອເຂົ້າລະບົບຄັ້ງຕໍ່ໄປ ລະບົບຈະໃຫ້ຕັ້ງລະຫັດໃໝ່ເອງ.
          </p>
          <p style={{ marginBottom: '8px' }}>
            <strong>👑 ເຈົ້າຂອງ:</strong> ຣີເຊັດໄດ້ທີ່ເຄື່ອງ server ເທົ່ານັ້ນ (ເພື່ອຄວາມປອດໄພ):
          </p>
          <ol style={{ paddingLeft: '20px', marginBottom: '8px' }}>
            <li>ປິດ server (ກົດ <code>Ctrl + C</code> ໃນໜ້າຕ່າງ Terminal)</li>
            <li>ພິມ: <code>npm run reset-password -- ຊື່ຜູ້ໃຊ້</code></li>
            <li>ໃສ່ລະຫັດໃໝ່ ແລ້ວເປີດ server ຄືນ: <code>npm start</code></li>
          </ol>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>ເຂົ້າໃຈແລ້ວ</button>
        </div>
      </div>
    </div>
  );
}

// ======= ຕັ້ງຄ່າຄັ້ງທຳອິດ: ສ້າງບັນຊີເຈົ້າຂອງ / ນຳເຂົ້າຂໍ້ມູນເກົ່າ =======
function SetupOwnerCard() {
  const { setupOwner, importLegacyWithAccounts } = useAuth();
  const legacy = useMemo(() => getLegacySummary(), []);
  const [form, setForm] = useState({ name: '', username: '', phone: '', password: '', confirm: '' });
  const [importLegacy, setImportLegacy] = useState(legacy.hasData);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
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
    const r = await setupOwner({ ...form, importLegacy });
    setLoading(false);
    if (!r.success) setError(r.message);
  };

  const handleImportAll = async () => {
    setError('');
    setLoading(true);
    const r = await importLegacyWithAccounts();
    setLoading(false);
    if (!r.success) setError(r.message);
    else setInfo('✅ ນຳເຂົ້າສຳເລັດ! ເຂົ້າລະບົບດ້ວຍຊື່ຜູ້ໃຊ້ ແລະ ລະຫັດຜ່ານເດີມໄດ້ເລີຍ');
  };

  return (
    <div className="card" style={{ padding: '32px' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
        🛠️ ຕັ້ງຄ່າຄັ້ງທຳອິດ
      </h2>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        server ຍັງບໍ່ມີບັນຊີເຈົ້າຂອງ.
      </p>
      {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>❌ {error}</div>}
      {info && <div className="alert alert-success" style={{ marginBottom: '16px' }}>{info}</div>}

      {legacy.hasData && (
        <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 'var(--radius)', padding: '14px', marginBottom: '18px', fontSize: '0.82rem' }}>
          <div style={{ fontWeight: 700, color: '#1e40af', marginBottom: '6px' }}>📦 ພົບຂໍ້ມູນເກົ່າໃນ browser ນີ້</div>
          <div style={{ color: '#1e3a8a', marginBottom: '10px' }}>
            ການຈອງ {legacy.bookings} • ຫ້ອງ {legacy.rooms} • ຂາຍກິດຈະກຳ {legacy.activitySales} • ບັນຊີຜູ້ໃຊ້ {legacy.users}
          </div>
          {legacy.hasOwner && (
            <button type="button" className="btn btn-primary btn-sm" style={{ width: '100%' }} disabled={loading} onClick={handleImportAll}>
              📥 ນຳເຂົ້າທັງໝົດ (ໃຊ້ບັນຊີ ແລະ ລະຫັດຜ່ານເດີມ)
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-secondary)' }}>
          {legacy.hasOwner ? 'ຫຼື ສ້າງບັນຊີເຈົ້າຂອງໃໝ່:' : 'ສ້າງບັນຊີເຈົ້າຂອງ:'}
        </div>
        <div className="form-group">
          <label className="form-label">ຊື່ ແລະ ນາມສະກຸນ</label>
          <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">ຊື່ຜູ້ໃຊ້ (Username)</label>
            <input className="form-input" autoComplete="username" autoCapitalize="none" value={form.username} onChange={e => set('username', e.target.value)} required />
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
        {legacy.hasData && (
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.82rem', marginBottom: '14px', cursor: 'pointer' }}>
            <input type="checkbox" checked={importLegacy} onChange={e => setImportLegacy(e.target.checked)} />
            ນຳເຂົ້າຂໍ້ມູນເກົ່າ (ການຈອງ, ຫ້ອງ, ລາຍຮັບ) ນຳ
          </label>
        )}
        <button type="submit" className="btn btn-success" disabled={loading} style={{ width: '100%', padding: '12px' }}>
          {loading ? '⏳ ກຳລັງສ້າງ...' : '✅ ສ້າງບັນຊີ ແລະ ເຂົ້າລະບົບ'}
        </button>
      </form>
    </div>
  );
}
