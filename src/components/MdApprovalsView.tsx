import React, { useState, useEffect } from 'react';
import { Visitor, Contractor, User, MeetingVenue, CONDITIONAL_REMARK_PRESETS } from '../types';
import { getVisitors, getContractors, approveVisitor, rejectVisitor, approveContractor, rejectContractor, getMeetingVenues } from '../lib/api';
import { NotificationModal } from './notification';
import { formatExecutiveDateTime, formatDisplayDate, formatDisplayDateTime } from '../lib/dateUtils';

const formatRequestDateTime = (dateStr?: string | null) => {
  return formatExecutiveDateTime(dateStr);
};

interface MdApprovalsViewProps {
  currentUser: User;
  visitors?: Visitor[];
  contractors?: Contractor[];
  onApproveVisitor?: (visitorId: string) => Promise<void>;
  onRejectVisitor?: (visitorId: string, reason: string) => Promise<void>;
  onApproveContractor?: (contractorId: string) => Promise<void>;
  onRejectContractor?: (contractorId: string, reason: string) => Promise<void>;
  onRefresh?: () => void;
}

export const MdApprovalsView: React.FC<MdApprovalsViewProps> = ({
  currentUser,
  visitors: initialVisitors,
  contractors: initialContractors,
  onApproveVisitor,
  onRejectVisitor,
  onApproveContractor,
  onRejectContractor,
  onRefresh,
}) => {
  const [visitors, setVisitors] = useState<Visitor[]>(initialVisitors || []);
  const [contractors, setContractors] = useState<Contractor[]>(initialContractors || []);
  const [meetingVenues, setMeetingVenues] = useState<MeetingVenue[]>([]);
  const [loading, setLoading] = useState<boolean>(!initialVisitors || !initialContractors);
  const [delegationInfo, setDelegationInfo] = useState<any>(null);

  const loadData = async () => {
    try {
      const [vList, cList, mvList] = await Promise.all([getVisitors(), getContractors(), getMeetingVenues()]);
      setVisitors(vList);
      setContractors(cList);
      setMeetingVenues(mvList || []);

      // Check delegation status
      try {
        const res = await fetch('/api/vms/email/settings');
        if (res.ok) {
          const data = await res.json();
          setDelegationInfo(data?.settings || null);
        }
      } catch {}
    } catch (err: any) {
      console.error('Failed to load pending approval lists:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  // Check if currentUser is authorized to access approval portal (Strictly MD or designated sub/backup approver)
  const isDelegationActive = Boolean(delegationInfo?.EnableDelegation);
  const isBackupApprover = isDelegationActive && (
    delegationInfo?.BackupApproverUserId === currentUser.id ||
    (delegationInfo?.BackupApproverEmail && currentUser.email && delegationInfo.BackupApproverEmail.toLowerCase().includes(currentUser.email.toLowerCase()))
  );
  const isAuthorized = currentUser.role === 'MANAGING_DIRECTOR' || isBackupApprover;

  if (!loading && !isAuthorized) {
    return (
      <div className="container-fluid p-4">
        <div className="alert alert-danger border-2 border-danger bg-danger bg-opacity-10 d-flex align-items-center gap-3 p-4 rounded-3 shadow-sm">
          <i className="bi bi-shield-x fs-1 text-danger"></i>
          <div>
            <h5 className="fw-bold text-danger mb-1 font-monospace">ACCESS RESTRICTED: EXECUTIVE CONTROL PORTAL</h5>
            <p className="mb-0 text-dark">
              The <strong>Executive Control Portal & Visit & Contractor Approval Center</strong> is strictly reserved for the <strong>Managing Director</strong> or an authorized <strong>Acting / Backup Approver</strong>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [filterType, setFilterType] = useState<'ALL' | 'VISITOR' | 'CONTRACTOR'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const [rejectingItem, setRejectingItem] = useState<{ id: string; type: 'VISITOR' | 'CONTRACTOR'; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  
  const [approvingItem, setApprovingItem] = useState<{
    id: string;
    type: 'VISITOR' | 'CONTRACTOR';
    name: string;
    companyName?: string;
    currentVenueId?: string;
    currentVenueName?: string;
    requestedBy?: string;
  } | null>(null);

  const [selectedPresetRemark, setSelectedPresetRemark] = useState<string>(CONDITIONAL_REMARK_PRESETS[0]);
  const [customRemark, setCustomRemark] = useState<string>('');
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [approvalPopup, setApprovalPopup] = useState<{ isOpen: boolean; message: string } | null>(null);

  const handleOpenApproveModal = (
    id: string,
    type: 'VISITOR' | 'CONTRACTOR',
    name: string,
    companyName?: string,
    currentVenueId?: string,
    currentVenueName?: string,
    requestedBy?: string
  ) => {
    setApprovingItem({ id, type, name, companyName, currentVenueId, currentVenueName, requestedBy });
    setSelectedPresetRemark(CONDITIONAL_REMARK_PRESETS[0]);
    setCustomRemark('');
    setSelectedVenueId(currentVenueId || '');
  };

  const handleConfirmApprovalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingItem) return;

    const { id, type, name } = approvingItem;
    setActionLoadingId(id);
    setFeedbackMessage(null);

    let finalRemark = '';
    if (selectedPresetRemark !== 'Standard Approval - No Special Restrictions') {
      if (selectedPresetRemark === 'Custom Location / Approval Remark...') {
        finalRemark = customRemark.trim();
      } else {
        finalRemark = selectedPresetRemark + (customRemark.trim() ? `: ${customRemark.trim()}` : '');
      }
    } else {
      finalRemark = customRemark.trim();
    }

    const venueObj = meetingVenues.find(v => v.id === selectedVenueId);
    const approvedVenueName = venueObj ? venueObj.name : approvingItem.currentVenueName;

    try {
      const payload = {
        approvalRemark: finalRemark || undefined,
        approvedVenueId: selectedVenueId || approvingItem.currentVenueId,
        approvedVenueName: approvedVenueName || approvingItem.currentVenueName
      };

      if (type === 'VISITOR') {
        if (onApproveVisitor) {
          await onApproveVisitor(id);
        } else {
          await approveVisitor(id, payload);
        }
        setFeedbackMessage({ text: `Visit request for ${name} approved!`, type: 'success' });
        setApprovalPopup({ isOpen: true, message: `Successfully approved! Visit authorization for ${name} has been approved.` });
      } else {
        if (onApproveContractor) {
          await onApproveContractor(id);
        } else {
          await approveContractor(id, payload);
        }
        setFeedbackMessage({ text: `Work permit for ${name} approved!`, type: 'success' });
        setApprovalPopup({ isOpen: true, message: `Successfully approved! Work permit for ${name} has been approved.` });
      }

      setApprovingItem(null);
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || 'Failed to approve request.', type: 'error' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter Visitors
  const pendingVisitors = (visitors || []).filter(v => {
    if (activeTab === 'PENDING') return v.status === 'PENDING_APPROVAL' || v.approvalStatus === 'PENDING';
    if (activeTab === 'APPROVED') return v.approvalStatus === 'APPROVED';
    if (activeTab === 'REJECTED') return v.status === 'REJECTED' || v.approvalStatus === 'REJECTED';
    return true;
  });

  // Filter Contractors
  const pendingContractors = (contractors || []).filter(c => {
    if (activeTab === 'PENDING') return c.status === 'PENDING_APPROVAL' || c.approvalStatus === 'PENDING';
    if (activeTab === 'APPROVED') return c.approvalStatus === 'APPROVED';
    if (activeTab === 'REJECTED') return c.status === 'REJECTED' || c.approvalStatus === 'REJECTED';
    return true;
  });

  const matchesSearch = (text: string) => text.toLowerCase().includes(searchQuery.trim().toLowerCase());

  const filteredVisitors = (filterType === 'ALL' || filterType === 'VISITOR')
    ? pendingVisitors.filter(v => !searchQuery || matchesSearch(v.fullName) || matchesSearch(v.registrationNo) || matchesSearch(v.companyName || '') || matchesSearch(v.hostUserName || ''))
    : [];

  const filteredContractors = (filterType === 'ALL' || filterType === 'CONTRACTOR')
    ? pendingContractors.filter(c => !searchQuery || matchesSearch(c.fullName) || matchesSearch(c.registrationNo) || matchesSearch(c.companyName || '') || matchesSearch(c.workOrderNo || '') || matchesSearch(c.hostUserName || ''))
    : [];

  const handleApproveV = async (id: string, name: string) => {
    setActionLoadingId(id);
    setFeedbackMessage(null);
    try {
      if (onApproveVisitor) {
        await onApproveVisitor(id);
      } else {
        await approveVisitor(id);
      }
      setFeedbackMessage({ text: `Visit authorization for ${name} approved!`, type: 'success' });
      setApprovalPopup({ isOpen: true, message: `Successfully approved! Visit authorization for ${name} has been approved.` });
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || 'Failed to approve visitor.', type: 'error' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApproveC = async (id: string, name: string) => {
    setActionLoadingId(id);
    setFeedbackMessage(null);
    try {
      if (onApproveContractor) {
        await onApproveContractor(id);
      } else {
        await approveContractor(id);
      }
      setFeedbackMessage({ text: `Work permit for ${name} approved!`, type: 'success' });
      setApprovalPopup({ isOpen: true, message: `Successfully approved! Work permit for ${name} has been approved.` });
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || 'Failed to approve contractor.', type: 'error' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBatchApproveAll = async () => {
    if (!window.confirm('Are you sure you want to approve ALL pending visitor and contractor requests?')) return;
    setBatchLoading(true);
    setFeedbackMessage(null);
    try {
      const vToApprove = visitors.filter(v => v.status === 'PENDING_APPROVAL');
      const cToApprove = contractors.filter(c => c.status === 'PENDING_APPROVAL');
      
      // Approve all visitor primary requests
      for (const v of vToApprove) {
        if (onApproveVisitor) await onApproveVisitor(v.id);
        else await approveVisitor(v.id);
      }
      // Approve all contractor requests
      for (const c of cToApprove) {
        if (onApproveContractor) await onApproveContractor(c.id);
        else await approveContractor(c.id);
      }

      setFeedbackMessage({ text: `Batch Approved! ${vToApprove.length} visitor group(s) and ${cToApprove.length} contractor permit(s) authorized.`, type: 'success' });
      setApprovalPopup({ isOpen: true, message: `Successfully approved! All pending visitor (${vToApprove.length}) and contractor (${cToApprove.length}) requests have been approved.` });
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || 'Batch approval completed with warnings.', type: 'error' });
    } finally {
      setBatchLoading(false);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingItem) return;
    
    setActionLoadingId(rejectingItem.id);
    setFeedbackMessage(null);
    try {
      if (rejectingItem.type === 'VISITOR') {
        if (onRejectVisitor) await onRejectVisitor(rejectingItem.id, rejectReason);
        else await rejectVisitor(rejectingItem.id, rejectReason);
      } else {
        if (onRejectContractor) await onRejectContractor(rejectingItem.id, rejectReason);
        else await rejectContractor(rejectingItem.id, rejectReason);
      }
      setFeedbackMessage({ text: `${rejectingItem.type === 'VISITOR' ? 'Visitor request' : 'Contractor work permit'} rejected.`, type: 'success' });
      setRejectingItem(null);
      setRejectReason('');
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || 'Failed to reject request.', type: 'error' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Group visitors by registrationNo
  const visitorGroupsMap = new Map<string, Visitor[]>();
  filteredVisitors.forEach(v => {
    const key = v.registrationNo || v.id;
    if (!visitorGroupsMap.has(key)) {
      visitorGroupsMap.set(key, []);
    }
    visitorGroupsMap.get(key)!.push(v);
  });

  const visitorGroups = Array.from(visitorGroupsMap.entries()).map(([regNo, group]) => ({
    registrationNo: regNo,
    companyName: group[0].companyName || 'Guest Organization',
    primaryVisitor: group[0],
    visitors: group,
    totalCount: group.length,
    status: group[0].status,
    approvalStatus: group[0].approvalStatus,
    approvedByUserName: group[0].approvedByUserName,
    approvedAt: group[0].approvedAt,
    rejectionReason: group[0].rejectionReason
  }));

  const pendingVisitorCount = visitors.filter(v => v.status === 'PENDING_APPROVAL').length;
  const pendingContractorCount = contractors.filter(c => c.status === 'PENDING_APPROVAL').length;
  const totalPendingCount = pendingVisitorCount + pendingContractorCount;

  return (
    <div className="container-fluid p-4" style={{ maxWidth: '1400px' }}>
      {/* EXECUTIVE HEADER BANNER */}
      <div className="card border-0 shadow-sm overflow-hidden mb-4" style={{ background: 'linear-gradient(135deg, #2E1065 0%, #4C1D95 60%, #6D28D9 100%)', borderRadius: '16px' }}>
        <div className="card-body p-4 text-white">
          <div className="row align-items-center g-3">
            <div className="col-lg-7">
              
              <h2 className="fw-extrabold mb-1 tracking-tight text-white">Pending Approval Center</h2>
              
            </div>

            <div className="col-lg-5">
              <div className="d-flex flex-wrap align-items-center justify-content-lg-end gap-2">
                {/* Executive Counters */}
                <div className="bg-white bg-opacity-10 backdrop-blur rounded-3 p-3 text-center border border-white border-opacity-20 flex-fill" style={{ minWidth: '110px' }}>
                  <div className="fs-3 fw-black text-warning lh-1 mb-1">{totalPendingCount}</div>
                  <div className="text-uppercase text-white-50 font-monospace" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>Total Pending</div>
                </div>
                <div className="bg-white bg-opacity-10 backdrop-blur rounded-3 p-3 text-center border border-white border-opacity-20 flex-fill" style={{ minWidth: '110px' }}>
                  <div className="fs-3 fw-black text-info lh-1 mb-1">{pendingVisitorCount}</div>
                  <div className="text-uppercase text-white-50 font-monospace" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>Visitors</div>
                </div>
                <div className="bg-white bg-opacity-10 backdrop-blur rounded-3 p-3 text-center border border-white border-opacity-20 flex-fill" style={{ minWidth: '110px' }}>
                  <div className="fs-3 fw-black text-amber-300 lh-1 mb-1" style={{ color: '#FCD34D' }}>{pendingContractorCount}</div>
                  <div className="text-uppercase text-white-50 font-monospace" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>Contractors</div>
                </div>

                {/* Batch Approve Button */}
                {totalPendingCount > 0 && activeTab === 'PENDING' && (
                  <div className="w-100 mt-2">
                    <button
                      className="btn btn-warning text-dark w-100 fw-extrabold shadow-sm py-2 d-flex align-items-center justify-content-center gap-2"
                      onClick={handleBatchApproveAll}
                      disabled={batchLoading}
                    >
                      {batchLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1"></span> Processing Authorizations...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check-all fs-5"></i> One-Tap Approve All ({totalPendingCount} Requests)
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FEEDBACK ALERT */}
      {feedbackMessage && (
        <div className={`alert alert-${feedbackMessage.type === 'success' ? 'success' : 'danger'} border-2 alert-dismissible fade show d-flex align-items-center justify-content-between mb-4 shadow-sm rounded-3`}>
          <div className="d-flex align-items-center gap-2">
            <i className={`bi bi-${feedbackMessage.type === 'success' ? 'check-circle-fill text-success' : 'exclamation-triangle-fill text-danger'} fs-4`}></i>
            <span className="fw-semibold">{feedbackMessage.text}</span>
          </div>
          <button type="button" className="btn-close" onClick={() => setFeedbackMessage(null)}></button>
        </div>
      )}

      {/* DELEGATION ACTIVE NOTIFICATION BANNER */}
      {isDelegationActive && (
        <div className="alert alert-warning border-2 border-warning bg-warning bg-opacity-10 d-flex align-items-center justify-content-between mb-4 p-3 rounded-3 shadow-sm">
          <div className="d-flex align-items-center gap-3">
            <i className="bi bi-person-gear fs-2 text-warning"></i>
            <div>
              <div className="fw-bold text-dark d-flex align-items-center gap-2">
                <span>Executive Delegation In Effect</span>
                <span className="badge bg-warning text-dark font-monospace">ACTING APPROVER ACTIVE</span>
              </div>
              <div className="extra-small text-muted">
                Assigned Secondary Approver: <strong>{delegationInfo?.BackupApproverName || delegationInfo?.BackupApproverEmail || 'Acting Approver'}</strong> ({delegationInfo?.BackupApproverEmail})
                {delegationInfo?.DelegationReason && <> • <em>Reason: {delegationInfo.DelegationReason}</em></>}
                {delegationInfo?.DelegationStartDate && <> • <em>From: {delegationInfo.DelegationStartDate}</em></>}
                {delegationInfo?.DelegationEndDate && <> • <em>To: {delegationInfo.DelegationEndDate}</em></>}
              </div>
            </div>
          </div>
          <div className="text-end">
            <span className="badge bg-dark text-white px-2 py-1 extra-small">
              Routing: {delegationInfo?.DelegationRoutingMode === 'BACKUP_ONLY' ? 'Backup Only' : 'Dual (MD + Backup)'}
            </span>
          </div>
        </div>
      )}

      {/* FILTER & TABS BAR */}
      <div className="card border-0 shadow-sm mb-4 rounded-3 bg-white">
        <div className="card-body p-3">
          <div className="row g-2 align-items-center">
            {/* Status Tabs */}
            <div className="col-lg-6 col-md-12">
              <div className="btn-group w-100" role="group">
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'PENDING' ? 'btn-primary fw-bold text-white shadow-sm' : 'btn-light text-secondary'}`}
                  onClick={() => setActiveTab('PENDING')}
                >
                  <i className="bi bi-clock-history me-1"></i> Pending Review ({totalPendingCount})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'APPROVED' ? 'btn-success fw-bold text-white shadow-sm' : 'btn-light text-secondary'}`}
                  onClick={() => setActiveTab('APPROVED')}
                >
                  <i className="bi bi-check-circle me-1"></i> Approved
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'REJECTED' ? 'btn-danger fw-bold text-white shadow-sm' : 'btn-light text-secondary'}`}
                  onClick={() => setActiveTab('REJECTED')}
                >
                  <i className="bi bi-x-circle me-1"></i> Rejected
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'ALL' ? 'btn-dark fw-bold text-white shadow-sm' : 'btn-light text-secondary'}`}
                  onClick={() => setActiveTab('ALL')}
                >
                  All History
                </button>
              </div>
            </div>

            {/* Type Filter */}
            <div className="col-lg-3 col-md-6">
              <select
                className="form-select form-select-sm border"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
              >
                <option value="ALL">All Categories (Visitors & Contractors)</option>
                <option value="VISITOR">Visitors Only</option>
                <option value="CONTRACTOR">Contractors Only</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="col-lg-3 col-md-6">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light border-end-0"><i className="bi bi-search text-muted"></i></span>
                <input
                  type="text"
                  className="form-control bg-light border-start-0"
                  placeholder="Quick search company, WO, host..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => setSearchQuery('')}>
                    <i className="bi bi-x"></i>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: VISITOR DELEGATION CARDS */}
      {(filterType === 'ALL' || filterType === 'VISITOR') && visitorGroups.length > 0 && (
        <div className="mb-5">
          <div className="d-flex align-items-center justify-content-between mb-3 px-1">
            <h5 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
              <i className="bi bi-building-check text-primary fs-4"></i>
              Company Visit Requests ({visitorGroups.length})
            </h5>
          
          </div>

          <div className="row g-3">
            {visitorGroups.map(grp => {
              const isPending = grp.status === 'PENDING_APPROVAL' || grp.approvalStatus === 'PENDING';
              const isApproved = grp.approvalStatus === 'APPROVED';
              const isRejected = grp.status === 'REJECTED' || grp.approvalStatus === 'REJECTED';
              const isExpanded = expandedGroup === grp.registrationNo;
              const hasBlacklistAlert = grp.visitors.some(v => v.isBlacklistedAtRegistration);

              return (
                <div className="col-12 col-xl-6" key={grp.registrationNo}>
                  <div
                    className="card h-100 border-0 shadow-sm rounded-3 overflow-hidden position-relative"
                    style={{
                      borderLeft: `5px solid ${isPending ? '#F59E0B' : isRejected ? '#EF4444' : '#10B981'}`,
                      backgroundColor: '#FFFFFF'
                    }}
                  >
                    {/* Header bar */}
                    <div className="card-header bg-white pt-3 pb-2 px-3 border-bottom d-flex flex-wrap align-items-center justify-content-between gap-2">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace px-2.5 py-1 fw-bold">
                          <i className="bi bi-building me-1"></i> VISITOR DELEGATION
                        </span>
                        <span className="badge bg-light text-dark border font-monospace" title="Registration No">
                          REQ: {grp.registrationNo}
                        </span>
                        {hasBlacklistAlert && (
                          <span className="badge bg-danger text-white animate-pulse">
                            <i className="bi bi-shield-exclamation me-1"></i> SECURITY ALERT
                          </span>
                        )}
                      </div>

                      <span className={`badge rounded-pill px-3 py-1 fw-bold font-monospace ${
                        isPending ? 'bg-warning text-dark' :
                        isRejected ? 'bg-danger text-white' :
                        'bg-success text-white'
                      }`}>
                        {isPending ? 'PENDING MD APPROVAL' : grp.status}
                      </span>
                    </div>

                    {/* Executive Summary Body */}
                    <div className="card-body p-3">
                      {/* Big Company Title & Group Count */}
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div>
                          <h4 className="fw-extrabold text-dark mb-1">{grp.companyName}</h4>
                          <div className="text-muted small">
                            <i className="bi bi-people-fill text-primary me-1"></i>
                            <strong>{grp.totalCount} Visitor{grp.totalCount > 1 ? 's' : ''}</strong>: {grp.primaryVisitor.fullName} {grp.totalCount > 1 ? `+ ${grp.totalCount - 1} co-visitors` : ''}
                          </div>
                        </div>
                      </div>

                      {/* Clean Key Information Box */}
                      <div className="p-3 rounded-3 mb-3" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <div className="row g-2" style={{ fontSize: '0.85rem' }}>
                          <div className="col-12 pb-2 mb-1 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-1">
                            <span className="text-muted small">
                              <i className="bi bi-calendar-event text-primary me-1"></i>
                              Request Submitted Date &amp; Time:
                            </span>
                            <strong className="text-dark font-monospace" style={{ fontSize: '0.825rem' }}>
                              <i className="bi bi-clock-history text-primary me-1"></i>
                              {formatRequestDateTime(grp.primaryVisitor.createdAt)}
                            </strong>
                          </div>

                          <div className="col-6">
                            <span className="text-muted d-block small">Host Employee &amp; Dept:</span>
                            <strong className="text-dark d-block text-truncate">
                              <i className="bi bi-person-badge text-primary me-1"></i>{grp.primaryVisitor.hostUserName}
                            </strong>
                            <span className="text-muted small">{grp.primaryVisitor.hostDepartment || 'General'}</span>
                          </div>

                          <div className="col-6">
                            <span className="text-muted d-block small">Meeting Venue, Date &amp; Time:</span>
                            <strong className="text-dark d-block text-truncate">
                              <i className="bi bi-geo-alt text-danger me-1"></i>{grp.primaryVisitor.meetingVenueName}
                            </strong>
                            <div className="text-dark small d-flex flex-wrap align-items-center gap-2 mt-1">
                              <span className="badge bg-white text-dark border font-monospace py-1 px-1.5" style={{ fontSize: '0.78rem' }}>
                                <i className="bi bi-calendar3 text-primary me-1"></i>
                                {grp.primaryVisitor.scheduledEndDate && grp.primaryVisitor.scheduledEndDate !== grp.primaryVisitor.scheduledDate
                                  ? `${formatDisplayDate(grp.primaryVisitor.scheduledDate)} - ${formatDisplayDate(grp.primaryVisitor.scheduledEndDate)}`
                                  : formatDisplayDate(grp.primaryVisitor.scheduledDate)}
                              </span>
                              <span className="badge bg-white text-dark border font-monospace py-1 px-1.5" style={{ fontSize: '0.78rem' }}>
                                <i className="bi bi-clock text-primary me-1"></i>{grp.primaryVisitor.scheduledStartTime} - {grp.primaryVisitor.scheduledEndTime}
                              </span>
                            </div>
                          </div>

                          <div className="col-12 mt-2 pt-2 border-top">
                            <span className="text-muted d-block small">Purpose of Visit:</span>
                            <div className="fw-semibold text-dark" style={{ lineHeight: '1.35' }}>
                              {grp.primaryVisitor.purpose}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Security Clearance Strip */}
                      <div className="d-flex align-items-center justify-content-between p-2 rounded border mb-3 bg-white" style={{ fontSize: '0.825rem' }}>
                        <div className="d-flex align-items-center gap-1.5">
                          <i className="bi bi-shield-check text-success fs-5"></i>
                          <span className="fw-semibold text-dark">Security Screening:</span>
                          {hasBlacklistAlert ? (
                            <span className="badge bg-danger text-white">FLAGGED IN BLACKLIST</span>
                          ) : (
                            <span className="text-success fw-bold">CLEAR & VERIFIED</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline-secondary rounded-pill px-2"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => setExpandedGroup(isExpanded ? null : grp.registrationNo)}
                        >
                          <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} me-1`}></i>
                          {isExpanded ? 'Hide Attendees' : `View ${grp.totalCount} Attendees`}
                        </button>
                      </div>

                      {/* Expandable Attendees Detail Table */}
                      {isExpanded && (
                        <div className="mb-3 rounded-3 border bg-white overflow-hidden shadow-sm">
                          <div className="p-2 bg-light border-bottom fw-bold text-dark small d-flex justify-content-between">
                            <span>Delegation Attendees ({grp.totalCount})</span>
                            <span className="text-muted font-monospace">{grp.registrationNo}</span>
                          </div>
                          <div className="table-responsive" style={{ maxHeight: '200px' }}>
                            <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                              <thead className="table-light">
                                <tr>
                                  <th>#</th>
                                  <th>Name</th>
                                  <th>IC / Passport</th>
                                  <th>Phone</th>
                                  <th>Vehicle</th>
                                </tr>
                              </thead>
                              <tbody>
                                {grp.visitors.map((v, i) => (
                                  <tr key={v.id}>
                                    <td className="fw-bold font-monospace text-muted">{i + 1}</td>
                                    <td className="fw-bold text-dark">{v.fullName}</td>
                                    <td className="font-monospace text-muted">{v.idNumber}</td>
                                    <td>{v.phone || '-'}</td>
                                    <td>{v.vehicleNumber ? <span className="badge bg-secondary font-monospace">{v.vehicleNumber}</span> : '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Approved or Rejected Status Details */}
                      {isApproved && (
                        <div className="mb-2">
                          <div className="p-2.5 bg-success bg-opacity-10 border border-success border-opacity-25 rounded-3 text-success small d-flex align-items-center gap-2">
                            <i className="bi bi-check-circle-fill fs-5"></i>
                            <div>
                              <strong>Approved by Executive:</strong> {grp.approvedByUserName || 'Managing Director'} on {formatDisplayDateTime(grp.approvedAt)}
                            </div>
                          </div>
                          {(grp.primaryVisitor.isConditionalApproval || grp.primaryVisitor.approvalRemark || grp.primaryVisitor.approvedVenueName) && (
                            <div className="mt-2 p-2.5 bg-warning bg-opacity-10 border border-warning rounded-3 text-dark small">
                              <div className="fw-bold text-uppercase font-monospace text-warning-emphasis d-flex align-items-center gap-1">
                                <i className="bi bi-shield-lock-fill text-warning"></i> MD CONDITIONAL APPROVAL & REMARK
                              </div>
                              {grp.primaryVisitor.approvedVenueName && grp.primaryVisitor.approvedVenueName !== grp.primaryVisitor.meetingVenueName && (
                                <div className="text-danger fw-bold mt-1">
                                  <i className="bi bi-geo-alt-fill me-1"></i>
                                  Approved Venue Changed by MD: {grp.primaryVisitor.approvedVenueName} (Requested: {grp.primaryVisitor.meetingVenueName})
                                </div>
                              )}
                              {grp.primaryVisitor.approvalRemark && (
                                <div className="fst-italic text-dark mt-1">
                                  &quot;{grp.primaryVisitor.approvalRemark}&quot;
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {isRejected && (
                        <div className="p-2.5 bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded-3 text-danger small mb-2 d-flex align-items-center gap-2">
                          <i className="bi bi-x-circle-fill fs-5"></i>
                          <div>
                            <strong>Rejected:</strong> {grp.rejectionReason}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ONE-TAP ACTION BUTTONS FOR EXECUTIVE */}
                    {isPending && (
                      <div className="card-footer bg-white p-3 border-top d-flex gap-2">
                        <button
                          className="btn btn-success flex-fill py-2 fw-extrabold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                          style={{ borderRadius: '8px' }}
                          disabled={actionLoadingId === grp.primaryVisitor.id}
                          onClick={() => handleOpenApproveModal(
                            grp.primaryVisitor.id,
                            'VISITOR',
                            grp.companyName,
                            grp.companyName,
                            grp.primaryVisitor.meetingVenueId,
                            grp.primaryVisitor.meetingVenueName,
                            grp.primaryVisitor.hostUserName
                          )}
                        >
                          {actionLoadingId === grp.primaryVisitor.id ? (
                            <span className="spinner-border spinner-border-sm"></span>
                          ) : (
                            <>
                              <i className="bi bi-check-circle-fill fs-5"></i> Review &amp; Approve Visit
                            </>
                          )}
                        </button>
                        <button
                          className="btn btn-outline-danger py-2 px-3 fw-bold d-flex align-items-center justify-content-center gap-1.5"
                          style={{ borderRadius: '8px' }}
                          disabled={actionLoadingId === grp.primaryVisitor.id}
                          onClick={() => {
                            setRejectingItem({ id: grp.primaryVisitor.id, type: 'VISITOR', name: `${grp.companyName} (${grp.totalCount} Visitors)` });
                            setRejectReason('');
                          }}
                        >
                          <i className="bi bi-x-lg"></i> Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: CONTRACTOR WORK PERMIT CARDS */}
      {(filterType === 'ALL' || filterType === 'CONTRACTOR') && filteredContractors.length > 0 && (
        <div className="mb-5">
          <div className="d-flex align-items-center justify-content-between mb-3 px-1">
            <h5 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
              <i className="bi bi-tools text-amber-500 fs-4" style={{ color: '#D97706' }}></i>
              Contractor Work Orders ({filteredContractors.length})
            </h5>
           
          </div>

          <div className="row g-3">
            {filteredContractors.map(c => {
              const isPending = c.status === 'PENDING_APPROVAL' || c.approvalStatus === 'PENDING';
              const isApproved = c.approvalStatus === 'APPROVED';
              const isRejected = c.status === 'REJECTED' || c.approvalStatus === 'REJECTED';

              return (
                <div className="col-12 col-xl-6" key={c.id}>
                  <div
                    className="card h-100 border-0 shadow-sm rounded-3 overflow-hidden position-relative"
                    style={{
                      borderLeft: `5px solid ${isPending ? '#F59E0B' : isRejected ? '#EF4444' : '#10B981'}`,
                      backgroundColor: '#FFFFFF'
                    }}
                  >
                    {/* Header bar */}
                    <div className="card-header bg-white pt-3 pb-2 px-3 border-bottom d-flex flex-wrap align-items-center justify-content-between gap-2">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className="badge bg-amber-100 text-amber-900 border border-amber-300 font-monospace px-2.5 py-1 fw-bold" style={{ backgroundColor: '#FEF3C7', color: '#78350F' }}>
                          <i className="bi bi-tools me-1"></i> CONTRACTOR WORK PERMIT
                        </span>
                        <span className="badge bg-light text-dark border font-monospace">
                          WO: {c.workOrderNo}
                        </span>
                      </div>

                      <span className={`badge rounded-pill px-3 py-1 fw-bold font-monospace ${
                        isPending ? 'bg-warning text-dark' :
                        isRejected ? 'bg-danger text-white' :
                        'bg-success text-white'
                      }`}>
                        {isPending ? 'PENDING MD APPROVAL' : c.status}
                      </span>
                    </div>

                    {/* Executive Summary Body */}
                    <div className="card-body p-3">
                      {/* Big Contractor Name & Vendor */}
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div>
                          <h4 className="fw-extrabold text-dark mb-1">{c.fullName}</h4>
                          <div className="text-muted small">
                            <i className="bi bi-building me-1"></i>
                            <strong>{c.companyName}</strong> &bull; IC: <span className="font-monospace text-dark">{c.idNumber}</span>
                          </div>
                        </div>
                        <div className="text-end">
                          <span className="badge bg-secondary-subtle text-dark border px-2.5 py-1.5 font-monospace">
                            <i className="bi bi-tag me-1"></i> {c.contractorCategoryName || 'Technical'}
                          </span>
                        </div>
                      </div>

                      {/* Clean Key Information Box */}
                      <div className="p-3 rounded-3 mb-3" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <div className="row g-2" style={{ fontSize: '0.85rem' }}>
                          <div className="col-12 pb-2 mb-1 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-1">
                            <span className="text-muted small">
                              <i className="bi bi-calendar-event text-primary me-1"></i>
                              Request Submitted Date &amp; Time:
                            </span>
                            <strong className="text-dark font-monospace" style={{ fontSize: '0.825rem' }}>
                              <i className="bi bi-clock-history text-primary me-1"></i>
                              {formatRequestDateTime(c.createdAt)}
                            </strong>
                          </div>

                          <div className="col-6">
                            <span className="text-muted d-block small">Supervising Host:</span>
                            <strong className="text-dark d-block text-truncate">
                              <i className="bi bi-person-badge text-primary me-1"></i>{c.hostUserName}
                            </strong>
                            <span className="text-muted small">{c.hostDepartment || 'Maintenance / Operations'}</span>
                          </div>

                          <div className="col-6">
                            <span className="text-muted d-block small">Location / Venue:</span>
                            <strong className="text-dark d-block text-truncate">
                              <i className="bi bi-geo-alt text-danger me-1"></i>{c.locationVenueName}
                            </strong>
                            <div className="text-muted small">
                              <i className="bi bi-calendar-range me-1"></i>{formatDisplayDate(c.startDate)} to {formatDisplayDate(c.endDate)}
                              <span className="ms-2 font-monospace text-primary fw-bold"><i className="bi bi-clock me-1"></i>{c.startTime || '08:00'} – {c.endTime || '17:00'}</span>
                            </div>
                          </div>

                          <div className="col-12 mt-2 pt-2 border-top">
                            <span className="text-muted d-block small">Scope of Work:</span>
                            <div className="fw-semibold text-dark" style={{ lineHeight: '1.35' }}>
                              {c.workScope}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Safety Induction & Vehicle Strip */}
                      <div className="d-flex align-items-center justify-content-between p-2 rounded border mb-3 bg-white" style={{ fontSize: '0.825rem' }}>
                        <div className="d-flex align-items-center gap-1.5">
                          <i className="bi bi-shield-check text-success fs-5"></i>
                          <span className="fw-semibold text-dark">Safety Induction:</span>
                          {c.safetyInductionVerified ? (
                            <span className="badge bg-success text-white">VERIFIED PASS</span>
                          ) : (
                            <span className="badge bg-secondary text-white">PENDING VERIFICATION</span>
                          )}
                        </div>

                        {c.vehicleNumber ? (
                          <span className="badge bg-light text-dark border font-monospace">
                            <i className="bi bi-car-front me-1"></i> {c.vehicleNumber}
                          </span>
                        ) : (
                          <span className="text-muted small">No vehicle registered</span>
                        )}
                      </div>

                      {/* Status Messages */}
                      {isApproved && (
                        <div className="mb-2">
                          <div className="p-2.5 bg-success bg-opacity-10 border border-success border-opacity-25 rounded-3 text-success small d-flex align-items-center gap-2">
                            <i className="bi bi-check-circle-fill fs-5"></i>
                            <div>
                              <strong>Approved:</strong> {c.approvedByUserName || 'Executive'} on {formatDisplayDateTime(c.approvedAt)}
                            </div>
                          </div>
                          {(c.isConditionalApproval || c.approvalRemark || c.approvedVenueName) && (
                            <div className="mt-2 p-2.5 bg-warning bg-opacity-10 border border-warning rounded-3 text-dark small">
                              <div className="fw-bold text-uppercase font-monospace text-warning-emphasis d-flex align-items-center gap-1">
                                <i className="bi bi-shield-lock-fill text-warning"></i> MD CONDITIONAL APPROVAL & REMARK
                              </div>
                              {c.approvedVenueName && c.approvedVenueName !== c.locationVenueName && (
                                <div className="text-danger fw-bold mt-1">
                                  <i className="bi bi-geo-alt-fill me-1"></i>
                                  Approved Venue Changed by MD: {c.approvedVenueName} (Requested: {c.locationVenueName})
                                </div>
                              )}
                              {c.approvalRemark && (
                                <div className="fst-italic text-dark mt-1">
                                  &quot;{c.approvalRemark}&quot;
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {isRejected && (
                        <div className="p-2.5 bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded-3 text-danger small mb-2 d-flex align-items-center gap-2">
                          <i className="bi bi-x-circle-fill fs-5"></i>
                          <div>
                            <strong>Rejected:</strong> {c.rejectionReason}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ONE-TAP ACTION BUTTONS FOR EXECUTIVE */}
                    {isPending && (
                      <div className="card-footer bg-white p-3 border-top d-flex gap-2">
                        <button
                          className="btn btn-success flex-fill py-2 fw-extrabold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                          style={{ borderRadius: '8px' }}
                          disabled={actionLoadingId === c.id}
                          onClick={() => handleOpenApproveModal(
                            c.id,
                            'CONTRACTOR',
                            `${c.fullName} (${c.companyName})`,
                            c.companyName,
                            c.locationVenueId,
                            c.locationVenueName,
                            c.hostUserName
                          )}
                        >
                          {actionLoadingId === c.id ? (
                            <span className="spinner-border spinner-border-sm"></span>
                          ) : (
                            <>
                              <i className="bi bi-check-circle-fill fs-5"></i> Review &amp; Approve Work Order
                            </>
                          )}
                        </button>
                        <button
                          className="btn btn-outline-danger py-2 px-3 fw-bold d-flex align-items-center justify-content-center gap-1.5"
                          style={{ borderRadius: '8px' }}
                          disabled={actionLoadingId === c.id}
                          onClick={() => {
                            setRejectingItem({ id: c.id, type: 'CONTRACTOR', name: `${c.fullName} (${c.companyName})` });
                            setRejectReason('');
                          }}
                        >
                          <i className="bi bi-x-lg"></i> Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {filteredVisitors.length === 0 && filteredContractors.length === 0 && (
        <div className="card border-0 shadow-sm p-5 text-center bg-white rounded-3">
          <div className="card-body">
            <i className="bi bi-check2-all text-success display-3 d-block mb-3"></i>
            <h4 className="fw-extrabold text-dark mb-2">No Approvals Pending Your Review</h4>
            <p className="text-muted mb-0" style={{ maxWidth: '500px', margin: '0 auto' }}>
              {activeTab === 'PENDING'
                ? 'All visitor pre-registrations and technical contractor work orders have been processed.'
                : 'No records matching the selected status and search criteria.'}
            </p>
          </div>
        </div>
      )}

      {/* APPROVAL & CONDITIONAL REMARK MODAL */}
      {approvingItem && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 1055 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header bg-success text-white py-3">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                  <i className="bi bi-patch-check-fill fs-4"></i> Managing Director Approval &amp; Access Conditions
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setApprovingItem(null)}></button>
              </div>
              <form onSubmit={handleConfirmApprovalSubmit}>
                <div className="modal-body p-4">
                  <div className="p-3 bg-light rounded-3 border mb-3">
                    <div className="row g-2 text-dark small">
                      <div className="col-12 col-md-6">
                        <span className="text-muted d-block">Target Company / Delegation:</span>
                        <strong className="fs-6 text-primary">{approvingItem.name}</strong>
                      </div>
                      <div className="col-12 col-md-6">
                        <span className="text-muted d-block">Host Staff Member:</span>
                        <strong className="text-dark"><i className="bi bi-person-badge me-1"></i>{approvingItem.requestedBy || 'Staff'}</strong>
                      </div>
                      <div className="col-12 mt-2 pt-2 border-top">
                        <span className="text-muted d-block">Host Requested Location / Venue:</span>
                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle fs-6 py-1 px-2 fw-bold">
                          <i className="bi bi-geo-alt-fill me-1"></i>{approvingItem.currentVenueName || 'Unspecified'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* VENUE OVERRIDE OPTION */}
                  <div className="mb-3">
                    <label className="form-label fw-bold text-dark d-flex align-items-center justify-content-between">
                      <span><i className="bi bi-geo-fill text-warning me-1"></i> Approved Allowed Location / Venue:</span>
                      <span className="badge bg-secondary font-monospace">MD Venue Override Option</span>
                    </label>
                    <select
                      className="form-select border-2 border-primary fw-semibold"
                      value={selectedVenueId}
                      onChange={(e) => setSelectedVenueId(e.target.value)}
                    >
                      {meetingVenues.map(mv => (
                        <option key={mv.id} value={mv.id}>
                          {mv.name} ({mv.buildingBlock} • {mv.floorLevel}) {mv.id === approvingItem.currentVenueId ? ' [Host Requested]' : ''}
                        </option>
                      ))}
                    </select>
                    {selectedVenueId && approvingItem.currentVenueId && selectedVenueId !== approvingItem.currentVenueId && (
                      <div className="form-text text-danger fw-bold mt-1">
                        <i className="bi bi-exclamation-triangle-fill me-1"></i> Location override active: Changing allowed venue from &quot;{approvingItem.currentVenueName}&quot; to the selected venue above.
                      </div>
                    )}
                  </div>

                  {/* PRESET CONDITIONAL REMARKS */}
                  <div className="mb-3">
                    <label className="form-label fw-bold text-dark">
                      <i className="bi bi-chat-left-text-fill text-primary me-1"></i> Executive Remark / Approval Conditions Prefix:
                    </label>
                    <select
                      className="form-select border-2 border-info"
                      value={selectedPresetRemark}
                      onChange={(e) => setSelectedPresetRemark(e.target.value)}
                    >
                      {CONDITIONAL_REMARK_PRESETS.map((preset, idx) => (
                        <option key={idx} value={preset}>
                          {preset}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* ADDITIONAL CUSTOM REMARK DETAILS */}
                  <div className="mb-2">
                    <label className="form-label fw-bold text-dark">
                      Additional Remark Details / Specific Instructions:
                    </label>
                    <textarea
                      className="form-control"
                      rows={2}
                      placeholder="e.g. Visitor is restricted to Ground Floor Meeting Room B only. Server room entry is strictly prohibited."
                      value={customRemark}
                      onChange={(e) => setCustomRemark(e.target.value)}
                    ></textarea>
                    <div className="form-text text-muted small">
                      This remark will be persisted to the database and immediately visible to Host History, Security Guard Desk, and Admin Audit logs.
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light p-3">
                  <button type="button" className="btn btn-secondary" onClick={() => setApprovingItem(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success fw-bold px-4 d-flex align-items-center gap-2 shadow-sm" disabled={actionLoadingId === approvingItem.id}>
                    {actionLoadingId === approvingItem.id ? (
                      <span className="spinner-border spinner-border-sm"></span>
                    ) : (
                      <>
                        <i className="bi bi-check2-circle fs-5"></i> Confirm MD Approval &amp; Dispatch
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectingItem && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                  <i className="bi bi-x-circle-fill fs-5"></i> Decline Authorization Request
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setRejectingItem(null)}></button>
              </div>
              <form onSubmit={handleConfirmReject}>
                <div className="modal-body p-4">
                  <p className="mb-3 text-dark">
                    You are declining entry authorization for <strong>{rejectingItem.name}</strong>.
                  </p>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Reason for Refusal / Rejection:</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      required
                      placeholder="e.g. Incomplete security clearance, non-essential work during operating hours, missing required documentation..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setRejectingItem(null)}>Cancel</button>
                  <button type="submit" className="btn btn-danger fw-bold px-4">Confirm Decline</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Approval Success Modal Popup */}
      <NotificationModal
        isOpen={!!approvalPopup?.isOpen}
        title="Successfully Approved"
        message={approvalPopup?.message || ''}
        type="success"
        onClose={() => setApprovalPopup(null)}
      />
    </div>
  );
};
