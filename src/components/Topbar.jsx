import { useHotel } from '../context/HotelContext';

export default function Topbar({ title, subtitle, onMenuClick, sidebarCollapsed, onToggleSidebar }) {
  const { lang, changeLang, syncStatus } = useHotel();
  const st = syncStatus?.status;
  const pending = syncStatus?.pending || 0;
  const syncBadge = st === 'online'
    ? (pending > 0 ? { c: '#d97706', bg: '#fef3c7', txt: `⏳ ກຳລັງບັນທຶກ (${pending})` } : { c: '#15803d', bg: '#dcfce7', txt: '🟢 ອອນລາຍ' })
    : st === 'offline'
      ? { c: '#b91c1c', bg: '#fee2e2', txt: `🔴 ອອບລາຍ${pending ? ` — ລໍສົ່ງ ${pending}` : ''}` }
      : { c: '#475569', bg: '#f1f5f9', txt: '⏳ ກຳລັງເຊື່ອມຕໍ່' };
  const now = new Date();
  const dateStr = now.toLocaleDateString('lo-LA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit' });
  const flags = { lo: '🇱🇦', th: '🇹🇭', en: '🇺🇸', vi: '🇻🇳', ko: '🇰🇷' };

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="mobile-menu-btn" onClick={onMenuClick}>☰</button>
        {onToggleSidebar && (
          <button
            type="button"
            className="desktop-sidebar-btn"
            onClick={onToggleSidebar}
            title={sidebarCollapsed ? 'ເປີດແຖບເມນູຊ້າຍ' : 'ປິດແຖບເມນູ'}
          >
            {sidebarCollapsed ? '☰ ເມນູ' : '✕ ປິດເມນູ'}
          </button>
        )}
        <div>
          <div className="topbar-title">{title}</div>
          <div className="topbar-subtitle">{subtitle}</div>
        </div>
      </div>
      <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {/* Sync status */}
        <div
          title={st === 'offline' ? 'ເຊື່ອມຕໍ່ server ບໍ່ໄດ້ — ຂໍ້ມູນຈະຖືກເກັບໄວ້ ແລະ ສົ່ງອັດຕະໂນມັດເມື່ອເຊື່ອມຕໍ່ໄດ້' : 'ສະຖານະການເຊື່ອມຕໍ່ server'}
          style={{ fontSize: '0.72rem', fontWeight: 700, color: syncBadge.c, background: syncBadge.bg, padding: '4px 10px', borderRadius: '999px', whiteSpace: 'nowrap' }}
        >
          {syncBadge.txt}
        </div>
        {/* Multilingual Selector */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.08)', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          {Object.keys(flags).map(l => (
            <button
              key={l}
              onClick={() => changeLang(l)}
              style={{
                background: lang === l ? 'var(--accent)' : 'transparent',
                border: 'none', borderRadius: '4px',
                width: '30px', height: '24px',
                fontSize: '1.1rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s',
                opacity: lang === l ? 1 : 0.6
              }}
              type="button"
              title={l.toUpperCase()}
            >
              {flags[l]}
            </button>
          ))}
        </div>
        
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{timeStr}</div>
          <div style={{ fontSize: '0.72rem' }}>{dateStr}</div>
        </div>
      </div>
    </header>
  );
}
