import React, { useEffect, useState } from 'react';
import { User, UserRole } from '../types';

interface SidebarProps {
  role: UserRole;
  currentUser?: User | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ role, currentUser, activeTab, onTabChange }) => {
  const [isDelegatedApprover, setIsDelegatedApprover] = useState<boolean>(false);

  useEffect(() => {
    // Check if the current user is a designated backup/acting approver
    if (role === 'STAFF' && currentUser) {
      fetch('/api/vms/email/settings')
        .then(res => res.json())
        .then(data => {
          const s = data?.settings;
          if (s && s.EnableDelegation) {
            const today = new Date().toISOString().split('T')[0];
            const withinStart = !s.DelegationStartDate || today >= s.DelegationStartDate;
            const withinEnd = !s.DelegationEndDate || today <= s.DelegationEndDate;
            if (withinStart && withinEnd) {
              const matchesUser = (s.BackupApproverUserId && s.BackupApproverUserId === currentUser.id) ||
                (s.BackupApproverEmail && currentUser.email && s.BackupApproverEmail.toLowerCase().includes(currentUser.email.toLowerCase()));
              setIsDelegatedApprover(Boolean(matchesUser));
              return;
            }
          }
          setIsDelegatedApprover(false);
        })
        .catch(() => setIsDelegatedApprover(false));
    } else {
      setIsDelegatedApprover(false);
    }
  }, [role, currentUser]);

  const getItemClass = (tabName: string) => {
    const isActive = activeTab === tabName;
    return `sidebar-nav-item ${isActive ? 'active' : ''}`;
  };

  return (
    <aside className="bg-white border-end flex-shrink-0 py-3 px-0 overflow-y-auto" style={{ width: '240px', borderColor: '#E2E8F0' }}>

      <nav className="nav flex-column">
        {/* ADMINISTRATOR MENU (Strictly System & Organization Management - No Executive Approval tab) */}
        {role === 'ADMINISTRATOR' && (
          <>
            <button className={getItemClass('dashboard')} onClick={() => onTabChange('dashboard')}>
              <i className="bi bi-speedometer2"></i> Dashboard
            </button>

            <div className="fw-bold font-monospace px-4 mt-3 mb-1" style={{ fontSize: '0.65rem', color: '#94A3B8' }}>USER MANAGEMENT</div>
            <button className={getItemClass('md_users')} onClick={() => onTabChange('md_users')}>
              <i className="bi bi-award-fill text-purple"></i> Managing Director
            </button>
            <button className={getItemClass('staff_users')} onClick={() => onTabChange('staff_users')}>
              <i className="bi bi-people-fill"></i> Staff Users
            </button>
            <button className={getItemClass('security_users')} onClick={() => onTabChange('security_users')}>
              <i className="bi bi-person-badge-fill"></i> Security Users
            </button>

            <div className="fw-bold font-monospace px-4 mt-3 mb-1" style={{ fontSize: '0.65rem', color: '#94A3B8' }}>ORGANIZATION SETUP</div>
            <button className={getItemClass('departments')} onClick={() => onTabChange('departments')}>
              <i className="bi bi-diagram-3-fill"></i> Departments
            </button>
            <button className={getItemClass('companies')} onClick={() => onTabChange('companies')}>
              <i className="bi bi-building font-semibold"></i> Companies
            </button>
            <button className={getItemClass('categories')} onClick={() => onTabChange('categories')}>
              <i className="bi bi-tags-fill"></i> All Categories
            </button>
            <button className={getItemClass('venues')} onClick={() => onTabChange('venues')}>
              <i className="bi bi-geo-alt-fill"></i> Meeting Venues
            </button>

            <div className="fw-bold font-monospace px-4 mt-3 mb-1" style={{ fontSize: '0.65rem', color: '#94A3B8' }}>SECURITY & AUDIT</div>
            <button className={getItemClass('all_visitors')} onClick={() => onTabChange('all_visitors')}>
              <i className="bi bi-person-lines-fill"></i> All Visitors
            </button>
            <button className={getItemClass('all_contractors')} onClick={() => onTabChange('all_contractors')}>
              <i className="bi bi-tools"></i> All Contractors
            </button>
            <button className={getItemClass('blacklist')} onClick={() => onTabChange('blacklist')}>
              <i className="bi bi-slash-circle-fill text-danger"></i> Blacklist Database
            </button>
            <button className={getItemClass('audit_logs')} onClick={() => onTabChange('audit_logs')}>
              <i className="bi bi-journal-text"></i> Audit Logs
            </button>
            <button className={getItemClass('login_history')} onClick={() => onTabChange('login_history')}>
              <i className="bi bi-clock-history"></i> Login History
            </button>

            <div className="fw-bold font-monospace px-4 mt-3 mb-1" style={{ fontSize: '0.65rem', color: '#94A3B8' }}>ADMINISTRATION</div>
            <button className={getItemClass('email_recipients')} onClick={() => onTabChange('email_recipients')}>
              <i className="bi bi-envelope-at-fill text-primary"></i> Email Recipients Setup
            </button>
            <button className={getItemClass('email_test')} onClick={() => onTabChange('email_test')}>
              <i className="bi bi-envelope-paper-heart-fill text-info"></i> Email Test & Logs
            </button>
            <button className={getItemClass('settings')} onClick={() => onTabChange('settings')}>
              <i className="bi bi-sliders"></i> System Settings
            </button>
            <button className={getItemClass('password_policy')} onClick={() => onTabChange('password_policy')}>
              <i className="bi bi-key-fill"></i> Password Policy
            </button>
            <button className={getItemClass('reports')} onClick={() => onTabChange('reports')}>
              <i className="bi bi-file-earmark-bar-graph-fill"></i> Reports & Export
            </button>
            <button className={getItemClass('system_guide')} onClick={() => onTabChange('system_guide')}>
              <i className="bi bi-journal-bookmark-fill text-primary"></i> How-To & System Guide
            </button>
          </>
        )}

        {/* MANAGING DIRECTOR MENU */}
        {role === 'MANAGING_DIRECTOR' && (
          <>
            <button className={getItemClass('dashboard')} onClick={() => onTabChange('dashboard')}>
              <i className="bi bi-speedometer2"></i> Executive Dashboard
            </button>
            <button className={getItemClass('md_approvals')} onClick={() => onTabChange('md_approvals')}>
              <i className="bi bi-patch-check-fill text-warning"></i> Pending Approvals
            </button>

            <div className="fw-bold font-monospace px-4 mt-3 mb-1" style={{ fontSize: '0.65rem', color: '#94A3B8' }}>VISITOR & CONTRACTOR LOGS</div>
            <button className={getItemClass('all_visitors')} onClick={() => onTabChange('all_visitors')}>
              <i className="bi bi-person-lines-fill"></i> All Visitors
            </button>
            <button className={getItemClass('all_contractors')} onClick={() => onTabChange('all_contractors')}>
              <i className="bi bi-tools"></i> All Contractors
            </button>

            <div className="fw-bold font-monospace px-4 mt-3 mb-1" style={{ fontSize: '0.65rem', color: '#94A3B8' }}>OPERATIONAL GUIDE</div>
            <button className={getItemClass('system_guide')} onClick={() => onTabChange('system_guide')}>
              <i className="bi bi-journal-bookmark-fill text-primary"></i> How-To & System Guide
            </button>
          </>
        )}

        {/* STAFF MENU */}
        {role === 'STAFF' && (
          <>
            <button className={getItemClass('dashboard')} onClick={() => onTabChange('dashboard')}>
              <i className="bi bi-speedometer2"></i> Dashboard
            </button>

            {/* Delegated / Acting Approver Tab - Only visible when staff member is assigned as active backup approver */}
            {isDelegatedApprover && (
              <>
                <div className="fw-bold font-monospace px-4 mt-3 mb-1 text-warning" style={{ fontSize: '0.65rem' }}>EXECUTIVE DELEGATION</div>
                <button className={`${getItemClass('md_approvals')} text-warning fw-bold`} onClick={() => onTabChange('md_approvals')}>
                  <i className="bi bi-patch-check-fill text-warning"></i> Acting MD Approvals
                </button>
              </>
            )}

            <div className="fw-bold font-monospace px-4 mt-3 mb-1" style={{ fontSize: '0.65rem', color: '#94A3B8' }}>PRE-REGISTRATION</div>
            <button className={getItemClass('register_visitor')} onClick={() => onTabChange('register_visitor')}>
              <i className="bi bi-person-plus-fill"></i> Register Visitor
            </button>
            <button className={getItemClass('register_contractor')} onClick={() => onTabChange('register_contractor')}>
              <i className="bi bi-plus-square-fill"></i> Register Contractor
            </button>

            <div className="fw-bold font-monospace px-4 mt-3 mb-1" style={{ fontSize: '0.65rem', color: '#94A3B8' }}>ORGANIZATION DIRECTORY</div>
            <button className={getItemClass('companies')} onClick={() => onTabChange('companies')}>
              <i className="bi bi-building font-semibold"></i> Company / Guest Org
            </button>

            <div className="fw-bold font-monospace px-4 mt-3 mb-1" style={{ fontSize: '0.65rem', color: '#94A3B8' }}>MY RECORDS (ISOLATED)</div>
            <button className={getItemClass('my_visitors')} onClick={() => onTabChange('my_visitors')}>
              <i className="bi bi-person-check-fill"></i> My Visitors
            </button>
            <button className={getItemClass('my_contractors')} onClick={() => onTabChange('my_contractors')}>
              <i className="bi bi-tools"></i> My Contractors
            </button>
          </>
        )}

        {/* SECURITY MENU */}
        {role === 'SECURITY' && (
          <>
            <button className={getItemClass('guard_desk')} onClick={() => onTabChange('guard_desk')}>
              <i className="bi bi-shield-check"></i> Check-In / Check-Out
            </button>
            <button className={getItemClass('on_premise')} onClick={() => onTabChange('on_premise')}>
              <i className="bi bi-building-check text-success"></i> On-Premise Live Roster
            </button>

            <div className="fw-bold font-monospace px-4 mt-3 mb-1" style={{ fontSize: '0.65rem', color: '#94A3B8' }}>SEARCH & LOGS</div>
            <button className={getItemClass('all_visitors')} onClick={() => onTabChange('all_visitors')}>
              <i className="bi bi-person-bounding-box"></i> All Visitor Logs
            </button>
            <button className={getItemClass('all_contractors')} onClick={() => onTabChange('all_contractors')}>
              <i className="bi bi-tools"></i> All Contractor Logs
            </button>
            <button className={getItemClass('blacklist')} onClick={() => onTabChange('blacklist')}>
              <i className="bi bi-shield-slash-fill text-danger"></i> Blacklist Database (View)
            </button>
          </>
        )}
      </nav>
    </aside>
  );
};
