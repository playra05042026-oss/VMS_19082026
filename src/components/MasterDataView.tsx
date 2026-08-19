import React, { useEffect, useState } from 'react';
import { Department, Company, VisitorCategory, ContractorCategory, MeetingVenue } from '../types';
import { NotificationBanner } from './notification';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  getVisitorCategories,
  createVisitorCategory,
  updateVisitorCategory,
  deleteVisitorCategory,
  getContractorCategories,
  createContractorCategory,
  updateContractorCategory,
  deleteContractorCategory,
  getMeetingVenues,
  createMeetingVenue,
  updateMeetingVenue,
  deleteMeetingVenue
} from '../lib/api';

interface MasterDataViewProps {
  initialTab?: 'DEPARTMENTS' | 'COMPANIES' | 'CATEGORIES' | 'VENUES';
}

export const MasterDataView: React.FC<MasterDataViewProps> = ({ initialTab = 'DEPARTMENTS' }) => {
  const [activeTab, setActiveTab] = useState<'DEPARTMENTS' | 'COMPANIES' | 'CATEGORIES' | 'VENUES'>(initialTab);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [visitorCategories, setVisitorCategories] = useState<VisitorCategory[]>([]);
  const [contractorCategories, setContractorCategories] = useState<ContractorCategory[]>([]);
  const [venues, setVenues] = useState<MeetingVenue[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms for Creation
  const [deptForm, setDeptForm] = useState({ code: '', name: '', headOfDepartment: '', floorLevel: '' });
  const [compForm, setCompForm] = useState({ name: '', registrationNumber: '', companyType: 'CONTRACTOR_VENDOR' as any, contactPhone: '', contactEmail: '', address: '' });
  const [vCatForm, setVCatForm] = useState({ name: '', description: '', requiresEscort: false });
  const [cCatForm, setCCatForm] = useState({ name: '', safetyInductionRequired: true });
  const [venueForm, setVenueForm] = useState({ name: '', buildingBlock: '', floorLevel: '', capacity: 10 });

  // Edit States
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingComp, setEditingComp] = useState<Company | null>(null);
  const [editingVCat, setEditingVCat] = useState<VisitorCategory | null>(null);
  const [editingCCat, setEditingCCat] = useState<ContractorCategory | null>(null);
  const [editingVenue, setEditingVenue] = useState<MeetingVenue | null>(null);

  const [saving, setSaving] = useState(false);
  const [statusNotification, setStatusNotification] = useState<{ type: 'danger' | 'warning' | 'info' | 'success'; title: string; message: string } | null>(null);
  const [companyToDeactivate, setCompanyToDeactivate] = useState<Company | null>(null);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [dList, cList, vcList, ccList, vList] = await Promise.all([
        getDepartments(),
        getCompanies(),
        getVisitorCategories(),
        getContractorCategories(),
        getMeetingVenues()
      ]);
      setDepartments(dList);
      setCompanies(cList);
      setVisitorCategories(vcList);
      setContractorCategories(ccList);
      setVenues(vList);
    } catch (err) {
      console.error('Error loading master data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Handlers for Creation
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createDepartment(deptForm);
      setDeptForm({ code: '', name: '', headOfDepartment: '', floorLevel: '' });
      setStatusNotification({ type: 'success', title: 'Successfully Submitted', message: `Successfully submitted! Department "${deptForm.name}" created.` });
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to create department');
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCompany(compForm);
      setCompForm({ name: '', registrationNumber: '', companyType: 'CONTRACTOR_VENDOR', contactPhone: '', contactEmail: '', address: '' });
      setStatusNotification({ type: 'success', title: 'Successfully Submitted', message: `Successfully submitted! Company "${compForm.name}" registered.` });
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to create company');
    }
  };

  const handleCreateVisitorCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vCatForm.name.trim()) return;
    try {
      await createVisitorCategory(vCatForm);
      setVCatForm({ name: '', description: '', requiresEscort: false });
      setStatusNotification({ type: 'success', title: 'Successfully Submitted', message: `Successfully submitted! Visitor category "${vCatForm.name}" created.` });
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to create visitor category');
    }
  };

  const handleCreateContractorCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cCatForm.name.trim()) return;
    try {
      await createContractorCategory(cCatForm);
      setCCatForm({ name: '', safetyInductionRequired: true });
      setStatusNotification({ type: 'success', title: 'Successfully Submitted', message: `Successfully submitted! Contractor category "${cCatForm.name}" created.` });
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to create contractor category');
    }
  };

  const handleCreateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venueForm.name.trim()) return;
    try {
      await createMeetingVenue(venueForm);
      setVenueForm({ name: '', buildingBlock: '', floorLevel: '', capacity: 10 });
      setStatusNotification({ type: 'success', title: 'Successfully Submitted', message: `Successfully submitted! Meeting venue "${venueForm.name}" added.` });
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to create meeting venue');
    }
  };

  // Handlers for Update & Delete
  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    try {
      setSaving(true);
      await updateDepartment(editingDept.id, editingDept);
      setEditingDept(null);
      setStatusNotification({ type: 'info', title: 'Department Updated', message: `Department "${editingDept.name}" updated successfully.` });
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to update department');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDepartment = async (dept: Department) => {
    try {
      const isCurrentlyActive = dept.isActive !== false;
      if (isCurrentlyActive) {
        await deleteDepartment(dept.id);
        setStatusNotification({ type: 'warning', title: 'Department Deactivated', message: `Department "${dept.name}" has been deactivated.` });
      } else {
        await updateDepartment(dept.id, { isActive: true });
        setStatusNotification({ type: 'success', title: 'Department Activated', message: `Department "${dept.name}" has been activated.` });
      }
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle department status');
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComp) return;
    try {
      setSaving(true);
      await updateCompany(editingComp.id, editingComp);
      setEditingComp(null);
      setStatusNotification({ type: 'info', title: 'Company Details Saved', message: `Company "${editingComp.name}" updated successfully.` });
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to update company');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCompany = async (comp: Company) => {
    const isCurrentlyActive = comp.isActive !== false;
    if (isCurrentlyActive) {
      // Prompt confirmation before deactivating
      setCompanyToDeactivate(comp);
    } else {
      try {
        await updateCompany(comp.id, { isActive: true });
        setStatusNotification({ type: 'success', title: 'Company Activated', message: `Company "${comp.name}" has been activated.` });
        await loadAll();
      } catch (err: any) {
        alert(err.message || 'Failed to activate company');
      }
    }
  };

  const handleConfirmDeactivateCompany = async () => {
    if (!companyToDeactivate) return;
    try {
      setSaving(true);
      await deleteCompany(companyToDeactivate.id);
      setStatusNotification({
        type: 'warning',
        title: 'Company Deactivated',
        message: `Company "${companyToDeactivate.name}" has been deactivated successfully.`
      });
      setCompanyToDeactivate(null);
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate company');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVisitorCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVCat) return;
    try {
      setSaving(true);
      await updateVisitorCategory(editingVCat.id, editingVCat);
      setEditingVCat(null);
      setStatusNotification({ type: 'info', title: 'Category Updated', message: `Visitor category "${editingVCat.name}" updated.` });
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to update visitor category');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisitorCategory = async (vc: VisitorCategory) => {
    try {
      const isCurrentlyActive = vc.isActive !== false;
      if (isCurrentlyActive) {
        await deleteVisitorCategory(vc.id);
        setStatusNotification({ type: 'warning', title: 'Category Deactivated', message: `Visitor category "${vc.name}" has been deactivated.` });
      } else {
        await updateVisitorCategory(vc.id, { isActive: true });
        setStatusNotification({ type: 'success', title: 'Category Activated', message: `Visitor category "${vc.name}" has been activated.` });
      }
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle visitor category status');
    }
  };

  const handleSaveContractorCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCCat) return;
    try {
      setSaving(true);
      await updateContractorCategory(editingCCat.id, editingCCat);
      setEditingCCat(null);
      setStatusNotification({ type: 'info', title: 'Category Updated', message: `Contractor category "${editingCCat.name}" updated.` });
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to update contractor category');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleContractorCategory = async (cc: ContractorCategory) => {
    try {
      const isCurrentlyActive = cc.isActive !== false;
      if (isCurrentlyActive) {
        await deleteContractorCategory(cc.id);
        setStatusNotification({ type: 'warning', title: 'Category Deactivated', message: `Contractor category "${cc.name}" has been deactivated.` });
      } else {
        await updateContractorCategory(cc.id, { isActive: true });
        setStatusNotification({ type: 'success', title: 'Category Activated', message: `Contractor category "${cc.name}" has been activated.` });
      }
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle contractor category status');
    }
  };

  const handleSaveVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVenue) return;
    try {
      setSaving(true);
      await updateMeetingVenue(editingVenue.id, editingVenue);
      setEditingVenue(null);
      setStatusNotification({ type: 'info', title: 'Venue Details Saved', message: `Meeting venue "${editingVenue.name}" updated.` });
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to update meeting venue');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVenue = async (venue: MeetingVenue) => {
    try {
      const isCurrentlyActive = venue.isActive !== false;
      if (isCurrentlyActive) {
        await deleteMeetingVenue(venue.id);
        setStatusNotification({ type: 'warning', title: 'Venue Deactivated', message: `Meeting venue "${venue.name}" has been deactivated.` });
      } else {
        await updateMeetingVenue(venue.id, { isActive: true });
        setStatusNotification({ type: 'success', title: 'Venue Activated', message: `Meeting venue "${venue.name}" has been activated.` });
      }
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle venue status');
    }
  };

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h3 className="fw-extrabold text-dark mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-diagram-3-fill text-primary"></i>
            Master Organization & Infrastructure Setup
          </h3>
          <p className="text-muted mb-0 small">
            Configure internal departments, external companies, visitor & contractor categories, and meeting venues. Changes automatically sync to all user accounts.
          </p>
        </div>
        <button onClick={loadAll} className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1">
          <i className="bi bi-arrow-clockwise"></i> Refresh Sync
        </button>
      </div>

      {statusNotification && (
        <NotificationBanner
          type={statusNotification.type}
          title={statusNotification.title}
          message={statusNotification.message}
          onDismiss={() => setStatusNotification(null)}
        />
      )}

      {/* Tabs */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button className={`nav-link fw-bold ${activeTab === 'DEPARTMENTS' ? 'active' : ''}`} onClick={() => setActiveTab('DEPARTMENTS')}>
            <i className="bi bi-diagram-3 me-1"></i> Departments ({departments.length})
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link fw-bold ${activeTab === 'COMPANIES' ? 'active' : ''}`} onClick={() => setActiveTab('COMPANIES')}>
            <i className="bi bi-building me-1"></i> Companies ({companies.length})
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link fw-bold ${activeTab === 'CATEGORIES' ? 'active' : ''}`} onClick={() => setActiveTab('CATEGORIES')}>
            <i className="bi bi-tags me-1"></i> Visitor & Contractor Categories ({visitorCategories.length + contractorCategories.length})
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link fw-bold ${activeTab === 'VENUES' ? 'active' : ''}`} onClick={() => setActiveTab('VENUES')}>
            <i className="bi bi-geo-alt me-1"></i> Meeting Venues ({venues.length})
          </button>
        </li>
      </ul>

      {/* TAB 1: DEPARTMENTS */}
      {activeTab === 'DEPARTMENTS' && (
        <div className="row g-4">
          <div className="col-md-4">
            <div className="card border-0 shadow-sm bg-white">
              <div className="card-header bg-dark text-white p-3 fw-bold">Create Department</div>
              <form onSubmit={handleCreateDepartment} className="card-body p-3">
                <div className="mb-3">
                  <label className="form-label small fw-bold">Code</label>
                  <input type="text" className="form-control font-monospace" placeholder="e.g. FIN" value={deptForm.code} onChange={e => setDeptForm({ ...deptForm, code: e.target.value })} required />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Department Name</label>
                  <input type="text" className="form-control" placeholder="e.g. Finance & Accounting" value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })} required />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Head of Department</label>
                  <input type="text" className="form-control" placeholder="e.g. David Chen" value={deptForm.headOfDepartment} onChange={e => setDeptForm({ ...deptForm, headOfDepartment: e.target.value })} />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Floor Level / Location</label>
                  <input type="text" className="form-control" placeholder="e.g. Level 3, Tower A" value={deptForm.floorLevel} onChange={e => setDeptForm({ ...deptForm, floorLevel: e.target.value })} />
                </div>
                <button type="submit" className="btn btn-primary w-100 fw-bold">Save Department</button>
              </form>
            </div>
          </div>

          <div className="col-md-8">
            <div className="card border-0 shadow-sm bg-white">
              <div className="card-header bg-white py-3 border-bottom fw-bold d-flex justify-content-between align-items-center">
                <span>Departments Directory ({departments.length})</span>
                <span className="badge badge-green">SYNCED TO ALL USERS</span>
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light small text-muted">
                    <tr>
                      <th>CODE</th>
                      <th>DEPARTMENT NAME</th>
                      <th>HEAD OF DEPT</th>
                      <th>LOCATION</th>
                      <th>STATUS</th>
                      <th className="text-end">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map(d => (
                      <tr key={d.id} className={!d.isActive ? 'table-light text-muted' : ''}>
                        <td className="font-monospace fw-bold text-primary">{d.code}</td>
                        <td className="fw-bold text-dark">{d.name}</td>
                        <td className="small text-secondary">{d.headOfDepartment || 'N/A'}</td>
                        <td className="small text-secondary">{d.floorLevel || 'N/A'}</td>
                        <td>
                          {d.isActive !== false ? (
                            <span className="badge bg-success">ACTIVE</span>
                          ) : (
                            <span className="badge bg-secondary">INACTIVE</span>
                          )}
                        </td>
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-outline-primary me-1 py-0 px-2"
                            onClick={() => setEditingDept(d)}
                            title="Edit Department"
                          >
                            <i className="bi bi-pencil-square"></i> Edit
                          </button>
                          <button
                            className={`btn btn-sm ${d.isActive !== false ? 'btn-outline-danger' : 'btn-outline-success'} py-0 px-2`}
                            onClick={() => handleToggleDepartment(d)}
                            title={d.isActive !== false ? 'Deactivate' : 'Activate'}
                          >
                            <i className={`bi ${d.isActive !== false ? 'bi-slash-circle' : 'bi-check-circle'}`}></i>{' '}
                            {d.isActive !== false ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COMPANIES */}
      {activeTab === 'COMPANIES' && (
        <div className="row g-4">
          <div className="col-md-4">
            <div className="card border-0 shadow-sm bg-white">
              <div className="card-header bg-dark text-white p-3 fw-bold">Register Company</div>
              <form onSubmit={handleCreateCompany} className="card-body p-3">
                <div className="mb-3">
                  <label className="form-label small fw-bold">Company Name</label>
                  <input type="text" className="form-control" placeholder="e.g. CyberShield Systems" value={compForm.name} onChange={e => setCompForm({ ...compForm, name: e.target.value })} required />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Reg Number</label>
                  <input type="text" className="form-control font-monospace" placeholder="e.g. CS-9021" value={compForm.registrationNumber} onChange={e => setCompForm({ ...compForm, registrationNumber: e.target.value })} />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Company Type</label>
                  <select className="form-select" value={compForm.companyType} onChange={e => setCompForm({ ...compForm, companyType: e.target.value as any })}>
                    <option value="CONTRACTOR_VENDOR">Contractor / Vendor</option>
                    <option value="VISITOR_ORGANIZATION">Visitor Organization</option>
                    <option value="INTERNAL">Internal Subsidiary</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Phone</label>
                  <input type="text" className="form-control" value={compForm.contactPhone} onChange={e => setCompForm({ ...compForm, contactPhone: e.target.value })} />
                </div>
                <button type="submit" className="btn btn-primary w-100 fw-bold">Save Company</button>
              </form>
            </div>
          </div>

          <div className="col-md-8">
            <div className="card border-0 shadow-sm bg-white">
              <div className="card-header bg-white py-3 border-bottom fw-bold d-flex justify-content-between align-items-center">
                <span>Registered Companies ({companies.length})</span>
                <span className="badge badge-green">REFLECTED IN GUEST FORMS</span>
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light small text-muted">
                    <tr>
                      <th>COMPANY NAME</th>
                      <th>REG NO</th>
                      <th>TYPE</th>
                      <th>CONTACT</th>
                      <th>STATUS</th>
                      <th className="text-end">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map(c => (
                      <tr key={c.id} className={!c.isActive ? 'table-light text-muted' : ''}>
                        <td className="fw-bold text-dark">{c.name}</td>
                        <td className="font-monospace small">{c.registrationNumber}</td>
                        <td><span className="badge bg-secondary">{c.companyType}</span></td>
                        <td className="small">{c.contactPhone}</td>
                        <td>
                          {c.isActive !== false ? (
                            <span className="badge bg-success">ACTIVE</span>
                          ) : (
                            <span className="badge bg-secondary">INACTIVE</span>
                          )}
                        </td>
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-outline-primary me-1 py-0 px-2"
                            onClick={() => setEditingComp(c)}
                            title="Edit Company"
                          >
                            <i className="bi bi-pencil-square"></i> Edit
                          </button>
                          <button
                            className={`btn btn-sm ${c.isActive !== false ? 'btn-outline-danger' : 'btn-outline-success'} py-0 px-2`}
                            onClick={() => handleToggleCompany(c)}
                            title={c.isActive !== false ? 'Deactivate' : 'Activate'}
                          >
                            <i className={`bi ${c.isActive !== false ? 'bi-slash-circle' : 'bi-check-circle'}`}></i>{' '}
                            {c.isActive !== false ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CATEGORIES */}
      {activeTab === 'CATEGORIES' && (
        <div className="row g-4">
          {/* VISITOR CATEGORIES */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm bg-white h-100">
              <div className="card-header bg-primary text-white py-3 d-flex justify-content-between align-items-center">
                <span className="fw-bold"><i className="bi bi-person-vcard me-1"></i> Visitor Categories ({visitorCategories.length})</span>
              </div>
              <div className="p-3 border-bottom bg-light">
                <form onSubmit={handleCreateVisitorCategory} className="row g-2 align-items-end">
                  <div className="col-md-5">
                    <label className="form-label small fw-bold mb-1">Category Name</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. VIP, Customer, Supplier"
                      value={vCatForm.name}
                      onChange={e => setVCatForm({ ...vCatForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-bold mb-1">Description</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Optional description"
                      value={vCatForm.description}
                      onChange={e => setVCatForm({ ...vCatForm, description: e.target.value })}
                    />
                  </div>
                  <div className="col-md-3">
                    <div className="form-check form-switch mb-1">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="escortSwitch"
                        checked={vCatForm.requiresEscort}
                        onChange={e => setVCatForm({ ...vCatForm, requiresEscort: e.target.checked })}
                      />
                      <label className="form-check-label small fw-bold text-dark" htmlFor="escortSwitch">Escort</label>
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm w-100 fw-bold">
                      <i className="bi bi-plus-circle me-1"></i> Add Category
                    </button>
                  </div>
                </form>
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light small">
                    <tr><th>NAME</th><th>DESCRIPTION</th><th>REQUIREMENT</th><th>STATUS</th><th className="text-end">ACTIONS</th></tr>
                  </thead>
                  <tbody>
                    {visitorCategories.map(vc => (
                      <tr key={vc.id} className={!vc.isActive ? 'table-light text-muted' : ''}>
                        <td className="fw-bold text-dark">{vc.name}</td>
                        <td className="small text-secondary">{vc.description || 'N/A'}</td>
                        <td>{vc.requiresEscort ? <span className="badge badge-amber">ESCORT REQUIRED</span> : <span className="badge badge-slate">OPTIONAL</span>}</td>
                        <td>{vc.isActive !== false ? <span className="badge badge-green">ACTIVE</span> : <span className="badge bg-secondary">INACTIVE</span>}</td>
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-outline-primary me-1 py-0 px-2"
                            onClick={() => setEditingVCat(vc)}
                          >
                            <i className="bi bi-pencil-square"></i>
                          </button>
                          <button
                            className={`btn btn-sm ${vc.isActive !== false ? 'btn-outline-danger' : 'btn-outline-success'} py-0 px-2`}
                            onClick={() => handleToggleVisitorCategory(vc)}
                          >
                            <i className={`bi ${vc.isActive !== false ? 'bi-slash-circle' : 'bi-check-circle'}`}></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* CONTRACTOR CATEGORIES */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm bg-white h-100">
              <div className="card-header bg-dark text-white py-3 d-flex justify-content-between align-items-center" style={{ backgroundColor: '#0F172A' }}>
                <span className="fw-bold"><i className="bi bi-tools me-1 text-warning"></i> Contractor Categories ({contractorCategories.length})</span>
              </div>
              <div className="p-3 border-bottom bg-light">
                <form onSubmit={handleCreateContractorCategory} className="row g-2 align-items-end">
                  <div className="col-md-6">
                    <label className="form-label small fw-bold mb-1">Category Name</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. Electrical, Mechanical, IT Work"
                      value={cCatForm.name}
                      onChange={e => setCCatForm({ ...cCatForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <div className="form-check form-switch mb-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="safetySwitch"
                          checked={cCatForm.safetyInductionRequired}
                          onChange={e => setCCatForm({ ...cCatForm, safetyInductionRequired: e.target.checked })}
                        />
                        <label className="form-check-label small fw-bold text-dark" htmlFor="safetySwitch">Safety Induction Required</label>
                      </div>
                    </div>
                    <button type="submit" className="btn btn-dark btn-sm w-100 fw-bold">
                      <i className="bi bi-plus-circle me-1"></i> Add Category
                    </button>
                  </div>
                </form>
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light small">
                    <tr><th>CATEGORY NAME</th><th>SAFETY INDUCTION</th><th>STATUS</th><th className="text-end">ACTIONS</th></tr>
                  </thead>
                  <tbody>
                    {contractorCategories.map(cc => (
                      <tr key={cc.id} className={!cc.isActive ? 'table-light text-muted' : ''}>
                        <td className="fw-bold text-dark">{cc.name}</td>
                        <td>{cc.safetyInductionRequired ? <span className="badge badge-red">MANDATORY</span> : <span className="badge badge-slate">STANDARD</span>}</td>
                        <td>{cc.isActive !== false ? <span className="badge badge-green">ACTIVE</span> : <span className="badge bg-secondary">INACTIVE</span>}</td>
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-outline-primary me-1 py-0 px-2"
                            onClick={() => setEditingCCat(cc)}
                          >
                            <i className="bi bi-pencil-square"></i>
                          </button>
                          <button
                            className={`btn btn-sm ${cc.isActive !== false ? 'btn-outline-danger' : 'btn-outline-success'} py-0 px-2`}
                            onClick={() => handleToggleContractorCategory(cc)}
                          >
                            <i className={`bi ${cc.isActive !== false ? 'bi-slash-circle' : 'bi-check-circle'}`}></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: VENUES */}
      {activeTab === 'VENUES' && (
        <div className="row g-4">
          <div className="col-lg-4">
            <div className="card border-0 shadow-sm bg-white">
              <div className="card-header bg-dark text-white p-3 fw-bold d-flex justify-content-between align-items-center">
                <span><i className="bi bi-geo-alt-fill text-warning me-1"></i> Add Meeting Venue</span>
              </div>
              <form onSubmit={handleCreateVenue} className="card-body p-3">
                <div className="mb-3">
                  <label className="form-label small fw-bold">Venue / Room Name <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Internal common area & Prod 1 corridor"
                    value={venueForm.name}
                    onChange={e => setVenueForm({ ...venueForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Building Block(s)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Prod 1, Prod 2 (comma separated for multiple)"
                    value={venueForm.buildingBlock}
                    onChange={e => setVenueForm({ ...venueForm, buildingBlock: e.target.value })}
                  />
                  <div className="form-text" style={{ fontSize: '0.75rem' }}>
                    Separate multiple building blocks with commas (e.g. <code>Prod 1, Prod 2</code>)
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Floor Level(s) / Zone(s)</label>
                  <input
                    type="text"
                    className="form-control font-monospace"
                    placeholder="e.g. Corridor, Inside (comma separated for multiple)"
                    value={venueForm.floorLevel}
                    onChange={e => setVenueForm({ ...venueForm, floorLevel: e.target.value })}
                  />
                  <div className="form-text" style={{ fontSize: '0.75rem' }}>
                    Separate multiple floors or zones with commas (e.g. <code>Corridor, Inside</code>)
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Seating Capacity (Pax)</label>
                  <input
                    type="number"
                    className="form-control font-monospace"
                    min="1"
                    placeholder="10"
                    value={venueForm.capacity}
                    onChange={e => setVenueForm({ ...venueForm, capacity: Number(e.target.value) || 1 })}
                  />
                </div>
                <button type="submit" className="btn btn-primary w-100 fw-bold d-flex align-items-center justify-content-center gap-1">
                  <i className="bi bi-plus-circle-fill"></i> Save & Publish Venue
                </button>
                <div className="mt-3 p-2 bg-light rounded text-muted small border">
                  <i className="bi bi-info-circle text-primary me-1"></i>
                  Created venues are immediately visible on the Staff pre-registration site with all associated building blocks and floor levels.
                </div>
              </form>
            </div>
          </div>

          <div className="col-lg-8">
            <div className="card border-0 shadow-sm bg-white h-100">
              <div className="card-header bg-white py-3 border-bottom fw-bold d-flex justify-content-between align-items-center">
                <span>Authorized Meeting Venues & Work Zones ({venues.length})</span>
                <span className="badge badge-green">LIVE IN STAFF FORMS</span>
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light small text-muted">
                    <tr>
                      <th>VENUE NAME</th>
                      <th>BUILDING BLOCK(S)</th>
                      <th>FLOOR LEVEL(S)</th>
                      <th>CAPACITY</th>
                      <th>STATUS</th>
                      <th className="text-end">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {venues.map(v => {
                      const blocks = v.buildingBlocks && v.buildingBlocks.length > 0 
                        ? v.buildingBlocks 
                        : (v.buildingBlock ? v.buildingBlock.split(',').map(b => b.trim()).filter(Boolean) : []);
                      const floors = v.floorLevels && v.floorLevels.length > 0 
                        ? v.floorLevels 
                        : (v.floorLevel ? v.floorLevel.split(',').map(f => f.trim()).filter(Boolean) : []);

                      return (
                        <tr key={v.id} className={!v.isActive ? 'table-light text-muted' : ''}>
                          <td className="fw-bold text-dark">{v.name}</td>
                          <td className="small">
                            {blocks.length > 0 ? (
                              <div className="d-flex flex-wrap gap-1">
                                {blocks.map((b, idx) => (
                                  <span key={idx} className="badge bg-light text-dark border fw-normal">
                                    <i className="bi bi-building me-1 text-primary"></i>{b}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-secondary">N/A</span>
                            )}
                          </td>
                          <td className="small">
                            {floors.length > 0 ? (
                              <div className="d-flex flex-wrap gap-1">
                                {floors.map((f, idx) => (
                                  <span key={idx} className="badge bg-light text-primary border fw-normal font-monospace">
                                    <i className="bi bi-layers me-1 text-secondary"></i>{f}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-secondary font-monospace">N/A</span>
                            )}
                          </td>
                          <td className="small font-monospace">{v.capacity} pax</td>
                          <td>
                            {v.isActive !== false ? (
                              <span className="badge bg-success">ACTIVE & VISIBLE</span>
                            ) : (
                              <span className="badge bg-secondary">INACTIVE</span>
                            )}
                          </td>
                          <td className="text-end">
                            <button
                              className="btn btn-sm btn-outline-primary me-1 py-0 px-2"
                              onClick={() => setEditingVenue(v)}
                              title="Edit Meeting Venue"
                            >
                              <i className="bi bi-pencil-square"></i> Edit
                            </button>
                            <button
                              className={`btn btn-sm ${v.isActive !== false ? 'btn-outline-danger' : 'btn-outline-success'} py-0 px-2`}
                              onClick={() => handleToggleVenue(v)}
                              title={v.isActive !== false ? 'Deactivate' : 'Activate'}
                            >
                              <i className={`bi ${v.isActive !== false ? 'bi-slash-circle' : 'bi-check-circle'}`}></i>{' '}
                              {v.isActive !== false ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {venues.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-4 text-muted">No meeting venues defined yet. Add one using the form on the left.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT DEPARTMENT MODAL */}
      {editingDept && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header bg-dark text-white py-2">
                <h5 className="modal-title fs-6 fw-bold"><i className="bi bi-pencil-square me-2"></i> Edit Department</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setEditingDept(null)}></button>
              </div>
              <form onSubmit={handleSaveDepartment} className="modal-body">
                <div className="mb-3">
                  <label className="form-label small fw-bold">Department Code</label>
                  <input
                    type="text"
                    className="form-control font-monospace"
                    value={editingDept.code}
                    onChange={e => setEditingDept({ ...editingDept, code: e.target.value })}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Department Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingDept.name}
                    onChange={e => setEditingDept({ ...editingDept, name: e.target.value })}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Head of Department</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingDept.headOfDepartment || ''}
                    onChange={e => setEditingDept({ ...editingDept, headOfDepartment: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Floor Level / Location</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingDept.floorLevel || ''}
                    onChange={e => setEditingDept({ ...editingDept, floorLevel: e.target.value })}
                  />
                </div>
                <div className="form-check form-switch mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="editDeptActive"
                    checked={editingDept.isActive !== false}
                    onChange={e => setEditingDept({ ...editingDept, isActive: e.target.checked })}
                  />
                  <label className="form-check-label small fw-bold" htmlFor="editDeptActive">Active Status</label>
                </div>
                <div className="d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-sm btn-light border" onClick={() => setEditingDept(null)}>Cancel</button>
                  <button type="submit" className="btn btn-sm btn-primary fw-bold" disabled={saving}>
                    {saving ? 'Saving Changes...' : 'Save & Sync Database'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT COMPANY MODAL */}
      {editingComp && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header bg-dark text-white py-2">
                <h5 className="modal-title fs-6 fw-bold"><i className="bi bi-pencil-square me-2"></i> Edit Company / Guest Org</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setEditingComp(null)}></button>
              </div>
              <form onSubmit={handleSaveCompany} className="modal-body">
                <div className="mb-3">
                  <label className="form-label small fw-bold">Company Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingComp.name}
                    onChange={e => setEditingComp({ ...editingComp, name: e.target.value })}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Registration Number</label>
                  <input
                    type="text"
                    className="form-control font-monospace"
                    value={editingComp.registrationNumber || ''}
                    onChange={e => setEditingComp({ ...editingComp, registrationNumber: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Company Type</label>
                  <select
                    className="form-select"
                    value={editingComp.companyType}
                    onChange={e => setEditingComp({ ...editingComp, companyType: e.target.value as any })}
                  >
                    <option value="CONTRACTOR_VENDOR">Contractor / Vendor</option>
                    <option value="VISITOR_ORGANIZATION">Visitor Organization</option>
                    <option value="INTERNAL">Internal Subsidiary</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Contact Phone</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingComp.contactPhone || ''}
                    onChange={e => setEditingComp({ ...editingComp, contactPhone: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Contact Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={editingComp.contactEmail || ''}
                    onChange={e => setEditingComp({ ...editingComp, contactEmail: e.target.value })}
                  />
                </div>
                <div className="form-check form-switch mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="editCompActive"
                    checked={editingComp.isActive !== false}
                    onChange={e => setEditingComp({ ...editingComp, isActive: e.target.checked })}
                  />
                  <label className="form-check-label small fw-bold" htmlFor="editCompActive">Active Status</label>
                </div>
                <div className="d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-sm btn-light border" onClick={() => setEditingComp(null)}>Cancel</button>
                  <button type="submit" className="btn btn-sm btn-primary fw-bold" disabled={saving}>
                    {saving ? 'Saving Changes...' : 'Save & Sync Database'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT VISITOR CATEGORY MODAL */}
      {editingVCat && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header bg-dark text-white py-2">
                <h5 className="modal-title fs-6 fw-bold"><i className="bi bi-pencil-square me-2"></i> Edit Visitor Category</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setEditingVCat(null)}></button>
              </div>
              <form onSubmit={handleSaveVisitorCategory} className="modal-body">
                <div className="mb-3">
                  <label className="form-label small fw-bold">Category Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingVCat.name}
                    onChange={e => setEditingVCat({ ...editingVCat, name: e.target.value })}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Description</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingVCat.description || ''}
                    onChange={e => setEditingVCat({ ...editingVCat, description: e.target.value })}
                  />
                </div>
                <div className="form-check form-switch mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="editEscort"
                    checked={editingVCat.requiresEscort}
                    onChange={e => setEditingVCat({ ...editingVCat, requiresEscort: e.target.checked })}
                  />
                  <label className="form-check-label small fw-bold" htmlFor="editEscort">Requires Security Escort</label>
                </div>
                <div className="form-check form-switch mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="editVCatActive"
                    checked={editingVCat.isActive !== false}
                    onChange={e => setEditingVCat({ ...editingVCat, isActive: e.target.checked })}
                  />
                  <label className="form-check-label small fw-bold" htmlFor="editVCatActive">Active Status</label>
                </div>
                <div className="d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-sm btn-light border" onClick={() => setEditingVCat(null)}>Cancel</button>
                  <button type="submit" className="btn btn-sm btn-primary fw-bold" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Category'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CONTRACTOR CATEGORY MODAL */}
      {editingCCat && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header bg-dark text-white py-2">
                <h5 className="modal-title fs-6 fw-bold"><i className="bi bi-pencil-square me-2"></i> Edit Contractor Category</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setEditingCCat(null)}></button>
              </div>
              <form onSubmit={handleSaveContractorCategory} className="modal-body">
                <div className="mb-3">
                  <label className="form-label small fw-bold">Category Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingCCat.name}
                    onChange={e => setEditingCCat({ ...editingCCat, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-check form-switch mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="editSafety"
                    checked={editingCCat.safetyInductionRequired}
                    onChange={e => setEditingCCat({ ...editingCCat, safetyInductionRequired: e.target.checked })}
                  />
                  <label className="form-check-label small fw-bold" htmlFor="editSafety">Safety Induction Mandatory</label>
                </div>
                <div className="form-check form-switch mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="editCCatActive"
                    checked={editingCCat.isActive !== false}
                    onChange={e => setEditingCCat({ ...editingCCat, isActive: e.target.checked })}
                  />
                  <label className="form-check-label small fw-bold" htmlFor="editCCatActive">Active Status</label>
                </div>
                <div className="d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-sm btn-light border" onClick={() => setEditingCCat(null)}>Cancel</button>
                  <button type="submit" className="btn btn-sm btn-primary fw-bold" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Category'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MEETING VENUE MODAL */}
      {editingVenue && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header bg-dark text-white py-2">
                <h5 className="modal-title fs-6 fw-bold"><i className="bi bi-pencil-square me-2"></i> Edit Meeting Venue</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setEditingVenue(null)}></button>
              </div>
              <form onSubmit={handleSaveVenue} className="modal-body">
                <div className="mb-3">
                  <label className="form-label small fw-bold">Venue / Room Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingVenue.name}
                    onChange={e => setEditingVenue({ ...editingVenue, name: e.target.value })}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Building Block(s)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Prod 1, Prod 2 (comma separated)"
                    value={editingVenue.buildingBlock || ''}
                    onChange={e => setEditingVenue({ ...editingVenue, buildingBlock: e.target.value })}
                  />
                  <div className="form-text" style={{ fontSize: '0.75rem' }}>
                    Comma-separated list of building blocks (e.g. <code>Prod 1, Prod 2</code>)
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Floor Level(s) / Zone(s)</label>
                  <input
                    type="text"
                    className="form-control font-monospace"
                    placeholder="e.g. Corridor, Inside (comma separated)"
                    value={editingVenue.floorLevel || ''}
                    onChange={e => setEditingVenue({ ...editingVenue, floorLevel: e.target.value })}
                  />
                  <div className="form-text" style={{ fontSize: '0.75rem' }}>
                    Comma-separated list of floor levels or zones (e.g. <code>Corridor, Inside</code>)
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Capacity (Pax)</label>
                  <input
                    type="number"
                    className="form-control font-monospace"
                    value={editingVenue.capacity}
                    onChange={e => setEditingVenue({ ...editingVenue, capacity: Number(e.target.value) || 1 })}
                    min="1"
                  />
                </div>
                <div className="form-check form-switch mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="editVenueActive"
                    checked={editingVenue.isActive !== false}
                    onChange={e => setEditingVenue({ ...editingVenue, isActive: e.target.checked })}
                  />
                  <label className="form-check-label small fw-bold" htmlFor="editVenueActive">Active & Visible in Forms</label>
                </div>
                <div className="d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-sm btn-light border" onClick={() => setEditingVenue(null)}>Cancel</button>
                  <button type="submit" className="btn btn-sm btn-primary fw-bold" disabled={saving}>
                    {saving ? 'Saving...' : 'Save & Publish Venue'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* CONFIRM COMPANY DEACTIVATION MODAL PROMPT */}
      {companyToDeactivate && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(3px)', zIndex: 1060 }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '500px' }}>
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header bg-danger text-white py-3 px-4 border-0">
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-circle bg-white text-danger p-1 d-flex align-items-center justify-content-center" style={{ width: '28px', height: '28px' }}>
                    <i className="bi bi-exclamation-triangle-fill fs-6"></i>
                  </div>
                  <h6 className="modal-title fw-bold mb-0">Confirm Company Deactivation</h6>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setCompanyToDeactivate(null)}
                  aria-label="Close"
                ></button>
              </div>

              <div className="modal-body p-4">
                <div className="text-center mb-3">
                  <div className="d-inline-flex p-3 rounded-circle bg-danger bg-opacity-10 text-danger mb-2">
                    <i className="bi bi-building-slash" style={{ fontSize: '2.2rem' }}></i>
                  </div>
                  <h5 className="fw-bold text-dark mb-1">Deactivate Registered Company?</h5>
                  <p className="text-muted small mb-0">Please confirm if you want to proceed with deactivating this company.</p>
                </div>

                <div className="bg-light p-3 rounded-3 border mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-muted small">Company Name:</span>
                    <span className="fw-bold text-dark">{companyToDeactivate.name}</span>
                  </div>
                  {companyToDeactivate.registrationNumber && (
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-muted small">Reg Number:</span>
                      <span className="font-monospace small text-secondary">{companyToDeactivate.registrationNumber}</span>
                    </div>
                  )}
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-muted small">Company Type:</span>
                    <span className="badge bg-secondary">{companyToDeactivate.companyType}</span>
                  </div>
                </div>

                <div className="alert alert-warning d-flex align-items-start gap-2 py-2 px-3 mb-0 small">
                  <i className="bi bi-info-circle-fill text-warning flex-shrink-0 mt-0.5"></i>
                  <div>
                    Once deactivated, this company will <strong>no longer be selectable</strong> in new visitor pre-registrations or contractor work permit submissions. Past records will remain intact for audit purposes.
                  </div>
                </div>
              </div>

              <div className="modal-footer bg-light py-3 px-4 border-0 d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary px-3 fw-semibold"
                  onClick={() => setCompanyToDeactivate(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger px-4 fw-bold shadow-sm"
                  onClick={handleConfirmDeactivateCompany}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Deactivating...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-slash-circle me-1.5"></i>
                      Yes, Deactivate Company
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
