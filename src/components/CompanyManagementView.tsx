import React, { useEffect, useState } from 'react';
import { Company, User } from '../types';
import { getCompanies, createCompany, updateCompany } from '../lib/api';
import { NotificationModal } from './notification';

interface CompanyManagementViewProps {
  currentUser: User;
}

export const CompanyManagementView: React.FC<CompanyManagementViewProps> = ({ currentUser }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal / Form States
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const [form, setForm] = useState({
    name: '',
    registrationNumber: '',
    companyType: 'VISITOR_ORGANIZATION' as 'INTERNAL' | 'CONTRACTOR_VENDOR' | 'VISITOR_ORGANIZATION',
    contactPhone: '',
    contactEmail: '',
    address: ''
  });

  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitPopup, setSubmitPopup] = useState<{ isOpen: boolean; message: string } | null>(null);
  const [companyToDeactivate, setCompanyToDeactivate] = useState<Company | null>(null);

  const isStaff = currentUser.role === 'STAFF';

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const data = await getCompanies();
      setCompanies(data);
    } catch (err: any) {
      console.error('Failed to load companies:', err);
      setErrorMessage('Failed to load companies from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, [currentUser]);

  const handleOpenAddModal = () => {
    setForm({
      name: '',
      registrationNumber: '',
      companyType: 'VISITOR_ORGANIZATION',
      contactPhone: '',
      contactEmail: '',
      address: ''
    });
    setEditingCompany(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (comp: Company) => {
    setForm({
      name: comp.name,
      registrationNumber: comp.registrationNumber || '',
      companyType: comp.companyType,
      contactPhone: comp.contactPhone || '',
      contactEmail: comp.contactEmail || '',
      address: comp.address || ''
    });
    setEditingCompany(comp);
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErrorMessage('Company or Guest Organization name is required.');
      return;
    }

    try {
      setSubmitLoading(true);
      setErrorMessage(null);

      if (editingCompany) {
        await updateCompany(editingCompany.id, {
          name: form.name.trim(),
          registrationNumber: form.registrationNumber.trim() || `REG-${Math.floor(100000 + Math.random() * 900000)}`,
          companyType: form.companyType,
          contactPhone: form.contactPhone.trim() || '+60 3-0000 0000',
          contactEmail: form.contactEmail.trim() || `${form.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@guest.com`,
          address: form.address.trim() || 'N/A'
        });
        setSuccessMessage(`Updated company record for "${form.name.trim()}" successfully.`);
        setSubmitPopup({
          isOpen: true,
          message: `Successfully submitted! Updated company details for "${form.name.trim()}".`
        });
      } else {
        await createCompany({
          name: form.name.trim(),
          registrationNumber: form.registrationNumber.trim() || `REG-${Math.floor(100000 + Math.random() * 900000)}`,
          companyType: form.companyType,
          contactPhone: form.contactPhone.trim() || '+60 3-0000 0000',
          contactEmail: form.contactEmail.trim() || `${form.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@guest.com`,
          address: form.address.trim() || 'N/A'
        });
        setSuccessMessage(`Registered new guest organization "${form.name.trim()}" successfully! Saved to database.`);
        setSubmitPopup({
          isOpen: true,
          message: `Successfully submitted! Registered new company / guest organization "${form.name.trim()}".`
        });
      }

      setShowAddModal(false);
      await loadCompanies();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save company record.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleToggleStatus = async (comp: Company) => {
    if (comp.isActive) {
      setCompanyToDeactivate(comp);
    } else {
      try {
        await updateCompany(comp.id, { isActive: true });
        setSuccessMessage(`Company "${comp.name}" has been reactivated successfully.`);
        await loadCompanies();
      } catch (err: any) {
        alert(err.message || 'Failed to reactivate company.');
      }
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!companyToDeactivate) return;
    try {
      setSubmitLoading(true);
      await updateCompany(companyToDeactivate.id, { isActive: false });
      setSuccessMessage(`Company "${companyToDeactivate.name}" has been deactivated.`);
      setCompanyToDeactivate(null);
      await loadCompanies();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate company.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Filter logic
  const filteredCompanies = companies.filter(c => {
    if (typeFilter !== 'ALL' && c.companyType !== typeFilter) return false;
    if (statusFilter === 'ACTIVE' && !c.isActive) return false;
    if (statusFilter === 'INACTIVE' && c.isActive) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = c.name.toLowerCase().includes(q);
      const matchReg = (c.registrationNumber || '').toLowerCase().includes(q);
      const matchEmail = (c.contactEmail || '').toLowerCase().includes(q);
      const matchDept = (c.departmentName || '').toLowerCase().includes(q);
      if (!matchName && !matchReg && !matchEmail && !matchDept) return false;
    }

    return true;
  });

  const totalCount = companies.length;
  const contractorCount = companies.filter(c => c.companyType === 'CONTRACTOR_VENDOR').length;
  const visitorOrgCount = companies.filter(c => c.companyType === 'VISITOR_ORGANIZATION').length;
  const activeCount = companies.filter(c => c.isActive).length;

  return (
    <div className="p-4">
      {/* HEADER BAR */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-3 border-bottom gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h3 className="fw-extrabold text-dark mb-0">
              <i className="bi bi-building font-semibold text-primary me-2"></i>
              Company & Guest Organization Directory
            </h3>
            {isStaff ? (
              <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle px-2.5 py-1 font-monospace">
                <i className="bi bi-diagram-3-fill me-1"></i> {currentUser.departmentName || 'Department'} Scope
              </span>
            ) : (
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2.5 py-1 font-monospace">
                <i className="bi bi-shield-check me-1"></i> Master Organization Database (All Departments)
              </span>
            )}
          </div>
          <p className="text-muted mb-0 small">
            {isStaff
              ? `Manage external contractors, vendors, and guest organizations registered by staff in the ${currentUser.departmentName || 'Department'}.`
              : 'Enterprise master registry of all internal departments, external contractor firms, vendors, and visitor guest organizations.'}
          </p>
        </div>

        <button className="btn btn-primary fw-bold shadow-sm d-flex align-items-center gap-2 px-3 py-2" onClick={handleOpenAddModal}>
          <i className="bi bi-plus-circle-fill fs-5"></i>
          Register New Company / Guest Org
        </button>
      </div>

      {/* NOTIFICATION MESSAGES */}
      {successMessage && (
        <div className="alert alert-success alert-dismissible fade show d-flex align-items-center gap-2 mb-4" role="alert">
          <i className="bi bi-check-circle-fill fs-5"></i>
          <div>{successMessage}</div>
          <button type="button" className="btn-close" onClick={() => setSuccessMessage(null)}></button>
        </div>
      )}
      {errorMessage && (
        <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center gap-2 mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill fs-5"></i>
          <div>{errorMessage}</div>
          <button type="button" className="btn-close" onClick={() => setErrorMessage(null)}></button>
        </div>
      )}

      {/* STATS SUMMARY CARDS */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm bg-white p-3 rounded-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-secondary small fw-bold font-monospace">TOTAL ORGANIZATIONS</span>
              <div className="p-2 rounded-circle bg-primary-subtle text-primary">
                <i className="bi bi-building fs-5"></i>
              </div>
            </div>
            <div className="fs-3 fw-extrabold text-dark">{totalCount}</div>
            <div className="text-muted small mt-1">
              <i className="bi bi-folder-check me-1"></i>Saved in database
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm bg-white p-3 rounded-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-secondary small fw-bold font-monospace">CONTRACTORS & VENDORS</span>
              <div className="p-2 rounded-circle bg-warning-subtle text-warning-emphasis">
                <i className="bi bi-tools fs-5"></i>
              </div>
            </div>
            <div className="fs-3 fw-extrabold text-dark">{contractorCount}</div>
            <div className="text-muted small mt-1">Work permit firms</div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm bg-white p-3 rounded-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-secondary small fw-bold font-monospace">GUEST ORGANIZATIONS</span>
              <div className="p-2 rounded-circle bg-info-subtle text-info-emphasis">
                <i className="bi bi-people-fill fs-5"></i>
              </div>
            </div>
            <div className="fs-3 fw-extrabold text-dark">{visitorOrgCount}</div>
            <div className="text-muted small mt-1">Visitor corporate guests</div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm bg-white p-3 rounded-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-secondary small fw-bold font-monospace">ACTIVE RECORDS</span>
              <div className="p-2 rounded-circle bg-success-subtle text-success">
                <i className="bi bi-check-circle-fill fs-5"></i>
              </div>
            </div>
            <div className="fs-3 fw-extrabold text-success">{activeCount}</div>
            <div className="text-muted small mt-1">Available for pre-registration</div>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="card border-0 shadow-sm bg-white mb-4 p-3 rounded-3">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-5">
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0 bg-light"
                placeholder="Search company name, registration #, email, or department..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="btn btn-outline-secondary border-start-0 border-end-0 bg-light" onClick={() => setSearchQuery('')}>
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </div>
          </div>

          <div className="col-6 col-md-3">
            <select className="form-select bg-light" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="ALL">All Company Types</option>
              <option value="VISITOR_ORGANIZATION">Visitor / Guest Organization</option>
              <option value="CONTRACTOR_VENDOR">Contractor / Vendor Firm</option>
              <option value="INTERNAL">Internal Enterprise Unit</option>
            </select>
          </div>

          <div className="col-6 col-md-2">
            <select className="form-select bg-light" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>

          <div className="col-12 col-md-2 text-end">
            <span className="badge bg-light text-dark border font-monospace px-3 py-2">
              Showing {filteredCompanies.length} of {totalCount}
            </span>
          </div>
        </div>
      </div>

      {/* TABLE DATA CONTAINER */}
      <div className="card border-0 shadow-sm bg-white rounded-3 overflow-hidden">
        <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
          <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
            <i className="bi bi-journal-bookmark-fill text-primary"></i>
            {isStaff ? `${currentUser.departmentName || 'Department'} Company Registry` : 'Master Company Directory'}
          </h6>
          <small className="text-muted">Data synced in real-time</small>
        </div>

        {loading ? (
          <div className="p-5 text-center text-muted">
            <div className="spinner-border text-primary mb-2" role="status"></div>
            <div>Loading organization database...</div>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="p-5 text-center text-muted">
            <i className="bi bi-building-x fs-1 text-secondary opacity-50 mb-2 d-block"></i>
            <h6 className="fw-bold">No Companies or Guest Organizations Found</h6>
            <p className="small text-muted mb-3">Try adjusting your search query or filters, or register a new guest organization.</p>
            <button className="btn btn-primary btn-sm fw-bold" onClick={handleOpenAddModal}>
              <i className="bi bi-plus-lg me-1"></i> Register New Company
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light small text-muted font-monospace">
                <tr>
                  <th style={{ width: '250px' }}>COMPANY / ORGANIZATION</th>
                  <th style={{ width: '170px' }}>TYPE</th>
                  <th style={{ width: '220px' }}>CONTACT INFO</th>
                  <th style={{ width: '200px' }}>DEPARTMENT & REGISTERED BY</th>
                  <th style={{ width: '120px' }}>REG DATE</th>
                  <th style={{ width: '100px' }}>STATUS</th>
                  <th style={{ width: '130px' }} className="text-end">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map(comp => (
                  <tr key={comp.id}>
                    <td>
                      <div className="fw-bold text-dark fs-6">{comp.name}</div>
                      <div className="text-muted small font-monospace">
                        <i className="bi bi-card-text me-1"></i>Reg #: {comp.registrationNumber || 'N/A'}
                      </div>
                      {comp.address && comp.address !== 'N/A' && (
                        <div className="text-secondary small text-truncate" style={{ maxWidth: '240px', fontSize: '0.75rem' }} title={comp.address}>
                          <i className="bi bi-geo-alt me-1"></i>{comp.address}
                        </div>
                      )}
                    </td>

                    <td>
                      {comp.companyType === 'CONTRACTOR_VENDOR' && (
                        <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2.5 py-1.5 font-monospace">
                          <i className="bi bi-tools me-1"></i>CONTRACTOR / VENDOR
                        </span>
                      )}
                      {comp.companyType === 'VISITOR_ORGANIZATION' && (
                        <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle px-2.5 py-1.5 font-monospace">
                          <i className="bi bi-building me-1"></i>GUEST / VISITOR ORG
                        </span>
                      )}
                      {comp.companyType === 'INTERNAL' && (
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2.5 py-1.5 font-monospace">
                          <i className="bi bi-house-door me-1"></i>INTERNAL HQ
                        </span>
                      )}
                    </td>

                    <td>
                      <div className="small fw-semibold text-dark">
                        <i className="bi bi-telephone text-primary me-1"></i>{comp.contactPhone || 'N/A'}
                      </div>
                      <div className="small text-muted font-monospace text-truncate" style={{ maxWidth: '210px' }} title={comp.contactEmail}>
                        <i className="bi bi-envelope me-1"></i>{comp.contactEmail || 'N/A'}
                      </div>
                    </td>

                    <td>
                      <div className="fw-semibold text-dark small">
                        <i className="bi bi-diagram-3 me-1 text-primary"></i>{comp.departmentName || 'Global / Unassigned'}
                      </div>
                      <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                        By: {comp.registeredByUserName || 'System Admin'}
                      </div>
                    </td>

                    <td className="small font-monospace text-muted">
                      {comp.createdAt || 'N/A'}
                    </td>

                    <td>
                      {comp.isActive ? (
                        <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 font-monospace">
                          ● ACTIVE
                        </span>
                      ) : (
                        <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-2 py-1 font-monospace">
                          ○ INACTIVE
                        </span>
                      )}
                    </td>

                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <button
                          className="btn btn-outline-primary"
                          title="Edit Company Details"
                          onClick={() => handleOpenEditModal(comp)}
                        >
                          <i className="bi bi-pencil-square me-1"></i>Edit
                        </button>
                        <button
                          className={`btn ${comp.isActive ? 'btn-outline-danger' : 'btn-outline-success'}`}
                          title={comp.isActive ? 'Deactivate Company' : 'Reactivate Company'}
                          onClick={() => handleToggleStatus(comp)}
                        >
                          {comp.isActive ? <i className="bi bi-slash-circle"></i> : <i className="bi bi-check-circle"></i>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REGISTER / EDIT MODAL */}
      {showAddModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header bg-dark text-white p-3">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                  <i className="bi bi-building-add text-primary"></i>
                  {editingCompany ? 'Edit Company / Organization Details' : 'Register New Company / Guest Organization'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAddModal(false)}></button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="modal-body p-4">
                  <div className="alert alert-info border-info-subtle bg-info-subtle text-info-emphasis small py-2 px-3 mb-3 rounded-2">
                    <i className="bi bi-info-circle-fill me-1"></i>
                    {isStaff
                      ? `This company/organization record will be saved under the ${currentUser.departmentName || 'Department'} directory and can be auto-selected for future visitor/contractor registrations.`
                      : 'This company/organization record will be saved in the master database across all departments.'}
                  </div>

                  <div className="row g-3">
                    <div className="col-12 col-md-8">
                      <label className="form-label fw-bold text-dark small">
                        Company / Organization Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Acme Corporation, TechShield Sdn Bhd"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label fw-bold text-dark small">Company Type</label>
                      <select
                        className="form-select"
                        value={form.companyType}
                        onChange={e => setForm({ ...form, companyType: e.target.value as any })}
                      >
                        <option value="VISITOR_ORGANIZATION">Visitor / Guest Organization</option>
                        <option value="CONTRACTOR_VENDOR">Contractor / Vendor Firm</option>
                        <option value="INTERNAL">Internal Enterprise Unit</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-bold text-dark small">Registration / SSM Number</label>
                      <input
                        type="text"
                        className="form-control font-monospace"
                        placeholder="e.g. 202601009842 (123456-X)"
                        value={form.registrationNumber}
                        onChange={e => setForm({ ...form, registrationNumber: e.target.value })}
                      />
                      <small className="text-muted" style={{ fontSize: '0.72rem' }}>Leave blank to auto-generate system ID</small>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-bold text-dark small">Contact Phone Number</label>
                      <input
                        type="text"
                        className="form-control font-monospace"
                        placeholder="e.g. +60 3-8890 1200"
                        value={form.contactPhone}
                        onChange={e => setForm({ ...form, contactPhone: e.target.value })}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-bold text-dark small">Contact Email Address</label>
                      <input
                        type="email"
                        className="form-control font-monospace"
                        placeholder="e.g. info@acme.com"
                        value={form.contactEmail}
                        onChange={e => setForm({ ...form, contactEmail: e.target.value })}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-bold text-dark small">Scope Department</label>
                      <input
                        type="text"
                        className="form-control bg-light text-muted"
                        value={currentUser.departmentName || 'Global / Unassigned'}
                        readOnly
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label fw-bold text-dark small">Address / Location Remarks</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        placeholder="e.g. Suite 501, Tower B, Commercial Park..."
                        value={form.address}
                        onChange={e => setForm({ ...form, address: e.target.value })}
                      ></textarea>
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light p-3">
                  <button type="button" className="btn btn-outline-secondary fw-semibold" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary fw-bold px-4" disabled={submitLoading}>
                    {submitLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle-fill me-1"></i>
                        {editingCompany ? 'Update Company Details' : 'Save Company Record'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Company Deactivation Confirmation Modal */}
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
                    Once deactivated, this company will <strong>no longer be selectable</strong> in new visitor pre-registrations or contractor work permit submissions.
                  </div>
                </div>
              </div>

              <div className="modal-footer bg-light py-3 px-4 border-0 d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary px-3 fw-semibold"
                  onClick={() => setCompanyToDeactivate(null)}
                  disabled={submitLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger px-4 fw-bold shadow-sm"
                  onClick={handleConfirmDeactivate}
                  disabled={submitLoading}
                >
                  {submitLoading ? (
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
