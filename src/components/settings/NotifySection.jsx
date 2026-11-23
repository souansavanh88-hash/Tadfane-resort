import { useState, useEffect, useCallback } from 'react';
import { api } from '../../utils/api';
import { useToast } from '../ToastProvider';

export default function NotifySection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [form, setForm] = useState({
    enabled: false,
    chatId: '',
    botToken: '',
    hasToken: false,
  });

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('/api/admin/notify');
      setForm(prev => ({
        ...prev,
        enabled: !!res.enabled,
        chatId: res.chatId || '',
        hasToken: !!res.hasToken,
        botToken: '',
      }));
    } catch (err) {
      toast(err.message || 'ໂຫຼດການຕັ້ງຄ່າແຈ້ງເຕືອນບໍ່ສຳເລັດ', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        enabled: form.enabled,
        chatId: form.chatId.trim(),
      };
      if (form.botToken.trim()) {
        payload.botToken = form.botToken.trim();
      }
      const res = await api('/api/admin/notify', {
        method: 'PUT',
        body: payload,
      });
      setForm(prev => ({
        ...prev,
        enabled: res.enabled,
        chatId: res.chatId,
        hasToken: res.hasToken,
        botToken: '',
      }));
      toast('💾 ບັນທຶກການຕັ້ງຄ່າ Telegram ສຳເລັດ', 'success');
    } catch (err) {
      toast(err.message || 'ບັນທຶກບໍ່ສຳເລັດ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClearToken = async () => {
    if (!window.confirm('ຕ້ອງການລຶບ Telegram Bot Token ອອກແທ້ບໍ່?')) return;
    setSaving(true);
    try {
      const res = await api('/api/admin/notify', {
        method: 'PUT',
        body: { enabled: false, chatId: form.chatId, clearToken: true },
      });
      setForm(prev => ({
        ...prev,
        enabled: res.enabled,
        hasToken: false,
        botToken: '',
      }));
      toast('ລຶບ Token ຮຽບຮ້ອຍ', 'info');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await api('/api/admin/notify/test', { method: 'POST' });
      toast('✅ ສົ່ງຂໍ້ຄວາມທົດສອບເຂົ້າ Telegram ສຳເລັດແລ້ວ! ກວດເບິ່ງໃນ Telegram ຂອງທ່ານ', 'success');
    } catch (err) {
      toast(`❌ ສົ່ງທົດສອບບໍ່ສຳເລັດ: ${err.message}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <div className="section-header" style={{ marginBottom: '20px' }}>
        <div>
          <div className="section-title">🔔 ການແຈ້ງເຕືອນ (Notifications)</div>
          <div className="section-subtitle">
            ແຈ້ງເຕືອນອັດຕະໂນມັດເມື່ອມີການຈອງຫ້ອງພັກ ຫຼື ຈອງກິດຈະກຳໃໝ່ຜ່ານທາງ Telegram
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Settings Form */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ✈️ ຕັ້ງຄ່າ Telegram Bot
          </h3>

          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>⏳ ກຳລັງໂຫຼດ...</div>
          ) : (
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.92rem' }}>
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))}
                  />
                  <span>ເປີດການແຈ້ງເຕືອນຜ່ານ Telegram (Active)</span>
                </label>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    Telegram Bot Token
                  </label>
                  {form.hasToken && (
                    <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                      ✓ ຕັ້ງຄ່າແລ້ວ
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  className="form-input"
                  placeholder={form.hasToken ? '•••••••••••••••••••••••• (ປ້ອນໃໝ່ຫາກຕ້ອງການປ່ຽນ)' : 'ເຊັ່ນ: 7123456789:AAH...'}
                  value={form.botToken}
                  onChange={e => setForm(p => ({ ...p, botToken: e.target.value }))}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <span>ຮັບ Token ຈາກ @BotFather ໃນ Telegram</span>
                  {form.hasToken && (
                    <button type="button" className="btn btn-ghost btn-xs" style={{ color: '#ef4444', padding: '0 4px' }} onClick={handleClearToken}>
                      ລຶບ Token ອອກ
                    </button>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Telegram Chat ID <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ເຊັ່ນ: 123456789 ຫຼື -100123456789 (ກຸ່ມ)"
                  value={form.chatId}
                  onChange={e => setForm(p => ({ ...p, chatId: e.target.value }))}
                  required={form.enabled}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  ID ຂອງຫ້ອງແຊັດສ່ວນຕົວ ຫຼື ກຸ່ມພະນັກງານຕ້ອນຮັບ
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ flex: 1, padding: '10px' }}
                >
                  {saving ? '⏳...' : '💾 ບັນທຶກການຕັ້ງຄ່າ'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  disabled={testing || !form.hasToken || !form.chatId}
                  onClick={handleTest}
                  title="ສົ່ງຂໍ້ຄວາມທົດສອບເຂົ້າ Telegram"
                >
                  {testing ? '⏳...' : '📲 ສົ່ງທົດສອບ'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Instructions Card */}
        <div className="card" style={{ padding: '24px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '14px' }}>
            📖 ວິທີສ້າງ Telegram Bot (4 ຂັ້ນຕອນ)
          </h3>

          <ol style={{ paddingLeft: '20px', fontSize: '0.85rem', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
            <li>
              ເປີດ Telegram ແລ້ວຄົ້ນຫາ <strong>@BotFather</strong>, ກົດ Start ແລ້ວສົ່ງຄຳສັ່ງ <code>/newbot</code>
            </li>
            <li>
              ຕັ້ງຊື່ Bot ແລະ Username (ລົງທ້າຍດ້ວຍ <code>bot</code>). BotFather ຈະໃຫ້ <strong>HTTP API Token</strong> ມາ, ໃຫ້ກັອບປີ້ມາວາງໃສ່ຊ່ອງ Bot Token ດ້ານຊ້າຍ.
            </li>
            <li>
              <strong>ເອົາ Chat ID:</strong>
              <ul style={{ paddingLeft: '16px', marginTop: '4px' }}>
                <li>ຖ້າແຈ້ງສ່ວນຕົວ: ສົ່ງຂໍ້ຄວາມຫາ Bot ແລ້ວເບິ່ງ ID ຜ່ານ <strong>@userinfobot</strong></li>
                <li>ຖ້າແຈ້ງເຂົ້າກຸ່ມ: ດຶງ Bot ເຂົ້າກຸ່ມ ແລ້ວໃຊ້ Bot <strong>@RawDataBot</strong> ເພື່ອເບິ່ງ Chat ID ຂອງກຸ່ມ (ຈະຂຶ້ນຕົ້ນດ້ວຍ <code>-100...</code>)</li>
              </ul>
            </li>
            <li>
              ປ້ອນ Chat ID, ໝາຍຕິກ <em>ເປີດການແຈ້ງເຕືອນ</em>, ກົດ <em>ບັນທຶກ</em> ແລ້ວກົດ <em>ສົ່ງທົດສອບ</em>.
            </li>
          </ol>

          <div style={{ marginTop: '16px', padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius)', fontSize: '0.8rem', color: '#065f46' }}>
            💡 <strong>ແຈ້ງເຕືອນໃນແອັບ:</strong> ເມື່ອພະນັກງານເປີດແອັບຣີສອດຢູ່ ລະບົບຈະມີສຽງ Chime ແລະ ໜ້າຕ່າງ Popup ແຈ້ງເຕືອນທັນທີທີ່ມີການຈອງອອນລາຍໂດຍອັດຕະໂນມັດ.
          </div>
        </div>
      </div>
    </div>
  );
}
