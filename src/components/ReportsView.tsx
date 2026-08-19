import React, { useEffect, useState } from 'react';
import { User, Visitor, Contractor } from '../types';
import { getVisitors, getContractors, getReportsSummary } from '../lib/api';
import { canViewOverstay } from '../lib/overstayUtils';
import { TrafficAnalyticsChart } from './TrafficAnalyticsChart';

interface ReportsViewProps {
  currentUser: User;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ currentUser }) => {
  const [summary, setSummary] = useState<any>(null);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);

  const hasOverstayPermission = canViewOverstay(currentUser.role);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [sumRes, vRes, cRes] = await Promise.all([
          getReportsSummary(),
          getVisitors(),
          getContractors()
        ]);
        setSummary(sumRes);
        setVisitors(vRes);
        setContractors(cRes);
      } catch (err) {
        console.error('Error loading reports:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const overstayedVisitors = visitors.filter(v => (v.exceededMinutes || 0) > 0);
  const totalExceededMinutes = overstayedVisitors.reduce((acc, curr) => acc + (curr.exceededMinutes || 0), 0);

  const handleExportCSV = () => {
    const headers = [
      'Registration No', 'Visitor Name', 'Company', 'Host', 'Department', 'Venue', 
      'Sched Start', 'Sched End', 'Status', 'Pass Badge', 'Check-In Time', 'Check-In Security Officer', 'Check-Out Time', 'Check-Out Security Officer'
    ];
    if (hasOverstayPermission) {
      headers.push('Exceeded Minutes', 'Overstay Notes');
    }

    const rows = visitors.map(v => {
      const row = [
        v.registrationNo,
        `"${v.fullName}"`,
        `"${v.companyName}"`,
        `"${v.hostUserName}"`,
        `"${v.hostDepartment}"`,
        `"${v.meetingVenueName}"`,
        v.scheduledStartTime || '09:00',
        v.scheduledEndTime || '12:00',
        v.status,
        v.passBadgeNumber || '',
        v.checkInTime || '',
        `"${v.checkInSecurityUserName || '—'}"`,
        v.checkOutTime || '',
        `"${v.checkOutSecurityUserName || '—'}"`
      ];
      if (hasOverstayPermission) {
        row.push((v.exceededMinutes || 0).toString(), `"${v.overstayNotes || ''}"`);
      }
      return row;
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `VMS_Visitor_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading || !summary) {
    return <div className="p-4 text-center my-5"><div className="spinner-border text-primary"></div></div>;
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom gap-3">
        <div>
          <h3 className="fw-extrabold text-dark mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-file-earmark-bar-graph-fill text-primary"></i>
            Enterprise VMS Reports &amp; Export Station
          </h3>
          <p className="text-muted mb-0 small">Generate, analyze, and export visitor traffic, department metrics, and contractor compliance data.</p>
        </div>

        <div className="d-flex gap-2">
          <button className="btn btn-outline-success fw-bold d-flex align-items-center gap-1 shadow-sm" onClick={handleExportCSV}>
            <i className="bi bi-file-earmark-excel-fill"></i> Export CSV Report
          </button>
        </div>
      </div>

      {/* Analytics Summary Grid */}
      <div className="row g-3 mb-4 print-metrics-row">
        <div className="col-md-3 print-metrics-col">
          <div className="card border-0 shadow-sm bg-white p-3 border-start border-4 border-primary h-100">
            <div className="text-muted small text-uppercase font-monospace fw-bold">TOTAL TODAY VISITORS</div>
            <div className="fs-2 fw-extrabold text-dark">{summary.totalVisitorsToday}</div>
          </div>
        </div>
        <div className="col-md-3 print-metrics-col">
          <div className="card border-0 shadow-sm bg-white p-3 border-start border-4 border-info h-100">
            <div className="text-muted small text-uppercase font-monospace fw-bold">TOTAL TODAY CONTRACTORS</div>
            <div className="fs-2 fw-extrabold text-dark">{summary.totalContractorsToday}</div>
          </div>
        </div>
        <div className="col-md-3 print-metrics-col">
          <div className="card border-0 shadow-sm bg-white p-3 border-start border-4 border-success h-100">
            <div className="text-muted small text-uppercase font-monospace fw-bold">CURRENTLY ON-PREMISE</div>
            <div className="fs-2 fw-extrabold text-success">{summary.onPremiseVisitorsCount + summary.onPremiseContractorsCount}</div>
          </div>
        </div>
        <div className="col-md-3 print-metrics-col">
          <div className="card border-0 shadow-sm bg-white p-3 border-start border-4 border-danger h-100">
            <div className="text-danger small text-uppercase font-monospace fw-bold d-flex align-items-center justify-content-between">
              <span>RECORDED OVERSTAYS</span>
              <i className="bi bi-alarm-fill"></i>
            </div>
            <div className="fs-2 fw-extrabold text-danger">{overstayedVisitors.length} <span className="fs-6 fw-normal text-muted">({totalExceededMinutes}m total)</span></div>
          </div>
        </div>
      </div>

      {/* Traffic Trend Visualizer */}
      <TrafficAnalyticsChart
        visitors={visitors}
        contractors={contractors}
        title="Historical & Current Traffic Dynamics"
        subtitle="Time-series comparative reporting across Daily (7/14/30 days), Monthly (12 months), and Yearly (5 years) periods"
      />

      {/* Detailed Report Table (Excluded from Print Summary) */}
      <div id="printableReport" className="card border-0 shadow-sm bg-white d-print-none">
        <div className="card-header bg-dark text-white py-3 fw-bold d-flex justify-content-between align-items-center">
          <span>Enterprise Master Visitor Traffic Log</span>
          <span className="font-monospace small">Generated: {new Date().toISOString().replace('T', ' ').substring(0, 19)}</span>
        </div>

        <div className="table-responsive">
          <table className="table table-bordered align-middle mb-0">
            <thead className="table-light small">
              <tr>
                <th>REG #</th>
                <th>VISITOR NAME</th>
                <th>COMPANY</th>
                <th>HOST & DEPT</th>
                <th>VENUE</th>
                <th>SCHED START</th>
                <th>SCHED END</th>
                <th>STATUS</th>
                <th>BADGE #</th>
                <th>CHECK-IN</th>
                <th>CHECK-IN SECURITY</th>
                <th>CHECK-OUT</th>
                <th>CHECK-OUT SECURITY</th>
                {hasOverstayPermission && <th>EXCEEDED TIME</th>}
              </tr>
            </thead>
            <tbody>
              {visitors.map(v => (
                <tr key={v.id} className={hasOverstayPermission && (v.exceededMinutes || 0) > 0 ? 'table-warning' : ''}>
                  <td className="font-monospace small fw-bold">{v.registrationNo}</td>
                  <td className="fw-bold text-dark">{v.fullName}</td>
                  <td className="small text-secondary">{v.companyName}</td>
                  <td className="small">{v.hostUserName} ({v.hostDepartment})</td>
                  <td className="small">
                    <div>{v.approvedVenueName || v.meetingVenueName}</div>
                    {v.approvalRemark && (
                      <div className="text-muted font-monospace fst-italic mt-0.5" style={{ fontSize: '0.68rem' }}>
                        MD: {v.approvalRemark}
                      </div>
                    )}
                  </td>
                  <td className="font-monospace small text-primary fw-bold">{v.scheduledStartTime || '09:00'}</td>
                  <td className="font-monospace small text-primary fw-bold">{v.scheduledEndTime || '12:00'}</td>
                  <td><span className="badge bg-secondary">{v.status}</span></td>
                  <td className="font-monospace small fw-bold">{v.passBadgeNumber || '—'}</td>
                  <td className="font-monospace small text-muted">{v.checkInTime || '—'}</td>
                  <td className="small text-dark font-monospace">
                    {v.checkInSecurityUserName ? (
                      <span className="badge bg-light text-dark border">
                        <i className="bi bi-shield-check text-success me-1"></i>
                        {v.checkInSecurityUserName}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="font-monospace small text-muted">{v.checkOutTime || '—'}</td>
                  <td className="small text-dark font-monospace">
                    {v.checkOutSecurityUserName ? (
                      <span className="badge bg-light text-dark border">
                        <i className="bi bi-shield-x text-danger me-1"></i>
                        {v.checkOutSecurityUserName}
                      </span>
                    ) : '—'}
                  </td>
                  {hasOverstayPermission && (
                    <td>
                      {(v.exceededMinutes || 0) > 0 ? (
                        <span className="badge bg-warning text-dark font-monospace fw-bold">
                          +{v.exceededMinutes} mins
                        </span>
                      ) : (
                        <span className="text-muted small">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
