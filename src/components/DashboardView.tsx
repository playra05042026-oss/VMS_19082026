import React, { useEffect, useState } from 'react';
import { User, Visitor, Contractor } from '../types';
import { getReportsSummary, getVisitors, getContractors } from '../lib/api';
import { calculateOverstayInfo, canViewOverstay } from '../lib/overstayUtils';
import { TrafficAnalyticsChart } from './TrafficAnalyticsChart';

interface DashboardViewProps {
  currentUser: User;
  onNavigate: (tab: string) => void;
  onOpenBadge: (item: Visitor | Contractor, type: 'VISITOR' | 'CONTRACTOR') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ currentUser, onNavigate, onOpenBadge }) => {
  const [summary, setSummary] = useState<any>(null);
  const [recentVisitors, setRecentVisitors] = useState<Visitor[]>([]);
  const [recentContractors, setRecentContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [sumRes, visRes, ctrRes] = await Promise.all([
          getReportsSummary(),
          getVisitors(),
          getContractors()
        ]);
        setSummary(sumRes);
        setRecentVisitors(visRes);
        setRecentContractors(ctrRes);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentUser]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (loading || !summary) {
    return (
      <div className="p-4 text-center my-5">
        <div className="spinner-border text-primary" role="status"></div>
        <div className="mt-2 text-muted fw-semibold">Loading Enterprise VMS Dashboard...</div>
      </div>
    );
  }

  const isStaff = currentUser.role === 'STAFF';
  const isAdmin = currentUser.role === 'ADMINISTRATOR';
  const isMD = currentUser.role === 'MANAGING_DIRECTOR';
  const isSecurity = currentUser.role === 'SECURITY';
  const canSeeOverstay = canViewOverstay(currentUser.role);
  const canSeePassBadge = currentUser.role !== 'STAFF' && currentUser.role !== 'MANAGING_DIRECTOR';

  const pendingApprovalsCount = summary.pendingMdApprovalsCount || 0;

  const activeOverstayCount = canSeeOverstay
    ? recentVisitors.filter(v => v.status === 'CHECKED_IN' && calculateOverstayInfo(v, now).isOverstay).length
    : 0;

  return (
    <div className="p-4">
      {/* Top Banner / Welcome */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-3 border-bottom gap-3">
        <div>
          <h3 className="fw-extrabold text-dark mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-grid-1x2-fill text-primary"></i>
            {isAdmin && 'Enterprise Control Center'}
            {isMD && `Managing Director — ${currentUser.fullName}`}
            {isStaff && `Staff Workspace — ${currentUser.fullName}`}
            {isSecurity && 'Security Operations & Gate Control'}
          </h3>
          {!isMD && (
            <p className="text-muted mb-0 small">
              {isAdmin && 'System-wide oversight, master configuration, user permission management, and audit tracking.'}
              {isStaff && `Pre-register and monitor your incoming visitors & contractors.`}
              {isSecurity && 'Real-time on-premise check-in, check-out, identification verification, and blacklist security screening.'}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        {!isMD && (
          <div className="d-flex gap-2">
            {isStaff && (
              <>
                <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm" onClick={() => onNavigate('register_visitor')}>
                  <i className="bi bi-person-plus-fill"></i> Register Visitor
                </button>
                <button className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1 shadow-sm" onClick={() => onNavigate('register_contractor')}>
                  <i className="bi bi-tools"></i> Register Contractor
                </button>
              </>
            )}

            {isSecurity && (
              <>
                <button className="btn btn-warning btn-sm fw-bold d-flex align-items-center gap-1 shadow-sm" onClick={() => onNavigate('guard_desk')}>
                  <i className="bi bi-shield-check"></i> Gate Guard Desk
                </button>
                <button className="btn btn-success btn-sm d-flex align-items-center gap-1 shadow-sm" onClick={() => onNavigate('on_premise')}>
                  <i className="bi bi-building-check"></i> On-Premise Live Roster
                </button>
              </>
            )}

            {isAdmin && (
              <>
                
                <button className="btn btn-danger btn-sm d-flex align-items-center gap-1 shadow-sm" onClick={() => onNavigate('blacklist')}>
                  <i className="bi bi-slash-circle-fill"></i> Blacklist DB
                </button>
              </>
            )}
          </div>
        )}
      </div>



      {/* Staff Isolation Notice */}
      {isStaff && (
        <div className="alert alert-primary border-primary bg-primary bg-opacity-10 d-flex align-items-center gap-3 mb-4 shadow-sm">
          <i className="bi bi-lock-fill fs-3 text-primary"></i>
          <div>
            <strong>Strict Staff Data Security Policy Engaged:</strong> You are currently logged in as <strong>{currentUser.fullName} ({currentUser.departmentName})</strong>. Under enterprise access rules, you can view and manage <em>only your own registered visitors and contractors</em>. Other staff registrations are hidden.
          </div>
        </div>
      )}

      {/* Overstay Security Warning Alert (Only Security & Admin) */}
      {canSeeOverstay && activeOverstayCount > 0 && (
        <div className="alert alert-danger border-2 border-danger bg-danger bg-opacity-10 d-flex align-items-center justify-content-between p-3 mb-4 rounded-3 shadow-sm">
          <div className="d-flex align-items-center gap-3">
            <div className="p-2 bg-danger text-white rounded-circle fs-4 d-flex align-items-center justify-content-center shadow-sm" style={{ width: '44px', height: '44px' }}>
              <i className="bi bi-alarm-fill animate-pulse"></i>
            </div>
            <div>
              <strong className="text-danger text-uppercase font-monospace d-block" style={{ fontSize: '0.8rem' }}>SECURITY & ADMIN OVERSTAY ALERT</strong>
              <div className="text-dark fw-bold">
                {activeOverstayCount} Visitor(s) on-premise have exceeded their scheduled visit end time!
              </div>
            </div>
          </div>
          <button
            className="btn btn-sm btn-danger fw-bold d-flex align-items-center gap-1 shadow-sm"
            onClick={() => onNavigate('guard_desk')}
          >
            <i className="bi bi-shield-check"></i> Open Guard Desk ({activeOverstayCount} Overstays)
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="row g-3 mb-4">
        {/* Card 1: Today Visitors */}
        <div className="col-sm-6 col-lg-3">
          <div className="card bg-white h-100 stat-card-blue">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="text-uppercase fw-bold font-monospace" style={{ fontSize: '0.725rem', color: '#64748B' }}>
                    {isStaff ? 'My Visitors Today' : 'Today Visitors'}
                  </div>
                  <h2 className="fw-bold mb-0 mt-1" style={{ color: '#0F172A' }}>{summary.totalVisitorsToday}</h2>
                </div>
                <div className="p-3 rounded-circle text-primary" style={{ backgroundColor: '#EFF6FF' }}>
                  <i className="bi bi-person-fill fs-3"></i>
                </div>
              </div>
              <div className="mt-2 small" style={{ color: '#64748B' }}>
                Scheduled for entry today
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Today Contractors */}
        <div className="col-sm-6 col-lg-3">
          <div className="card bg-white h-100 stat-card-amber">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="text-uppercase fw-bold font-monospace" style={{ fontSize: '0.725rem', color: '#64748B' }}>
                    {isStaff ? 'My Contractors Today' : 'Today Contractors'}
                  </div>
                  <h2 className="fw-bold mb-0 mt-1" style={{ color: '#0F172A' }}>{summary.totalContractorsToday}</h2>
                </div>
                <div className="p-3 rounded-circle" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>
                  <i className="bi bi-tools fs-3"></i>
                </div>
              </div>
              <div className="mt-2 small" style={{ color: '#64748B' }}>
                Active work orders
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Currently On-Premise */}
        <div className="col-sm-6 col-lg-3">
          <div className="card bg-white h-100 stat-card-green">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="text-uppercase fw-bold font-monospace" style={{ fontSize: '0.725rem', color: '#64748B' }}>
                    Currently On-Premise
                  </div>
                  <h2 className="fw-bold mb-0 mt-1" style={{ color: '#059669' }}>
                    {summary.onPremiseVisitorsCount + summary.onPremiseContractorsCount}
                  </h2>
                </div>
                <div className="p-3 rounded-circle" style={{ backgroundColor: '#DCFCE7', color: '#059669' }}>
                  <i className="bi bi-building-check fs-3"></i>
                </div>
              </div>
              <div className="mt-2 small" style={{ color: '#64748B' }}>
                {summary.onPremiseVisitorsCount} Visitors, {summary.onPremiseContractorsCount} Contractors
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Blacklist / System Counter */}
        <div className="col-sm-6 col-lg-3">
          <div className="card bg-white h-100 stat-card-red">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="text-uppercase fw-bold font-monospace" style={{ fontSize: '0.725rem', color: '#64748B' }}>
                    {isAdmin || isSecurity ? 'Blacklist DB Entries' : 'Pending Check-In'}
                  </div>
                  <h2 className="fw-bold mb-0 mt-1" style={{ color: '#0F172A' }}>
                    {isAdmin || isSecurity ? summary.blacklistTotalCount : summary.scheduledPendingCount}
                  </h2>
                </div>
                <div className="p-3 rounded-circle" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                  <i className={`bi ${isAdmin || isSecurity ? 'bi-shield-slash-fill' : 'bi-clock-history'} fs-3`}></i>
                </div>
              </div>
              <div className="mt-2 small" style={{ color: '#64748B' }}>
                {isAdmin || isSecurity ? 'Active security flags' : 'Awaiting gate arrival'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Traffic Analytics Graph (Daily, Monthly, Yearly) */}
      {(isAdmin || isMD || isSecurity || !isStaff) && (
        <TrafficAnalyticsChart
          visitors={recentVisitors}
          contractors={recentContractors}
          title={isAdmin ? 'Enterprise Traffic Trends (Daily / Monthly / Yearly)' : 'Facility Entry Trends & Analytics'}
          subtitle={isAdmin ? 'Real-time aggregated visual metrics of incoming visitors and contractors across selected time horizons' : 'Monitoring entry volume patterns'}
        />
      )}

      {/* Main Content Sections */}
      <div className="row g-4">
        {/* Visitors Table */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm bg-white">
            <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center border-bottom">
              <h5 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                <i className="bi bi-people text-primary"></i>
                {isStaff ? 'My Visitor Registrations' : 'Recent Visitor Activity'}
              </h5>
              <button className="btn btn-link btn-sm text-decoration-none" onClick={() => onNavigate(isStaff ? 'my_visitors' : 'all_visitors')}>
                View All <i className="bi bi-arrow-right"></i>
              </button>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light small text-muted">
                  <tr>
                    <th>REGISTRATION #</th>
                    <th>VISITOR NAME</th>
                    <th>SCHEDULED TIME</th>
                    <th>VENUE</th>
                    <th>STATUS</th>
                    {canSeePassBadge && <th>PASS / ACTION</th>}
                  </tr>
                </thead>
                <tbody>
                  {recentVisitors.length === 0 ? (
                    <tr>
                      <td colSpan={canSeePassBadge ? 6 : 5} className="text-center py-4 text-muted">No visitor records found.</td>
                    </tr>
                  ) : (
                    recentVisitors.slice(0, 5).map((v) => {
                      const overstayInfo = calculateOverstayInfo(v, now);
                      const isOverstaying = canSeeOverstay && v.status === 'CHECKED_IN' && overstayInfo.isOverstay;
                      return (
                        <tr key={v.id} className={isOverstaying ? 'table-danger bg-danger bg-opacity-10' : ''}>
                          <td className="font-monospace fw-bold text-dark small">{v.registrationNo}</td>
                          <td>
                            <div className="fw-semibold text-dark">{v.fullName}</div>
                            <div className="text-muted small">{v.companyName}</div>
                          </td>
                          <td className="small font-monospace">
                            <div className="text-primary fw-semibold">
                              <i className="bi bi-clock me-1"></i>
                              {v.scheduledStartTime || '09:00'} – {v.scheduledEndTime || '12:00'}
                            </div>
                            {isOverstaying && (
                              <span className="badge bg-danger text-white border px-1.5 py-0.5 mt-1 font-monospace d-inline-flex align-items-center gap-1" style={{ fontSize: '0.7rem' }}>
                                <i className="bi bi-alarm-fill animate-pulse"></i> +{overstayInfo.formattedLiveTimer}
                              </span>
                            )}
                            {canSeeOverstay && v.status === 'CHECKED_OUT' && (v.exceededMinutes || 0) > 0 && (
                              <span className="badge bg-warning text-dark border px-1.5 py-0.5 mt-1 font-monospace d-inline-flex align-items-center gap-1" style={{ fontSize: '0.7rem' }}>
                                <i className="bi bi-clock-history"></i> +{v.exceededMinutes}m overstay
                              </span>
                            )}
                          </td>
                          <td className="small text-dark">{v.meetingVenueName}</td>
                          <td>
                            <span className={`badge rounded-pill ${
                              v.status === 'CHECKED_IN' ? (isOverstaying ? 'bg-danger' : 'bg-success') :
                              v.status === 'CHECKED_OUT' ? 'bg-secondary' :
                              v.status === 'SCHEDULED' ? 'bg-primary' : 'bg-danger'
                            }`}>
                              {isOverstaying ? 'OVERSTAY' : v.status}
                            </span>
                          </td>
                          {canSeePassBadge && (
                            <td>
                              {v.passBadgeNumber ? (
                                <button className="btn btn-sm btn-outline-dark font-monospace py-0 px-2" onClick={() => onOpenBadge(v, 'VISITOR')}>
                                  <i className="bi bi-pass me-1"></i> {v.passBadgeNumber}
                                </button>
                              ) : (
                                <span className="text-muted small">Not Issued</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Contractors Table */}
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm bg-white">
            <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center border-bottom">
              <h5 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                <i className="bi bi-tools text-info"></i>
                {isStaff ? 'My Contractors' : 'Active Contractor Work Orders'}
              </h5>
              <button className="btn btn-link btn-sm text-decoration-none" onClick={() => onNavigate(isStaff ? 'my_contractors' : 'all_contractors')}>
                View All <i className="bi bi-arrow-right"></i>
              </button>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light small text-muted">
                  <tr>
                    <th>NAME & COMPANY</th>
                    <th>WORK ORDER</th>
                    <th>STATUS</th>
                    {canSeePassBadge && <th>PASS</th>}
                  </tr>
                </thead>
                <tbody>
                  {recentContractors.length === 0 ? (
                    <tr>
                      <td colSpan={canSeePassBadge ? 4 : 3} className="text-center py-4 text-muted">No contractor records found.</td>
                    </tr>
                  ) : (
                    recentContractors.slice(0, 5).map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div className="fw-semibold text-dark small">{c.fullName}</div>
                          <div className="text-muted small" style={{ fontSize: '0.75rem' }}>{c.companyName}</div>
                        </td>
                        <td className="font-monospace small">{c.workOrderNo}</td>
                        <td>
                          <span className={`badge rounded-pill ${
                            c.status === 'CHECKED_IN' ? 'bg-success' : 'bg-primary'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        {canSeePassBadge && (
                          <td>
                            {c.passBadgeNumber ? (
                              <button className="btn btn-sm btn-outline-dark font-monospace py-0 px-2" onClick={() => onOpenBadge(c, 'CONTRACTOR')}>
                                <i className="bi bi-pass me-1"></i> {c.passBadgeNumber}
                              </button>
                            ) : (
                              <span className="text-muted small">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
