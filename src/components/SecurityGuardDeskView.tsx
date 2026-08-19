import React, { useEffect, useState } from 'react';
import { User, Visitor, Contractor, BlacklistEntry } from '../types';
import { getVisitors, getContractors, checkInVisitor, checkOutVisitor, checkInContractor, checkOutContractor, getBlacklist } from '../lib/api';
import { calculateOverstayInfo, canViewOverstay } from '../lib/overstayUtils';
import { NotificationModal } from './notification';
import { formatDisplayDate, formatDisplayDateTime } from '../lib/dateUtils';

interface SecurityGuardDeskViewProps {
  currentUser: User;
  onOpenBadge: (item: Visitor | Contractor, type: 'VISITOR' | 'CONTRACTOR') => void;
  defaultSubTab?: 'ALL' | 'ON_PREMISE';
}

export const SecurityGuardDeskView: React.FC<SecurityGuardDeskViewProps> = ({ currentUser, onOpenBadge, defaultSubTab = 'ALL' }) => {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [now, setNow] = useState<Date>(new Date());

  const [activeTab, setActiveTab] = useState<'VISITORS' | 'CONTRACTORS' | 'ON_PREMISE' | 'OVERSTAY'>(
    defaultSubTab === 'ON_PREMISE' ? 'ON_PREMISE' : 'VISITORS'
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Check-In Modal State
  const [selectedItem, setSelectedItem] = useState<{ item: Visitor | Contractor; type: 'VISITOR' | 'CONTRACTOR' } | null>(null);
  const [passBadgeInput, setPassBadgeInput] = useState('');
  const [vehicleInput, setVehicleInput] = useState('');
  const [itemsInput, setItemsInput] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);

  // Blacklist Warning Modal State
  const [blacklistAlert, setBlacklistAlert] = useState<BlacklistEntry | null>(null);

  // Overstay Checkout Modal State
  const [overstayVisitorToCheckout, setOverstayVisitorToCheckout] = useState<{ visitor: Visitor; overstayMins: number; liveTimer: string } | null>(null);
  const [overstayNotesInput, setOverstayNotesInput] = useState('');
  const [overstayNotesError, setOverstayNotesError] = useState<string | null>(null);
  const [checkingOutOverstay, setCheckingOutOverstay] = useState(false);
  const [actionPopup, setActionPopup] = useState<{ isOpen: boolean; message: string } | null>(null);

  const hasOverstayPermission = canViewOverstay(currentUser.role);

  const loadData = async () => {
    try {
      setLoading(true);
      const [vList, cList, bList] = await Promise.all([
        getVisitors(),
        getContractors(),
        getBlacklist()
      ]);
      setVisitors(vList);
      setContractors(cList);
      setBlacklist(bList);
    } catch (err) {
      console.error('Error fetching guard desk data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  // Live ticking timer for real-time overstay counter
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleOpenCheckInModal = (item: Visitor | Contractor, type: 'VISITOR' | 'CONTRACTOR') => {
    // SECURITY BLACKLIST CHECK ON OPEN
    const isBlk = blacklist.find(b => b.isActive && b.idNumber.toLowerCase() === item.idNumber.toLowerCase());
    if (isBlk) {
      setBlacklistAlert(isBlk);
      return;
    }

    setSelectedItem({ item, type });
    setPassBadgeInput(
      item.passBadgeNumber || (type === 'VISITOR' ? `V-BADGE-${Math.floor(800 + Math.random() * 100)}` : `C-BADGE-${Math.floor(900 + Math.random() * 100)}`)
    );
    setVehicleInput(item.vehicleNumber || '');
    setItemsInput((type === 'VISITOR' ? (item as Visitor).itemsCarried : (item as Contractor).toolsEquipmentCarried) || '');
  };

  const handleConfirmCheckIn = async () => {
    if (!selectedItem) return;
    try {
      setCheckingIn(true);
      let updated: any;
      if (selectedItem.type === 'VISITOR') {
        updated = await checkInVisitor(selectedItem.item.id, {
          passBadgeNumber: passBadgeInput,
          vehicleNumber: vehicleInput,
          itemsCarried: itemsInput
        });
      } else {
        updated = await checkInContractor(selectedItem.item.id, {
          passBadgeNumber: passBadgeInput,
          vehicleNumber: vehicleInput,
          toolsEquipmentCarried: itemsInput
        });
      }

      setSelectedItem(null);
      setActionPopup({
        isOpen: true,
        message: `Successfully submitted! Check-in completed for ${selectedItem.item.fullName}. Pass Badge #${passBadgeInput} issued.`
      });
      await loadData();
      // Automatically show printable pass badge
      onOpenBadge(updated, selectedItem.type);
    } catch (err: any) {
      alert(err.message || 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async (id: string, type: 'VISITOR' | 'CONTRACTOR', name: string) => {
    if (type === 'VISITOR' && hasOverstayPermission) {
      const v = visitors.find(item => item.id === id);
      if (v && v.status === 'CHECKED_IN') {
        const overstayInfo = calculateOverstayInfo(v, now);
        if (overstayInfo.isOverstay) {
          // Open overstay confirmation dialog to record minutes exceeded
          setOverstayVisitorToCheckout({
            visitor: v,
            overstayMins: overstayInfo.exceededMinutes,
            liveTimer: overstayInfo.formattedLiveTimer
          });
          setOverstayNotesInput('');
          setOverstayNotesError(null);
          return;
        }
      }
    }

    if (!window.confirm(`Confirm Check-Out & Card Collection for ${name}?`)) return;
    try {
      if (type === 'VISITOR') {
        await checkOutVisitor(id);
      } else {
        await checkOutContractor(id);
      }
      setActionPopup({
        isOpen: true,
        message: `Successfully submitted! Check-out and pass badge collection processed for ${name}.`
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Check-out failed');
    }
  };

  const handleConfirmOverstayCheckout = async () => {
    if (!overstayVisitorToCheckout) return;

    if (!overstayNotesInput.trim()) {
      setOverstayNotesError('Security officer reason/justification for overstay is required before completing check-out.');
      return;
    }

    setOverstayNotesError(null);
    try {
      setCheckingOutOverstay(true);
      await checkOutVisitor(overstayVisitorToCheckout.visitor.id, {
        overstayNotes: overstayNotesInput.trim()
      });
      setOverstayVisitorToCheckout(null);
      setOverstayNotesInput('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Check-out failed');
    } finally {
      setCheckingOutOverstay(false);
    }
  };

  const onPremiseVisitors = visitors.filter(v => v.status === 'CHECKED_IN');
  const onPremiseContractors = contractors.filter(c => c.status === 'CHECKED_IN');
  const totalOnPremise = onPremiseVisitors.length + onPremiseContractors.length;

  // Security Desk Filter States
  const [visitorStatusFilter, setVisitorStatusFilter] = useState<string>('ALL');
  const [contractorStatusFilter, setContractorStatusFilter] = useState<string>('ALL');
  const [onPremiseTypeFilter, setOnPremiseTypeFilter] = useState<string>('ALL');

  // Active Overstay Visitors (Only computed/visible for Security & Admin)
  const overstayingVisitors = hasOverstayPermission
    ? visitors.filter(v => v.status === 'CHECKED_IN' && calculateOverstayInfo(v, now).isOverstay)
    : [];

  const filteredVisitors = visitors.filter(v => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      v.fullName.toLowerCase().includes(term) ||
      v.idNumber.toLowerCase().includes(term) ||
      v.registrationNo.toLowerCase().includes(term) ||
      v.hostUserName.toLowerCase().includes(term) ||
      v.companyName.toLowerCase().includes(term) ||
      (v.meetingVenueName && v.meetingVenueName.toLowerCase().includes(term)) ||
      (v.passBadgeNumber && v.passBadgeNumber.toLowerCase().includes(term));

    const matchesStatus = visitorStatusFilter === 'ALL' || v.status === visitorStatusFilter;

    return matchesSearch && matchesStatus;
  });

  const filteredContractors = contractors.filter(c => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      c.fullName.toLowerCase().includes(term) ||
      c.idNumber.toLowerCase().includes(term) ||
      c.workOrderNo.toLowerCase().includes(term) ||
      c.hostUserName.toLowerCase().includes(term) ||
      c.companyName.toLowerCase().includes(term) ||
      (c.technicalCategory && c.technicalCategory.toLowerCase().includes(term)) ||
      (c.passBadgeNumber && c.passBadgeNumber.toLowerCase().includes(term));

    const matchesStatus = contractorStatusFilter === 'ALL' || c.status === contractorStatusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-4">
      {/* Top Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-3 border-bottom gap-3 bg-dark text-white p-3 rounded shadow-sm">
        <div className="d-flex align-items-center gap-3">
          <div className="bg-warning text-dark p-2 rounded-circle fs-3 d-flex align-items-center justify-content-center" style={{ width: '50px', height: '50px' }}>
            <i className="bi bi-shield-check"></i>
          </div>
          <div>
            <h4 className="fw-extrabold mb-0">GATE SECURITY COMMAND DESK</h4>
            <div className="small text-warning font-monospace">
              OFFICER: {currentUser.fullName} ({currentUser.badgeId}) | GATE 1 MAIN ENTRANCE
            </div>
          </div>
        </div>

        {/* Live On-Premise & Overstay Badges */}
        <div className="d-flex align-items-center gap-3">
          {hasOverstayPermission && overstayingVisitors.length > 0 && (
            <div className="bg-danger bg-opacity-25 p-2 px-3 rounded text-center border border-danger">
              <div className="text-uppercase text-danger font-monospace fw-bold" style={{ fontSize: '0.65rem' }}>TIME EXCEEDED OVERSTAYS</div>
              <div className="fw-extrabold fs-4 text-white animate-pulse"><i className="bi bi-alarm-fill me-1"></i>{overstayingVisitors.length} OVERDUE</div>
            </div>
          )}
          <div className="bg-secondary bg-opacity-50 p-2 px-3 rounded text-center border border-secondary">
            <div className="text-uppercase text-muted font-monospace" style={{ fontSize: '0.65rem' }}>ACTIVE ON-PREMISE</div>
            <div className="fw-extrabold fs-4 text-success">{totalOnPremise} INDIVIDUALS</div>
          </div>
        </div>
      </div>

      {/* OVERSTAY ALERT BANNER (Security & Admin Only) */}
      {hasOverstayPermission && overstayingVisitors.length > 0 && (
        <div className="alert alert-danger border-2 border-danger bg-danger bg-opacity-10 shadow-sm d-flex align-items-center justify-content-between p-3 mb-4 rounded-3">
          <div className="d-flex align-items-center gap-3">
            <div className="p-2 bg-danger text-white rounded-circle fs-4 d-flex align-items-center justify-content-center shadow-sm" style={{ width: '46px', height: '46px' }}>
              <i className="bi bi-alarm-fill animate-pulse"></i>
            </div>
            <div>
              <div className="fw-extrabold text-danger text-uppercase font-monospace" style={{ fontSize: '0.8rem' }}>
                SECURITY WARNING: TIME EXCEEDED VISIT DURATION EXCEEDED
              </div>
              <div className="fw-bold text-dark">
                {overstayingVisitors.length} Visitor(s) currently on premise have exceeded their scheduled visit end time! Live countdown active.
              </div>
            </div>
          </div>
          <button
            className="btn btn-sm btn-danger fw-bold d-flex align-items-center gap-1 shadow-sm"
            onClick={() => setActiveTab('OVERSTAY')}
          >
            <i className="bi bi-clock-history"></i> Inspect Overstay List ({overstayingVisitors.length})
          </button>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
        <ul className="nav nav-pills gap-2">
          <li className="nav-item">
            <button
              className={`nav-link fw-bold ${activeTab === 'VISITORS' ? 'active bg-primary' : 'bg-white border text-dark'}`}
              onClick={() => setActiveTab('VISITORS')}
            >
              <i className="bi bi-person-badge me-1"></i> Visitors Log ({visitors.length})
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link fw-bold ${activeTab === 'CONTRACTORS' ? 'active bg-info text-white' : 'bg-white border text-dark'}`}
              onClick={() => setActiveTab('CONTRACTORS')}
            >
              <i className="bi bi-tools me-1"></i> Contractors Log ({contractors.length})
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link fw-bold ${activeTab === 'ON_PREMISE' ? 'active bg-success' : 'bg-white border text-dark'}`}
              onClick={() => setActiveTab('ON_PREMISE')}
            >
              <i className="bi bi-building-check me-1"></i> On-Premise Roster ({totalOnPremise})
            </button>
          </li>
          {hasOverstayPermission && (
            <li className="nav-item">
              <button
                className={`nav-link fw-bold ${activeTab === 'OVERSTAY' ? 'active bg-danger text-white' : 'bg-white border border-danger text-danger'}`}
                onClick={() => setActiveTab('OVERSTAY')}
              >
                <i className="bi bi-alarm-fill me-1"></i> Overstay Exceeded ({overstayingVisitors.length})
              </button>
            </li>
          )}
        </ul>

        {/* Real-time Search Box */}
        <div className="input-group" style={{ maxWidth: '360px' }}>
          <span className="input-group-text bg-white border-end-0"><i className="bi bi-search text-muted"></i></span>
          <input
            type="text"
            className="form-control border-start-0"
            placeholder="Search IC / Passport, Name, Pass Badge..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* BLACKLIST ALERT MODAL */}
      {blacklistAlert && (
        <div className="modal show d-block bg-danger bg-opacity-75" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-3 border-danger shadow-lg">
              <div className="modal-header bg-danger text-white p-3">
                <h5 className="modal-title fw-extrabold d-flex align-items-center gap-2">
                  <i className="bi bi-shield-slash-fill fs-3"></i>
                  SECURITY ALERT: BLACKLISTED INDIVIDUAL!
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setBlacklistAlert(null)}></button>
              </div>

              <div className="modal-body p-4 bg-light">
                <div className="alert alert-danger border-danger fw-bold text-center fs-5 mb-3">
                  ACCESS DENIED — DO NOT ISSUE PASS!
                </div>

                <div className="card border-danger mb-3">
                  <div className="card-body">
                    <div className="mb-2"><strong>NAME:</strong> <span className="fs-5 text-dark fw-extrabold">{blacklistAlert.fullName}</span></div>
                    <div className="mb-2"><strong>IC / PASSPORT:</strong> <span className="font-monospace text-danger fw-bold">{blacklistAlert.idNumber}</span></div>
                    <div className="mb-2"><strong>SEVERITY FLAG:</strong> <span className="badge bg-danger">{blacklistAlert.severity}</span></div>
                    <div className="mb-2"><strong>REASON FOR BLACKLIST:</strong></div>
                    <div className="p-2 bg-white rounded border border-danger text-dark small">{blacklistAlert.reason}</div>
                  </div>
                </div>

                <div className="small text-muted">
                  <i className="bi bi-info-circle-fill me-1"></i> Standard Protocol: Notify Chief Security Officer immediately and request individual to exit reception area.
                </div>
              </div>

              <div className="modal-footer bg-light p-3">
                <button type="button" className="btn btn-dark fw-bold" onClick={() => setBlacklistAlert(null)}>
                  Acknowledge Security Alert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHECK-IN MODAL */}
      {selectedItem && (
        <div className="modal show d-block bg-dark bg-opacity-75" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-secondary shadow-lg">
              <div className="modal-header bg-dark text-white p-3">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i className="bi bi-person-check-fill text-success fs-4"></i>
                  Confirm Security Check-In & Issue Badge
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedItem(null)}></button>
              </div>

              <div className="modal-body p-4 bg-light">
                <div className="card border-0 shadow-sm mb-3">
                  <div className="card-body p-3">
                    <h6 className="fw-bold mb-1 text-dark">{selectedItem.item.fullName}</h6>
                    <div className="text-muted small">Organization: {selectedItem.item.companyName}</div>
                    <div className="text-muted font-monospace small">IC/Passport: {selectedItem.item.idNumber}</div>
                    <div className="text-primary small mt-1">
                      <i className="bi bi-person me-1"></i>Host: {selectedItem.item.hostUserName} ({selectedItem.item.hostDepartment})
                    </div>
                    {/* MD Conditional Remark & Venue Display */}
                    {(selectedItem.item.isConditionalApproval || selectedItem.item.approvalRemark || selectedItem.item.approvedVenueName) && (
                      <div className="mt-2.5 p-2.5 bg-warning bg-opacity-10 border border-warning rounded-3 text-dark small">
                        <div className="fw-bold text-uppercase font-monospace text-warning-emphasis d-flex align-items-center gap-1">
                          <i className="bi bi-shield-lock-fill text-warning"></i> MD EXECUTIVE APPROVAL &amp; ACCESS CONDITIONS
                        </div>
                        {selectedItem.item.approvedVenueName && (
                          <div className="fw-bold text-danger mt-1">
                            <i className="bi bi-geo-alt-fill me-1"></i>
                            Allowed Access Venue: {selectedItem.item.approvedVenueName}
                          </div>
                        )}
                        {selectedItem.item.approvalRemark && (
                          <div className="fst-italic text-dark mt-1">
                            &quot;{selectedItem.item.approvalRemark}&quot;
                          </div>
                        )}
                      </div>
                    )}

                    {/* Foreign Contractor Permit Details Verification */}
                    {selectedItem.type === 'CONTRACTOR' && (selectedItem.item as Contractor).isForeignWorker && (
                      <div className="mt-2.5 p-3 bg-primary bg-opacity-10 border border-primary rounded-3 text-dark small">
                        <div className="fw-bold text-uppercase font-monospace text-primary d-flex align-items-center gap-1.5">
                          <i className="bi bi-globe2 fs-5"></i> FOREIGN CONTRACTOR WORK PERMIT CHECK
                        </div>
                        <div className="mt-1.5 row g-1">
                          <div className="col-4"><strong>Passport No:</strong> <span className="font-monospace">{(selectedItem.item as Contractor).passportNumber || (selectedItem.item as Contractor).idNumber}</span></div>
                          <div className="col-4"><strong>Nationality:</strong> {(selectedItem.item as Contractor).nationality || 'Non-Malaysian'}</div>
                          <div className="col-4"><strong>Permit Expiry:</strong> <span className="font-monospace fw-bold text-success">{(selectedItem.item as Contractor).permitExpiryDate}</span></div>
                        </div>
                        <div className="mt-2 pt-2 border-top border-primary-subtle text-muted small d-flex align-items-center gap-1">
                          <i className="bi bi-check-square-fill text-success me-1"></i>
                          <span>Officer Note: Verify physical passport and work permit prior to badge issuance.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-bold text-dark small">Assign Physical Pass Badge # <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control font-monospace fw-bold fs-5 text-primary"
                      value={passBadgeInput}
                      onChange={e => setPassBadgeInput(e.target.value)}
                    />
                  </div>

                  {selectedItem.type === 'VISITOR' && (
                    <div className="col-12">
                      <div className="p-2.5 rounded border bg-white">
                        <div className="small fw-bold text-dark mb-1 d-flex align-items-center gap-1.5">
                          <i className="bi bi-clock-history text-primary"></i> Scheduled Visit Window:
                        </div>
                        <div className="d-flex justify-content-between align-items-center small">
                          <div>
                            <span className="text-muted me-1">Start Time:</span>
                            <strong className="text-dark font-monospace">{(selectedItem.item as Visitor).scheduledStartTime || '—'}</strong>
                          </div>
                          <div>
                            <span className="text-muted me-1">End Time:</span>
                            <strong className="text-dark font-monospace">{(selectedItem.item as Visitor).scheduledEndTime || '—'}</strong>
                          </div>
                          <span className="badge bg-primary">
                            {(selectedItem.item as Visitor).scheduledDate}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="col-12">
                    <label className="form-label fw-bold text-dark small">Vehicle Plate Number (Recorded at Gate)</label>
                    <input
                      type="text"
                      className="form-control font-monospace"
                      placeholder="e.g. W-8821-X"
                      value={vehicleInput}
                      onChange={e => setVehicleInput(e.target.value)}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label fw-bold text-dark small">Laptops / Equipment / Tools Inspection Record</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Dell Laptop S/N: CN-09823 verified"
                      value={itemsInput}
                      onChange={e => setItemsInput(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer bg-light p-3">
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedItem(null)}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-success fw-bold d-flex align-items-center gap-2"
                  onClick={handleConfirmCheckIn}
                  disabled={checkingIn || !passBadgeInput}
                >
                  <i className="bi bi-check-circle-fill"></i>
                  {checkingIn ? 'Processing Check-In...' : 'Confirm Check-In & Print Badge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OVERSTAY CHECK-OUT REGISTRATION MODAL */}
      {overstayVisitorToCheckout && (
        <div className="modal show d-block bg-dark bg-opacity-75" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-danger shadow-lg">
              <div className="modal-header bg-danger text-white p-3">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                  <i className="bi bi-alarm-fill fs-4"></i>
                  Record Overstay & Complete Check-Out
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setOverstayVisitorToCheckout(null)}></button>
              </div>

              <div className="modal-body p-4 bg-light">
                <div className="alert alert-danger border-danger mb-3 d-flex align-items-center gap-3">
                  <i className="bi bi-clock-history fs-2 text-danger"></i>
                  <div>
                    <strong className="d-block text-danger">SCHEDULED VISIT DURATION EXCEEDED!</strong>
                    <div className="small text-dark">
                      This visitor stayed beyond scheduled end time (<span className="font-monospace fw-bold">{overstayVisitorToCheckout.visitor.scheduledEndTime}</span>).
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm mb-3">
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="fw-bold mb-0 text-dark">{overstayVisitorToCheckout.visitor.fullName}</h6>
                      <span className="badge bg-danger font-monospace">
                        Pass: {overstayVisitorToCheckout.visitor.passBadgeNumber || 'N/A'}
                      </span>
                    </div>
                    <div className="text-muted small">Organization: {overstayVisitorToCheckout.visitor.companyName}</div>
                    <div className="text-muted small">Host: {overstayVisitorToCheckout.visitor.hostUserName} ({overstayVisitorToCheckout.visitor.hostDepartment})</div>
                    <hr className="my-2" />
                    <div className="d-flex justify-content-between align-items-center bg-light p-2 rounded">
                      <span className="small fw-bold text-muted">REGISTERED OVERSTAY MINUTES:</span>
                      <span className="fw-extrabold text-danger font-monospace fs-5">
                        +{overstayVisitorToCheckout.overstayMins} MINUTES ({overstayVisitorToCheckout.liveTimer})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold text-dark small d-flex justify-content-between align-items-center">
                    <span>Reason for Overstay / Host Justification</span>
                    <span className="badge bg-danger text-white font-monospace" style={{ fontSize: '0.65rem' }}>REQUIRED *</span>
                  </label>
                  <textarea
                    className={`form-control ${overstayNotesError ? 'is-invalid border-danger' : ''}`}
                    rows={3}
                    placeholder="Mandatory: Enter justification for overstay (e.g., Meeting extended by Host John Miller, delay in transport, emergency discussion)."
                    value={overstayNotesInput}
                    onChange={e => {
                      setOverstayNotesInput(e.target.value);
                      if (e.target.value.trim()) setOverstayNotesError(null);
                    }}
                  ></textarea>
                  {overstayNotesError ? (
                    <div className="invalid-feedback d-block fw-bold text-danger mt-1">
                      <i className="bi bi-exclamation-triangle-fill me-1"></i>
                      {overstayNotesError}
                    </div>
                  ) : (
                    <div className="form-text small text-muted">
                      Security policy requires a documented reason for overstay before check-out can be completed.
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer bg-light p-3">
                <button type="button" className="btn btn-secondary" onClick={() => setOverstayVisitorToCheckout(null)}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-danger fw-bold d-flex align-items-center gap-2 shadow-sm"
                  onClick={handleConfirmOverstayCheckout}
                  disabled={checkingOutOverstay}
                >
                  <i className="bi bi-box-arrow-right"></i>
                  {checkingOutOverstay ? 'Registering Overstay...' : `Confirm Check-Out (${overstayVisitorToCheckout.overstayMins} mins exceeded)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: VISITORS LOG */}
      {activeTab === 'VISITORS' && (
        <div className="card border-0 shadow-sm bg-white">
          <div className="card-header bg-white py-3 border-bottom">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <h5 className="fw-bold mb-0 text-dark">Today Expected & Active Visitors</h5>
                <span className="text-muted small">Showing {filteredVisitors.length} of {visitors.length} visitors</span>
              </div>

              {/* Status Filter Dropdown & Quick Pills */}
              <div className="d-flex flex-wrap align-items-center gap-2">
                <div className="d-flex gap-1">
                  <button
                    type="button"
                    className={`btn btn-xs rounded-pill ${visitorStatusFilter === 'ALL' ? 'btn-primary text-white fw-bold' : 'btn-outline-secondary'}`}
                    onClick={() => setVisitorStatusFilter('ALL')}
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  >
                    All ({visitors.length})
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs rounded-pill ${visitorStatusFilter === 'CHECKED_IN' ? 'btn-success text-white fw-bold' : 'btn-outline-success'}`}
                    onClick={() => setVisitorStatusFilter('CHECKED_IN')}
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  >
                    Checked-In ({visitors.filter(v => v.status === 'CHECKED_IN').length})
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs rounded-pill ${visitorStatusFilter === 'SCHEDULED' ? 'btn-info text-white fw-bold' : 'btn-outline-info'}`}
                    onClick={() => setVisitorStatusFilter('SCHEDULED')}
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  >
                    Scheduled ({visitors.filter(v => v.status === 'SCHEDULED').length})
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs rounded-pill ${visitorStatusFilter === 'PENDING_APPROVAL' ? 'btn-warning text-dark fw-bold' : 'btn-outline-warning text-dark'}`}
                    onClick={() => setVisitorStatusFilter('PENDING_APPROVAL')}
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  >
                    Pending MD ({visitors.filter(v => v.status === 'PENDING_APPROVAL').length})
                  </button>
                </div>

                <select
                  className="form-select form-select-sm"
                  style={{ width: '170px' }}
                  value={visitorStatusFilter}
                  onChange={e => setVisitorStatusFilter(e.target.value)}
                >
                  <option value="ALL">Filter All Statuses</option>
                  <option value="SCHEDULED">Scheduled / Approved</option>
                  <option value="CHECKED_IN">Checked-In (On Premise)</option>
                  <option value="CHECKED_OUT">Checked-Out</option>
                  <option value="PENDING_APPROVAL">Pending MD Approval</option>
                  <option value="REJECTED">MD Rejected</option>
                </select>
              </div>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-muted small">
                <tr>
                  <th>REGISTRATION #</th>
                  <th>VISITOR NAME</th>
                  <th>HOST & DEPARTMENT</th>
                  <th>VENUE</th>
                  <th>SCHEDULED TIME (START & END)</th>
                  <th>STATUS</th>
                  <th>PASS BADGE</th>
                  <th>SECURITY ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredVisitors.map(v => {
                  const overstayInfo = calculateOverstayInfo(v, now);
                  return (
                    <tr key={v.id} className={hasOverstayPermission && v.status === 'CHECKED_IN' && overstayInfo.isOverstay ? 'table-danger' : ''}>
                      <td className="font-monospace fw-bold text-dark small">{v.registrationNo}</td>
                      <td>
                        <div className="fw-bold text-dark">{v.fullName}</div>
                        <div className="text-muted font-monospace small" style={{ fontSize: '0.75rem' }}>IC: {v.idNumber}</div>
                        <div className="text-muted small" style={{ fontSize: '0.75rem' }}>{v.companyName}</div>
                      </td>
                      <td>
                        <div className="fw-semibold text-dark small">{v.hostUserName}</div>
                        <div className="text-muted small" style={{ fontSize: '0.75rem' }}>{v.hostDepartment}</div>
                      </td>
                      <td className="small text-dark" style={{ minWidth: '160px' }}>
                        <div className="fw-semibold">{v.approvedVenueName || v.meetingVenueName}</div>
                        {v.approvedVenueName && v.approvedVenueName !== v.meetingVenueName && (
                          <span className="badge bg-danger-subtle text-danger border border-danger-subtle font-monospace d-inline-block mt-0.5" style={{ fontSize: '0.65rem' }}>
                            <i className="bi bi-geo-alt-fill me-1"></i>MD Venue Override
                          </span>
                        )}
                        {v.approvalRemark && (
                          <div className="mt-1 p-1 bg-warning bg-opacity-10 border border-warning rounded text-dark font-monospace" style={{ fontSize: '0.68rem', lineHeight: '1.2' }}>
                            <i className="bi bi-shield-lock-fill text-warning me-1"></i>&quot;{v.approvalRemark}&quot;
                          </div>
                        )}
                      </td>
                      <td className="small">
                        <div className="fw-semibold text-primary font-monospace">
                          <i className="bi bi-clock me-1"></i>
                          {v.scheduledStartTime || '09:00'} – {v.scheduledEndTime || '12:00'}
                        </div>
                        <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                          Date: {v.scheduledEndDate && v.scheduledEndDate !== v.scheduledDate ? (
                            <span className="fw-semibold font-monospace text-dark">
                              {formatDisplayDate(v.scheduledDate)} <span className="text-muted">to</span> {formatDisplayDate(v.scheduledEndDate)}
                            </span>
                          ) : (
                            <span className="fw-semibold font-monospace text-dark">{formatDisplayDate(v.scheduledDate)}</span>
                          )}
                        </div>
                        {hasOverstayPermission && v.status === 'CHECKED_IN' && overstayInfo.isOverstay && (
                          <div className="mt-1">
                            <span className="badge bg-danger text-white border px-2 py-1 shadow-sm font-monospace d-inline-flex align-items-center gap-1">
                              <i className="bi bi-alarm-fill animate-pulse"></i> EXCEEDED: +{overstayInfo.formattedLiveTimer}
                            </span>
                          </div>
                        )}
                        {hasOverstayPermission && v.status === 'CHECKED_OUT' && (v.exceededMinutes || 0) > 0 && (
                          <div className="mt-1">
                            <span className="badge bg-warning text-dark border px-2 py-1 font-monospace d-inline-flex align-items-center gap-1">
                              <i className="bi bi-clock-history"></i> Overstay: +{v.exceededMinutes} mins
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge rounded-pill ${
                          v.status === 'CHECKED_IN' ? (hasOverstayPermission && overstayInfo.isOverstay ? 'bg-danger' : 'bg-success') :
                          v.status === 'CHECKED_OUT' ? 'bg-secondary' :
                          v.status === 'PENDING_APPROVAL' ? 'bg-warning text-dark' :
                          v.status === 'REJECTED' ? 'bg-danger text-white' : 'bg-primary'
                        }`}>
                          {v.status === 'CHECKED_IN' && hasOverstayPermission && overstayInfo.isOverstay ? 'OVERSTAY' :
                           v.status === 'PENDING_APPROVAL' ? 'PENDING MD APPROVAL' : v.status}
                        </span>
                        {v.approvalStatus === 'APPROVED' && (
                          <div className="text-success small mt-1 font-monospace" style={{ fontSize: '0.7rem' }}>
                            <i className="bi bi-patch-check-fill me-1"></i>MD Approved
                          </div>
                        )}
                        {v.checkInSecurityUserName && (
                          <div className="text-muted small mt-1" style={{ fontSize: '0.7rem' }}>
                            <i className="bi bi-shield-check text-success me-1"></i>In: {v.checkInSecurityUserName}
                          </div>
                        )}
                        {v.checkOutSecurityUserName && (
                          <div className="text-muted small" style={{ fontSize: '0.7rem' }}>
                            <i className="bi bi-shield-x text-danger me-1"></i>Out: {v.checkOutSecurityUserName}
                          </div>
                        )}
                      </td>
                      <td className="font-monospace small">
                        {v.passBadgeNumber || '—'}
                      </td>
                      <td>
                        {v.status === 'SCHEDULED' && (
                          <button
                            className="btn btn-sm btn-success fw-bold d-flex align-items-center gap-1 shadow-sm"
                            onClick={() => handleOpenCheckInModal(v, 'VISITOR')}
                          >
                            <i className="bi bi-box-arrow-in-right"></i> Check-In
                          </button>
                        )}
                        {v.status === 'PENDING_APPROVAL' && (
                          <button
                            className="btn btn-sm btn-outline-warning text-dark fw-semibold d-flex align-items-center gap-1"
                            disabled
                            title="Awaiting Managing Director Approval prior to check-in"
                          >
                            <i className="bi bi-clock-history"></i> Pending Approval
                          </button>
                        )}
                        {v.status === 'REJECTED' && (
                          <button
                            className="btn btn-sm btn-outline-danger fw-semibold d-flex align-items-center gap-1"
                            disabled
                            title={v.rejectionReason || 'Rejected by Executive Management'}
                          >
                            <i className="bi bi-x-circle"></i> Rejected
                          </button>
                        )}
                        {v.status === 'CHECKED_IN' && (
                          <div className="d-flex gap-1">
                            <button
                              className="btn btn-sm btn-outline-dark font-monospace"
                              onClick={() => onOpenBadge(v, 'VISITOR')}
                              title="Print Badge"
                            >
                              <i className="bi bi-printer"></i> Badge
                            </button>
                            <button
                              className={`btn btn-sm ${hasOverstayPermission && overstayInfo.isOverstay ? 'btn-danger fw-extrabold' : 'btn-danger fw-bold'}`}
                              onClick={() => handleCheckOut(v.id, 'VISITOR', v.fullName)}
                            >
                              <i className="bi bi-box-arrow-right"></i> Check-Out
                            </button>
                          </div>
                        )}
                        {v.status === 'CHECKED_OUT' && (
                          <span className="text-muted small font-monospace"><i className="bi bi-check-all"></i> Completed ({v.checkOutTime?.substring(11, 16)})</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CONTRACTORS LOG */}
      {activeTab === 'CONTRACTORS' && (
        <div className="card border-0 shadow-sm bg-white">
          <div className="card-header bg-white py-3 border-bottom">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <h5 className="fw-bold mb-0 text-dark">Today Technical Contractors & Work Permits</h5>
                <span className="text-muted small">Showing {filteredContractors.length} of {contractors.length} contractors</span>
              </div>

              {/* Contractor Status Filter */}
              <div className="d-flex flex-wrap align-items-center gap-2">
                <div className="d-flex gap-1">
                  <button
                    type="button"
                    className={`btn btn-xs rounded-pill ${contractorStatusFilter === 'ALL' ? 'btn-primary text-white fw-bold' : 'btn-outline-secondary'}`}
                    onClick={() => setContractorStatusFilter('ALL')}
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  >
                    All ({contractors.length})
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs rounded-pill ${contractorStatusFilter === 'CHECKED_IN' ? 'btn-success text-white fw-bold' : 'btn-outline-success'}`}
                    onClick={() => setContractorStatusFilter('CHECKED_IN')}
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  >
                    Checked-In ({contractors.filter(c => c.status === 'CHECKED_IN').length})
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs rounded-pill ${contractorStatusFilter === 'APPROVED' ? 'btn-info text-white fw-bold' : 'btn-outline-info'}`}
                    onClick={() => setContractorStatusFilter('APPROVED')}
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  >
                    Approved Permits ({contractors.filter(c => c.status === 'APPROVED' || c.status === 'SCHEDULED').length})
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs rounded-pill ${contractorStatusFilter === 'PENDING_APPROVAL' ? 'btn-warning text-dark fw-bold' : 'btn-outline-warning text-dark'}`}
                    onClick={() => setContractorStatusFilter('PENDING_APPROVAL')}
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  >
                    Pending MD ({contractors.filter(c => c.status === 'PENDING_APPROVAL').length})
                  </button>
                </div>

                <select
                  className="form-select form-select-sm"
                  style={{ width: '170px' }}
                  value={contractorStatusFilter}
                  onChange={e => setContractorStatusFilter(e.target.value)}
                >
                  <option value="ALL">Filter All Statuses</option>
                  <option value="APPROVED">Approved Permits</option>
                  <option value="CHECKED_IN">Checked-In (On Premise)</option>
                  <option value="CHECKED_OUT">Checked-Out</option>
                  <option value="PENDING_APPROVAL">Pending MD Approval</option>
                  <option value="REJECTED">MD Rejected</option>
                </select>
              </div>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-muted small">
                <tr>
                  <th>REGISTRATION & WO #</th>
                  <th>CONTRACTOR NAME</th>
                  <th>CATEGORY & WORK SCOPE</th>
                  <th>SUPERVISING HOST</th>
                  <th>STATUS</th>
                  <th>PASS BADGE</th>
                  <th>SECURITY ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredContractors.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div className="font-monospace fw-bold text-dark small">{c.registrationNo}</div>
                      <div className="font-monospace text-primary small">WO: {c.workOrderNo}</div>
                    </td>
                    <td>
                      <div className="fw-bold text-dark">{c.fullName}</div>
                      <div className="text-muted small">{c.companyName}</div>
                      <div className="text-muted font-monospace small" style={{ fontSize: '0.75rem' }}>IC/Passport: {c.passportNumber || c.idNumber}</div>
                      {c.isForeignWorker && (
                        <div className="mt-1">
                          <span className={`badge ${c.permitStatus === 'EXPIRED' ? 'bg-danger text-white' : 'bg-primary-subtle text-primary border border-primary-subtle'} font-monospace d-inline-block`} style={{ fontSize: '0.65rem' }}>
                            <i className="bi bi-globe2 me-1"></i>Permit Exp: {c.permitExpiryDate || 'N/A'}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="small" style={{ maxWidth: '220px' }}>
                      <div className="fw-semibold text-dark">{c.contractorCategoryName}</div>
                      <div className="text-muted text-truncate" style={{ fontSize: '0.75rem' }}>{c.workScope}</div>
                    </td>
                    <td>
                      <div className="fw-semibold text-dark small">{c.hostUserName}</div>
                      <div className="text-dark small"><i className="bi bi-geo-alt text-danger me-1"></i>{c.approvedVenueName || c.locationVenueName}</div>
                      <div className="text-muted small" style={{ fontSize: '0.72rem' }}><i className="bi bi-calendar-range me-1"></i>{formatDisplayDate(c.startDate)} to {formatDisplayDate(c.endDate)}</div>
                      <div className="text-primary font-monospace fw-semibold" style={{ fontSize: '0.72rem' }}><i className="bi bi-clock me-1"></i>{c.startTime || '08:00'} – {c.endTime || '17:00'}</div>
                      {c.approvedVenueName && c.approvedVenueName !== c.locationVenueName && (
                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle font-monospace d-inline-block mt-0.5" style={{ fontSize: '0.65rem' }}>
                          <i className="bi bi-geo-alt-fill me-1"></i>MD Venue Override
                        </span>
                      )}
                      {c.approvalRemark && (
                        <div className="mt-1 p-1 bg-warning bg-opacity-10 border border-warning rounded text-dark font-monospace" style={{ fontSize: '0.68rem', lineHeight: '1.2' }}>
                          <i className="bi bi-shield-lock-fill text-warning me-1"></i>&quot;{c.approvalRemark}&quot;
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge rounded-pill ${
                        c.status === 'CHECKED_IN' ? 'bg-success' :
                        c.status === 'CHECKED_OUT' ? 'bg-secondary' :
                        c.status === 'PENDING_APPROVAL' ? 'bg-warning text-dark' :
                        c.status === 'REJECTED' ? 'bg-danger text-white' : 'bg-primary'
                      }`}>
                        {c.status === 'PENDING_APPROVAL' ? 'PENDING MD APPROVAL' : c.status}
                      </span>
                      {c.approvalStatus === 'APPROVED' && (
                        <div className="text-success small mt-1 font-monospace" style={{ fontSize: '0.7rem' }}>
                          <i className="bi bi-patch-check-fill me-1"></i>MD Approved
                        </div>
                      )}
                      {c.checkInSecurityUserName && (
                        <div className="text-muted small mt-1" style={{ fontSize: '0.7rem' }}>
                          <i className="bi bi-shield-check text-success me-1"></i>In: {c.checkInSecurityUserName}
                        </div>
                      )}
                      {c.checkOutSecurityUserName && (
                        <div className="text-muted small" style={{ fontSize: '0.7rem' }}>
                          <i className="bi bi-shield-x text-danger me-1"></i>Out: {c.checkOutSecurityUserName}
                        </div>
                      )}
                    </td>
                    <td className="font-monospace small">
                      {c.passBadgeNumber || '—'}
                    </td>
                    <td>
                      {c.status === 'SCHEDULED' && (
                        <button
                          className="btn btn-sm btn-success fw-bold d-flex align-items-center gap-1 shadow-sm"
                          onClick={() => handleOpenCheckInModal(c, 'CONTRACTOR')}
                        >
                          <i className="bi bi-box-arrow-in-right"></i> Check-In
                        </button>
                      )}
                      {c.status === 'PENDING_APPROVAL' && (
                        <button
                          className="btn btn-sm btn-outline-warning text-dark fw-semibold d-flex align-items-center gap-1"
                          disabled
                          title="Awaiting Managing Director Approval prior to contractor check-in"
                        >
                          <i className="bi bi-clock-history"></i> Pending Approval
                        </button>
                      )}
                      {c.status === 'REJECTED' && (
                        <button
                          className="btn btn-sm btn-outline-danger fw-semibold d-flex align-items-center gap-1"
                          disabled
                          title={c.rejectionReason || 'Rejected by Executive Management'}
                        >
                          <i className="bi bi-x-circle"></i> Rejected
                        </button>
                      )}
                      {c.status === 'CHECKED_IN' && (
                        <div className="d-flex gap-1">
                          <button
                            className="btn btn-sm btn-outline-dark font-monospace"
                            onClick={() => onOpenBadge(c, 'CONTRACTOR')}
                          >
                            <i className="bi bi-printer"></i> Badge
                          </button>
                          <button
                            className="btn btn-sm btn-danger fw-bold"
                            onClick={() => handleCheckOut(c.id, 'CONTRACTOR', c.fullName)}
                          >
                            <i className="bi bi-box-arrow-right"></i> Check-Out
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ON-PREMISE LIVE ROSTER */}
      {activeTab === 'ON_PREMISE' && (
        <div className="card border-0 shadow-sm bg-white">
          <div className="card-header bg-success text-white py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
            <h5 className="fw-extrabold mb-0 d-flex align-items-center gap-2">
              <i className="bi bi-building-check fs-4"></i>
              Active On-Premise Emergency Evacuation Roll Call Roster
            </h5>
            <div className="d-flex align-items-center gap-2">
              <div className="btn-group btn-group-sm">
                <button
                  type="button"
                  className={`btn ${onPremiseTypeFilter === 'ALL' ? 'btn-light fw-bold text-dark' : 'btn-outline-light'}`}
                  onClick={() => setOnPremiseTypeFilter('ALL')}
                >
                  All On-Premise ({totalOnPremise})
                </button>
                <button
                  type="button"
                  className={`btn ${onPremiseTypeFilter === 'VISITOR' ? 'btn-light fw-bold text-dark' : 'btn-outline-light'}`}
                  onClick={() => setOnPremiseTypeFilter('VISITOR')}
                >
                  Visitors ({onPremiseVisitors.length})
                </button>
                <button
                  type="button"
                  className={`btn ${onPremiseTypeFilter === 'CONTRACTOR' ? 'btn-light fw-bold text-dark' : 'btn-outline-light'}`}
                  onClick={() => setOnPremiseTypeFilter('CONTRACTOR')}
                >
                  Contractors ({onPremiseContractors.length})
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 bg-light border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="small text-muted">
              <i className="bi bi-info-circle-fill me-1"></i> Real-time tracking of all non-employees currently inside the facility grounds for emergency muster count.
            </div>
            <div className="badge bg-dark font-monospace text-white px-3 py-2">
              MUSTER COUNT: {(onPremiseTypeFilter === 'VISITOR' ? onPremiseVisitors : onPremiseTypeFilter === 'CONTRACTOR' ? onPremiseContractors : [...onPremiseVisitors, ...onPremiseContractors]).length} ACTIVE ON-SITE
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-muted small">
                <tr>
                  <th>TYPE</th>
                  <th>BADGE NO</th>
                  <th>FULL NAME & COMPANY</th>
                  <th>IC / PASSPORT</th>
                  <th>HOST / LOCATION</th>
                  <th>CHECK-IN TIME</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {(onPremiseTypeFilter === 'ALL' || onPremiseTypeFilter === 'VISITOR') && onPremiseVisitors.map(v => (
                  <tr key={v.id}>
                    <td><span className="badge bg-primary">VISITOR</span></td>
                    <td className="font-monospace fw-extrabold text-primary">{v.passBadgeNumber}</td>
                    <td>
                      <div className="fw-bold text-dark">{v.fullName}</div>
                      <div className="text-muted small">{v.companyName}</div>
                    </td>
                    <td className="font-monospace small">{v.idNumber}</td>
                    <td>
                      <div className="fw-semibold text-dark small">{v.hostUserName}</div>
                      <div className="text-muted small">{v.meetingVenueName}</div>
                    </td>
                    <td className="font-monospace small">
                      <div className="text-success fw-bold"><i className="bi bi-box-arrow-in-right me-1"></i>{formatDisplayDateTime(v.checkInTime)}</div>
                      {v.checkInSecurityUserName && (
                        <div className="text-dark fw-semibold" style={{ fontSize: '0.725rem' }}>
                          <i className="bi bi-shield-check text-success me-1"></i>By: {v.checkInSecurityUserName}
                        </div>
                      )}
                      <div className="text-primary fw-semibold" style={{ fontSize: '0.75rem' }}>
                        <i className="bi bi-clock me-1"></i>Sched: {v.scheduledStartTime || '09:00'} – {v.scheduledEndTime || '12:00'}
                      </div>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-danger fw-bold" onClick={() => handleCheckOut(v.id, 'VISITOR', v.fullName)}>
                        Check-Out
                      </button>
                    </td>
                  </tr>
                ))}

                {(onPremiseTypeFilter === 'ALL' || onPremiseTypeFilter === 'CONTRACTOR') && onPremiseContractors.map(c => (
                  <tr key={c.id}>
                    <td><span className="badge bg-info text-white">CONTRACTOR</span></td>
                    <td className="font-monospace fw-extrabold text-info">{c.passBadgeNumber}</td>
                    <td>
                      <div className="fw-bold text-dark">{c.fullName}</div>
                      <div className="text-muted small">{c.companyName}</div>
                    </td>
                    <td className="font-monospace small">{c.idNumber}</td>
                    <td>
                      <div className="fw-semibold text-dark small">{c.hostUserName}</div>
                      <div className="text-muted small">{c.locationVenueName}</div>
                    </td>
                    <td className="font-monospace small">
                      <div className="text-success fw-bold"><i className="bi bi-box-arrow-in-right me-1"></i>{formatDisplayDateTime(c.checkInTime)}</div>
                      {c.checkInSecurityUserName && (
                        <div className="text-dark fw-semibold" style={{ fontSize: '0.725rem' }}>
                          <i className="bi bi-shield-check text-success me-1"></i>By: {c.checkInSecurityUserName}
                        </div>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-sm btn-danger fw-bold" onClick={() => handleCheckOut(c.id, 'CONTRACTOR', c.fullName)}>
                        Check-Out
                      </button>
                    </td>
                  </tr>
                ))}

                {totalOnPremise === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-5 text-muted">No individuals currently on-premise.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: OVERSTAY INCIDENT LOG (Security & Admin Only) */}
      {activeTab === 'OVERSTAY' && hasOverstayPermission && (
        <div className="card border-danger shadow-sm bg-white">
          <div className="card-header bg-danger text-white py-3 fw-bold d-flex justify-content-between align-items-center">
            <span className="d-flex align-items-center gap-2">
              <i className="bi bi-alarm-fill fs-5"></i>
              Live Visitor Overstay Incident Log & Time Exceeded Register
            </span>
            <span className="badge bg-white text-danger font-monospace fw-bold">
              {overstayingVisitors.length} ACTIVE OVERSTAYS
            </span>
          </div>

          {overstayingVisitors.length === 0 ? (
            <div className="p-5 text-center text-muted">
              <i className="bi bi-check-circle-fill fs-1 text-success d-block mb-2"></i>
              <h5 className="fw-bold text-dark">No Active Overstays Detected</h5>
              <p className="mb-0 small">All on-premise visitors are currently within their authorized scheduled visit windows.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light text-muted small">
                  <tr>
                    <th>REGISTRATION #</th>
                    <th>VISITOR NAME & COMPANY</th>
                    <th>SUPERVISING HOST</th>
                    <th>SCHEDULED END TIME</th>
                    <th>LIVE OVERSTAY TIMER</th>
                    <th>TOTAL MINUTES EXCEEDED</th>
                    <th>SECURITY ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {overstayingVisitors.map(v => {
                    const info = calculateOverstayInfo(v, now);
                    return (
                      <tr key={v.id} className="table-danger bg-danger bg-opacity-10">
                        <td className="font-monospace fw-bold text-dark small">{v.registrationNo}</td>
                        <td>
                          <div className="fw-bold text-dark">{v.fullName}</div>
                          <div className="text-muted small">{v.companyName}</div>
                          <div className="badge bg-dark font-monospace mt-1">Badge: {v.passBadgeNumber || 'N/A'}</div>
                        </td>
                        <td>
                          <div className="fw-semibold text-dark small">{v.hostUserName}</div>
                          <div className="text-muted small">{v.hostDepartment}</div>
                        </td>
                        <td className="font-monospace fw-bold text-dark">
                          <i className="bi bi-clock me-1 text-danger"></i>
                          {v.scheduledEndTime}
                        </td>
                        <td>
                          <span className="badge bg-danger text-white fs-6 font-monospace px-3 py-2 shadow-sm animate-pulse d-inline-flex align-items-center gap-1">
                            <i className="bi bi-alarm-fill"></i>
                            +{info.formattedLiveTimer}
                          </span>
                        </td>
                        <td className="font-monospace fw-extrabold text-danger fs-6">
                          +{info.exceededMinutes} MINS
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-danger fw-bold d-flex align-items-center gap-1 shadow-sm"
                            onClick={() => handleCheckOut(v.id, 'VISITOR', v.fullName)}
                          >
                            <i className="bi bi-box-arrow-right"></i> Record Overstay & Check-Out
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Action Notification Popup Modal */}
      <NotificationModal
        isOpen={!!actionPopup?.isOpen}
        title="Successfully Submitted"
        message={actionPopup?.message || ''}
        type="success"
        onClose={() => setActionPopup(null)}
      />
    </div>
  );
};
