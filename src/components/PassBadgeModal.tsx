import React from 'react';
import { Visitor, Contractor, SystemSettings } from '../types';

interface PassBadgeModalProps {
  item: Visitor | Contractor;
  type: 'VISITOR' | 'CONTRACTOR';
  settings: SystemSettings;
  onClose: () => void;
}

export const PassBadgeModal: React.FC<PassBadgeModalProps> = ({ item, type, settings, onClose }) => {
  const isVisitor = type === 'VISITOR';
  const visitorItem = item as Visitor;
  const contractorItem = item as Contractor;

  const badgeNumber = item.passBadgeNumber || (isVisitor ? 'V-TEMP-99' : 'C-TEMP-99');
  const issueTime = item.checkInTime || new Date().toISOString().replace('T', ' ').substring(0, 19);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal show d-block bg-dark bg-opacity-75" tabIndex={-1}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-secondary shadow-lg">
          <div className="modal-header bg-dark text-white p-3">
            <h5 className="modal-title d-flex align-items-center gap-2">
              <i className="bi bi-pass-fill text-warning fs-4"></i>
              Official Enterprise Pass Badge Preview
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <div className="modal-body p-4 bg-light text-center">
            {/* Printable Physical Badge Card */}
            <div id="printableBadge" className="card shadow border-2 border-dark mx-auto text-start overflow-hidden bg-white" style={{ maxWidth: '360px', borderRadius: '12px' }}>
              {/* Badge Header Banner */}
              <div className={`${isVisitor ? 'bg-primary' : 'bg-warning text-dark'} text-white p-3 text-center position-relative`}>
                <div className="fw-extrabold font-monospace text-uppercase tracking-wider fs-6">
                  {settings.companyName || 'ENTERPRISE HEADQUARTERS'}
                </div>
                <div className="fw-bold fs-5 text-uppercase mt-1">
                  {isVisitor ? 'VISITOR SECURITY PASS' : 'CONTRACTOR ACCESS BADGE'}
                </div>
                <span className="position-absolute top-0 end-0 m-2 badge bg-dark bg-opacity-50 text-white font-monospace">
                  ON-PREMISE
                </span>
              </div>

              <div className="card-body p-4 text-center">
                {/* Avatar / Photo Box */}
                <div className="d-inline-block position-relative mb-3">
                  <div className="bg-light border border-3 border-secondary rounded-circle d-flex align-items-center justify-content-center mx-auto shadow-sm" style={{ width: '90px', height: '90px' }}>
                    <i className={`bi ${isVisitor ? 'bi-person-fill' : 'bi-tools'} fs-1 text-secondary`}></i>
                  </div>
                  <span className="position-absolute bottom-0 end-0 badge bg-success border border-white rounded-circle p-2">
                    <i className="bi bi-check-lg"></i>
                  </span>
                </div>

                {/* Name & ID */}
                <h4 className="fw-extrabold text-dark mb-1">{item.fullName}</h4>
                <div className="text-secondary fw-semibold fs-6 mb-2">{item.companyName}</div>

                <div className="badge bg-dark font-monospace fs-6 px-3 py-2 mb-3 tracking-widest text-white shadow-sm">
                  BADGE NO: {badgeNumber}
                </div>

                <hr className="my-2" />

                {/* Details Grid */}
                <div className="text-start small row g-2">
                  <div className="col-6">
                    <span className="text-muted d-block">HOST STAFF:</span>
                    <strong className="text-dark">{item.hostUserName}</strong>
                  </div>
                  <div className="col-6">
                    <span className="text-muted d-block">DEPARTMENT:</span>
                    <strong className="text-dark">{item.hostDepartment}</strong>
                  </div>
                  <div className="col-12">
                    <span className="text-muted d-block">{isVisitor ? 'MEETING VENUE:' : 'WORK AREA:'}</span>
                    <strong className="text-dark">{isVisitor ? visitorItem.meetingVenueName : contractorItem.locationVenueName}</strong>
                  </div>
                  {isVisitor ? (
                    <>
                      <div className="col-12">
                        <span className="text-muted d-block">PURPOSE OF VISIT:</span>
                        <span className="text-dark">{visitorItem.purpose}</span>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block">START TIME:</span>
                        <strong className="text-primary font-monospace">{visitorItem.scheduledStartTime || '09:00'}</strong>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block">END TIME:</span>
                        <strong className="text-primary font-monospace">{visitorItem.scheduledEndTime || '12:00'}</strong>
                      </div>
                    </>
                  ) : (
                    <div className="col-12">
                      <span className="text-muted d-block">WORK ORDER #:</span>
                      <span className="text-dark fw-bold">{contractorItem.workOrderNo}</span>
                    </div>
                  )}
                  <div className="col-12">
                    <span className="text-muted d-block">ISSUED TIMESTAMP:</span>
                    <span className="font-monospace text-secondary">{issueTime}</span>
                  </div>
                </div>

                {/* Barcode / QR Simulation */}
                <div className="mt-3 pt-3 border-top text-center">
                  <div className="bg-dark text-white p-2 rounded font-monospace small tracking-widest mb-1 d-inline-block px-4">
                    ||||| ||| ||||||| |||| ||||| ||
                  </div>
                  <div className="text-muted font-monospace" style={{ fontSize: '0.65rem' }}>
                    IC/PASS: {item.idNumber} | VALID FOR TODAY ONLY
                  </div>
                </div>
              </div>

              {/* Badge Footer Notice */}
              <div className="card-footer bg-light p-2 text-center text-muted" style={{ fontSize: '0.65rem' }}>
                {settings.onPremiseNoticeText || 'Must be displayed visibly at all times on premise.'}
              </div>
            </div>
          </div>

          <div className="modal-footer bg-light p-3">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            <button type="button" className="btn btn-primary d-flex align-items-center gap-2" onClick={handlePrint}>
              <i className="bi bi-printer-fill"></i>
              Print Pass Badge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
