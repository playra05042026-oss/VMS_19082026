import { useEffect, useState } from 'react';
import { User, Visitor, Contractor, SystemSettings } from './types';
import { getCurrentUser, switchUser, getUsers, getSettings } from './lib/api';
import { LoginView } from './components/LoginView';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { VisitorRegistrationView } from './components/VisitorRegistrationView';
import { ContractorRegistrationView } from './components/ContractorRegistrationView';
import { SecurityGuardDeskView } from './components/SecurityGuardDeskView';
import { UserManagementView } from './components/UserManagementView';
import { MasterDataView } from './components/MasterDataView';
import { CompanyManagementView } from './components/CompanyManagementView';
import { BlacklistManagementView } from './components/BlacklistManagementView';
import { AuditLogsView } from './components/AuditLogsView';
import { SystemSettingsView } from './components/SystemSettingsView';
import { EmailTestView } from './components/EmailTestView';
import { ReportsView } from './components/ReportsView';
import { MdApprovalsView } from './components/MdApprovalsView';
import { SystemGuideView } from './components/SystemGuideView';
import { PassBadgeModal } from './components/PassBadgeModal';
import { NotificationModal } from './components/notification';
import { MustChangePasswordModal } from './components/MustChangePasswordModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  // Notification Modal State
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type?: 'deactivated' | 'error' | 'warning' | 'info' | 'success';
  }>({
    isOpen: false,
    message: ''
  });

  // Badge Modal State
  const [badgeModal, setBadgeModal] = useState<{
    item: Visitor | Contractor;
    type: 'VISITOR' | 'CONTRACTOR';
  } | null>(null);

  const initData = async () => {
    try {
      setLoading(true);
      const [uRes, usersRes, sRes] = await Promise.all([
        getCurrentUser(),
        getUsers(),
        getSettings()
      ]);
      setAllUsers(usersRes);
      setSettings(sRes);
      
      const wasLoggedIn = sessionStorage.getItem('vms_logged_in') === 'true';
      const storedUserId = sessionStorage.getItem('vms_auth_user_id');

      if (wasLoggedIn) {
        setIsLoggedIn(true);
        if (storedUserId) {
          const matched = usersRes.find((u: User) => u.id === storedUserId);
          if (matched && matched.isActive) {
            setCurrentUser(matched);
          } else if (uRes && uRes.user) {
            setCurrentUser(uRes.user);
          }
        } else if (uRes && uRes.user) {
          setCurrentUser(uRes.user);
        }
      } else {
        setIsLoggedIn(false);
        if (uRes && uRes.user) {
          setCurrentUser(uRes.user);
        }
      }
    } catch (err: any) {
      console.error('Failed to initialize VMS application:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initData();

    // Periodic synchronization to keep user list in sync across navbar and switcher
    const interval = setInterval(async () => {
      try {
        const usersRes = await getUsers();
        setAllUsers(usersRes);
      } catch (err) {
        // Silent sync failure
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    sessionStorage.setItem('vms_logged_in', 'true');
    sessionStorage.setItem('vms_auth_user_id', user.id);
    if (user.role === 'SECURITY') {
      setActiveTab('guard_desk');
    } else if (user.role === 'MANAGING_DIRECTOR') {
      setActiveTab('md_approvals');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/vms/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    sessionStorage.removeItem('vms_logged_in');
    sessionStorage.removeItem('vms_auth_user_id');
    setCurrentUser(null);
    setIsLoggedIn(false);
  };

  const handleSwitchUser = async (userId: string) => {
    const targetUser = allUsers.find(u => u.id === userId);
    if (targetUser && !targetUser.isActive) {
      setNotification({
        isOpen: true,
        type: 'deactivated',
        title: 'Account Deactivated',
        message: 'Your account is deactivated, please contact Security Administrator.'
      });
      return;
    }

    try {
      setLoading(true);
      const res = await switchUser(userId);
      setCurrentUser(res.user);
      sessionStorage.setItem('vms_auth_user_id', res.user.id);
      sessionStorage.setItem('vms_logged_in', 'true');
      const updatedUsers = await getUsers();
      setAllUsers(updatedUsers);

      // Default active tab based on new role
      if (res.user.role === 'SECURITY') {
        setActiveTab('guard_desk');
      } else {
        setActiveTab('dashboard');
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to switch user account';
      if (msg.toLowerCase().includes('deactivated')) {
        setNotification({
          isOpen: true,
          type: 'deactivated',
          title: 'Account Deactivated',
          message: 'Your account is deactivated, please contact Security Administrator.'
        });
      } else {
        console.error('Failed to switch user:', err);
        setNotification({
          isOpen: true,
          type: 'error',
          title: 'Authentication Error',
          message: msg
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBadge = (item: Visitor | Contractor, type: 'VISITOR' | 'CONTRACTOR') => {
    setBadgeModal({ item, type });
  };

  if (loading) {
    return (
      <div className="vh-100 d-flex flex-column align-items-center justify-content-center bg-dark text-white">
        <div className="spinner-border text-primary fs-3 mb-3" style={{ width: '3rem', height: '3rem' }} role="status"></div>
        <div className="fw-bold fs-5 font-monospace">BOOTING ENTERPRISE VMS...</div>
        <small className="text-muted mt-1">Initializing IIS local runtime, role authorization, and Security database</small>
      </div>
    );
  }

  // Show main login screen if not logged in
  if (!isLoggedIn || !currentUser) {
    return (
      <LoginView
        allUsers={allUsers}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div className="vh-100 d-flex flex-column overflow-hidden bg-light">
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        onSwitchUser={handleSwitchUser}
        onLogout={handleLogout}
        allUsers={allUsers}
      />

      <div className="d-flex flex-grow-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          role={currentUser.role}
          currentUser={currentUser}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Main Content Area */}
        <main className="flex-grow-1 bg-light overflow-auto">
          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <DashboardView
              currentUser={currentUser}
              onNavigate={setActiveTab}
              onOpenBadge={(item, type) => handleOpenBadge(item, type)}
            />
          )}

          {/* VISITOR VIEWS */}
          {activeTab === 'register_visitor' && (
            <VisitorRegistrationView
              currentUser={currentUser}
              mode="REGISTER"
              onOpenBadge={(v) => handleOpenBadge(v, 'VISITOR')}
            />
          )}
          {(activeTab === 'my_visitors' || activeTab === 'all_visitors') && (
            <VisitorRegistrationView
              currentUser={currentUser}
              mode="LIST"
              onOpenBadge={(v) => handleOpenBadge(v, 'VISITOR')}
            />
          )}

          {/* CONTRACTOR VIEWS */}
          {activeTab === 'register_contractor' && (
            <ContractorRegistrationView
              currentUser={currentUser}
              mode="REGISTER"
              onOpenBadge={(c) => handleOpenBadge(c, 'CONTRACTOR')}
            />
          )}
          {(activeTab === 'my_contractors' || activeTab === 'all_contractors') && (
            <ContractorRegistrationView
              currentUser={currentUser}
              mode="LIST"
              onOpenBadge={(c) => handleOpenBadge(c, 'CONTRACTOR')}
            />
          )}

          {/* SECURITY GUARD DESK */}
          {activeTab === 'guard_desk' && (
            <SecurityGuardDeskView
              currentUser={currentUser}
              onOpenBadge={(item, type) => handleOpenBadge(item, type)}
              defaultSubTab="ALL"
            />
          )}
          {activeTab === 'on_premise' && (
            <SecurityGuardDeskView
              currentUser={currentUser}
              onOpenBadge={(item, type) => handleOpenBadge(item, type)}
              defaultSubTab="ON_PREMISE"
            />
          )}

          {/* USER MANAGEMENT */}
          {activeTab === 'md_users' && (
            <UserManagementView key="md_users" currentUser={currentUser} targetRole="MANAGING_DIRECTOR" />
          )}
          {activeTab === 'staff_users' && (
            <UserManagementView key="staff_users" currentUser={currentUser} targetRole="STAFF" />
          )}
          {activeTab === 'security_users' && (
            <UserManagementView key="security_users" currentUser={currentUser} targetRole="SECURITY" />
          )}

          {/* MASTER DATA SETUP & COMPANY MANAGEMENT */}
          {activeTab === 'departments' && <MasterDataView initialTab="DEPARTMENTS" />}
          {activeTab === 'companies' && <CompanyManagementView currentUser={currentUser} />}
          {activeTab === 'categories' && <MasterDataView initialTab="CATEGORIES" />}
          {activeTab === 'venues' && <MasterDataView initialTab="VENUES" />}

          {/* BLACKLIST MANAGEMENT */}
          {activeTab === 'blacklist' && (
            <BlacklistManagementView currentUser={currentUser} />
          )}

          {/* AUDIT LOGS & LOGIN HISTORY */}
          {activeTab === 'audit_logs' && <AuditLogsView currentUser={currentUser} initialTab="AUDIT" />}
          {activeTab === 'login_history' && <AuditLogsView currentUser={currentUser} initialTab="LOGIN_HISTORY" />}

          {/* SYSTEM SETTINGS & PASSWORD POLICY */}
          {activeTab === 'settings' && <SystemSettingsView key="settings" currentUser={currentUser} initialTab="SETTINGS" />}
          {activeTab === 'email_recipients' && <SystemSettingsView key="email_recipients" currentUser={currentUser} initialTab="EMAIL_RECIPIENTS" />}
          {activeTab === 'password_policy' && <SystemSettingsView key="password_policy" currentUser={currentUser} initialTab="PASSWORD_POLICY" />}
          {activeTab === 'email_test' && <EmailTestView />}

          {/* MANAGING DIRECTOR APPROVALS */}
          {activeTab === 'md_approvals' && (
            <MdApprovalsView currentUser={currentUser} />
          )}

          {/* REPORTS */}
          {activeTab === 'reports' && <ReportsView currentUser={currentUser} />}

          {/* SYSTEM OPERATIONAL GUIDE & HOW-TO */}
          {activeTab === 'system_guide' && (
            <SystemGuideView currentUser={currentUser} onNavigate={setActiveTab} />
          )}
        </main>
      </div>

      {/* Printable Pass Badge Modal */}
      {badgeModal && (
        <PassBadgeModal
          item={badgeModal.item}
          type={badgeModal.type}
          settings={settings}
          onClose={() => setBadgeModal(null)}
        />
      )}

      {/* Mandatory First-Login Password Change Modal */}
      {currentUser && currentUser.mustChangePassword && (
        <MustChangePasswordModal
          user={currentUser}
          onPasswordChanged={updatedUser => {
            setCurrentUser(updatedUser);
            getUsers().then(setAllUsers).catch(() => {});
          }}
        />
      )}

      {/* Global Security & System Notification Modal */}
      <NotificationModal
        isOpen={notification.isOpen}
        onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
        title={notification.title}
        message={notification.message}
        type={notification.type}
      />

      {/* System Status Footer Bar */}
      <footer className="status-footer">
        <div>
          System Status: <span style={{ color: '#10B981', fontWeight: 'bold' }}>● ONLINE</span> | IIS Node
        </div>
        <div className="d-none d-sm-block">
          Database: MSSQL-CORE-01 | On-Premise Internal Network | Enterprise VMS v1.0.4-LTS
        </div>
      </footer>
    </div>
  );
}
