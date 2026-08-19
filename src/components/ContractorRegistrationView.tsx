import React, { useEffect, useState } from 'react';
import { User, Contractor, ContractorCategory, MeetingVenue, Company } from '../types';
import { getContractors, registerContractor, getContractorCategories, getMeetingVenues, getUsers, getCompanies } from '../lib/api';
import { NotificationModal } from './notification';
import { formatDisplayDate } from '../lib/dateUtils';

interface ContractorRegistrationViewProps {
  currentUser: User;
  mode: 'REGISTER' | 'LIST';
  onOpenBadge: (c: Contractor) => void;
}

export const ContractorRegistrationView: React.FC<ContractorRegistrationViewProps> = ({ currentUser, mode, onOpenBadge }) => {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [categories, setCategories] = useState<ContractorCategory[]>([]);
  const [venues, setVenues] = useState<MeetingVenue[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'FORM' | 'LIST'>(mode === 'REGISTER' ? 'FORM' : 'LIST');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [submitPopup, setSubmitPopup] = useState<{ isOpen: boolean; message: string } | null>(null);

  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayStr();
  const [formData, setFormData] = useState({
    fullName: '',
    idNumber: '',
    phone: '',
    email: '',
    companyName: '',
    workOrderNo: '',
    contractorCategoryId: '',
    workScope: '',
    hostUserId: currentUser.id,
    locationVenueId: '',
    startDate: todayStr,
    endDate: todayStr,
    startTime: '08:00',
    endTime: '17:00',
    vehicleNumber: '',
    toolsEquipmentCarried: '',
    safetyInductionVerified: true
  });

  const [contractorList, setContractorList] = useState<Array<{
    fullName: string;
    idNumber: string;
    phone: string;
    email: string;
    vehicleNumber: string;
    toolsEquipmentCarried: string;
    isForeignWorker?: boolean;
    passportNumber?: string;
    nationality?: string;
    permitNumber?: string;
    permitExpiryDate?: string;
  }>>([
    { fullName: '', idNumber: '', phone: '', email: '', vehicleNumber: '', toolsEquipmentCarried: '', isForeignWorker: false, passportNumber: '', nationality: 'Non-Malaysian', permitNumber: '', permitExpiryDate: '' }
  ]);

  const [companies, setCompanies] = React.useState<Company[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ctrList, catList, venList, userList, compList] = await Promise.all([
        getContractors(),
        getContractorCategories(),
        getMeetingVenues(),
        getUsers(),
        getCompanies()
      ]);
      setContractors(ctrList);
      setCategories(catList);
      setVenues(venList);
      setAllUsers(userList);
      setCompanies(compList);

      if (catList.length > 0 && !formData.contractorCategoryId) {
        setFormData(f => ({ ...f, contractorCategoryId: catList[0].id }));
      }
      if (venList.length > 0 && !formData.locationVenueId) {
        setFormData(f => ({ ...f, locationVenueId: venList[0].id }));
      }
    } catch (err) {
      console.error('Error loading contractor view data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  // Known company names for quick selection / autocomplete (Strictly scoped by Staff Department)
  const knownCompanies = React.useMemo(() => {
    const setNames = new Set<string>();
    const myDept = (currentUser.departmentName || '').trim().toLowerCase();

    companies.forEach(comp => {
      if (comp.name && comp.isActive) {
        setNames.add(comp.name);
      }
    });

    contractors.forEach(c => {
      if (!c.companyName) return;
      if (currentUser.role === 'STAFF' && myDept) {
        const hostDept = (c.hostDepartment || '').trim().toLowerCase();
        if (hostDept && hostDept !== myDept) return;
      }
      setNames.add(c.companyName);
    });

    return Array.from(setNames);
  }, [companies, contractors, currentUser]);

  // Matching past contractors for selected company (Department Scoped)
  const matchingPastContractors = React.useMemo(() => {
    const query = (formData.companyName || '').trim().toLowerCase();
    const myDept = (currentUser.departmentName || '').trim().toLowerCase();

    const matches = contractors.filter(c => {
      if (!c.companyName) return false;

      if (query) {
        const compClean = c.companyName.trim().toLowerCase();
        if (compClean !== query) return false;
      }

      if (currentUser.role === 'STAFF' && myDept) {
        const hostDept = (c.hostDepartment || '').trim().toLowerCase();
        if (hostDept && hostDept !== myDept) return false;
      }
      return true;
    });

    const uniqueMap = new Map<string, Contractor>();
    matches.forEach(m => {
      const key = `${m.companyName.trim().toLowerCase()}::${(m.idNumber || m.fullName).trim().toLowerCase()}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, m);
      }
    });

    return Array.from(uniqueMap.values());
  }, [formData.companyName, contractors, currentUser]);

  const handleSelectCompany = (newCompanyName: string) => {
    const cleanOld = formData.companyName.trim().toLowerCase();
    const cleanNew = newCompanyName.trim().toLowerCase();

    if (cleanOld && cleanNew && cleanOld !== cleanNew) {
      const hasFilledRows = contractorList.some(v => v.fullName.trim() || v.idNumber.trim() || v.email.trim());
      if (hasFilledRows) {
        setContractorList([{ fullName: '', idNumber: '', phone: '', email: '', vehicleNumber: '', toolsEquipmentCarried: '' }]);
      }
    }
    setFormData(f => ({ ...f, companyName: newCompanyName }));
  };

  const togglePastContractor = (past: Contractor) => {
    if (past.companyName && formData.companyName.trim().toLowerCase() !== past.companyName.trim().toLowerCase()) {
      handleSelectCompany(past.companyName);
    }

    const isAlreadyAdded = contractorList.some(v =>
      (v.idNumber && past.idNumber && v.idNumber.trim().toLowerCase() === past.idNumber.trim().toLowerCase()) ||
      (v.fullName && past.fullName && v.fullName.trim().toLowerCase() === past.fullName.trim().toLowerCase())
    );

    if (isAlreadyAdded) {
      const updated = contractorList.filter(v =>
        !((v.idNumber && past.idNumber && v.idNumber.trim().toLowerCase() === past.idNumber.trim().toLowerCase()) ||
          (v.fullName && past.fullName && v.fullName.trim().toLowerCase() === past.fullName.trim().toLowerCase()))
      );
      setContractorList(updated.length > 0 ? updated : [{ fullName: '', idNumber: '', phone: '', email: '', vehicleNumber: '', toolsEquipmentCarried: '', isForeignWorker: false, passportNumber: '', nationality: 'Non-Malaysian', permitNumber: '', permitExpiryDate: '' }]);
    } else {
      const firstEmptyIndex = contractorList.findIndex(v => !v.fullName.trim() && !v.idNumber.trim());
      const newRow = {
        fullName: past.fullName,
        idNumber: past.idNumber,
        phone: past.phone || '',
        email: past.email || '',
        vehicleNumber: past.vehicleNumber || '',
        toolsEquipmentCarried: past.toolsEquipmentCarried || '',
        isForeignWorker: !!past.isForeignWorker,
        passportNumber: past.passportNumber || '',
        nationality: past.nationality || 'Non-Malaysian',
        permitNumber: past.permitNumber || '',
        permitExpiryDate: past.permitExpiryDate || ''
      };

      if (firstEmptyIndex !== -1) {
        const copy = [...contractorList];
        copy[firstEmptyIndex] = newRow;
        setContractorList(copy);
      } else {
        setContractorList([...contractorList, newRow]);
      }
    }
  };

  const handleAddContractorRow = () => {
    setContractorList([
      ...contractorList,
      { fullName: '', idNumber: '', phone: '', email: '', vehicleNumber: '', toolsEquipmentCarried: '', isForeignWorker: false, passportNumber: '', nationality: 'Non-Malaysian', permitNumber: '', permitExpiryDate: '' }
    ]);
  };

  const handleRemoveContractorRow = (index: number) => {
    if (contractorList.length === 1) {
      setContractorList([{ fullName: '', idNumber: '', phone: '', email: '', vehicleNumber: '', toolsEquipmentCarried: '', isForeignWorker: false, passportNumber: '', nationality: 'Non-Malaysian', permitNumber: '', permitExpiryDate: '' }]);
      return;
    }
    const updated = contractorList.filter((_, i) => i !== index);
    setContractorList(updated);
  };

  const handleContractorChange = (index: number, field: string, val: any) => {
    const updated = [...contractorList];
    const parsedVal = field === 'isForeignWorker' ? (val === 'true' || val === true) : val;
    updated[index] = { ...updated[index], [field]: parsedVal };
    setContractorList(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaff) {
      setErrorMsg('Administrator accounts cannot pre-register contractors on behalf of users. Only Staff can pre-register contractors.');
      return;
    }

    if (!formData.companyName.trim()) {
      setErrorMsg('Please enter or select a Contractor Company Name.');
      return;
    }
    if (!formData.workOrderNo.trim()) {
      setErrorMsg('Please enter a Work Order / Permit Number.');
      return;
    }

    const today = getTodayStr();
    if (formData.startDate < today) {
      setErrorMsg(`Work permit start date (${formData.startDate}) cannot be in the past. Please select today (${today}) or a future date.`);
      return;
    }
    if (formData.endDate < formData.startDate) {
      setErrorMsg(`Work permit end date (${formData.endDate}) cannot be earlier than start date (${formData.startDate}).`);
      return;
    }
    if (formData.startDate === formData.endDate && formData.startTime && formData.endTime && formData.endTime <= formData.startTime) {
      setErrorMsg(`Work end time (${formData.endTime}) must be later than work start time (${formData.startTime}) for single-day permit.`);
      return;
    }

    // Validate contractor worker list and single email domain
    const emailDomains = new Set<string>();
    for (let i = 0; i < contractorList.length; i++) {
      const v = contractorList[i];
      if (!v.fullName.trim() || !v.idNumber.trim()) {
        setErrorMsg(`Contractor Worker #${i + 1} is missing required fields (Full Name and IC/Passport Number).`);
        return;
      }
      if (v.isForeignWorker) {
        if (!v.passportNumber && !v.idNumber) {
          setErrorMsg(`Contractor Worker #${i + 1} (${v.fullName || 'Worker'}) is marked as a Foreign Worker but is missing a Passport Number.`);
          return;
        }
        if (!v.permitExpiryDate) {
          setErrorMsg(`Contractor Worker #${i + 1} (${v.fullName || 'Worker'}) is a Foreign Worker and requires a Work Permit Expiry Date.`);
          return;
        }
        if (v.permitExpiryDate < today) {
          setErrorMsg(`EXPIRED WORK PERMIT REJECTED: Contractor Worker #${i + 1} (${v.fullName || 'Worker'}) has an expired work permit (${v.permitExpiryDate}). Under Malaysian Security & Immigration guidelines, foreign contractors with expired work permits cannot be registered.`);
          return;
        }
      }
      if (v.email && v.email.includes('@')) {
        const domain = v.email.split('@')[1].trim().toLowerCase();
        if (domain) emailDomains.add(domain);
      }
    }

    if (emailDomains.size > 1) {
      setErrorMsg(`Single Organization Violation: Detected workers with different email domains (${Array.from(emailDomains).map(d => '@' + d).join(', ')}). A single work order request cannot mix workers from different companies. Please raise separate requests for each company.`);
      return;
    }

    try {
      setSaving(true);
      setErrorMsg('');

      const payload = {
        ...formData,
        fullName: contractorList[0].fullName,
        idNumber: contractorList[0].idNumber,
        phone: contractorList[0].phone,
        email: contractorList[0].email,
        vehicleNumber: contractorList[0].vehicleNumber,
        toolsEquipmentCarried: contractorList[0].toolsEquipmentCarried,
        contractorsList: contractorList
      };

      const created = await registerContractor(payload);
      setSuccessMsg(`Contractor Work Permit submitted for ${contractorList.length} worker(s) under Work Order ${created.workOrderNo} (${created.companyName})`);
      setSubmitPopup({
        isOpen: true,
        message: `Successfully submitted! Contractor work permit request for ${contractorList.length} worker(s) under Work Order: ${created.workOrderNo} (${created.companyName}).`
      });

      setFormData({
        fullName: '',
        idNumber: '',
        phone: '',
        email: '',
        companyName: '',
        workOrderNo: '',
        contractorCategoryId: categories[0]?.id || '',
        workScope: '',
        hostUserId: currentUser.id,
        locationVenueId: venues[0]?.id || '',
        startDate: todayStr,
        endDate: todayStr,
        startTime: '08:00',
        endTime: '17:00',
        vehicleNumber: '',
        toolsEquipmentCarried: '',
        safetyInductionVerified: true
      });

      setContractorList([{ fullName: '', idNumber: '', phone: '', email: '', vehicleNumber: '', toolsEquipmentCarried: '' }]);

      await loadData();
      setActiveTab('LIST');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register contractor');
    } finally {
      setSaving(false);
    }
  };

  const isStaff = currentUser.role === 'STAFF';
  const canSeePassBadge = currentUser.role !== 'STAFF' && currentUser.role !== 'MANAGING_DIRECTOR';

  // Filter States
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');

  // Unique contractor companies
  const uniqueContractorCompanies = Array.from(new Set(contractors.map(c => c.companyName.trim()).filter(Boolean)));
  // Unique technical categories
  const uniqueCategories = Array.from(new Set(contractors.map(c => c.technicalCategory?.trim()).filter(Boolean)));

  const filteredContractors = contractors.filter(c => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      c.fullName.toLowerCase().includes(term) ||
      c.idNumber.toLowerCase().includes(term) ||
      c.workOrderNo.toLowerCase().includes(term) ||
      c.companyName.toLowerCase().includes(term) ||
      c.hostUserName.toLowerCase().includes(term) ||
      (c.technicalCategory && c.technicalCategory.toLowerCase().includes(term)) ||
      (c.workScopeDescription && c.workScopeDescription.toLowerCase().includes(term)) ||
      (c.vehicleNumber && c.vehicleNumber.toLowerCase().includes(term)) ||
      (c.passBadgeNumber && c.passBadgeNumber.toLowerCase().includes(term));

    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesCategory = categoryFilter === 'ALL' || c.technicalCategory === categoryFilter;
    const matchesCompany = companyFilter === 'ALL' || c.companyName.trim().toLowerCase() === companyFilter.trim().toLowerCase();

    return matchesSearch && matchesStatus && matchesCategory && matchesCompany;
  });

  return (
    <div className="p-4">
      {/* View Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom gap-3">
        <div>
          <h3 className="fw-extrabold text-dark mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-tools text-info"></i>
            {isStaff ? 'My Contractor Registrations' : 'Enterprise Contractor Work Orders'}
          </h3>
          <p className="text-muted mb-0 small">
            {isStaff
              ? 'Register vendor contractors attending facility works, electrical maintenance, or IT setup.'
              : 'Master repository of external technical contractor work orders and access permits.'}
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="btn-group shadow-sm">
          <button
            className={`btn ${activeTab === 'LIST' ? 'btn-info text-white fw-bold' : 'btn-outline-info'}`}
            onClick={() => setActiveTab('LIST')}
          >
            <i className="bi bi-list-ul me-1"></i>
            {isStaff ? 'My Contractors List' : 'All Contractors List'} ({contractors.length})
          </button>
          {isStaff && (
            <button
              className={`btn ${activeTab === 'FORM' ? 'btn-info text-white fw-bold' : 'btn-outline-info'}`}
              onClick={() => setActiveTab('FORM')}
            >
              <i className="bi bi-plus-lg me-1"></i>
              Pre-Register Contractor Work Permit
            </button>
          )}
        </div>
      </div>

      {/* Staff Isolation Alert Banner */}
      {isStaff && (
        <div className="alert alert-info border-info bg-white shadow-sm d-flex align-items-center justify-content-between mb-4">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-shield-lock-fill text-info fs-4"></i>
            <div>
              <strong className="text-dark">Staff Access Security Guard:</strong> Showing ONLY contractors supervised by <strong>{currentUser.fullName} ({currentUser.departmentName})</strong>.
            </div>
          </div>
          <span className="badge bg-info text-white">STRICT HOST ISOLATION</span>
        </div>
      )}

      {/* Feedback Messages */}
      {successMsg && (
        <div className="alert alert-success alert-dismissible fade show shadow-sm mb-4">
          <i className="bi bi-check-circle-fill me-2"></i> {successMsg}
          <button type="button" className="btn-close" onClick={() => setSuccessMsg('')}></button>
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-danger alert-dismissible fade show shadow-sm mb-4">
          <i className="bi bi-exclamation-triangle-fill me-2"></i> {errorMsg}
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
                    Under enterprise security policy, <strong>Administrator and Security accounts do not have access to pre-register contractors on behalf of users</strong>.
                  </p>
                  <p className="small text-secondary mb-0">
                    <i className="bi bi-info-circle me-1"></i> This policy prevents cheating, fake work permits, and unauthorized entry passes. Contractors must be registered directly by the supervising <strong>Staff Member</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card border-0 shadow-sm bg-white mx-auto" style={{ maxWidth: '900px' }}>
          <div className="card-header bg-dark text-white p-3 d-flex align-items-center gap-2">
            <i className="bi bi-tools text-info fs-5"></i>
            <h5 className="fw-bold mb-0">Contractor Work Order Registration Form</h5>
          </div>

          <form onSubmit={handleSubmit} className="card-body p-4">
            <div className="row g-3">
              {/* SECTION 1: WORK ORDER & COMPANY DETAILS */}
              <div className="col-12">
                <h6 className="fw-bold text-info border-bottom pb-2 mb-2 d-flex align-items-center gap-2">
                  <i className="bi bi-building"></i>
                  1. WORK ORDER & CONTRACTOR COMPANY DETAILS
                </h6>
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold text-dark small d-flex justify-content-between align-items-center">
                  <span>Contractor Company Name <span className="text-danger">*</span></span>
                  {knownCompanies.length > 0 && (
                    <span className="text-muted small fw-normal">
                      <i className="bi bi-clock-history me-1"></i>Select or type company
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  list="contractorCompanySuggestions"
                  className="form-control fw-bold"
                  placeholder="Type or select company (e.g. Apex Global Solutions)"
                  value={formData.companyName}
                  onChange={e => handleSelectCompany(e.target.value)}
                  required
                />
                <datalist id="contractorCompanySuggestions">
                  {knownCompanies.map((cName, idx) => (
                    <option key={idx} value={cName} />
                  ))}
                </datalist>

                {/* Quick Company Selection Chips */}
                {knownCompanies.length > 0 && (
                  <div className="d-flex flex-wrap align-items-center gap-1.5 mt-2">
                    <span className="text-muted small fs-7 fw-semibold">
                      <i className="bi bi-diagram-3 text-info me-1"></i>
                      Quick Select Company ({currentUser.departmentName || 'Your Department'} History):
                    </span>
                    {knownCompanies.slice(0, 6).map((cName, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`btn btn-xs ${
                          formData.companyName.trim().toLowerCase() === cName.toLowerCase()
                            ? 'btn-info text-white fw-bold shadow-xs'
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

              <div className="col-md-6">
                <label className="form-label fw-bold text-dark small">Work Order / Permit # <span className="text-danger">*</span></label>
                <input
                  type="text"
                  className="form-control font-monospace fw-bold"
                  placeholder="e.g. WO-2026-991"
                  value={formData.workOrderNo}
                  onChange={e => setFormData({ ...formData, workOrderNo: e.target.value })}
                  required
                />
              </div>

              {/* PAST CONTRACTORS QUICK SELECTION PANEL */}
              {matchingPastContractors.length > 0 && (
                <div className="col-12 mt-2">
                  <div className="card border-info-subtle bg-info-subtle shadow-xs rounded-3 p-3">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2 pb-2 border-bottom border-info-subtle">
                      <div>
                        <h6 className="fw-bold text-info-emphasis mb-0 d-flex align-items-center gap-2">
                          <i className="bi bi-person-lines-fill fs-5"></i>
                          Select Previous Contractors {formData.companyName.trim() ? `from "${formData.companyName}"` : '(Foreign & Local Workers from Database)'} ({matchingPastContractors.length} Worker{matchingPastContractors.length > 1 ? 's' : ''} - {currentUser.departmentName || 'Department'} Records)
                        </h6>
                        <span className="text-secondary small">
                          Click any previous contractor worker below to quickly auto-fill their company and permit details into this work permit:
                        </span>
                      </div>
                    </div>

                    <div className="row g-2">
                      {matchingPastContractors.map(past => {
                        const isAdded = contractorList.some(v =>
                          (v.idNumber && past.idNumber && v.idNumber.trim().toLowerCase() === past.idNumber.trim().toLowerCase()) ||
                          (v.fullName && past.fullName && v.fullName.trim().toLowerCase() === past.fullName.trim().toLowerCase())
                        );
                        return (
                          <div className="col-lg-4 col-md-6" key={past.id}>
                            <div
                              className={`card p-2.5 h-100 transition-all border ${
                                isAdded
                                  ? 'border-success bg-success-subtle text-success-emphasis shadow-xs'
                                  : 'border-white bg-white hover:border-info shadow-xs'
                              }`}
                              style={{ cursor: 'pointer', borderRadius: '8px' }}
                              onClick={() => togglePastContractor(past)}
                            >
                              <div className="d-flex align-items-start justify-content-between gap-2 mb-1">
                                <div>
                                  <div className="fw-bold text-dark small">{past.fullName}</div>
                                  <div className="text-muted small fw-semibold" style={{ fontSize: '0.75rem' }}>
                                    <i className="bi bi-building text-info me-1"></i>{past.companyName}
                                  </div>
                                  <div className="d-flex flex-wrap gap-1 align-items-center mt-1">
                                    <span className="badge bg-light text-dark border font-monospace" style={{ fontSize: '0.72rem' }}>
                                      <i className="bi bi-card-heading me-1"></i>{past.passportNumber || past.idNumber}
                                    </span>
                                    {past.isForeignWorker && (
                                      <span className={`badge ${past.permitStatus === 'EXPIRED' ? 'bg-danger text-white' : 'bg-primary-subtle text-primary border border-primary-subtle'} font-monospace`} style={{ fontSize: '0.68rem' }}>
                                        <i className="bi bi-globe2 me-1"></i>Permit Exp: {past.permitExpiryDate || 'N/A'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isAdded ? (
                                  <span className="badge bg-success text-white px-2 py-1 rounded-pill small d-flex align-items-center gap-1" style={{ fontSize: '0.7rem' }}>
                                    <i className="bi bi-check-circle-fill"></i> Selected
                                  </span>
                                ) : (
                                  <span className="btn btn-xs btn-outline-info fw-bold px-2 py-0.5 rounded-pill" style={{ fontSize: '0.7rem' }}>
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
                <label className="form-label fw-bold text-dark small">Contractor Technical Category</label>
                <select
                  className="form-select"
                  value={formData.contractorCategoryId}
                  onChange={e => setFormData({ ...formData, contractorCategoryId: e.target.value })}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold text-dark small">Work Location / Venue Zone</label>
                <select
                  className="form-select"
                  value={formData.locationVenueId}
                  onChange={e => setFormData({ ...formData, locationVenueId: e.target.value })}
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

              <div className="col-12">
                <label className="form-label fw-bold text-dark small">Scope of Work / Task Description</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="e.g. Datacenter Fiber Optic Patching & Core Switch Installation"
                  value={formData.workScope}
                  onChange={e => setFormData({ ...formData, workScope: e.target.value })}
                ></textarea>
              </div>

              <div className="col-md-3">
                <label className="form-label fw-bold text-dark small">Work Start Date</label>
                <input
                  type="date"
                  className="form-control"
                  min={getTodayStr()}
                  value={formData.startDate}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>

              <div className="col-md-3">
                <label className="form-label fw-bold text-dark small">Work Start Time</label>
                <input
                  type="time"
                  className="form-control"
                  value={formData.startTime}
                  onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>

              <div className="col-md-3">
                <label className="form-label fw-bold text-dark small">Work End Date</label>
                <input
                  type="date"
                  className="form-control"
                  min={formData.startDate || getTodayStr()}
                  value={formData.endDate}
                  onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>

              <div className="col-md-3">
                <label className="form-label fw-bold text-dark small">Work End Time</label>
                <input
                  type="time"
                  className="form-control"
                  value={formData.endTime}
                  onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>

              {/* SECTION 2: REGISTERED CONTRACTOR WORKERS */}
              <div className="col-12 mt-4">
                <div className="alert alert-info py-2 px-3 small border-info-subtle bg-info-subtle text-info-emphasis d-flex align-items-center gap-2 mb-3 rounded-3">
                  <i className="bi bi-shield-check fs-5"></i>
                  <span>
                    <strong>Single Organization Request Rule:</strong> All <strong>{contractorList.length}</strong> contractor worker(s) in this submission are registered under <strong>1 Company</strong> (<strong className="text-info-emphasis">{formData.companyName.trim() || 'Specified Contractor Company'}</strong>). Multiple workers from the same company can be added below.
                  </span>
                </div>

                <div className="d-flex flex-wrap justify-content-between align-items-center border-bottom pb-2 mb-3 gap-2">
                  <h6 className="fw-bold text-info mb-0 d-flex align-items-center gap-2">
                    <i className="bi bi-people-fill"></i>
                    2. REGISTERED CONTRACTORS / WORKERS ({contractorList.length} Person{contractorList.length > 1 ? 's' : ''})
                  </h6>
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle font-monospace px-2.5 py-1.5" style={{ fontSize: '0.78rem' }}>
                      <i className="bi bi-building me-1"></i>Company: {formData.companyName.trim() || '(Specify Above)'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-success fw-bold d-flex align-items-center gap-1 shadow-sm d-none"
                      onClick={handleAddContractorRow}
                    >
                      <i className="bi bi-plus-lg"></i> Add Contractor ({formData.companyName.trim() || 'Same Company'})
                    </button>
                  </div>
                </div>
                <p className="text-muted small mb-3">
                  Enter details for each contractor worker attending from <strong>{formData.companyName || 'this company'}</strong>. Managing Director will receive 1 batch work order containing all workers for approval.
                </p>
              </div>

              {/* DYNAMIC CONTRACTOR WORKER ROWS */}
              {contractorList.map((v, idx) => (
                <div className="col-12" key={idx}>
                  <div className="p-3 border rounded-3 bg-light relative shadow-sm mb-2">
                    <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                      <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-dark text-white font-monospace px-2.5 py-1">
                          CONTRACTOR WORKER #{idx + 1}
                        </span>
                        <span className="badge bg-white text-dark border font-monospace px-2 py-1">
                          <i className="bi bi-building text-info me-1"></i>
                          {formData.companyName.trim() || 'Company Specified Above'}
                        </span>
                      </div>
                      {contractorList.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-xs fw-bold px-2 py-1"
                          onClick={() => handleRemoveContractorRow(idx)}
                        >
                          <i className="bi bi-trash me-1"></i> Remove
                        </button>
                      )}
                    </div>

                    <div className="row g-2">
                      <div className="col-md-6">
                        <label className="form-label fw-bold text-dark small mb-1">Worker Full Name <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="e.g. Robert Henderson"
                          value={v.fullName}
                          onChange={e => handleContractorChange(idx, 'fullName', e.target.value)}
                          required
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label fw-bold text-dark small mb-1">IC / Passport Number <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className="form-control form-control-sm font-monospace"
                          placeholder="e.g. IC-820115-05-4421"
                          value={v.idNumber}
                          onChange={e => handleContractorChange(idx, 'idNumber', e.target.value)}
                          required
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label text-dark small mb-1">Phone Number</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="+1 (555) 987-6543"
                          value={v.phone}
                          onChange={e => handleContractorChange(idx, 'phone', e.target.value)}
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label text-dark small mb-1">Email Address</label>
                        <input
                          type="email"
                          className="form-control form-control-sm"
                          placeholder="robert@contractorcompany.com"
                          value={v.email}
                          onChange={e => handleContractorChange(idx, 'email', e.target.value)}
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label text-dark small mb-1">Vehicle Plate Number</label>
                        <input
                          type="text"
                          className="form-control form-control-sm font-monospace"
                          placeholder="e.g. VAN-7722"
                          value={v.vehicleNumber}
                          onChange={e => handleContractorChange(idx, 'vehicleNumber', e.target.value)}
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label text-dark small mb-1">Tools / Equipment / Heavy Machinery</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="e.g. OTDR Meter, Splicing Machine, Tool Box #4"
                          value={v.toolsEquipmentCarried}
                          onChange={e => handleContractorChange(idx, 'toolsEquipmentCarried', e.target.value)}
                        />
                      </div>

                      {/* FOREIGN WORKER TOGGLE & PERMIT FIELDS */}
                      <div className="col-12 mt-2">
                        <div className={`p-2.5 rounded-3 border transition-all ${v.isForeignWorker ? 'bg-primary-subtle border-primary text-primary-emphasis' : 'bg-white border-light-subtle'}`}>
                          <div className="form-check form-switch mb-0">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              role="switch"
                              id={`foreignCheck-${idx}`}
                              checked={!!v.isForeignWorker}
                              onChange={e => {
                                handleContractorChange(idx, 'isForeignWorker', String(e.target.checked));
                                if (e.target.checked && !v.nationality) {
                                  handleContractorChange(idx, 'nationality', 'Indonesian');
                                }
                              }}
                            />
                            <label className="form-check-label fw-bold small text-dark d-flex align-items-center gap-1.5 cursor-pointer" htmlFor={`foreignCheck-${idx}`}>
                              <i className="bi bi-globe2 text-primary"></i> Foreign Worker / Non-Malaysian Contractor (Requires Valid Work Permit Expiry Date)
                            </label>
                          </div>

                          {v.isForeignWorker && (
                            <div className="mt-3 pt-2 border-top border-primary-subtle">
                              <div className="row g-2">
                                <div className="col-md-4">
                                  <label className="form-label fw-bold text-dark small mb-1">Passport Number <span className="text-danger">*</span></label>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm font-monospace fw-bold"
                                    placeholder="e.g. A-9812401"
                                    value={v.passportNumber || v.idNumber}
                                    onChange={e => {
                                      handleContractorChange(idx, 'passportNumber', e.target.value);
                                      if (!v.idNumber || v.idNumber === v.passportNumber) {
                                        handleContractorChange(idx, 'idNumber', e.target.value);
                                      }
                                    }}
                                    required
                                  />
                                </div>

                                <div className="col-md-4">
                                  <label className="form-label fw-bold text-dark small mb-1">Nationality</label>
                                  <select
                                    className="form-select form-select-sm"
                                    value={v.nationality || 'Indonesian'}
                                    onChange={e => handleContractorChange(idx, 'nationality', e.target.value)}
                                  >
                                    <option value="Indonesian">Indonesia</option>
                                    <option value="Bangladeshi">Bangladesh</option>
                                    <option value="Nepalese">Nepal</option>
                                    <option value="Indian">India</option>
                                    <option value="Myanmar">Myanmar</option>
                                    <option value="Pakistani">Pakistan</option>
                                    <option value="Filipino">Philippines</option>
                                    <option value="Vietnamese">Vietnam</option>
                                    <option value="Other">Other Non-Malaysian</option>
                                  </select>
                                </div>

                                <div className="col-md-4">
                                  <label className="form-label fw-bold text-dark small mb-1">Permit Expiry Date <span className="text-danger">*</span></label>
                                  <input
                                    type="date"
                                    className="form-control form-control-sm font-monospace fw-bold"
                                    min={getTodayStr()}
                                    value={v.permitExpiryDate || ''}
                                    onChange={e => handleContractorChange(idx, 'permitExpiryDate', e.target.value)}
                                    required
                                  />
                                </div>

                                <div className="col-12 mt-1">
                                  {v.permitExpiryDate ? (
                                    v.permitExpiryDate < getTodayStr() ? (
                                      <div className="alert alert-danger py-1 px-2.5 mb-0 small d-flex align-items-center gap-1.5 fw-bold">
                                        <i className="bi bi-x-circle-fill fs-6"></i>
                                        EXPIRED WORK PERMIT ({v.permitExpiryDate}): Cannot register foreign worker per Malaysian Immigration regulation.
                                      </div>
                                    ) : (
                                      <div className="alert alert-success py-1 px-2.5 mb-0 small d-flex align-items-center gap-1.5 text-success-emphasis fw-bold">
                                        <i className="bi bi-shield-check fs-6 text-success"></i>
                                        VALID WORK PERMIT VERIFIED (Expires: {v.permitExpiryDate})
                                      </div>
                                    )
                                  ) : (
                                    <span className="text-muted small fst-italic" style={{ fontSize: '0.75rem' }}>
                                      <i className="bi bi-info-circle me-1"></i>Please specify the foreign worker&apos;s valid work permit expiry date.
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="col-12 mt-3">
                <div className="form-check bg-light p-3 rounded border">
                  <input
                    type="checkbox"
                    className="form-check-input ms-0 me-2"
                    id="safetyCheck"
                    checked={formData.safetyInductionVerified}
                    onChange={e => setFormData({ ...formData, safetyInductionVerified: e.target.checked })}
                  />
                  <label className="form-check-label fw-bold text-dark small" htmlFor="safetyCheck">
                    <i className="bi bi-shield-check text-success me-1"></i> Verify Safety Induction Completed (PPE & High-Risk Access Briefing Completed)
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-top d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('LIST')}>Cancel</button>
              <button type="submit" className="btn btn-info text-white fw-bold px-4" disabled={saving}>
                {saving ? 'Registering...' : `Submit Contractor Work Permit (${contractorList.length} Worker${contractorList.length > 1 ? 's' : ''})`}
              </button>
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
                  {isStaff ? 'My Supervised Contractor Permits' : 'All Contractor Work Orders'}
                </h5>
                <span className="text-muted small">Showing {filteredContractors.length} of {contractors.length} total contractor work permits</span>
              </div>

              {/* Quick Filter Pills */}
              <div className="d-flex flex-wrap gap-1">
                <button
                  type="button"
                  className={`btn btn-xs rounded-pill ${statusFilter === 'ALL' && categoryFilter === 'ALL' && companyFilter === 'ALL' ? 'btn-primary text-white fw-bold' : 'btn-outline-secondary'}`}
                  onClick={() => { setStatusFilter('ALL'); setCategoryFilter('ALL'); setCompanyFilter('ALL'); setSearchTerm(''); }}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                >
                  All ({contractors.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-xs rounded-pill ${statusFilter === 'CHECKED_IN' ? 'btn-success text-white fw-bold' : 'btn-outline-success'}`}
                  onClick={() => setStatusFilter('CHECKED_IN')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                >
                  <i className="bi bi-box-arrow-in-right me-1"></i> Checked-In ({contractors.filter(c => c.status === 'CHECKED_IN').length})
                </button>
                <button
                  type="button"
                  className={`btn btn-xs rounded-pill ${statusFilter === 'APPROVED' ? 'btn-info text-white fw-bold' : 'btn-outline-info'}`}
                  onClick={() => setStatusFilter('APPROVED')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                >
                  <i className="bi bi-check-circle me-1"></i> Approved Permits ({contractors.filter(c => c.status === 'APPROVED').length})
                </button>
                <button
                  type="button"
                  className={`btn btn-xs rounded-pill ${statusFilter === 'PENDING_APPROVAL' ? 'btn-warning text-dark fw-bold' : 'btn-outline-warning text-dark'}`}
                  onClick={() => setStatusFilter('PENDING_APPROVAL')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                >
                  <i className="bi bi-clock-history me-1"></i> Pending MD ({contractors.filter(c => c.status === 'PENDING_APPROVAL').length})
                </button>
                <button
                  type="button"
                  className={`btn btn-xs rounded-pill ${statusFilter === 'CHECKED_OUT' ? 'btn-secondary text-white fw-bold' : 'btn-outline-secondary'}`}
                  onClick={() => setStatusFilter('CHECKED_OUT')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                >
                  <i className="bi bi-box-arrow-right me-1"></i> Checked-Out ({contractors.filter(c => c.status === 'CHECKED_OUT').length})
                </button>
              </div>
            </div>

            {/* Filter Dropdowns and Search Input */}
            <div className="row g-2 align-items-center pt-2 border-top">
              <div className="col-md-3 col-sm-6">
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-light border-end-0"><i className="bi bi-search"></i></span>
                  <input
                    type="text"
                    className="form-control bg-light border-start-0"
                    placeholder="Search WO #, contractor, IC, company..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="col-md-3 col-sm-6">
                <select
                  className="form-select form-select-sm"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Permit Statuses</option>
                  <option value="APPROVED">Approved Permits</option>
                  <option value="CHECKED_IN">Checked-In (On-Premise)</option>
                  <option value="CHECKED_OUT">Checked-Out (Completed)</option>
                  <option value="PENDING_APPROVAL">Pending MD Approval</option>
                  <option value="REJECTED">MD Rejected</option>
                </select>
              </div>

              <div className="col-md-3 col-sm-6">
                <select
                  className="form-select form-select-sm"
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                >
                  <option value="ALL">All Technical Categories ({uniqueCategories.length})</option>
                  {uniqueCategories.map((cat, idx) => (
                    <option key={idx} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-3 col-sm-6 d-flex align-items-center gap-1">
                <select
                  className="form-select form-select-sm"
                  value={companyFilter}
                  onChange={e => setCompanyFilter(e.target.value)}
                >
                  <option value="ALL">All Vendor Companies ({uniqueContractorCompanies.length})</option>
                  {uniqueContractorCompanies.map((comp, idx) => (
                    <option key={idx} value={comp}>{comp}</option>
                  ))}
                </select>
                {(searchTerm || statusFilter !== 'ALL' || categoryFilter !== 'ALL' || companyFilter !== 'ALL') && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary text-nowrap px-2"
                    title="Reset filters"
                    onClick={() => { setSearchTerm(''); setStatusFilter('ALL'); setCategoryFilter('ALL'); setCompanyFilter('ALL'); }}
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
                  <th>REGISTRATION & WO #</th>
                  <th>CONTRACTOR DETAILS</th>
                  <th>WORK SCOPE</th>
                  <th>SUPERVISOR / VENUE</th>
                  <th>DATES</th>
                  <th>STATUS</th>
                  {canSeePassBadge && <th>PASS BADGE</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={canSeePassBadge ? 7 : 6} className="text-center py-5">
                      <div className="spinner-border text-info"></div>
                    </td>
                  </tr>
                ) : filteredContractors.length === 0 ? (
                  <tr>
                    <td colSpan={canSeePassBadge ? 7 : 6} className="text-center py-5 text-muted">No contractor work permits found.</td>
                  </tr>
                ) : (
                  filteredContractors.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div className="font-monospace fw-bold text-dark small">{c.registrationNo}</div>
                        <div className="font-monospace text-primary small">WO: {c.workOrderNo}</div>
                      </td>
                      <td>
                        <div className="fw-bold text-dark">{c.fullName}</div>
                        <div className="text-muted small" style={{ fontSize: '0.75rem' }}>{c.companyName}</div>
                        <div className="text-muted font-monospace small" style={{ fontSize: '0.75rem' }}>IC/Passport: {c.passportNumber || c.idNumber}</div>
                        {c.isForeignWorker && (
                          <div className="mt-1">
                            <span className={`badge ${c.permitStatus === 'EXPIRED' ? 'bg-danger-subtle text-danger border-danger-subtle' : 'bg-primary-subtle text-primary border-primary-subtle'} border font-monospace d-inline-block`} style={{ fontSize: '0.65rem' }}>
                              <i className="bi bi-globe2 me-1"></i>Permit Exp: {c.permitExpiryDate ? formatDisplayDate(c.permitExpiryDate) : 'N/A'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="small text-secondary" style={{ maxWidth: '220px' }}>
                        <div><strong>{c.contractorCategoryName}</strong></div>
                        <div className="text-truncate">{c.workScope}</div>
                      </td>
                      <td>
                        <div className="fw-semibold text-dark small">{c.hostUserName}</div>
                        <div className="text-muted small"><i className="bi bi-geo-alt me-1"></i>{c.locationVenueName}</div>
                      </td>
                      <td className="small font-monospace">
                        <div className="fw-semibold text-dark">{formatDisplayDate(c.startDate)} to {formatDisplayDate(c.endDate)}</div>
                        <div className="text-primary fw-semibold" style={{ fontSize: '0.75rem' }}><i className="bi bi-clock me-1"></i>{c.startTime || '08:00'} – {c.endTime || '17:00'}</div>
                      </td>
                      <td>
                        <span className={`badge rounded-pill ${
                          c.status === 'CHECKED_IN' ? 'bg-success' :
                          c.status === 'CHECKED_OUT' ? 'bg-secondary' :
                          c.status === 'SCHEDULED' ? 'bg-primary' :
                          c.status === 'PENDING_APPROVAL' ? 'bg-warning text-dark' : 'bg-danger'
                        }`}>
                          {c.status === 'PENDING_APPROVAL' ? 'PENDING MD APPROVAL' :
                           c.status === 'SCHEDULED' ? 'APPROVED (SCHEDULED)' : c.status}
                        </span>
                        {c.approvalStatus === 'APPROVED' && (
                          <div className="text-success small mt-1 font-monospace" style={{ fontSize: '0.68rem' }}>
                            <i className="bi bi-patch-check-fill me-1"></i>Approved by MD
                          </div>
                        )}
                        {c.approvalStatus === 'REJECTED' && c.rejectionReason && (
                          <div className="text-danger small mt-1" style={{ fontSize: '0.68rem' }}>
                            <i className="bi bi-x-circle-fill me-1"></i>Rejected: {c.rejectionReason}
                          </div>
                        )}
                        {c.checkInSecurityUserName && (
                          <div className="text-muted small mt-1 font-monospace" style={{ fontSize: '0.68rem' }}>
                            <i className="bi bi-shield-check text-success me-1"></i>In: {c.checkInSecurityUserName}
                          </div>
                        )}
                        {c.checkOutSecurityUserName && (
                          <div className="text-muted small font-monospace" style={{ fontSize: '0.68rem' }}>
                            <i className="bi bi-shield-x text-danger me-1"></i>Out: {c.checkOutSecurityUserName}
                          </div>
                        )}
                      </td>
                      {canSeePassBadge && (
                        <td>
                          {c.passBadgeNumber ? (
                            <button className="btn btn-sm btn-outline-dark font-monospace py-0 px-2" onClick={() => onOpenBadge(c)}>
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
