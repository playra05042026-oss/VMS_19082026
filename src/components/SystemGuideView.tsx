import React, { useState } from 'react';
import { User } from '../types';

interface SystemGuideViewProps {
  currentUser: User;
  onNavigate?: (tab: string) => void;
}

export const SystemGuideView: React.FC<SystemGuideViewProps> = ({ currentUser, onNavigate }) => {
  const isAdmin = currentUser.role === 'ADMINISTRATOR';
  const isMd = currentUser.role === 'MANAGING_DIRECTOR';

  const [activeGuideTab, setActiveGuideTab] = useState<
    'ADMIN_SETUP' | 'MD_WORKFLOW' | 'SYSTEM_CYCLE' | 'ROLES' | 'SECURITY_RULES' | 'ADMIN_FAQ' | 'FAQ'
  >(isAdmin ? 'ADMIN_SETUP' : 'MD_WORKFLOW');

  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const adminFaqList = [
    {
      q: 'Q1: How do I configure Executive Notification Delegation (Acting / Backup Approver)?',
      a: 'Navigate to "Administration > Email Recipients Setup" from the left sidebar. In the "Department & Executive Notification Delegation" section, switch the toggle to ON (green), select the designated staff user (e.g., Sarah Jenkins) as the Backup Approver, and optionally specify Start/End dates and justification. When saved, the designated staff member will automatically see an "Acting MD Approvals" menu in their sidebar during the delegation window.'
    },
    {
      q: 'Q2: How do I create and manage users across different roles?',
      a: 'Go to the "USER MANAGEMENT" section in the left sidebar to access dedicated views for Managing Director, Staff Users, and Security Users. You can create new accounts, assign their home department, set contact details, deactivate former personnel, or initiate a secure one-time password reset.'
    },
    {
      q: 'Q3: What happens when I deactivate a registered company or contractor?',
      a: 'When you deactivate a company under "Organization Setup > Companies" or Master Infrastructure, the system displays a confirmation prompt. Once confirmed, that company is immediately excluded from new visitor pre-registrations and contractor permit forms, while all past historical records and check-in audit logs remain intact for compliance.'
    },
    {
      q: 'Q4: How do I enforce and configure password security policies?',
      a: 'Under "Administration > Password Policy", you can configure password expiration periods (e.g., 90 days), minimum character length, mandatory complexity requirements (uppercase, numbers, symbols), and maximum failed login attempts before account lockout.'
    },
    {
      q: 'Q5: How do I test SMTP email deliverability and view dispatch logs?',
      a: 'Open "Administration > Email Test & Logs". You can send a test email to any address, verify SMTP credentials, and inspect detailed live delivery logs with timestamps, recipient addresses, and delivery statuses.'
    },
    {
      q: 'Q6: Where can I review system security incidents and audit trails?',
      a: 'Navigate to "Security & Audit > Audit Logs" and "Login History". The system logs every critical event (user logins, visitor approvals, check-ins/outs, blacklist updates, and administrative setting changes) with immutable timestamps, actor IDs, and IP addresses.'
    }
  ];

  const mdFaqList = [
    {
      q: 'Q1: What happens if I reject a visitor pre-registration request?',
      a: 'When you click "Reject Request" and enter a justification reason, the system immediately updates the record status to REJECTED. An automated rejection notification email is dispatched to the host staff member. If the rejected individual attempts to check in at the facility gate, the Security Officer desk will see an explicit "AUTHORIZATION DENIED: Visit request was rejected by Managing Director" warning, preventing gate pass issuance.'
    },
    {
      q: 'Q2: Can Security Guards check in unapproved or walk-in guests without MD approval?',
      a: 'No. The Tanaka VMS enforces a mandatory Zero-Bypass security protocol. Security Guards cannot manually bypass MD approvals for pre-registered visits. If an unannounced walk-in guest or vendor arrives at the main gate, the Security Officer must first contact the internal host staff member to submit an urgent walk-in registration, which must then receive authorization before pass badge issuance.'
    },
    {
      q: 'Q3: How do contractor work orders differ from standard visitor passes?',
      a: 'Contractor registrations require higher safety and compliance vetting. In addition to basic visitor details, contractor submissions must specify the registered contractor company, work classification category (e.g., High-Voltage Electrical, Chemical Processing, Machinery Maintenance), list of tools/equipment brought on-site, vehicle registration, and safety protocol acknowledgement before MD digital sign-off.'
    },
    {
      q: 'Q4: How does the automatic Security Watchlist & Blacklist screening work?',
      a: 'Every pre-registration and gate check-in request is instantly screened by our backend engine against the PostgreSQL Security Database. The engine cross-checks National IC/Passport numbers, phone numbers, and email addresses. Matching a BLACKLIST entry hard-blocks check-in with an immediate Red Alert. Matching a WATCHLIST entry allows check-in with a supervisor warning and creates an audit log.'
    },
    {
      q: 'Q5: Where can I review system activity, check-in history, and audit logs?',
      a: 'Managing Directors can inspect live real-time facility headcount via the Executive Dashboard, access full historical guest records in "All Visitors" and "All Contractors", or view full immutable system audit trails under "Audit Logs" (for Administrators and MDs).'
    },
    {
      q: 'Q6: What should I do if a host staff member registers a visitor with incorrect details?',
      a: 'Before approving, you can reject the request with a note specifying the required corrections (e.g., "Please update guest IC number"). The host staff member can then submit a corrected pre-registration request for your review.'
    }
  ];

  return (
    <div className="container-fluid p-4" style={{ maxWidth: '1400px' }}>
      {/* Header Banner */}
      <div className="card border-0 shadow-sm bg-dark text-white mb-4 overflow-hidden position-relative">
        <div className="card-body p-4 p-md-5 position-relative z-1">
          <div className="row align-items-center">
            <div className="col-lg-8">
              <div className="d-inline-flex align-items-center gap-2 bg-primary bg-opacity-25 px-3 py-1 rounded-pill mb-3 border border-primary text-info small font-monospace">
                <i className={`bi ${isAdmin ? 'bi-sliders' : 'bi-patch-check-fill'}`}></i>
                {isAdmin ? 'SYSTEM ADMINISTRATOR & OPERATIONS GUIDE' : 'MANAGING DIRECTOR & EXECUTIVE OPERATIONAL GUIDE'}
              </div>
              <h1 className="display-6 fw-extrabold mb-2 text-white">
                Visitor & Contractor Management System
              </h1>
              <p className="lead text-light mb-4 opacity-75">
                {isAdmin
                  ? 'Complete administrative standard operating procedures, organization provisioning, user governance, email delegation workflows, and security audit manual.'
                  : 'Complete operational manual, executive approval workflows, gate security procedures, and system architecture guide for Tanaka VMS.'}
              </p>

              <div className="d-flex flex-wrap gap-2">
                {isAdmin && onNavigate && (
                  <>
                    <button
                      className="btn btn-primary fw-bold d-flex align-items-center gap-2 px-3 py-2 shadow-sm"
                      onClick={() => onNavigate('email_recipients')}
                    >
                      <i className="bi bi-envelope-at-fill"></i>
                      Email & Delegation Setup
                    </button>
                    <button
                      className="btn btn-outline-light fw-bold d-flex align-items-center gap-2 px-3 py-2"
                      onClick={() => onNavigate('settings')}
                    >
                      <i className="bi bi-sliders"></i>
                      System Settings
                    </button>
                    <button
                      className="btn btn-outline-info fw-bold d-flex align-items-center gap-2 px-3 py-2"
                      onClick={() => onNavigate('dashboard')}
                    >
                      <i className="bi bi-speedometer2"></i>
                      Dashboard
                    </button>
                  </>
                )}

                {isMd && onNavigate && (
                  <>
                    <button
                      className="btn btn-warning fw-bold d-flex align-items-center gap-2 px-3 py-2 shadow-sm"
                      onClick={() => onNavigate('md_approvals')}
                    >
                      <i className="bi bi-patch-check-fill fs-5"></i>
                      Go to Pending Approvals
                    </button>
                    <button
                      className="btn btn-outline-light fw-bold d-flex align-items-center gap-2 px-3 py-2"
                      onClick={() => onNavigate('dashboard')}
                    >
                      <i className="bi bi-speedometer2 fs-5"></i>
                      View Executive Dashboard
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="col-lg-4 d-none d-lg-block text-center position-relative">
              <div className="p-4 rounded-4 bg-white bg-opacity-10 backdrop-blur border border-white border-opacity-10 text-start">
                <div className="text-uppercase font-monospace text-warning small fw-bold mb-2">
                  {isAdmin ? 'Admin Quick Pillars' : 'Executive Summary'}
                </div>
                <ul className="list-unstyled mb-0 text-light small d-flex flex-column gap-2">
                  {isAdmin ? (
                    <>
                      <li className="d-flex align-items-start gap-2">
                        <i className="bi bi-check-circle-fill text-success mt-1"></i>
                        <span><strong>RBAC & Identity:</strong> Segregate Staff, MD, Guard, and Admin roles.</span>
                      </li>
                      <li className="d-flex align-items-start gap-2">
                        <i className="bi bi-check-circle-fill text-success mt-1"></i>
                        <span><strong>Approval Delegation:</strong> Assign and manage acting approvers during MD absence.</span>
                      </li>
                      <li className="d-flex align-items-start gap-2">
                        <i className="bi bi-check-circle-fill text-success mt-1"></i>
                        <span><strong>Immutable Audit Logs:</strong> Track all gate scans, approvals, and configuration edits.</span>
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="d-flex align-items-start gap-2">
                        <i className="bi bi-check-circle-fill text-success mt-1"></i>
                        <span><strong>100% Gate Enforcement:</strong> No unapproved visitors can check in at security desk.</span>
                      </li>
                      <li className="d-flex align-items-start gap-2">
                        <i className="bi bi-check-circle-fill text-success mt-1"></i>
                        <span><strong>MD Single-Point Authority:</strong> All pre-registrations require Managing Director digital signature.</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative background circle */}
        <div
          className="position-absolute rounded-circle bg-primary opacity-10"
          style={{ width: '400px', height: '400px', right: '-100px', top: '-100px', filter: 'blur(50px)' }}
        ></div>
      </div>

      {/* Guide Navigation Tabs */}
      <ul className="nav nav-pills bg-white p-2 rounded-3 shadow-sm border mb-4 d-flex gap-2 flex-wrap">
        {isAdmin && (
          <li className="nav-item">
            <button
              className={`nav-link fw-bold d-flex align-items-center gap-2 ${activeGuideTab === 'ADMIN_SETUP' ? 'active bg-primary text-white' : 'text-secondary'}`}
              onClick={() => setActiveGuideTab('ADMIN_SETUP')}
            >
              <i className="bi bi-gear-wide-connected"></i>
              1. Admin Setup & Delegation Guide
            </button>
          </li>
        )}

        <li className="nav-item">
          <button
            className={`nav-link fw-bold d-flex align-items-center gap-2 ${activeGuideTab === 'MD_WORKFLOW' ? 'active bg-warning text-dark' : 'text-secondary'}`}
            onClick={() => setActiveGuideTab('MD_WORKFLOW')}
          >
            <i className="bi bi-award-fill"></i>
            {isAdmin ? '2. Executive Approval Workflow' : '1. MD Approval Instructions'}
          </button>
        </li>

        <li className="nav-item">
          <button
            className={`nav-link fw-bold d-flex align-items-center gap-2 ${activeGuideTab === 'SYSTEM_CYCLE' ? 'active bg-info text-dark' : 'text-secondary'}`}
            onClick={() => setActiveGuideTab('SYSTEM_CYCLE')}
          >
            <i className="bi bi-diagram-3-fill"></i>
            {isAdmin ? '3. End-to-End VMS Lifecycle' : '2. End-to-End VMS Lifecycle'}
          </button>
        </li>

        <li className="nav-item">
          <button
            className={`nav-link fw-bold d-flex align-items-center gap-2 ${activeGuideTab === 'ROLES' ? 'active bg-dark text-white' : 'text-secondary'}`}
            onClick={() => setActiveGuideTab('ROLES')}
          >
            <i className="bi bi-people-fill"></i>
            {isAdmin ? '4. User Roles & Matrix' : '3. User Roles & Matrix'}
          </button>
        </li>

        <li className="nav-item">
          <button
            className={`nav-link fw-bold d-flex align-items-center gap-2 ${activeGuideTab === 'SECURITY_RULES' ? 'active bg-danger text-white' : 'text-secondary'}`}
            onClick={() => setActiveGuideTab('SECURITY_RULES')}
          >
            <i className="bi bi-shield-slash-fill"></i>
            {isAdmin ? '5. Security Watchlist & Gate Blocker' : '4. Watchlist & Gate Screening'}
          </button>
        </li>

        <li className="nav-item">
          <button
            className={`nav-link fw-bold d-flex align-items-center gap-2 ${(activeGuideTab === 'ADMIN_FAQ' || activeGuideTab === 'FAQ') ? 'active bg-success text-white' : 'text-secondary'}`}
            onClick={() => setActiveGuideTab(isAdmin ? 'ADMIN_FAQ' : 'FAQ')}
          >
            <i className="bi bi-question-circle-fill"></i>
            {isAdmin ? '6. Administrator FAQ & How-To' : '5. Executive FAQ'}
          </button>
        </li>
      </ul>

      {/* TAB: ADMIN SETUP & DELEGATION GUIDE */}
      {activeGuideTab === 'ADMIN_SETUP' && (
        <div className="row g-4">
          <div className="col-lg-8">
            <div className="card border-0 shadow-sm bg-white mb-4">
              <div className="card-header bg-white py-3 border-bottom d-flex align-items-center gap-2">
                <i className="bi bi-sliders text-primary fs-4"></i>
                <h5 className="fw-bold text-dark mb-0">Administrator Core Standard Operating Procedures</h5>
              </div>
              <div className="card-body p-4">
                <p className="text-secondary mb-4">
                  As the <strong>System Administrator</strong>, you oversee system configuration, master organizational data, user governance, email routing, and security audit readiness.
                </p>

                <div className="d-flex flex-column gap-4">
                  {/* Step 1 */}
                  <div className="d-flex gap-3 align-items-start p-3 bg-light rounded-3 border border-primary border-opacity-50">
                    <div className="badge bg-primary text-white fs-5 fw-extrabold rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '40px', height: '40px' }}>
                      1
                    </div>
                    <div>
                      <h6 className="fw-extrabold text-dark mb-1">Executive Delegation & Backup Approver Configuration</h6>
                      <p className="small text-muted mb-2">
                        When the Managing Director is out of office, you can designate an authorized Acting Approver (e.g. Senior Manager / Head of Department) without transferring full system administrator privileges.
                      </p>
                      <div className="bg-white p-3 rounded border small text-dark">
                        <div className="fw-bold mb-1 text-primary"><i className="bi bi-check2-circle me-1"></i> How to set up delegation:</div>
                        <ol className="mb-0 ps-3 text-secondary">
                          <li>Navigate to <strong>Administration &gt; Email Recipients Setup</strong>.</li>
                          <li>Locate the <strong>Department &amp; Executive Notification Delegation</strong> section.</li>
                          <li>Turn the toggle <strong>ON</strong> (green).</li>
                          <li>Select the Staff member from the <strong>Designated Backup Approver</strong> dropdown.</li>
                          <li>Optionally enter the effective Start Date, End Date, and Justification note.</li>
                          <li>Click <strong>Save Email Recipients &amp; Preferences</strong>. The popup modal confirms the update.</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="d-flex gap-3 align-items-start p-3 bg-light rounded-3 border">
                    <div className="badge bg-dark text-white fs-5 fw-extrabold rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '40px', height: '40px' }}>
                      2
                    </div>
                    <div>
                      <h6 className="fw-extrabold text-dark mb-1">Master Organization & Infrastructure Setup</h6>
                      <p className="small text-muted mb-2">
                        Configure baseline master entities to populate dropdowns across the application:
                      </p>
                      <div className="d-flex flex-wrap gap-2 small">
                        <span className="badge bg-light text-dark border"><i className="bi bi-diagram-3-fill me-1 text-primary"></i> Internal Departments</span>
                        <span className="badge bg-light text-dark border"><i className="bi bi-building me-1 text-info"></i> Registered Visitor &amp; Contractor Companies</span>
                        <span className="badge bg-light text-dark border"><i className="bi bi-tags-fill me-1 text-warning"></i> Visit &amp; Work Categories</span>
                        <span className="badge bg-light text-dark border"><i className="bi bi-geo-alt-fill me-1 text-danger"></i> Meeting Venues &amp; Conference Rooms</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="d-flex gap-3 align-items-start p-3 bg-light rounded-3 border border-warning border-opacity-50">
                    <div className="badge bg-warning text-dark fs-5 fw-extrabold rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '40px', height: '40px' }}>
                      3
                    </div>
                    <div>
                      <h6 className="fw-extrabold text-dark mb-1">User Management & Role Provisioning</h6>
                      <p className="small text-muted mb-2">
                        Create and manage accounts segregated by responsibility:
                      </p>
                      <ul className="small text-secondary mb-0 ps-3">
                        <li><strong>Staff Accounts:</strong> Can pre-register visitors/contractors and view their own submissions.</li>
                        <li><strong>Security Officers:</strong> Gate desk operations, badge assignment, and live check-in/out.</li>
                        <li><strong>Managing Director:</strong> Holds sole executive approval authorization.</li>
                      </ul>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="d-flex gap-3 align-items-start p-3 bg-light rounded-3 border border-success border-opacity-50">
                    <div className="badge bg-success text-white fs-5 fw-extrabold rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '40px', height: '40px' }}>
                      4
                    </div>
                    <div>
                      <h6 className="fw-extrabold text-dark mb-1">Security Blacklist & Immutable Audit Verification</h6>
                      <p className="small text-muted mb-0">
                        Maintain the Blacklist/Watchlist database for barred individuals. Use the <strong>Audit Logs</strong> and <strong>Login History</strong> modules to generate compliance audit trails for security investigations.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="card border-0 shadow-sm bg-white">
              <div className="card-header bg-dark text-white py-3">
                <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-shield-lock-fill text-warning"></i>
                  Admin Governance Checklist
                </h6>
              </div>
              <div className="card-body p-3">
                <div className="mb-3 p-2.5 border rounded bg-light">
                  <div className="fw-bold text-primary small mb-1">
                    <i className="bi bi-envelope-check-fill me-1"></i> SMTP & Notification Testing
                  </div>
                  <span className="small text-muted">Run periodic delivery tests in Email Test &amp; Logs to ensure hosts and executives receive timely alerts.</span>
                </div>

                <div className="mb-3 p-2.5 border rounded bg-light">
                  <div className="fw-bold text-success small mb-1">
                    <i className="bi bi-key-fill me-1"></i> Password Policy Enforcement
                  </div>
                  <span className="small text-muted">Enforce 90-day password rotation, complexity criteria, and failed attempt thresholds.</span>
                </div>

                <div className="p-2.5 border rounded bg-light">
                  <div className="fw-bold text-danger small mb-1">
                    <i className="bi bi-slash-circle-fill me-1"></i> Company Deactivation Protection
                  </div>
                  <span className="small text-muted">Deactivating a company requires explicit confirmation and keeps historical audit logs intact.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MD WORKFLOW INSTRUCTIONS */}
      {activeGuideTab === 'MD_WORKFLOW' && (
        <div className="row g-4">
          <div className="col-lg-8">
            <div className="card border-0 shadow-sm bg-white mb-4">
              <div className="card-header bg-white py-3 border-bottom d-flex align-items-center gap-2">
                <i className="bi bi-patch-check-fill text-warning fs-4"></i>
                <h5 className="fw-bold text-dark mb-0">Managing Director Approval Responsibilities</h5>
              </div>
              <div className="card-body p-4">
                <p className="text-secondary mb-4">
                  As the <strong>Managing Director (MD)</strong>, you hold executive approval authority for all external guests, visitors, and contractor crews requesting entry into the company facility.
                </p>

                <div className="d-flex flex-column gap-4">
                  {/* Step 1 */}
                  <div className="d-flex gap-3 align-items-start p-3 bg-light rounded-3 border border-warning border-opacity-50">
                    <div className="badge bg-warning text-dark fs-5 fw-extrabold rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '40px', height: '40px' }}>
                      1
                    </div>
                    <div>
                      <h6 className="fw-extrabold text-dark mb-1">Receive &amp; Review Pre-Registration Requests</h6>
                      <p className="small text-muted mb-2">
                        Staff members submit pre-registrations for upcoming visitors or contractor work orders. The system saves them under <span className="badge bg-warning text-dark">PENDING_MD_APPROVAL</span> state and dispatches email alerts to you.
                      </p>
                      <div className="bg-white p-2 rounded border small font-monospace text-dark">
                        <i className="bi bi-envelope-fill me-1 text-primary"></i> Email Subject: <strong>[VMS] ACTION REQUIRED: New Pre-Registration Approval Request</strong>
                      </div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="d-flex gap-3 align-items-start p-3 bg-light rounded-3 border">
                    <div className="badge bg-primary text-white fs-5 fw-extrabold rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '40px', height: '40px' }}>
                      2
                    </div>
                    <div>
                      <h6 className="fw-extrabold text-dark mb-1">Access Pending Approvals View</h6>
                      <p className="small text-muted mb-2">
                        Navigate to <strong>Pending Approvals</strong> from the left sidebar or the dashboard shortcut. Requests are grouped by <strong>Host Staff Member</strong> or <strong>Visit Date</strong> for rapid batch evaluation.
                      </p>
                      <div className="d-flex flex-wrap gap-2 small">
                        <span className="badge bg-secondary">Grouped Visitor Cards</span>
                        <span className="badge bg-secondary">Contractor Work Orders</span>
                        <span className="badge bg-secondary">Meeting Venue &amp; Duration</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="d-flex gap-3 align-items-start p-3 bg-light rounded-3 border border-danger border-opacity-25">
                    <div className="badge bg-danger text-white fs-5 fw-extrabold rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '40px', height: '40px' }}>
                      3
                    </div>
                    <div>
                      <h6 className="fw-extrabold text-dark mb-1">Verify Watchlist &amp; Security Flags</h6>
                      <p className="small text-muted mb-2">
                        The system automatically screens visitor IC/Passport numbers, phone numbers, and email addresses against the live <strong>Security Watchlist &amp; Blacklist Database</strong>.
                      </p>
                      <div className="p-2 bg-danger bg-opacity-10 rounded border border-danger small text-danger fw-bold d-flex align-items-center gap-2">
                        <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                        <span>If flagged, a RED alert badge "FLAGGED IN BLACKLIST" appears on the visitor's card. Review the security incident reason before approving!</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="d-flex gap-3 align-items-start p-3 bg-light rounded-3 border border-success border-opacity-50">
                    <div className="badge bg-success text-white fs-5 fw-extrabold rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '40px', height: '40px' }}>
                      4
                    </div>
                    <div>
                      <h6 className="fw-extrabold text-dark mb-1">Grant Digital Approval or Rejection</h6>
                      <p className="small text-muted mb-2">
                        Click <strong>Approve Visit Request</strong> to grant authorization. The status immediately transitions to <span className="badge bg-success">APPROVED</span>, generating an official QR Visitor Pass Badge and notifying Security at the main gate.
                      </p>
                      <p className="small text-muted mb-0">
                        If rejected, provide a justification reason. Staff host and guest receive instant email notification.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="card border-0 shadow-sm bg-white mb-4">
              <div className="card-header bg-dark text-white py-3">
                <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-lightning-charge-fill text-warning"></i>
                  MD Decision Controls
                </h6>
              </div>
              <div className="card-body p-3">
                <div className="mb-3 p-2 border rounded bg-light">
                  <div className="fw-bold text-success small mb-1">
                    <i className="bi bi-check-circle-fill me-1"></i> APPROVE VISIT
                  </div>
                  <span className="small text-muted">Authorizes gate check-in. Security can issue pass badge upon guest arrival.</span>
                </div>

                <div className="mb-3 p-2 border rounded bg-light">
                  <div className="fw-bold text-danger small mb-1">
                    <i className="bi bi-x-circle-fill me-1"></i> REJECT VISIT
                  </div>
                  <span className="small text-muted">Blocks gate entry completely. System logs rejection reason in audit trail.</span>
                </div>

                <div className="p-2 border rounded bg-light">
                  <div className="fw-bold text-primary small mb-1">
                    <i className="bi bi-qr-code-scan me-1"></i> PASS BADGE ISSUANCE
                  </div>
                  <span className="small text-muted">Generates digital QR pass containing host, venue, date, and MD approval seal.</span>
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm bg-white">
              <div className="card-header bg-primary text-white py-3">
                <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-shield-check"></i>
                  Executive Safeguards
                </h6>
              </div>
              <div className="card-body p-3 small text-secondary">
                <p className="mb-2">
                  <strong>Zero Bypass Gate Policy:</strong> Guard officers cannot manually bypass MD approvals for pre-registered visits.
                </p>
                <p className="mb-0">
                  <strong>Immutable Audit Logging:</strong> Every approval, rejection, or edit made by the MD account is permanently recorded with timestamp, IP address, and browser agent in PostgreSQL.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: END-TO-END VMS LIFECYCLE */}
      {activeGuideTab === 'SYSTEM_CYCLE' && (
        <div className="card border-0 shadow-sm bg-white mb-4">
          <div className="card-header bg-white py-3 border-bottom">
            <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
              <i className="bi bi-diagram-3-fill text-primary"></i>
              Complete End-to-End Visitor &amp; Contractor Management Flow
            </h5>
          </div>
          <div className="card-body p-4">
            <div className="row g-3 text-center mb-5">
              {/* Stage 1 */}
              <div className="col-md-2">
                <div className="p-3 bg-light rounded border h-100 position-relative">
                  <div className="badge bg-secondary mb-2">STAGE 1</div>
                  <i className="bi bi-person-plus-fill fs-2 text-primary d-block mb-2"></i>
                  <h6 className="fw-bold text-dark small mb-1">Staff Pre-Registration</h6>
                  <span className="small text-muted d-block" style={{ fontSize: '0.75rem' }}>Staff enters guest &amp; visit details</span>
                </div>
              </div>

              {/* Arrow */}
              <div className="col-md-1 d-none d-md-flex align-items-center justify-content-center">
                <i className="bi bi-arrow-right fs-3 text-muted"></i>
              </div>

              {/* Stage 2 */}
              <div className="col-md-2">
                <div className="p-3 bg-warning bg-opacity-10 border border-warning rounded h-100">
                  <div className="badge bg-warning text-dark mb-2">STAGE 2</div>
                  <i className="bi bi-award-fill fs-2 text-warning d-block mb-2"></i>
                  <h6 className="fw-bold text-dark small mb-1">MD Approval</h6>
                  <span className="small text-muted d-block" style={{ fontSize: '0.75rem' }}>MD reviews &amp; signs authorization</span>
                </div>
              </div>

              {/* Arrow */}
              <div className="col-md-1 d-none d-md-flex align-items-center justify-content-center">
                <i className="bi bi-arrow-right fs-3 text-muted"></i>
              </div>

              {/* Stage 3 */}
              <div className="col-md-2">
                <div className="p-3 bg-info bg-opacity-10 border border-info rounded h-100">
                  <div className="badge bg-info text-dark mb-2">STAGE 3</div>
                  <i className="bi bi-shield-check fs-2 text-info d-block mb-2"></i>
                  <h6 className="fw-bold text-dark small mb-1">Gate Check-In</h6>
                  <span className="small text-muted d-block" style={{ fontSize: '0.75rem' }}>Guard verifies ID &amp; issues badge</span>
                </div>
              </div>

              {/* Arrow */}
              <div className="col-md-1 d-none d-md-flex align-items-center justify-content-center">
                <i className="bi bi-arrow-right fs-3 text-muted"></i>
              </div>

              {/* Stage 4 */}
              <div className="col-md-3">
                <div className="p-3 bg-success bg-opacity-10 border border-success rounded h-100">
                  <div className="badge bg-success text-white mb-2">STAGE 4 &amp; 5</div>
                  <i className="bi bi-building-check fs-2 text-success d-block mb-2"></i>
                  <h6 className="fw-bold text-dark small mb-1">On-Premise &amp; Check-Out</h6>
                  <span className="small text-muted d-block" style={{ fontSize: '0.75rem' }}>Live roster tracking &amp; departure badge return</span>
                </div>
              </div>
            </div>

            {/* Detailed Stage Explanation Table */}
            <div className="table-responsive">
              <table className="table table-bordered align-middle">
                <thead className="table-dark small">
                  <tr>
                    <th style={{ width: '120px' }}>LIFECYCLE STAGE</th>
                    <th style={{ width: '160px' }}>RESPONSIBLE ROLE</th>
                    <th>SYSTEM ACTIONS &amp; AUTOMATION</th>
                    <th style={{ width: '180px' }}>RECORD STATUS</th>
                  </tr>
                </thead>
                <tbody className="small">
                  <tr>
                    <td className="fw-bold text-primary">1. Request Draft</td>
                    <td><span className="badge bg-secondary">Host Staff</span></td>
                    <td>Staff creates visit booking. Input details: Visitor Name, IC/Passport, Phone, Company, Date, Time, Venue, Purpose.</td>
                    <td><span className="badge bg-warning text-dark">PENDING_MD_APPROVAL</span></td>
                  </tr>
                  <tr>
                    <td className="fw-bold text-warning">2. Executive Review</td>
                    <td><span className="badge bg-warning text-dark">Managing Director</span></td>
                    <td>MD reviews request list, screens security warnings, and signs digital approval. Automatic email sent to guest &amp; host.</td>
                    <td><span className="badge bg-success">APPROVED</span> / <span className="badge bg-danger">REJECTED</span></td>
                  </tr>
                  <tr>
                    <td className="fw-bold text-info">3. Arrival at Gate</td>
                    <td><span className="badge bg-dark">Security Guard</span></td>
                    <td>Guest presents IC/Passport or QR Pass. Security assigns physical badge number, records vehicle &amp; items carried, then clicks Check-In.</td>
                    <td><span className="badge bg-primary">CHECKED_IN</span></td>
                  </tr>
                  <tr>
                    <td className="fw-bold text-success">4. Facility Stay</td>
                    <td><span className="badge bg-light text-dark border">System Automated</span></td>
                    <td>Visitor appears on <strong>Live On-Premise Roster</strong>. Overstay timer monitors visit duration vs expected departure time.</td>
                    <td><span className="badge bg-success">ON_PREMISE</span></td>
                  </tr>
                  <tr>
                    <td className="fw-bold text-danger">5. Gate Departure</td>
                    <td><span className="badge bg-dark">Security Guard</span></td>
                    <td>Guest returns pass badge at security post. Security clicks Check-Out. System records departure timestamp.</td>
                    <td><span className="badge bg-secondary">CHECKED_OUT</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: USER ROLES & ACCESS MATRIX */}
      {activeGuideTab === 'ROLES' && (
        <div className="card border-0 shadow-sm bg-white mb-4">
          <div className="card-header bg-white py-3 border-bottom">
            <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
              <i className="bi bi-people-fill text-dark"></i>
              System User Roles &amp; Access Rights Matrix
            </h5>
          </div>
          <div className="card-body p-4">
            <p className="text-muted small mb-4">
              Tanaka VMS implements strict Role-Based Access Control (RBAC) to preserve security isolation and audit accountability across departments.
            </p>

            <div className="table-responsive">
              <table className="table table-striped table-hover align-middle">
                <thead className="table-light small">
                  <tr>
                    <th>SYSTEM MODULE / FEATURE</th>
                    <th className="text-center" style={{ width: '130px' }}>MANAGING DIRECTOR</th>
                    <th className="text-center" style={{ width: '130px' }}>STAFF HOST</th>
                    <th className="text-center" style={{ width: '130px' }}>SECURITY GUARD</th>
                    <th className="text-center" style={{ width: '130px' }}>ADMINISTRATOR</th>
                  </tr>
                </thead>
                <tbody className="small">
                  <tr>
                    <td className="fw-bold">Executive Dashboard &amp; KPI Analytics</td>
                    <td className="text-center text-success"><i className="bi bi-check-circle-fill fs-5"></i></td>
                    <td className="text-center text-secondary"><i className="bi bi-dash-circle fs-5"></i></td>
                    <td className="text-center text-secondary"><i className="bi bi-dash-circle fs-5"></i></td>
                    <td className="text-center text-success"><i className="bi bi-check-circle-fill fs-5"></i></td>
                  </tr>
                  <tr>
                    <td className="fw-bold">Pre-Register Visitors &amp; Contractors</td>
                    <td className="text-center text-secondary"><i className="bi bi-dash-circle fs-5"></i></td>
                    <td className="text-center text-success"><i className="bi bi-check-circle-fill fs-5"></i></td>
                    <td className="text-center text-secondary"><i className="bi bi-dash-circle fs-5"></i></td>
                    <td className="text-center text-success"><i className="bi bi-check-circle-fill fs-5"></i></td>
                  </tr>
                  <tr>
                    <td className="fw-bold">Pre-Registration Approval Authority</td>
                    <td className="text-center text-warning fw-bold"><i className="bi bi-star-fill fs-5 me-1"></i> SOLE POWER</td>
                    <td className="text-center text-danger"><i className="bi bi-x-circle-fill fs-5"></i></td>
                    <td className="text-center text-danger"><i className="bi bi-x-circle-fill fs-5"></i></td>
                    <td className="text-center text-secondary"><i className="bi bi-dash-circle fs-5"></i> (Delegates to MD)</td>
                  </tr>
                  <tr>
                    <td className="fw-bold">Gate Check-In &amp; Check-Out Execution</td>
                    <td className="text-center text-secondary"><i className="bi bi-eye-fill fs-5"></i> (View Only)</td>
                    <td className="text-center text-danger"><i className="bi bi-x-circle-fill fs-5"></i></td>
                    <td className="text-center text-success"><i className="bi bi-check-circle-fill fs-5"></i></td>
                    <td className="text-center text-success"><i className="bi bi-check-circle-fill fs-5"></i></td>
                  </tr>
                  <tr>
                    <td className="fw-bold">Live On-Premise Roster View</td>
                    <td className="text-center text-success"><i className="bi bi-check-circle-fill fs-5"></i></td>
                    <td className="text-center text-secondary"><i className="bi bi-dash-circle fs-5"></i></td>
                    <td className="text-center text-success"><i className="bi bi-check-circle-fill fs-5"></i></td>
                    <td className="text-center text-success"><i className="bi bi-check-circle-fill fs-5"></i></td>
                  </tr>
                  <tr>
                    <td className="fw-bold">Watchlist &amp; Blacklist Entry Management</td>
                    <td className="text-center text-secondary"><i className="bi bi-eye-fill fs-5"></i> (View Only)</td>
                    <td className="text-center text-danger"><i className="bi bi-x-circle-fill fs-5"></i></td>
                    <td className="text-center text-success"><i className="bi bi-check-circle-fill fs-5"></i></td>
                    <td className="text-center text-success"><i className="bi bi-check-circle-fill fs-5"></i></td>
                  </tr>
                  <tr>
                    <td className="fw-bold">User Account &amp; System Configuration</td>
                    <td className="text-center text-danger"><i className="bi bi-x-circle-fill fs-5"></i></td>
                    <td className="text-center text-danger"><i className="bi bi-x-circle-fill fs-5"></i></td>
                    <td className="text-center text-danger"><i className="bi bi-x-circle-fill fs-5"></i></td>
                    <td className="text-center text-success"><i className="bi bi-check-circle-fill fs-5"></i></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: WATCHLIST & GATE SCREENING */}
      {activeGuideTab === 'SECURITY_RULES' && (
        <div className="card border-0 shadow-sm bg-white mb-4">
          <div className="card-header bg-danger text-white py-3">
            <h5 className="fw-bold mb-0 d-flex align-items-center gap-2">
              <i className="bi bi-shield-slash-fill"></i>
              Security Screening, Watchlist &amp; Gate Blocker Procedures
            </h5>
          </div>
          <div className="card-body p-4">
            <div className="row g-4 mb-4">
              <div className="col-md-6">
                <div className="p-3 bg-danger bg-opacity-10 border border-danger rounded-3 h-100">
                  <h6 className="fw-extrabold text-danger mb-2 d-flex align-items-center gap-2">
                    <i className="bi bi-slash-circle-fill"></i>
                    1. BLACKLIST (Hard Gate Check-In Blocker)
                  </h6>
                  <p className="small text-dark mb-2">
                    Individuals tagged as <strong>BLACKLIST</strong> are strictly barred from entering the premises under any circumstances.
                  </p>
                  <ul className="small text-muted mb-0 ps-3">
                    <li>Triggers instant <strong>RED ALERT MODAL</strong> on Security Guard Desk upon IC/Phone scan.</li>
                    <li>System hard-blocks the Check-In button.</li>
                    <li>Security Officer must contact Security Supervisor or Police if necessary.</li>
                    <li>Recorded in immutable Audit Logs under <code>BLACKLIST_ALERT</code>.</li>
                  </ul>
                </div>
              </div>

              <div className="col-md-6">
                <div className="p-3 bg-warning bg-opacity-10 border border-warning rounded-3 h-100">
                  <h6 className="fw-extrabold text-dark mb-2 d-flex align-items-center gap-2">
                    <i className="bi bi-exclamation-triangle-fill text-warning"></i>
                    2. WATCHLIST (Monitoring &amp; Alert Flag)
                  </h6>
                  <p className="small text-dark mb-2">
                    Individuals tagged as <strong>WATCHLIST</strong> require heightened security surveillance but are not automatically barred from entry.
                  </p>
                  <ul className="small text-muted mb-0 ps-3">
                    <li>Displays yellow warning flag during MD Approval and Security Check-In.</li>
                    <li>Check-in is permitted, but triggers automatic <code>WATCHLIST_ALERT</code> audit logging.</li>
                    <li>Security Officer conducts bag/vehicle inspection before issuing pass badge.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-3 bg-light rounded border">
              <h6 className="fw-bold text-dark mb-2">Multi-Field Automatic Matching Engine</h6>
              <p className="small text-muted mb-0">
                The screening engine performs case-insensitive exact matching across three independent identification attributes: <strong>National IC / Passport Number</strong>, <strong>Cleaned Phone Number</strong>, and <strong>Email Address</strong>. Matching any single field triggers the security protocol.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: FAQ (ADMIN or MD) */}
      {(activeGuideTab === 'ADMIN_FAQ' || activeGuideTab === 'FAQ') && (
        <div className="card border-0 shadow-sm bg-white mb-4">
          <div className="card-header bg-success bg-opacity-10 text-dark py-3 border-bottom border-success border-opacity-25 d-flex align-items-center justify-content-between">
            <h5 className="fw-bold mb-0 d-flex align-items-center gap-2">
              <i className="bi bi-question-circle-fill text-success"></i>
              {isAdmin ? 'Frequently Asked Questions (Administrator & IT Operations)' : 'Frequently Asked Questions (Executive & MD Operations)'}
            </h5>
            <span className="badge bg-dark font-monospace">
              {isAdmin ? `${adminFaqList.length} Administrator Guides` : `${mdFaqList.length} Executive Guides`}
            </span>
          </div>
          <div className="card-body p-4">
            <div className="d-flex flex-column gap-3">
              {(isAdmin ? adminFaqList : mdFaqList).map((item, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={idx}
                    className={`border rounded-3 overflow-hidden transition-all ${isOpen ? 'shadow-sm border-success border-opacity-50' : 'bg-light'}`}
                  >
                    <button
                      type="button"
                      className={`w-100 text-start p-3 d-flex align-items-center justify-content-between border-0 fw-bold font-sans ${isOpen ? 'bg-success text-white' : 'bg-white text-dark'}`}
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      style={{ cursor: 'pointer', outline: 'none' }}
                    >
                      <span className="fs-6 pe-3">{item.q}</span>
                      <i className={`bi ${isOpen ? 'bi-chevron-up text-white' : 'bi-chevron-down text-secondary'} fs-5 flex-shrink-0`}></i>
                    </button>
                    {isOpen && (
                      <div className="p-3 bg-white text-dark border-top border-light">
                        <p className="mb-0 text-secondary leading-relaxed font-sans" style={{ fontSize: '0.925rem', color: '#334155', lineHeight: '1.6' }}>
                          {item.a}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
