import React, { useEffect, useState } from 'react';
import { EmailLogEntry } from '../types';
import { getEmailSettings, testSmtpConnection, getEmailLogs, sendTestEmail } from '../lib/api';

export const EmailTestView: React.FC = () => {
  const [settings, setSettings] = useState<any>(null);
  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // SMTP Relay quick connection test
  const [testingSmtp, setTestingSmtp] = useState<boolean>(false);
  const [smtpResult, setSmtpResult] = useState<{ success: boolean; message: string } | null>(null);

  // Send Test Email Form state
  const [recipient, setRecipient] = useState<string>('ananth@tanaka.com.my');
  const [subject, setSubject] = useState<string>('VMS SMTP Relay Test Email');
  const [message, setMessage] = useState<string>('This is a test notification email from Tanaka Visitor Management System sent via internal SMTP relay 157.9.183.242:25.');
  const [sending, setSending] = useState<boolean>(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [settingsRes, logsRes] = await Promise.all([
        getEmailSettings(),
        getEmailLogs()
      ]);
      setSettings(settingsRes.settings);
      setLogs(logsRes);
      if (settingsRes.settings?.ItEmail) {
        setRecipient(settingsRes.settings.ItEmail);
      }
    } catch (err: any) {
      console.error('Failed to load email diagnostic data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTestSmtpConnection = async () => {
    try {
      setTestingSmtp(true);
      setSmtpResult(null);
      const res = await testSmtpConnection();
      if (res.success) {
        setSmtpResult({
          success: true,
          message: `Successfully connected to SMTP relay ${settings?.SmtpServer || '157.9.183.242'}:${settings?.SmtpPort || 25}.`
        });
      } else {
        setSmtpResult({
          success: false,
          message: `SMTP connection failed: ${res.error || 'Host unreachable or port 25 blocked.'}`
        });
      }
    } catch (err: any) {
      setSmtpResult({
        success: false,
        message: `SMTP test error: ${err.message}`
      });
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim() || !subject.trim()) {
      setSendResult({
        success: false,
        message: 'Recipient email address and Subject are required.'
      });
      return;
    }

    try {
      setSending(true);
      setSendResult(null);
      const res = await sendTestEmail(recipient.trim(), subject.trim(), message.trim());
      if (res.success) {
        setSendResult({
          success: true,
          message: `Email sent successfully. ${res.messageId ? `Message ID: ${res.messageId}` : ''}`
        });
        // Refresh logs table
        const updatedLogs = await getEmailLogs();
        setLogs(updatedLogs);
      } else {
        setSendResult({
          success: false,
          message: `Email failed. ${res.error || 'SMTP delivery rejected.'}`
        });
        const updatedLogs = await getEmailLogs();
        setLogs(updatedLogs);
      }
    } catch (err: any) {
      setSendResult({
        success: false,
        message: `Email failed. ${err.message}`
      });
      const updatedLogs = await getEmailLogs();
      setLogs(updatedLogs);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4">
      {/* HEADER BAR */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-3 border-bottom gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h3 className="fw-extrabold text-dark mb-0">
              <i className="bi bi-envelope-paper-heart-fill text-primary me-2"></i>
              Email Notification Diagnostic & Test Console
            </h3>
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2.5 py-1 font-monospace">
              <i className="bi bi-shield-lock-fill me-1"></i> Administrator Only
            </span>
          </div>
          <p className="text-muted mb-0 small">
            Configure company SMTP relay parameters, dispatch test notification messages, and view real-time email execution logs.
          </p>
        </div>

        <button className="btn btn-outline-secondary fw-semibold btn-sm d-flex align-items-center gap-2 px-3 py-2" onClick={loadData}>
          <i className="bi bi-arrow-clockwise"></i> Refresh Data
        </button>
      </div>

      <div className="row g-4 mb-4">
        {/* CONFIGURATION SUMMARY CARD */}
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm bg-white rounded-3 h-100">
            <div className="card-header bg-dark text-white py-3">
              <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
                <i className="bi bi-sliders text-warning"></i>
                Active SMTP & Notification Relay Settings
              </h6>
            </div>
            <div className="card-body p-4">
              {loading ? (
                <div className="text-center py-4 text-muted">
                  <div className="spinner-border spinner-border-sm text-primary mb-2" role="status"></div>
                  <div>Loading email configuration...</div>
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <label className="text-secondary small font-monospace fw-bold d-block mb-1">SMTP RELAY SERVER</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0">
                        <i className="bi bi-hdd-network-fill text-primary"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control bg-light font-monospace fw-bold"
                        value={`${settings?.SmtpServer || '157.9.183.242'} : Port ${settings?.SmtpPort || 25}`}
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="text-secondary small font-monospace fw-bold d-block mb-1">FROM SENDER ADDRESS</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0">
                        <i className="bi bi-send-check-fill text-success"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control bg-light font-monospace"
                        value={`${settings?.FromName || 'Tanaka VMS'} <${settings?.FromAddress || 'Administrator@tanaka.com.my'}>`}
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-12 col-md-4">
                      <label className="text-secondary small font-monospace fw-bold d-block mb-1">MD RECIPIENT</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light font-monospace"
                        value={settings?.MdEmail || 'luqman@tanaka.com.my'}
                        readOnly
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="text-secondary small font-monospace fw-bold d-block mb-1">IT RECIPIENT</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light font-monospace"
                        value={settings?.ItEmail || 'Nora@tanaka.com.my'}
                        readOnly
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="text-secondary small font-monospace fw-bold d-block mb-1">PROD MGR RECIPIENT</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light font-monospace"
                        value={settings?.ProductionManagerEmail || 'nakamu@ml.tanaka.co.jp'}
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-light rounded-3 border mb-3">
                    <small className="text-muted d-block">
                      <i className="bi bi-info-circle-fill text-info me-1"></i>
                      SMTP settings are configured via <code>appsettings.json</code>. The VMS connects directly as an SMTP client to <strong>157.9.183.242:25</strong> to route emails to Microsoft 365.
                    </small>
                  </div>

                  {smtpResult && (
                    <div className={`alert ${smtpResult.success ? 'alert-success' : 'alert-danger'} py-2 px-3 small d-flex align-items-center gap-2 mb-3`}>
                      <i className={`bi ${smtpResult.success ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} fs-6`}></i>
                      <div>{smtpResult.message}</div>
                    </div>
                  )}

                  <button
                    className="btn btn-outline-primary w-100 fw-bold d-flex align-items-center justify-content-center gap-2"
                    onClick={handleTestSmtpConnection}
                    disabled={testingSmtp}
                  >
                    {testingSmtp ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                        Testing TCP Connection to 157.9.183.242:25...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-plug-fill"></i>
                        Test SMTP Connection
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* SEND TEST EMAIL FORM CARD */}
        <div className="col-12 col-lg-7">
          <div className="card border-0 shadow-sm bg-white rounded-3 h-100">
            <div className="card-header bg-primary text-white py-3">
              <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
                <i className="bi bi-envelope-fill"></i>
                Send Test Email via VMS EmailService
              </h6>
            </div>
            <div className="card-body p-4">
              <form onSubmit={handleSendTestEmail}>
                <div className="mb-3">
                  <label className="form-label fw-bold text-dark small">
                    Recipient Email Address <span className="text-danger">*</span>
                  </label>
                  <input
                    type="email"
                    className="form-control font-monospace"
                    placeholder="e.g. ananth@tanaka.com.my"
                    value={recipient}
                    onChange={e => setRecipient(e.target.value)}
                    required
                  />
                  <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                    Defaults to IT notification address (ananth@tanaka.com.my)
                  </small>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold text-dark small">
                    Subject Line <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. VMS Request Approved - REQ-2026-1001"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold text-dark small">
                    Email Message Content
                  </label>
                  <textarea
                    className="form-control font-monospace"
                    rows={4}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                  ></textarea>
                </div>

                {sendResult && (
                  <div className={`alert ${sendResult.success ? 'alert-success' : 'alert-danger'} p-3 rounded-2 d-flex align-items-center gap-2 mb-3`}>
                    <i className={`bi ${sendResult.success ? 'bi-check-circle-fill fs-4' : 'bi-exclamation-triangle-fill fs-4'}`}></i>
                    <div>
                      <div className="fw-bold">{sendResult.success ? 'Email sent successfully.' : 'Email failed.'}</div>
                      <div className="small font-monospace">{sendResult.message}</div>
                    </div>
                  </div>
                )}

                <div className="d-flex justify-content-end">
                  <button type="submit" className="btn btn-primary fw-bold px-4 py-2" disabled={sending}>
                    {sending ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Sending via SMTP Relay...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-send-fill me-2"></i>
                        Send Test Email
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* EMAIL LOG TABLE CONTAINER */}
      <div className="card border-0 shadow-sm bg-white rounded-3 overflow-hidden">
        <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
          <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
            <i className="bi bi-journal-text text-primary"></i>
            Email Notification Dispatch Logs (EmailLog Table)
          </h6>
          <span className="badge bg-secondary-subtle text-secondary border font-monospace">
            Total Records: {logs.length}
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="p-5 text-center text-muted">
            <i className="bi bi-inbox fs-1 text-secondary opacity-50 mb-2 d-block"></i>
            <h6 className="fw-bold">No Email Logs Recorded Yet</h6>
            <p className="small text-muted mb-0">Use the form above to send a test email or trigger notification events.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light small text-muted font-monospace">
                <tr>
                  <th style={{ width: '160px' }}>TIMESTAMP</th>
                  <th style={{ width: '180px' }}>EMAIL TYPE</th>
                  <th style={{ width: '220px' }}>RECIPIENT</th>
                  <th>SUBJECT</th>
                  <th style={{ width: '100px' }}>STATUS</th>
                  <th style={{ width: '220px' }}>DETAILS / ERROR</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="small font-monospace text-muted">{log.createdDate}</td>
                    <td>
                      {log.emailType === 'MD_NOTIFICATION' && (
                        <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1 font-monospace">
                          MD_NOTIFICATION
                        </span>
                      )}
                      {log.emailType === 'APPROVED_NOTIFICATION' && (
                        <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 font-monospace">
                          APPROVED_NOTIFICATION
                        </span>
                      )}
                      {log.emailType === 'DECLINED_NOTIFICATION' && (
                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1 font-monospace">
                          DECLINED_NOTIFICATION
                        </span>
                      )}
                      {log.emailType === 'TEST_EMAIL' && (
                        <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle px-2 py-1 font-monospace">
                          TEST_EMAIL
                        </span>
                      )}
                    </td>
                    <td className="small font-monospace text-dark font-semibold">{log.recipient}</td>
                    <td className="small fw-semibold text-dark">{log.subject}</td>
                    <td>
                      {log.status === 'Sent' ? (
                        <span className="badge bg-success text-white px-2.5 py-1 font-monospace">
                          Sent
                        </span>
                      ) : (
                        <span className="badge bg-danger text-white px-2.5 py-1 font-monospace">
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="small text-muted font-monospace text-truncate" style={{ maxWidth: '220px' }} title={log.errorMessage || 'Delivered to SMTP relay'}>
                      {log.errorMessage ? (
                        <span className="text-danger"><i className="bi bi-x-circle me-1"></i>{log.errorMessage}</span>
                      ) : (
                        <span className="text-success"><i className="bi bi-check-all me-1"></i>Dispatched OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
