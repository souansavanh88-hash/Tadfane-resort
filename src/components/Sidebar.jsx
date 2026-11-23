import { useAuth } from '../context/AuthContext';
import { useHotel } from '../context/HotelContext';

const ROLE_KEYS = {
  owner: 'owner',
  reception: 'reception',
  housekeeping: 'housekeeping',
};

const NAV_ITEMS = [
  {
    sectionKey: 'sidebarSectionMain',
    items: [
      { id: 'dashboard', icon: '🏨', labelKey: 'sidebarDashboard', roles: ['owner', 'reception', 'housekeeping'] },
    ]
  },
  {
    sectionKey: 'sidebarSectionOps',
    items: [
      { id: 'cashier', icon: '🧾', labelKey: 'sidebarCashier', roles: ['owner', 'reception'] },
      { id: 'booking', icon: '📋', labelKey: 'sidebarBooking', roles: ['owner', 'reception'] },
      { id: 'checkin', icon: '📱', labelKey: 'sidebarCheckin', roles: ['owner', 'reception'] },
      { id: 'activities', icon: '🎡', labelKey: 'sidebarActivities', roles: ['owner', 'reception'] },
    ]
  },
  {
    sectionKey: 'sidebarSectionAdmin',
    items: [
      { id: 'reports', icon: '📊', labelKey: 'sidebarReports', roles: ['owner'] },
      { id: 'settings', icon: '⚙️', labelKey: 'sidebarSettings', roles: ['owner'] },
    ]
  },
];

export default function Sidebar({ activePage, navigate, isOpen, onChangePassword }) {
  const { currentUser, logout } = useAuth();
  const { t, bookings = [] } = useHotel();
  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const bookedCount = bookings.filter(b => b.status === 'booked').length;
  const bookingBadgeCount = pendingCount + bookedCount;

  const initials = currentUser?.name
    ? currentUser.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const getRoleLabel = (role) => {
    if (role === 'owner') return t('owner', { defaultValue: 'ເຈົ້າຂອງ' });
    if (role === 'reception') return t('reception', { defaultValue: 'ພະນັກງານຕ້ອນຮັບ' });
    if (role === 'housekeeping') return t('housekeeping', { defaultValue: 'ພະນັກງານອະນາໄມ' });
    return role;
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🏨</div>
        <div className="sidebar-logo-name">ຣີສອດຕາດຟານ</div>
        <div className="sidebar-logo-sub">Resort Management System</div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(section => {
          const visibleItems = section.items.filter(item =>
            item.roles.includes(currentUser?.role)
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.sectionKey}>
              <div className="nav-section-label">{t(section.sectionKey)}</div>
              {visibleItems.map(item => (
                <div
                  key={item.id}
                  className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                  onClick={() => navigate(item.id)}
                >
                  <span className="nav-item-icon">{item.icon}</span>
                  <span>{t(item.labelKey)}</span>
                  {item.id === 'booking' && bookingBadgeCount > 0 && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        background: pendingCount > 0 ? '#d97706' : '#2563eb',
                        color: '#fff',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '1px 7px',
                        borderRadius: '999px',
                        lineHeight: 1.4,
                      }}
                      title={pendingCount > 0 ? `ລໍຢືນຢັນ ${pendingCount} · ລໍ Check-in ${bookedCount}` : `ລໍ Check-in ${bookedCount}`}
                    >
                      {bookingBadgeCount}
                    </span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">{initials}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{currentUser?.name}</div>
          <div className="sidebar-user-role">{getRoleLabel(currentUser?.role)}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={onChangePassword}
            title="ປ່ຽນລະຫັດຜ່ານ"
            type="button"
          >
            🔑
          </button>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={logout}
            title={t('logoutLabel')}
            type="button"
          >
            🚪
          </button>
        </div>
      </div>
    </aside>
  );
}
