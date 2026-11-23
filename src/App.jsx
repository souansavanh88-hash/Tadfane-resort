import { useState, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HotelProvider, useHotel } from './context/HotelContext';
import LoginPage from './pages/LoginPage';
import GuestPage from './pages/GuestPage';
import GuestBookingConfirmationPage from './pages/GuestBookingConfirmationPage';
import DashboardPage from './pages/DashboardPage';
import CashierPage from './pages/CashierPage';
import BookingPage from './pages/BookingPage';
import TabletCheckInPage from './pages/TabletCheckInPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import ActivitiesPage from './pages/ActivitiesPage';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import ToastProvider from './components/ToastProvider';
import ChangePasswordModal from './components/ChangePasswordModal';

function AppRoutes() {
  const { currentUser, canAccess } = useAuth();
  const { t } = useHotel();
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  // Guest mode: check URL param or state
  const [guestMode, setGuestMode] = useState(() => {
    return new URLSearchParams(window.location.search).get('guest') === 'true';
  });

  // Check if opened via guest booking share link (?booking=... or ?confirm=... or ?reg=...)
  const publicBookingId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('booking') || params.get('confirm') || params.get('reg');
  }, []);

  const encodedData = useMemo(() => {
    return new URLSearchParams(window.location.search).get('d') || '';
  }, []);

  // Direct guest confirmation view for customer phone (bypasses staff login)
  if (publicBookingId) {
    return (
      <GuestBookingConfirmationPage
        bookingId={publicBookingId}
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
    );
  }

  // Show guest page if in guest mode (no login needed)
  if (guestMode || !currentUser) {
    if (guestMode) {
      return (
        <GuestPage onGoLogin={() => setGuestMode(false)} />
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
    reports: { title: t('reportsTitle'), subtitle: t('reportsSubtitle') },
    settings: { title: t('settingsTitle'), subtitle: t('settingsSubtitle') },
  };

  return (
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
        {renderPage()}
      </div>

      {/* User-requested Change Password Modal */}
      {showChangePassword && (
        <ChangePasswordModal
          forced={false}
          onClose={() => setShowChangePassword(false)}
        />
      )}
    </div>
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
