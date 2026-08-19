import React, { useEffect, useState, useMemo } from 'react';
import { User, Visitor, VisitorCategory, MeetingVenue, Company } from '../types';
import { getVisitors, registerVisitor, cancelVisitor, getVisitorCategories, getMeetingVenues, getUsers, getPastVisitorsByCompany, getCompanies } from '../lib/api';
import { NotificationModal } from './notification';
import { formatDisplayDate, getLocalTodayStr, getLocalTimeStr } from '../lib/dateUtils';

interface VisitorRegistrationViewProps {
  currentUser: User;
  mode: 'REGISTER' | 'LIST';
  onOpenBadge: (v: Visitor) => void;
}

export const VisitorRegistrationView: React.FC<VisitorRegistrationViewProps> = ({ currentUser, mode, onOpenBadge }) => {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [categories, setCategories] = useState<VisitorCategory[]>([]);
  const [venues, setVenues] = useState<MeetingVenue[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [pastAttendees, setPastAttendees] = useState<Visitor[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeTab, setActiveTab] = useState<'FORM' | 'LIST'>(mode === 'REGISTER' ? 'FORM' : 'LIST');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [submitPopup, setSubmitPopup] = useState<{ isOpen: boolean; message: string } | null>(null);

  // Helper functions for current local date and time
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getNowTimeStr = () => {
    const d = new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Form state
  const todayStr = getTodayStr();
  const [formData, setFormData] = useState({
    companyName: '',
    visitorCategoryId: '',
    purpose: '',
    hostUserId: currentUser.id,
    meetingVenueId: '',
    scheduledDate: todayStr,
    scheduledEndDate: todayStr,
    scheduledStartTime: '09:00',
    scheduledEndTime: '12:00',
    notes: ''
  });

  const [visitorList, setVisitorList] = useState<Array<{
    fullName: string;
    idNumber: string;
    phone: string;
    email: string;
    vehicleNumber: string;
    itemsCarried: string;
  }>>([
    { fullName: '', idNumber: '', phone: '', email: '', vehicleNumber: '', itemsCarried: '' }
  ]);

  const handleAddVisitorRow = () => {
    setVisitorList(prev => [
      ...prev,
      { fullName: '', idNumber: '', phone: '', email: '', vehicleNumber: '', itemsCarried: '' }
    ]);
  };

  const handleRemoveVisitorRow = (index: number) => {
    if (visitorList.length <= 1) return;
    setVisitorList(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleVisitorChange = (index: number, field: string, value: string) => {
    setVisitorList(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [visList, catList, venList, userList, pastList, compList] = await Promise.all([
        getVisitors(),
        getVisitorCategories(),
        getMeetingVenues(),
        getUsers(),
        getPastVisitorsByCompany(),
        getCompanies()
      ]);
      setVisitors(visList);
      setCategories(catList);
      setVenues(venList);
      setAllUsers(userList);
      setPastAttendees(pastList);
      setCompanies(compList);

      if (catList.length > 0 && !formData.visitorCategoryId) {
        setFormData(f => ({ ...f, visitorCategoryId: catList[0].id }));
      }
      if (venList.length > 0 && !formData.meetingVenueId) {
        setFormData(f => ({ ...f, meetingVenueId: venList[0].id }));
      }
    } catch (err) {
      console.error('Error fetching visitor registration data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Known company names for quick selection / autocomplete (Strictly scoped by Staff Department)
  const knownCompanies = useMemo(() => {
    const setNames = new Set<string>();

    const myDept = (currentUser.departmentName || '').trim().toLowerCase();

    companies.forEach(c => {
      if (c.name && c.isActive) {
        setNames.add(c.name);
      }
    });

    pastAttendees.forEach(p => {
      if (!p.companyName) return;
      if (currentUser.role === 'STAFF' && myDept) {
        const hostDept = (p.hostDepartment || '').trim().toLowerCase();
        if (hostDept && hostDept !== myDept) return;
      }
      setNames.add(p.companyName);
    });

    return Array.from(setNames);
  }, [companies, pastAttendees, currentUser]);

  // Matching past attendees for selected company (Department Scoped, STRICT EXACT COMPANY MATCH)
  const matchingPastAttendees = useMemo(() => {
    const query = (formData.companyName || '').trim().toLowerCase();
    if (!query) return [];

    const myDept = (currentUser.departmentName || '').trim().toLowerCase();

    const matches = pastAttendees.filter(p => {
      if (!p.companyName) return false;
      const compClean = p.companyName.trim().toLowerCase();
      // STRICT EXACT MATCH: Company name must match exactly to prevent mixing companies
      if (compClean !== query) return false;

      if (currentUser.role === 'STAFF' && myDept) {
        const hostDept = (p.hostDepartment || '').trim().toLowerCase();
        if (hostDept && hostDept !== myDept) return false;
      }
      return true;
    });

    const uniqueMap = new Map<string, Visitor>();
    matches.forEach(m => {
      const key = (m.idNumber || m.fullName).trim().toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, m);
      }
    });

    return Array.from(uniqueMap.values());
  }, [formData.companyName, pastAttendees, currentUser]);

  const handleSelectCompany = (newCompanyName: string) => {
    const cleanOld = formData.companyName.trim().toLowerCase();
    const cleanNew = newCompanyName.trim().toLowerCase();

    if (cleanOld && cleanNew && cleanOld !== cleanNew) {
      // Check if visitor list contains filled rows from a different company
      const hasFilledRows = visitorList.some(v => v.fullName.trim() || v.idNumber.trim() || v.email.trim());
      if (hasFilledRows) {
        // Reset visitor list to 1 empty row for the new company to prevent mixing
        setVisitorList([{ fullName: '', idNumber: '', phone: '', email: '', vehicleNumber: '', itemsCarried: '' }]);
      }
    }
    setFormData(f => ({ ...f, companyName: newCompanyName }));
  };

  const togglePastAttendee = (past: Visitor) => {
    // If current company name is empty or differs from past attendee's company, lock company name to past.companyName
    if (past.companyName && formData.companyName.trim().toLowerCase() !== past.companyName.trim().toLowerCase()) {
      handleSelectCompany(past.companyName);
    }

    const isAlreadyAdded = visitorList.some(v =>
      (v.idNumber && past.idNumber && v.idNumber.trim().toLowerCase() === past.idNumber.trim().toLowerCase()) ||
      (v.fullName && past.fullName && v.fullName.trim().toLowerCase() === past.fullName.trim().toLowerCase())
    );

    if (isAlreadyAdded) {
      if (visitorList.length === 1) {
        setVisitorList([{ fullName: '', idNumber: '', phone: '', email: '', vehicleNumber: '', itemsCarried: '' }]);
      } else {
        setVisitorList(prev => prev.filter(v =>
          !(
            (v.idNumber && past.idNumber && v.idNumber.trim().toLowerCase() === past.idNumber.trim().toLowerCase()) ||
            (v.fullName && past.fullName && v.fullName.trim().toLowerCase() === past.fullName.trim().toLowerCase())
          )
        ));
      }
    } else {
      const newVisitorObj = {
        fullName: past.fullName || '',
        idNumber: past.idNumber || '',
        phone: past.phone || '',
        email: past.email || '',
        vehicleNumber: past.vehicleNumber || '',
        itemsCarried: past.itemsCarried || ''
      };

      setVisitorList(prev => {
        if (prev.length === 1 && !prev[0].fullName.trim() && !prev[0].idNumber.trim()) {
          return [newVisitorObj];
        }
        return [...prev, newVisitorObj];
      });
    }
  };

  const handleSelectAllPastAttendees = () => {
    if (matchingPastAttendees.length === 0) return;

    setVisitorList(prev => {
      const newToAppend: Array<{
        fullName: string;
        idNumber: string;
        phone: string;
        email: string;
        vehicleNumber: string;
        itemsCarried: string;
      }> = [];

      matchingPastAttendees.forEach(past => {
        const exists = prev.some(v =>
          (v.idNumber && past.idNumber && v.idNumber.trim().toLowerCase() === past.idNumber.trim().toLowerCase()) ||
          (v.fullName && past.fullName && v.fullName.trim().toLowerCase() === past.fullName.trim().toLowerCase())
        );
        if (!exists) {
          newToAppend.push({
            fullName: past.fullName || '',
            idNumber: past.idNumber || '',
            phone: past.phone || '',
            email: past.email || '',
            vehicleNumber: past.vehicleNumber || '',
            itemsCarried: past.itemsCarried || ''
          });
        }
      });

      if (newToAppend.length === 0) return prev;

      if (prev.length === 1 && !prev[0].fullName.trim() && !prev[0].idNumber.trim()) {
        return newToAppend;
      }

      return [...prev, ...newToAppend];
    });
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaff) {
      setErrorMsg('Administrator accounts cannot pre-register visitors on behalf of users. Only Staff can pre-register visitors.');
      return;
    }

    if (!formData.companyName.trim()) {
      setErrorMsg('Please enter Company / Organization Name.');
      return;
    }

    if (!formData.purpose.trim()) {
      setErrorMsg('Please enter Purpose of Visit.');
      return;
    }

    // Validate backdate and back time
    const today = getTodayStr();
    const currentTime = getNowTimeStr();

    if (formData.scheduledDate < today) {
      setErrorMsg(`Scheduled start date (${formData.scheduledDate}) cannot be in the past. Please select today (${today}) or a future date.`);
      return;
    }

    if (formData.scheduledEndDate && formData.scheduledEndDate < formData.scheduledDate) {
      setErrorMsg(`Scheduled end date (${formData.scheduledEndDate}) cannot be earlier than start date (${formData.scheduledDate}).`);
      return;
    }

    if (formData.scheduledDate === today && formData.scheduledStartTime < currentTime) {
      setErrorMsg(`Scheduled start time (${formData.scheduledStartTime}) cannot be in the past for today's visit. Current time is ${currentTime}. Please select a valid start time.`);
      return;
    }

    // Validate all visitors in list & check single organization email domain rule
    const emailDomains = new Set<string>();
    for (let i = 0; i < visitorList.length; i++) {
      const v = visitorList[i];
      if (!v.fullName.trim() || !v.idNumber.trim()) {
        setErrorMsg(`Visitor #${i + 1} is missing required fields (Full Name and IC/Passport Number).`);
        return;
      }
      if (v.email && v.email.includes('@')) {
        const domain = v.email.split('@')[1].trim().toLowerCase();
        if (domain) emailDomains.add(domain);
      }
    }

    if (emailDomains.size > 1) {
      setErrorMsg(`Single Organization Violation: Detected attendees with different email domains (${Array.from(emailDomains).map(d => '@' + d).join(', ')}). A single request cannot mix attendees from different companies. Please raise separate requests for each company.`);
      return;
    }

    try {
      setSaving(true);
      setErrorMsg('');
      const created = await registerVisitor({
        ...formData,
        fullName: visitorList[0].fullName,
        idNumber: visitorList[0].idNumber,
        phone: visitorList[0].phone,
        email: visitorList[0].email,
        vehicleNumber: visitorList[0].vehicleNumber,
        itemsCarried: visitorList[0].itemsCarried,
        visitors: visitorList
      });

      setSuccessMsg(`Pre-registered ${visitorList.length} visitor(s) for ${formData.companyName} successfully! Registration Request No: ${created.registrationNo}`);
      setSubmitPopup({
        isOpen: true,
        message: `Successfully submitted! Pre-registered ${visitorList.length} visitor(s) for ${formData.companyName}. Registration Request No: ${created.registrationNo}`
      });
      
      // Reset form
      setFormData({
        companyName: '',
        visitorCategoryId: categories[0]?.id || '',
        purpose: '',
        hostUserId: currentUser.id,
        meetingVenueId: venues[0]?.id || '',
        scheduledDate: todayStr,
        scheduledEndDate: todayStr,
        scheduledStartTime: '09:00',
        scheduledEndTime: '12:00',
        notes: ''
      });

      setVisitorList([
        { fullName: '', idNumber: '', phone: '', email: '', vehicleNumber: '', itemsCarried: '' }
      ]);

      await loadData();
      setActiveTab('LIST');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to pre-register visitors.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to cancel the visitor registration for ${name}?`)) return;
    try {
      await cancelVisitor(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel registration');
    }
  };

  const isStaff = currentUser.role === 'STAFF';
  const canSeePassBadge = currentUser.role !== 'STAFF' && currentUser.role !== 'MANAGING_DIRECTOR';

  // Filter States
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');

  // Extract list of unique visitor companies for quick filter dropdown
  const uniqueCompanies = Array.from(new Set(visitors.map(v => v.companyName.trim()).filter(Boolean)));

  const filteredVisitors = visitors.filter(v => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      v.fullName.toLowerCase().includes(term) ||
      v.idNumber.toLowerCase().includes(term) ||
      v.registrationNo.toLowerCase().includes(term) ||
      v.companyName.toLowerCase().includes(term) ||
      v.hostUserName.toLowerCase().includes(term) ||
      (v.meetingVenueName && v.meetingVenueName.toLowerCase().includes(term)) ||
      (v.vehicleNumber && v.vehicleNumber.toLowerCase().includes(term)) ||
      (v.passBadgeNumber && v.passBadgeNumber.toLowerCase().includes(term));

    const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
    const matchesCompany = companyFilter === 'ALL' || v.companyName.trim().toLowerCase() === companyFilter.trim().toLowerCase();

    return matchesSearch && matchesStatus && matchesCompany;
  });

  return (
    <div className="p-4">
      {/* View Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom gap-3">
        <div>
          <h3 className="fw-extrabold text-dark mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-person-badge text-primary"></i>
            {isStaff ? 'My Visitor Management' : 'Enterprise Visitor Registration'}
          </h3>
          <p className="text-muted mb-0 small">
            {isStaff
              ? 'Pre-register your official visitors. Registered visitors will receive gate access verification on arrival.'
              : 'Overview of all visitor registrations across departments and hosts.'}
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="btn-group shadow-sm">
          <button
            className={`btn ${activeTab === 'LIST' ? 'btn-primary fw-bold' : 'btn-outline-primary'}`}
            onClick={() => setActiveTab('LIST')}
          >
            <i className="bi bi-list-ul me-1"></i>
            {isStaff ? 'My Visitors List' : 'All Visitors List'} ({visitors.length})
          </button>
          {isStaff && (
            <button
              className={`btn ${activeTab === 'FORM' ? 'btn-primary fw-bold' : 'btn-outline-primary'}`}
              onClick={() => setActiveTab('FORM')}
            >
              <i className="bi bi-plus-lg me-1"></i>
              Pre-Register New Visitor
            </button>
          )}
        </div>
      </div>

      {/* Staff Isolation Alert Banner */}
      {isStaff && (
        <div className="alert alert-secondary border-secondary bg-white shadow-sm d-flex align-items-center justify-content-between mb-4">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-shield-lock-fill text-primary fs-4"></i>
            <div>
              <strong className="text-dark">Staff Access Security Guard:</strong> Showing ONLY visitors hosted by <strong>{currentUser.fullName} ({currentUser.departmentName})</strong>.
            </div>
          </div>
          <span className="badge bg-primary">STRICT HOST ISOLATION</span>
        </div>
      )}

      {/* Feedback Messages */}
      {successMsg && (
        <div className="alert alert-success alert-dismissible fade show shadow-sm mb-4" role="alert">
          <i className="bi bi-check-circle-fill me-2"></i>
          {successMsg}
          <button type="button" className="btn-close" onClick={() => setSuccessMsg('')}></button>
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-danger alert-dismissible fade show shadow-sm mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {errorMsg}
          <button type="button" className="btn-close" onClick={() => setErrorMsg('')}></button>
        </div>
      )}

      {/* FORM TAB */}
      {activeTab === 'FORM' && (
        !isStaff ? (
          <div className="card border-0 shadow-sm bg-white mx-auto p-4" style={{ maxWidth: '900px' }}>
            <div className="alert alert-warning border-2 border-warning bg-warning bg-opacity-10 p-4 rounded-3 text-dark mb-0">
              <div className="d-flex align-items-start gap-3">
                <i className="bi bi-shield-slash-fill text-danger fs-1 flex-shrink-0"></i>
                <div>
                  <h5 className="fw-bold text-danger mb-2">Pre-Registration Access Restricted</h5>
                  <p className="mb-2 fs-6">
                    Under enterprise security policy, <strong>Administrator and Security accounts do not have access to pre-register visitors on behalf of users</strong>.
                  </p>
                  <p className="small text-secondary mb-0">
                    <i className="bi bi-info-circle me-1"></i> This policy prevents cheating, fake registrations, and unauthorized entry passes. Visitors must be pre-registered directly by the hosting <strong>Staff Member</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card border-0 shadow-sm bg-white mx-auto" style={{ maxWidth: '960px' }}>
          <div className="card-header bg-dark text-white p-3 d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-file-earmark-person-fill text-warning fs-5"></i>
              <h5 className="fw-bold mb-0">Visitor Pre-Registration Form</h5>
            </div>
            <span className="badge bg-primary font-monospace">DELEGATION SUPPORT</span>
          </div>

          <form onSubmit={handleSubmit} className="card-body p-4">
            <div className="row g-3">
              {/* SECTION 1: ORGANIZATION & VISIT METADATA */}
              <div className="col-12">
                <h6 className="fw-bold text-primary border-bottom pb-2 mb-2 d-flex align-items-center gap-2">
                  <i className="bi bi-building"></i>
                  1. ORGANIZATION & VISIT DETAILS
                </h6>
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold text-dark small d-flex justify-content-between align-items-center">
                  <span>Company / Guest Organization <span className="text-danger">*</span></span>
                  {knownCompanies.length > 0 && (
                    <span className="text-muted small fw-normal">
                      <i className="bi bi-clock-history me-1"></i>Select or type company
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  list="companySuggestions"
                  className="form-control fw-bold"
                  placeholder="Type or select company (e.g. Apex Global Solutions)"
                  value={formData.companyName}
                  onChange={e => handleSelectCompany(e.target.value)}
                  required
                />
                <datalist id="companySuggestions">
                  {knownCompanies.map((cName, idx) => (
                    <option key={idx} value={cName} />
                  ))}
                </datalist>

                {/* Quick Company Selection Chips */}
                {knownCompanies.length > 0 && (
                  <div className="d-flex flex-wrap align-items-center gap-1.5 mt-2">
                    <span className="text-muted small fs-7 fw-semibold">
                      <i className="bi bi-diagram-3 text-primary me-1"></i>
                      Quick Select Company ({currentUser.departmentName || 'Your Department'} History):
                    </span>
                    {knownCompanies.slice(0, 6).map((cName, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`btn btn-xs ${
                          formData.companyName.trim().toLowerCase() === cName.toLowerCase()
                            ? 'btn-primary fw-bold shadow-xs'
                            : 'btn-outline-secondary bg-white text-dark'
                        } rounded-pill font-monospace`}
                        onClick={() => handleSelectCompany(cName)}
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}
                      >
                        <i className="bi bi-building me-1"></i>{cName}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* PAST ATTENDEES QUICK SELECTION PANEL */}
              {formData.companyName.trim() && matchingPastAttendees.length > 0 && (
                <div className="col-12 mt-2">
                  <div className="card border-primary-subtle bg-primary-subtle shadow-xs rounded-3 p-3">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2 pb-2 border-bottom border-primary-subtle">
                      <div>
                        <h6 className="fw-bold text-primary mb-0 d-flex align-items-center gap-2">
                          <i className="bi bi-person-lines-fill fs-5"></i>
                          Select Previous Visitors from "{formData.companyName}" ({matchingPastAttendees.length} Attendee{matchingPastAttendees.length > 1 ? 's' : ''} - {currentUser.departmentName || 'Department'} Records)
                        </h6>
                        <span className="text-secondary small">
                          Click any previous visitor below to quickly auto-fill their details into this visit request:
                        </span>
                      </div>
                      {/* Add All button hidden as requested */}
                    </div>

                    <div className="row g-2">
                      {matchingPastAttendees.map(past => {
                        const isAdded = visitorList.some(v =>
                          (v.idNumber && past.idNumber && v.idNumber.trim().toLowerCase() === past.idNumber.trim().toLowerCase()) ||
                          (v.fullName && past.fullName && v.fullName.trim().toLowerCase() === past.fullName.trim().toLowerCase())
                        );
                        return (
                          <div className="col-lg-4 col-md-6" key={past.id}>
                            <div
                              className={`card p-2.5 h-100 transition-all border ${
                                isAdded
                                  ? 'border-success bg-success-subtle text-success-emphasis shadow-xs'
                                  : 'border-white bg-white hover:border-primary shadow-xs'
                              }`}
                              style={{ cursor: 'pointer', borderRadius: '8px' }}
                              onClick={() => togglePastAttendee(past)}
                            >
                              <div className="d-flex align-items-start justify-content-between gap-2 mb-1">
                                <div>
                                  <div className="fw-bold text-dark small">{past.fullName}</div>
                                  <span className="badge bg-light text-dark border font-monospace mt-1" style={{ fontSize: '0.72rem' }}>
                                    <i className="bi bi-card-heading me-1"></i>{past.idNumber}
                                  </span>
                                </div>
                                {isAdded ? (
                                  <span className="badge bg-success text-white px-2 py-1 rounded-pill small d-flex align-items-center gap-1" style={{ fontSize: '0.7rem' }}>
                                    <i className="bi bi-check-circle-fill"></i> Selected
                                  </span>
                                ) : (
                                  <span className="btn btn-xs btn-outline-primary fw-bold px-2 py-0.5 rounded-pill" style={{ fontSize: '0.7rem' }}>
                                    + Add
                                  </span>
                                )}
                              </div>

                              <div className="text-muted small mt-1.5 pt-1.5 border-top border-light d-flex flex-column gap-0.5" style={{ fontSize: '0.76rem' }}>
                                <div><i className="bi bi-telephone text-secondary me-1"></i>{past.phone || 'N/A'}</div>
                                <div><i className="bi bi-envelope text-secondary me-1"></i>{past.email || 'N/A'}</div>
                                {past.vehicleNumber && (
                                  <div><i className="bi bi-car-front text-secondary me-1"></i>Vehicle: <span className="font-monospace text-dark">{past.vehicleNumber}</span></div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="col-md-6">
                <label className="form-label fw-bold text-dark small">Purpose of Visit <span className="text-danger">*</span></label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Q3 Enterprise Architecture Strategy Discussion"
                  value={formData.purpose}
                  onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold text-dark small">Visitor Category</label>
                <select
                  className="form-select"
                  value={formData.visitorCategoryId}
                  onChange={e => setFormData({ ...formData, visitorCategoryId: e.target.value })}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.requiresEscort ? '(Escort Required)' : ''}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold text-dark small">Meeting Venue / Room</label>
                <select
                  className="form-select"
                  value={formData.meetingVenueId}
                  onChange={e => setFormData({ ...formData, meetingVenueId: e.target.value })}
                >
                  {venues.map(v => {
                    const blockStr = v.buildingBlocks && v.buildingBlocks.length > 0 ? v.buildingBlocks.join(', ') : (v.buildingBlock || '');
                    const floorStr = v.floorLevels && v.floorLevels.length > 0 ? v.floorLevels.join(', ') : (v.floorLevel || '');
                    const locDetail = [blockStr, floorStr].filter(Boolean).join(' | ');
                    return (
                      <option key={v.id} value={v.id}>
                        {v.name}{locDetail ? ` (${locDetail})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold text-dark small">Host Staff Member</label>
                {isStaff ? (
                  <input type="text" className="form-control bg-light" value={`${currentUser.fullName} (${currentUser.departmentName})`} disabled />
                ) : (
                  <select
                    className="form-select"
                    value={formData.hostUserId}
                    onChange={e => setFormData({ ...formData, hostUserId: e.target.value })}
                  >
                    {allUsers.filter(u => u.role === 'STAFF' || u.role === 'ADMINISTRATOR').map(u => (
                      <option key={u.id} value={u.id}>{u.fullName} ({u.departmentName})</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="col-md-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label fw-bold text-dark small mb-0">Visit Start Date *</label>
                  <span className="text-muted small" style={{ fontSize: '0.72rem' }}>From</span>
                </div>
                <input
                  type="date"
                  className="form-control"
                  min={getTodayStr()}
                  value={formData.scheduledDate}
                  onChange={e => {
                    const newStart = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      scheduledDate: newStart,
                      // If end date is now earlier than start date, automatically align it
                      scheduledEndDate: prev.scheduledEndDate && prev.scheduledEndDate < newStart ? newStart : prev.scheduledEndDate
                    }));
                  }}
                />
              </div>

              <div className="col-md-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label fw-bold text-dark small mb-0">Visit End Date</label>
                  <div className="d-flex gap-1">
                    <button
                      type="button"
                      className="btn btn-link p-0 text-primary small text-decoration-none fw-semibold"
                      style={{ fontSize: '0.7rem' }}
                      onClick={() => {
                        const start = new Date(formData.scheduledDate || getTodayStr());
                        start.setDate(start.getDate() + 6); // 1 week range (7 days total)
                        const yr = start.getFullYear();
                        const mo = String(start.getMonth() + 1).padStart(2, '0');
                        const dy = String(start.getDate()).padStart(2, '0');
                        setFormData(prev => ({ ...prev, scheduledEndDate: `${yr}-${mo}-${dy}` }));
                      }}
                      title="Set to 1 Week Duration"
                    >
                      +1 Week
                    </button>
                    <span className="text-muted small" style={{ fontSize: '0.7rem' }}>|</span>
                    <button
                      type="button"
                      className="btn btn-link p-0 text-secondary small text-decoration-none"
                      style={{ fontSize: '0.7rem' }}
                      onClick={() => setFormData(prev => ({ ...prev, scheduledEndDate: prev.scheduledDate }))}
                      title="Single Day Visit"
                    >
                      1 Day
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  className="form-control"
                  min={formData.scheduledDate || getTodayStr()}
                  value={formData.scheduledEndDate || formData.scheduledDate}
                  onChange={e => setFormData({ ...formData, scheduledEndDate: e.target.value })}
                />
              </div>

              <div className="col-md-3 col-6">
                <label className="form-label fw-bold text-dark small">Start Time</label>
                <input
                  type="time"
                  className="form-control"
                  value={formData.scheduledStartTime}
                  onChange={e => setFormData({ ...formData, scheduledStartTime: e.target.value })}
                />
              </div>

              <div className="col-md-3 col-6">
                <label className="form-label fw-bold text-dark small">End Time</label>
                <input
                  type="time"
                  className="form-control"
                  value={formData.scheduledEndTime}
                  onChange={e => setFormData({ ...formData, scheduledEndTime: e.target.value })}
                />
              </div>

              {/* SECTION 2: DELEGATION VISITORS LIST */}
              <div className="col-12 mt-4">
                <div className="alert alert-info py-2 px-3 small border-info-subtle bg-info-subtle text-info-emphasis d-flex align-items-center gap-2 mb-3 rounded-3">
                  <i className="bi bi-shield-check fs-5"></i>
                  <span>
                    <strong>Single Organization Request Rule:</strong> All <strong>{visitorList.length}</strong> visitor(s) in this submission are registered under <strong>1 Company</strong> (<strong className="text-primary">{formData.companyName.trim() || 'Specified Guest Organization'}</strong>). Multiple visitors from the same organization can be added below.
                  </span>
                </div>

                <div className="d-flex flex-wrap justify-content-between align-items-center border-bottom pb-2 mb-3 gap-2">
                  <h6 className="fw-bold text-primary mb-0 d-flex align-items-center gap-2">
                    <i className="bi bi-people-fill"></i>
                    2. REGISTERED VISITORS / ATTENDEES ({visitorList.length} Person{visitorList.length > 1 ? 's' : ''})
                  </h6>
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace px-2.5 py-1.5" style={{ fontSize: '0.78rem' }}>
                      <i className="bi bi-building me-1"></i>Company: {formData.companyName.trim() || '(Specify Above)'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-success fw-bold d-flex align-items-center gap-1 shadow-sm d-none"
                      onClick={handleAddVisitorRow}
                    >
                      <i className="bi bi-plus-lg"></i> Add Visitor ({formData.companyName.trim() || 'Same Company'})
                    </button>
                  </div>
                </div>
                <p className="text-muted small mb-3">
                  Enter details for each individual attending from <strong>{formData.companyName || 'this company'}</strong>. Managing Director will receive 1 batch request containing all attendees for approval.
                </p>
              </div>

              {/* DYNAMIC VISITOR ROWS */}
              {visitorList.map((v, idx) => (
                <div className="col-12" key={idx}>
                  <div className="p-3 border rounded-3 bg-light relative shadow-sm mb-2">
                    <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                      <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-dark text-white font-monospace px-2.5 py-1">
                          VISITOR #{idx + 1}
                        </span>
                        <span className="badge bg-white text-dark border font-monospace px-2 py-1">
                          <i className="bi bi-building text-primary me-1"></i>
                          {formData.companyName.trim() || 'Company Specified Above'}
                        </span>
                      </div>
                      {visitorList.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                          onClick={() => handleRemoveVisitorRow(idx)}
                        >
                          <i className="bi bi-trash"></i> Remove Visitor #{idx + 1}
                        </button>
                      )}
                    </div>

                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-bold text-dark small mb-1">Full Name <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. John Doe"
                          value={v.fullName}
                          onChange={e => handleVisitorChange(idx, 'fullName', e.target.value)}
                          required
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label fw-bold text-dark small mb-1">IC / Passport Number <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className="form-control font-monospace"
                          placeholder="e.g. IC-920101-14-5000"
                          value={v.idNumber}
                          onChange={e => handleVisitorChange(idx, 'idNumber', e.target.value)}
                          required
                        />
                      </div>

                      <div className="col-md-3">
                        <label className="form-label fw-bold text-dark small mb-1">Contact Phone</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="+60 12-345 6789"
                          value={v.phone}
                          onChange={e => handleVisitorChange(idx, 'phone', e.target.value)}
                        />
                      </div>

                      <div className="col-md-3">
                        <label className="form-label fw-bold text-dark small mb-1">Email Address</label>
                        <input
                          type="email"
                          className="form-control"
                          placeholder="visitor@company.com"
                          value={v.email}
                          onChange={e => handleVisitorChange(idx, 'email', e.target.value)}
                        />
                      </div>

                      <div className="col-md-3">
                        <label className="form-label fw-bold text-dark small mb-1">Vehicle Plate No.</label>
                        <input
                          type="text"
                          className="form-control font-monospace"
                          placeholder="e.g. W-8821-X"
                          value={v.vehicleNumber}
                          onChange={e => handleVisitorChange(idx, 'vehicleNumber', e.target.value)}
                        />
                      </div>

                      <div className="col-md-3">
                        <label className="form-label fw-bold text-dark small mb-1">Items / Laptops Carried</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Dell Laptop"
                          value={v.itemsCarried}
                          onChange={e => handleVisitorChange(idx, 'itemsCarried', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-top d-flex justify-content-between align-items-center">
              <button
                type="button"
                className="btn btn-outline-success fw-bold d-flex align-items-center gap-1"
                onClick={handleAddVisitorRow}
              >
                <i className="bi bi-plus-circle-fill"></i> + Add Another Visitor for {formData.companyName || 'Same Company'}
              </button>

              <div className="d-flex gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('LIST')}>Cancel</button>
                <button type="submit" className="btn btn-primary fw-bold px-4" disabled={saving}>
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span> Submitting Delegation...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle-fill me-1"></i> Submit Visit Pre-Registration ({visitorList.length} Visitor{visitorList.length > 1 ? 's' : ''})
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
        )
      )}

      {/* LIST TAB */}
      {activeTab === 'LIST' && (
        <div className="card border-0 shadow-sm bg-white">
          <div className="card-header bg-white py-3 border-bottom">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div>
                <h5 className="fw-bold mb-0 text-dark">
                  {isStaff ? 'My Registered Visitors' : 'Master Visitor Records'}
                </h5>
                <span className="text-muted small">Showing {filteredVisitors.length} of {visitors.length} total visitor entries</span>
              </div>

              {/* Quick Status Filter Pills */}
              <div className="d-flex flex-wrap gap-1">
                <button
                  type="button"
                  className={`btn btn-xs rounded-pill ${statusFilter === 'ALL' && companyFilter === 'ALL' ? 'btn-primary text-white fw-bold' : 'btn-outline-secondary'}`}
                  onClick={() => { setStatusFilter('ALL'); setCompanyFilter('ALL'); setSearchTerm(''); }}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                >
                  All ({visitors.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-xs rounded-pill ${statusFilter === 'CHECKED_IN' ? 'btn-success text-white fw-bold' : 'btn-outline-success'}`}
                  onClick={() => setStatusFilter('CHECKED_IN')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                >
                  <i className="bi bi-box-arrow-in-right me-1"></i> Checked-In ({visitors.filter(v => v.status === 'CHECKED_IN').length})
                </button>
                <button
                  type="button"
                  className={`btn btn-xs rounded-pill ${statusFilter === 'SCHEDULED' ? 'btn-info text-white fw-bold' : 'btn-outline-info'}`}
                  onClick={() => setStatusFilter('SCHEDULED')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                >
                  <i className="bi bi-calendar-event me-1"></i> Scheduled ({visitors.filter(v => v.status === 'SCHEDULED').length})
                </button>
                <button
                  type="button"
                  className={`btn btn-xs rounded-pill ${statusFilter === 'PENDING_APPROVAL' ? 'btn-warning text-dark fw-bold' : 'btn-outline-warning text-dark'}`}
                  onClick={() => setStatusFilter('PENDING_APPROVAL')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                >
                  <i className="bi bi-clock-history me-1"></i> Pending MD ({visitors.filter(v => v.status === 'PENDING_APPROVAL').length})
                </button>
                <button
                  type="button"
                  className={`btn btn-xs rounded-pill ${statusFilter === 'CHECKED_OUT' ? 'btn-secondary text-white fw-bold' : 'btn-outline-secondary'}`}
                  onClick={() => setStatusFilter('CHECKED_OUT')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                >
                  <i className="bi bi-box-arrow-right me-1"></i> Checked-Out ({visitors.filter(v => v.status === 'CHECKED_OUT').length})
                </button>
              </div>
            </div>

            {/* Filter Dropdowns and Search Input */}
            <div className="row g-2 align-items-center pt-2 border-top">
              <div className="col-md-4 col-sm-6">
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-light border-end-0"><i className="bi bi-search"></i></span>
                  <input
                    type="text"
                    className="form-control bg-light border-start-0"
                    placeholder="Search visitor, IC, host, venue, badge..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="col-md-4 col-sm-6">
                <select
                  className="form-select form-select-sm"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SCHEDULED">Scheduled / Approved</option>
                  <option value="CHECKED_IN">Checked-In (On-Premise)</option>
                  <option value="CHECKED_OUT">Checked-Out (Departed)</option>
                  <option value="PENDING_APPROVAL">Pending MD Approval</option>
                  <option value="REJECTED">MD Rejected</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div className="col-md-4 col-sm-6 d-flex align-items-center gap-1">
                <select
                  className="form-select form-select-sm"
                  value={companyFilter}
                  onChange={e => setCompanyFilter(e.target.value)}
                >
                  <option value="ALL">All Visitor Organizations ({uniqueCompanies.length})</option>
                  {uniqueCompanies.map((comp, idx) => (
                    <option key={idx} value={comp}>{comp}</option>
                  ))}
                </select>
                {(searchTerm || statusFilter !== 'ALL' || companyFilter !== 'ALL') && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary text-nowrap px-2"
                    title="Reset filters"
                    onClick={() => { setSearchTerm(''); setStatusFilter('ALL'); setCompanyFilter('ALL'); }}
                  >
                    <i className="bi bi-x-circle-fill me-1"></i>Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-muted small">
                <tr>
                  <th>REGISTRATION #</th>
                  <th>VISITOR DETAILS</th>
                  <th>ORGANIZATION</th>
                  <th>HOST & VENUE</th>
                  <th>SCHEDULED TIME (START & END)</th>
                  <th>STATUS</th>
                  {canSeePassBadge && <th>PASS BADGE</th>}
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={canSeePassBadge ? 8 : 7} className="text-center py-5">
                      <div className="spinner-border text-primary"></div>
                      <div className="mt-2 text-muted small">Loading visitor database...</div>
                    </td>
                  </tr>
                ) : filteredVisitors.length === 0 ? (
                  <tr>
                    <td colSpan={canSeePassBadge ? 8 : 7} className="text-center py-5 text-muted">
                      <i className="bi bi-inbox fs-1 d-block mb-2 text-secondary"></i>
                      No visitor registrations found.
                    </td>
                  </tr>
                ) : (
                  filteredVisitors.map(v => (
                    <tr key={v.id}>
                      <td className="font-monospace fw-bold text-dark small">{v.registrationNo}</td>
                      <td>
                        <div className="fw-bold text-dark">{v.fullName}</div>
                        <div className="text-muted font-monospace small" style={{ fontSize: '0.75rem' }}>IC/Pass: {v.idNumber}</div>
                        <div className="text-muted small" style={{ fontSize: '0.75rem' }}>{v.phone}</div>
                      </td>
                      <td className="small text-secondary">{v.companyName}</td>
                      <td>
                        <div className="fw-semibold text-dark small"><i className="bi bi-person me-1"></i>{v.hostUserName}</div>
                        <div className="text-muted small" style={{ fontSize: '0.75rem' }}><i className="bi bi-geo-alt me-1"></i>{v.meetingVenueName}</div>
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
                      </td>
                      <td>
                        <span className={`badge rounded-pill ${
                          v.status === 'CHECKED_IN' ? 'bg-success' :
                          v.status === 'CHECKED_OUT' ? 'bg-secondary' :
                          v.status === 'SCHEDULED' ? 'bg-primary' :
                          v.status === 'PENDING_APPROVAL' ? 'bg-warning text-dark' : 'bg-danger'
                        }`}>
                          {v.status === 'PENDING_APPROVAL' ? 'PENDING MD APPROVAL' :
                           v.status === 'SCHEDULED' ? 'APPROVED (SCHEDULED)' : v.status}
                        </span>
                        {v.approvalStatus === 'APPROVED' && (
                          <div className="text-success small mt-1 font-monospace" style={{ fontSize: '0.68rem' }}>
                            <i className="bi bi-patch-check-fill me-1"></i>Approved by MD
                          </div>
                        )}
                        {v.approvalStatus === 'REJECTED' && v.rejectionReason && (
                          <div className="text-danger small mt-1" style={{ fontSize: '0.68rem' }}>
                            <i className="bi bi-x-circle-fill me-1"></i>Rejected: {v.rejectionReason}
                          </div>
                        )}
                        {v.checkInSecurityUserName && (
                          <div className="text-muted small mt-1 font-monospace" style={{ fontSize: '0.68rem' }}>
                            <i className="bi bi-shield-check text-success me-1"></i>In: {v.checkInSecurityUserName}
                          </div>
                        )}
                        {v.checkOutSecurityUserName && (
                          <div className="text-muted small font-monospace" style={{ fontSize: '0.68rem' }}>
                            <i className="bi bi-shield-x text-danger me-1"></i>Out: {v.checkOutSecurityUserName}
                          </div>
                        )}
                      </td>
                      {canSeePassBadge && (
                        <td>
                          {v.passBadgeNumber ? (
                            <button className="btn btn-sm btn-outline-dark font-monospace py-0 px-2" onClick={() => onOpenBadge(v)}>
                              <i className="bi bi-pass me-1"></i> {v.passBadgeNumber}
                            </button>
                          ) : (
                            <span className="text-muted small">—</span>
                          )}
                        </td>
                      )}
                      <td>
                        <div className="d-flex gap-1">
                          {v.status === 'SCHEDULED' && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleCancel(v.id, v.fullName)}
                              title="Cancel Pre-Registration"
                            >
                              <i className="bi bi-x-circle"></i> Cancel
                            </button>
                          )}
                          {canSeePassBadge && v.passBadgeNumber && (
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => onOpenBadge(v)}
                              title="View & Print Pass Badge"
                            >
                              <i className="bi bi-printer"></i> Badge
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Submission Success Modal Popup */}
      <NotificationModal
        isOpen={!!submitPopup?.isOpen}
        title="Successfully Submitted"
        message={submitPopup?.message || ''}
        type="success"
        onClose={() => setSubmitPopup(null)}
      />
    </div>
  );
};
