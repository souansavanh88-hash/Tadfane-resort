import { useState, useMemo, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HotelProvider, useHotel } from './context/HotelContext';
import LoginPage from './pages/LoginPage';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import ToastProvider from './components/ToastProvider';
import ChangePasswordModal from './components/ChangePasswordModal';

// ໂຫຼດແຕ່ລະໜ້າເມື່ອຕ້ອງການ (ເປີດເວັບໄວຂຶ້ນ ໂດຍສະເພາະໃນມືຖື)
const GuestPage = lazy(() => import('./pages/GuestPage'));
const GuestBookingConfirmationPage = lazy(() => import('./pages/GuestBookingConfirmationPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CashierPage = lazy(() => import('./pages/CashierPage'));
const BookingPage = lazy(() => import('./pages/BookingPage'));
const TabletCheckInPage = lazy(() => import('./pages/TabletCheckInPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ActivitiesPage = lazy(() => import('./pages/ActivitiesPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const HousekeepingPage = lazy(() => import('./pages/HousekeepingPage'));

function PageLoader({ text = '⏳ ກຳລັງໂຫຼດ...' }) {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>{text}</div>
  );
}

function DataGate({ children }) {
  const { dataReady, dataError, retrySync } = useHotel();
  const { logout } = useAuth();
  if (dataError && !dataReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="card" style={{ maxWidth: 420, padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>📡</div>
          <h3 style={{ marginBottom: 8 }}>ໂຫຼດຂໍ້ມູນຈາກ server ບໍ່ໄດ້</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>{dataError}</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={retrySync}>🔄 ລອງໃໝ່</button>
            <button className="btn btn-ghost" onClick={logout}>🚪 ອອກຈາກລະບົບ</button>
          </div>
        </div>
      </div>
    );
  }
  if (!dataReady) return <PageLoader text="⏳ ກຳລັງໂຫຼດຂໍ້ມູນຈາກ server..." />;
  return children;
}

function AppRoutes() {
  const { currentUser, canAccess } = useAuth();
  const { t } = useHotel();
  const [activePage, setActivePage] = useState(() => (currentUser?.role === 'housekeeping' ? 'housekeeping' : 'dashboard'));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  // Guest mode: check URL param or state
  const [guestMode, setGuestMode] = useState(() => {
    return new URLSearchParams(window.location.search).get('guest') === 'true';
  });

  // Check if opened via guest booking share link (?booking=... or ?confirm=... or ?reg=...)
  const { publicBookingId, publicToken, encodedData } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      publicBookingId: params.get('booking') || params.get('confirm') || params.get('reg'),
      publicToken: params.get('t') || '',
      encodedData: params.get('d') || '',
    };
  }, []);

  // Direct guest confirmation view for customer phone (bypasses staff login)
  if (publicBookingId) {
    return (
      <Suspense fallback={<PageLoader />}>
        <GuestBookingConfirmationPage
          bookingId={publicBookingId}
          publicToken={publicToken}
          encodedData={encodedData}
          onGoHome={() => {
            const url = new URL(window.location.href);
            url.search = '?guest=true';
            window.location.href = url.toString();
          }}
          onGoLogin={() => {
            const url = new URL(window.location.href);
            url.search = '';
            window.location.href = url.toString();
          }}
        />
      </Suspense>
    );
  }

  // Show guest page if in guest mode (no login needed)
  if (guestMode || !currentUser) {
    if (guestMode) {
      return (
        <Suspense fallback={<PageLoader />}>
          <GuestPage onGoLogin={() => setGuestMode(false)} />
        </Suspense>
      );
    }
    return <LoginPage onGuestMode={() => setGuestMode(true)} />;
  }

  const navigate = (page) => {
    if (canAccess(page) || page === 'dashboard') {
      setActivePage(page);
      setSidebarOpen(false);
      setSidebarCollapsed(true);
    }
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <DashboardPage navigate={navigate} />;
      case 'cashier': return <CashierPage navigate={navigate} />;
      case 'booking': return <BookingPage navigate={navigate} />;
      case 'checkin': return <TabletCheckInPage />;
      case 'activities': return <ActivitiesPage />;
      case 'housekeeping': return <HousekeepingPage />;
      case 'expenses': return <ExpensesPage />;
      case 'reports': return <ReportsPage />;
      case 'settings': return <SettingsPage />;
      default: return <DashboardPage navigate={navigate} />;
    }
  };

  const pageTitles = {
    dashboard: { title: t('dashboardTitle'), subtitle: t('dashboardSubtitle') },
    cashier: { title: t('cashierTitle'), subtitle: t('cashierSubtitle') },
    booking: { title: t('bookingTitle'), subtitle: t('bookingSubtitle') },
    checkin: { title: t('checkinTitle'), subtitle: t('checkinSubtitle') },
    activities: { title: t('activitiesTitle'), subtitle: t('activitiesSubtitle') },
    housekeeping: { title: '🧹 ແມ່ບ້ານ & ສ້ອມແປງ', subtitle: 'ຫ້ອງລໍອະນາໄມ, ແຈ້ງບັນຫາ ແລະ ປະຫວັດການສ້ອມແປງ' },
    expenses: { title: '📉 ລາຍຈ່າຍ', subtitle: 'ບັນທຶກຄ່າໃຊ້ຈ່າຍຂອງຣີສອດ ເພື່ອຄິດໄລ່ກຳໄລ' },
    reports: { title: t('reportsTitle'), subtitle: t('reportsSubtitle') },
    settings: { title: t('settingsTitle'), subtitle: t('settingsSubtitle') },
  };

  return (
    <DataGate>
      <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {(sidebarOpen || !sidebarCollapsed) && (
          <div
            className="sidebar-overlay"
            style={{ display: 'block' }}
            onClick={() => {
              setSidebarOpen(false);
              setSidebarCollapsed(true);
            }}
          />
        )}
        <Sidebar
          activePage={activePage}
          navigate={navigate}
          isOpen={sidebarOpen}
          onClose={() => {
            setSidebarOpen(false);
            setSidebarCollapsed(true);
          }}
          onChangePassword={() => setShowChangePassword(true)}
        />
        <div className="main-content">
          <Topbar
            title={pageTitles[activePage]?.title}
            subtitle={pageTitles[activePage]?.subtitle}
            onMenuClick={() => setSidebarOpen(true)}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed(c => !c)}
          />
          <Suspense fallback={<PageLoader />}>
            {renderPage()}
          </Suspense>
        </div>

        {/* ບັງຄັບປ່ຽນລະຫັດ ຫຼັງເຈົ້າຂອງຣີເຊັດໃຫ້ */}
        {(showChangePassword || currentUser.mustChangePassword) && (
          <ChangePasswordModal
            forced={!!currentUser.mustChangePassword}
            onClose={() => setShowChangePassword(false)}
          />
        )}
      </div>
    </DataGate>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <HotelProvider>
          <AppRoutes />
        </HotelProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
