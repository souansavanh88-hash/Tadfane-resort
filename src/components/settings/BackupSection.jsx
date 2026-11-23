import { useState, useEffect, useCallback } from 'react';
import { api } from '../../utils/api';
import { useToast } from '../ToastProvider';
import { todayStr, formatDateTime } from '../../data/initialData';

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function BackupSection() {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [dailyBackups, setDailyBackups] = useState([]);
  const [backupDir, setBackupDir] = useState('');
  const [loadingBackups, setLoadingBackups] = useState(false);

  const loadDailyBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const res = await api('/api/admin/backups');
      setDailyBackups(res.files || []);
      setBackupDir(res.dir || '');
    } catch {
      // ignore
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  useEffect(() => {
    loadDailyBackups();
  }, [loadDailyBackups]);

  // Download Backup JSON
  const handleDownloadBackup = async () => {
    setDownloading(true);
    try {
      const data = await api('/api/admin/backup');
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tadfane-backup-${todayStr()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('💾 ດາວໂຫຼດໄຟລ໌ສຳຮອງຂໍ້ມູນຮຽບຮ້ອຍແລ້ວ', 'success');
    } catch (err) {
      toast(err.message || 'ເກີດຂໍ້ຜິດພາດໃນການດາວໂຫຼດ', 'error');
    } finally {
      setDownloading(false);
    }
  };

  // Restore from Uploaded File
  const handleRestoreFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.format !== 'tadfane-backup' || !parsed.collections) {
          toast('ໄຟລ໌ນີ້ບໍ່ແມ່ນໄຟລ໌ສຳຮອງຂອງລະບົບຣີສອດຕາດຟານ', 'error');
          return;
        }

        const confirmWord = window.prompt(
          `⚠️ ຄຳເຕືອນ: ການກູ້ຄືນຂໍ້ມູນຈະຂຽນທັບຖານຂໍ້ມູນປັດຈຸບັນດ້ວຍຂໍ້ມູນຈາກໄຟລ໌ (${parsed.exportedAt || 'ບໍ່ຮູ້ວັນທີ'}).\n\nຖ້າແນ່ໃຈ ກະລຸນາພິມຄຳວ່າ "RESTORE" ເພື່ອຢືນຢັນ:`
        );

        if (confirmWord !== 'RESTORE') {
          toast('ຍົກເລີກການກູ້ຄືນ', 'info');
          return;
        }

        setRestoring(true);
        await api('/api/admin/restore', {
          method: 'POST',
          body: { backup: parsed },
        });

        toast('♻️ ກູ້ຄືນຂໍ້ມູນສຳເລັດ! ກຳລັງຣີໂຫຼດໜ້າ...', 'success');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (err) {
        toast(`ກູ້ຄືນບໍ່ສຳເລັດ: ${err.message}`, 'error');
      } finally {
        setRestoring(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <div className="section-header" style={{ marginBottom: '20px' }}>
        <div>
          <div className="section-title">💾 ສຳຮອງ &amp; ກູ້ຄືນຂໍ້ມູນ (Backup &amp; Restore)</div>
          <div className="section-subtitle">
            ປ້ອງກັນຂໍ້ມູນສູນຫາຍ ໂດຍການດາວໂຫຼດໄຟລ໌ສຳຮອງ ແລະ ຕິດຕາມສຳຮອງອັດຕະໂນມັດຂອງ server
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Card 1: Download Manual Backup */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '8px', color: 'var(--primary)' }}>
              📥 ດາວໂຫຼດໄຟລ໌ສຳຮອງ (Export Backup)
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '14px' }}>
              ດາວໂຫຼດຖານຂໍ້ມູນທັງໝົດ (ຫ້ອງພັກ, ການຈອງ, ບັນຊີຜູ້ໃຊ້ງານ, ໃບບິນກິດຈະກຳ, ລາຍຈ່າຍ, ແລະ ປະຫວັດ) ເກັບໄວ້ໃນຄອມພິວເຕີຂອງທ່ານເປັນໄຟລ໌ <code>.json</code>
            </p>
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontWeight: 800 }}
            disabled={downloading}
            onClick={handleDownloadBackup}
          >
            {downloading ? '⏳ ກຳລັງສ້າງໄຟລ໌ສຳຮອງ...' : '💾 ດາວໂຫຼດໄຟລ໌ສຳຮອງດຽວນີ້'}
          </button>
        </div>

        {/* Card 2: Restore from file */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid #fcd34d' }}>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '8px', color: '#b45309' }}>
              ♻️ ກູ້ຄືນຂໍ້ມູນຈາກໄຟລ໌ (Restore)
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '14px' }}>
              ນຳໄຟລ໌ສຳຮອງ <code>.json</code> ມາກູ້ຄືນໃນລະບົບ (ເຊັ່ນ: ຍ້າຍເຄື່ອງ server ໃໝ່ ຫຼື ກູ້ຄືນຍ້ອນຫຼັງ). ລະບົບຈະສຳຮອງຖານຂໍ້ມູນປັດຈຸບັນໄວ້ກ່ອນກູ້ຄືນໂດຍອັດຕະໂນມັດ.
            </p>
          </div>
          <label className="btn btn-warning" style={{ width: '100%', padding: '12px', fontWeight: 800, textAlign: 'center', cursor: restoring ? 'not-allowed' : 'pointer' }}>
            {restoring ? '⏳ ກຳລັງກູ້ຄືນ...' : '📂 ເລືອກໄຟລ໌ສຳຮອງ (.json) ເພື່ອກູ້ຄືນ'}
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              disabled={restoring}
              onChange={handleRestoreFile}
            />
          </label>
        </div>
      </div>

      {/* Automatic Daily Backups on Server */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              🛡️ ສຳຮອງອັດຕະໂນມັດປະຈຳວັນ (Server Auto-Backups)
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Server ບັນທຶກສຳເນົາຖານຂໍ້ມູນໄວ້ທຸກວັນ ແລະ ເກັບຮັກສາໄວ້ 30 ວັນຫຼ້າສຸດໂດຍອັດຕະໂນມັດ
              {backupDir && <span style={{ marginLeft: '6px' }}>• ໂຟນເດີ: <code>{backupDir}</code></span>}
            </div>
          </div>
          <button className="btn btn-ghost btn-xs" onClick={loadDailyBackups}>
            🔄 ໂຫຼດໃໝ່
          </button>
        </div>

        {loadingBackups ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>⏳ ກຳລັງໂຫຼດລາຍການ...</div>
        ) : dailyBackups.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            ຍັງບໍ່ມີໄຟລ໌ສຳຮອງປະຈຳວັນ (ລະບົບຈະສ້າງອັດຕະໂນມັດເມື່ອມີການປ່ຽນແປງຂໍ້ມູນໃນມື້ທຳອິດ)
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
            {dailyBackups.map(f => (
              <div
                key={f.name}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>📄 {f.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatBytes(f.size)}</div>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>✓ ສຳຮອງແລ້ວ</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
