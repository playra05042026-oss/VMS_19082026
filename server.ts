import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db, logAudit } from './src/server/db';
import { emailService } from './src/server/emailService';
import { User, Visitor, Contractor, BlacklistEntry, Department, Company, MeetingVenue, VisitorCategory, ContractorCategory, LoginHistory } from './src/types';
import {
  initPostgres,
  saveCompanyToPg,
  deleteCompanyFromPg,
  saveVisitorToPg,
  saveContractorToPg,
  saveUserToPg,
  saveAuditLogToPg,
  fetchUsersFromPg,
  deleteUserFromPg,
  fetchCompaniesFromPg,
  fetchVisitorsFromPg,
  deleteVisitorFromPg,
  fetchContractorsFromPg,
  deleteContractorFromPg,
  fetchAuditLogsFromPg,
  fetchBlacklistFromPg,
  saveBlacklistEntryToPg,
  deleteBlacklistEntryFromPg,
  saveDepartmentToPg,
  deleteDepartmentFromPg,
  fetchDepartmentsFromPg,
  saveMeetingVenueToPg,
  deleteMeetingVenueFromPg,
  fetchMeetingVenuesFromPg,
  saveVisitorCategoryToPg,
  fetchVisitorCategoriesFromPg,
  saveContractorCategoryToPg,
  fetchContractorCategoriesFromPg,
  saveSystemSettingsToPg,
  fetchSystemSettingsFromPg,
  savePasswordPolicyToPg,
  fetchPasswordPolicyFromPg,
  saveEmailSettingsToPg,
  fetchEmailSettingsFromPg,
  saveEmailLogToPg,
  fetchEmailLogsFromPg,
  saveLoginHistoryToPg,
  fetchLoginHistoryFromPg,
  getDbPoolMetrics,
  getIsPgConnected
} from './src/server/postgres';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize PostgreSQL Database Connection & Load Seed Data asynchronously
  initPostgres().then(connected => {
    if (connected) console.log('PostgreSQL initialized successfully.');
    else console.log('PostgreSQL connection attempt finished (using memory store fallback if unavailable).');
  }).catch(err => {
    console.warn('PostgreSQL initialization error:', err ? err.message : err);
  });

  // Helper to get active user
  const getActiveUser = (): User => {
    return db.users.find(u => u.id === db.activeUserId) || db.users[0];
  };

  // --- API ROUTES ---

  // Auth: Current User & Switch Role User
  app.get('/api/vms/auth/current-user', (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser && !currentUser.isActive) {
      return res.status(400).json({ error: 'Your account is deactivated, please contact Security Administrator.' });
    }
    res.json({ user: currentUser });
  });

  app.post('/api/vms/auth/switch-user', async (req, res) => {
    const { userId } = req.body;
    const targetUser = db.users.find(u => u.id === userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!targetUser.isActive) {
      logAudit(targetUser.id, 'USER_SWITCH_BLOCKED', `Blocked login attempt to deactivated account ${targetUser.fullName}`, req);
      return res.status(400).json({ error: 'Your account is deactivated, please contact Security Administrator.' });
    }
    db.activeUserId = targetUser.id;
    targetUser.lastLoginAt = new Date().toISOString();

    const loginRecord: LoginHistory = {
      id: `lh-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userId: targetUser.id,
      userName: targetUser.fullName,
      userRole: targetUser.role,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '192.168.10.100',
      status: 'SUCCESS',
      userAgent: req.headers['user-agent'] || 'VMS Web Portal'
    };

    db.loginHistory.unshift(loginRecord);
    if (getIsPgConnected()) {
      await saveLoginHistoryToPg(loginRecord);
      await saveUserToPg(targetUser);
    }

    logAudit(targetUser.id, 'LOGIN', `Active session switched to ${targetUser.fullName} (${targetUser.role})`, req);
    res.json({ user: targetUser });
  });

  // --- EMAIL NOTIFICATION MODULE (STAGE 1 & STAGE 2) ---
  app.get('/api/vms/email/settings', async (req, res) => {
    if (getIsPgConnected()) {
      const pgSettings = await fetchEmailSettingsFromPg();
      if (pgSettings) {
        return res.json({ settings: pgSettings });
      }
    }
    res.json({
      settings: emailService.getSettings()
    });
  });

  // PUT update email configuration settings
  app.put('/api/vms/email/settings', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR') {
      return res.status(400).json({ error: 'Permission denied. Only Administrators can update system email settings.' });
    }

    const { 
      SmtpServer, 
      SmtpPort, 
      FromAddress, 
      FromName, 
      MdEmail, 
      ItEmail, 
      ProductionManagerEmail, 
      FallbackAdminEmail,
      Secure,
      EnableMdNotifications,
      EnableProdManagerNotifications,
      EnableNewUserNotifications,
      EnableCheckInNotifications,
      BackupApproverEmail,
      BackupApproverName,
      BackupApproverUserId,
      EnableDelegation,
      DelegationStartDate,
      DelegationEndDate,
      DelegationRoutingMode,
      DelegationReason
    } = req.body;

    if (SmtpPort !== undefined && (isNaN(Number(SmtpPort)) || Number(SmtpPort) <= 0)) {
      return res.status(400).json({ error: 'Invalid SMTP Port number.' });
    }

    const oldSettings = emailService.getSettings();
    const updated = await emailService.updateSettings({
      SmtpServer: SmtpServer || oldSettings.SmtpServer,
      SmtpPort: SmtpPort ? Number(SmtpPort) : oldSettings.SmtpPort,
      FromAddress: FromAddress || oldSettings.FromAddress,
      FromName: FromName || oldSettings.FromName,
      MdEmail: MdEmail || oldSettings.MdEmail,
      ItEmail: ItEmail !== undefined ? ItEmail : oldSettings.ItEmail,
      ProductionManagerEmail: ProductionManagerEmail !== undefined ? ProductionManagerEmail : oldSettings.ProductionManagerEmail,
      FallbackAdminEmail: FallbackAdminEmail !== undefined ? FallbackAdminEmail : oldSettings.FallbackAdminEmail,
      Secure: Secure !== undefined ? Boolean(Secure) : oldSettings.Secure,
      EnableMdNotifications: EnableMdNotifications !== undefined ? Boolean(EnableMdNotifications) : oldSettings.EnableMdNotifications,
      EnableProdManagerNotifications: EnableProdManagerNotifications !== undefined ? Boolean(EnableProdManagerNotifications) : oldSettings.EnableProdManagerNotifications,
      EnableNewUserNotifications: EnableNewUserNotifications !== undefined ? Boolean(EnableNewUserNotifications) : oldSettings.EnableNewUserNotifications,
      EnableCheckInNotifications: EnableCheckInNotifications !== undefined ? Boolean(EnableCheckInNotifications) : oldSettings.EnableCheckInNotifications,
      BackupApproverEmail: BackupApproverEmail !== undefined ? BackupApproverEmail : oldSettings.BackupApproverEmail,
      BackupApproverName: BackupApproverName !== undefined ? BackupApproverName : oldSettings.BackupApproverName,
      BackupApproverUserId: BackupApproverUserId !== undefined ? BackupApproverUserId : oldSettings.BackupApproverUserId,
      EnableDelegation: EnableDelegation !== undefined ? Boolean(EnableDelegation) : oldSettings.EnableDelegation,
      DelegationStartDate: DelegationStartDate !== undefined ? DelegationStartDate : oldSettings.DelegationStartDate,
      DelegationEndDate: DelegationEndDate !== undefined ? DelegationEndDate : oldSettings.DelegationEndDate,
      DelegationRoutingMode: DelegationRoutingMode !== undefined ? DelegationRoutingMode : oldSettings.DelegationRoutingMode,
      DelegationReason: DelegationReason !== undefined ? DelegationReason : oldSettings.DelegationReason
    });

    const changesList: string[] = [];
    if (oldSettings.MdEmail !== updated.MdEmail) changesList.push(`MD Email: ${oldSettings.MdEmail} -> ${updated.MdEmail}`);
    if (oldSettings.ItEmail !== updated.ItEmail) changesList.push(`IT Email: ${oldSettings.ItEmail} -> ${updated.ItEmail}`);
    if (oldSettings.ProductionManagerEmail !== updated.ProductionManagerEmail) changesList.push(`Production Manager Email: ${oldSettings.ProductionManagerEmail} -> ${updated.ProductionManagerEmail}`);
    if (oldSettings.EnableDelegation !== updated.EnableDelegation) changesList.push(`Delegation Active: ${oldSettings.EnableDelegation} -> ${updated.EnableDelegation}`);
    if (oldSettings.BackupApproverEmail !== updated.BackupApproverEmail) changesList.push(`Backup Approver: ${updated.BackupApproverEmail}`);
    if (oldSettings.FromAddress !== updated.FromAddress) changesList.push(`From Address: ${oldSettings.FromAddress} -> ${updated.FromAddress}`);
    if (oldSettings.SmtpServer !== updated.SmtpServer) changesList.push(`SMTP Server: ${oldSettings.SmtpServer} -> ${updated.SmtpServer}`);

    const auditDetail = changesList.length > 0 
      ? `Updated Email Settings: ${changesList.join(', ')}` 
      : 'Updated System Email Configuration';

    logAudit(currentUser.id, 'SYSTEM_CONFIG_UPDATE', auditDetail, req);

    res.json({
      message: 'Email configuration updated and saved directly to PostgreSQL successfully.',
      settings: updated
    });
  });

  app.post('/api/vms/email/test-smtp', async (req, res) => {
    const currentUser = getActiveUser();
    const result = await emailService.testConnection();
    logAudit(currentUser.id, 'SMTP_TEST', `Tested SMTP connection to ${emailService.getSettings().SmtpServer}:${emailService.getSettings().SmtpPort}: ${result.success ? 'SUCCESS' : result.error}`);
    res.json(result);
  });

  app.get('/api/vms/email/logs', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR') {
      return res.status(403).json({ error: 'Administrator access required.' });
    }
    if (getIsPgConnected()) {
      const pgLogs = await fetchEmailLogsFromPg();
      if (pgLogs) return res.json(pgLogs);
    }
    res.json(db.emailLogs || []);
  });

  app.post('/api/vms/email/send-test', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR') {
      return res.status(403).json({ error: 'Administrator access required.' });
    }

    const { recipient, subject, message } = req.body;
    if (!recipient || !recipient.trim()) {
      return res.status(400).json({ error: 'Recipient email address is required.' });
    }

    const testSubject = subject && subject.trim() ? subject.trim() : 'Tanaka VMS SMTP Test Email';

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 6px;">
        <div style="background-color: #003366; color: white; padding: 15px 20px; border-radius: 4px 4px 0 0;">
          <h2 style="margin: 0; font-size: 18px;">Tanaka Visitor Management System</h2>
          <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.8;">SMTP Test Message</p>
        </div>
        <div style="padding: 20px; background-color: #fcfcfc;">
          <p style="font-size: 14px;">This is an automated SMTP test email sent from the Tanaka VMS Administrator Console.</p>
          <div style="background: #ffffff; border-left: 4px solid #003366; padding: 12px; margin: 15px 0; font-size: 13px;">
            <strong>Subject:</strong> ${testSubject}<br/>
            <strong>Sent Date:</strong> ${new Date().toLocaleString()}<br/>
            <strong>Message:</strong> ${message || 'System SMTP configuration verified.'}
          </div>
          <p style="font-size: 12px; color: #666; margin-top: 20px;">If you received this message, the company SMTP relay (157.9.183.242:25) is configured correctly.</p>
        </div>
      </div>
    `;

    const result = await emailService.sendAndLogEmail({
      to: recipient.trim(),
      subject: testSubject,
      html: htmlBody,
      text: `Tanaka VMS SMTP Test Message\n\nSubject: ${testSubject}\nDate: ${new Date().toLocaleString()}\nMessage: ${message || 'System SMTP configuration verified.'}`,
      emailType: 'TEST_EMAIL'
    });

    logAudit(currentUser.id, 'SEND_TEST_EMAIL', `Sent test email to ${recipient}: ${result.success ? 'SUCCESS' : result.error}`);
    res.json(result);
  });

  // --- AUTOMATIC EMAIL NOTIFICATION DISPATCH HELPERS (STAGES 3, 4, 5) ---
  function getHostEmail(hostUserId?: string | null): string | null {
    if (!hostUserId) return null;
    const user = db.users.find(u => u.id === hostUserId);
    return user && user.email ? user.email.trim() : null;
  }

  function isExecutiveDelegationActive(customSettings?: any): boolean {
    const s = customSettings || emailService.getSettings();
    if (!s.EnableDelegation) return false;
    if (!s.BackupApproverEmail && !s.BackupApproverUserId) return false;
    const today = new Date().toISOString().split('T')[0];
    if (s.DelegationStartDate && today < s.DelegationStartDate) return false;
    if (s.DelegationEndDate && today > s.DelegationEndDate) return false;
    return true;
  }

  function canUserApproveExecutive(user: User): { allowed: boolean; isActing: boolean; actingLabel?: string } {
    if (user.role === 'MANAGING_DIRECTOR') {
      return { allowed: true, isActing: false };
    }
    const settings = emailService.getSettings();
    if (isExecutiveDelegationActive(settings)) {
      if (settings.BackupApproverUserId && settings.BackupApproverUserId === user.id) {
        return { allowed: true, isActing: true, actingLabel: `${user.fullName} (Acting Approver for MD)` };
      }
      if (settings.BackupApproverEmail && user.email && settings.BackupApproverEmail.toLowerCase().includes(user.email.toLowerCase())) {
        return { allowed: true, isActing: true, actingLabel: `${user.fullName} (Acting Approver for MD)` };
      }
    }
    return { allowed: false, isActing: false };
  }

  // STAGE 3: Notify MD or Assigned Acting Approver on Staff Submission
  async function sendMdNewRequestNotification(details: {
    registrationNo: string;
    type: 'Visitor' | 'Contractor';
    visitorOrContractorName: string;
    companyName: string;
    hostName: string;
    department: string;
    visitDate: string;
    expectedTime: string;
    purpose: string;
  }) {
    try {
      const settings = emailService.getSettings();
      const isDelegated = isExecutiveDelegationActive(settings);

      let recipient = settings.MdEmail || 'luqman@tanaka.com.my';
      if (isDelegated && settings.BackupApproverEmail && settings.BackupApproverEmail.trim()) {
        if (settings.DelegationRoutingMode === 'BACKUP_ONLY') {
          recipient = settings.BackupApproverEmail.trim();
        } else {
          recipient = `${settings.MdEmail || 'luqman@tanaka.com.my'}, ${settings.BackupApproverEmail.trim()}`;
        }
      }

      const portalUrl = 'http://157.9.183.151:3000';
      const subject = `VMS Approval Required - ${details.registrationNo}${isDelegated ? ' [EXECUTIVE DELEGATION / ACTING APPROVER]' : ''}`;

      const delegationBannerHtml = isDelegated ? `
        <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 15px 0; border-radius: 4px; font-size: 13px; color: #856404;">
          <strong>🏢 Executive Notification Delegation Active:</strong><br/>
          Assigned Secondary / Acting Approver: <strong>${settings.BackupApproverName || 'Acting Approver'} (${settings.BackupApproverEmail || ''})</strong><br/>
          <span style="font-size: 11px; opacity: 0.9;">Notice: Managing Director is out of office. Secondary approver is authorized to review and approve. ${settings.DelegationReason ? `&bull; Reason: ${settings.DelegationReason}` : ''} ${settings.DelegationStartDate ? `(${settings.DelegationStartDate} to ${settings.DelegationEndDate || 'Indefinite'})` : ''}</span>
        </div>
      ` : '';

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 6px;">
          <div style="background-color: #003366; color: white; padding: 15px 20px; border-radius: 4px 4px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">Tanaka Visitor Management System</h2>
            <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.85;">${isDelegated ? 'Executive Directorate / Acting Approver Review Required' : 'Managing Director Review Required'}</p>
          </div>
          <div style="padding: 20px; background-color: #fcfcfc;">
            ${delegationBannerHtml}
            <p style="font-size: 14px; margin-top: 0; color: #222;">
              A ${details.type.toLowerCase()} request has been submitted and requires executive review in the VMS portal.
            </p>

            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 15px 0;">
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Request Number:</strong></td><td style="padding: 8px 0; font-family: monospace; font-weight: bold; color: #003366;">${details.registrationNo}</td></tr>
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>${details.type}:</strong></td><td style="padding: 8px 0; font-weight: bold;">${details.visitorOrContractorName}</td></tr>
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Company:</strong></td><td style="padding: 8px 0;">${details.companyName}</td></tr>
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Requested By:</strong></td><td style="padding: 8px 0;">${details.hostName}</td></tr>
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Department:</strong></td><td style="padding: 8px 0;">${details.department}</td></tr>
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Visit Date:</strong></td><td style="padding: 8px 0;">${details.visitDate}</td></tr>
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Expected Arrival:</strong></td><td style="padding: 8px 0;">${details.expectedTime}</td></tr>
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Purpose / Scope:</strong></td><td style="padding: 8px 0;">${details.purpose}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;"><strong>Status:</strong></td><td style="padding: 8px 0;"><span style="background: #fff3cd; color: #856404; border: 1px solid #ffebba; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">Pending Executive Approval</span></td></tr>
            </table>

            <div style="background-color: #f8f9fa; border-left: 4px solid #003366; padding: 12px; margin: 20px 0; font-size: 12px; color: #444;">
              <strong>Action Required:</strong> Please log in to the Visitor Management System portal at <a href="${portalUrl}" style="color: #003366; font-weight: bold;">${portalUrl}</a> to review, approve, or reject this request.
            </div>
          </div>
          <div style="background-color: #f1f1f1; padding: 10px 20px; font-size: 11px; color: #777; text-align: center; border-radius: 0 0 4px 4px;">
            Tanaka Visitor Management System &bull; Automated System Notification
          </div>
        </div>
      `;

      const textBody = `Tanaka Visitor Management System - Approval Required\n\n${isDelegated ? `[EXECUTIVE DELEGATION ACTIVE: Assigned to Secondary / Acting Approver ${settings.BackupApproverName} (${settings.BackupApproverEmail})]\n\n` : ''}A ${details.type.toLowerCase()} request has been submitted and requires review.\n\nRequest Number: ${details.registrationNo}\n${details.type}: ${details.visitorOrContractorName}\nCompany: ${details.companyName}\nRequested By: ${details.hostName} (${details.department})\nVisit Date: ${details.visitDate}\nExpected Arrival: ${details.expectedTime}\nPurpose: ${details.purpose}\nStatus: Pending Executive Approval\n\nPlease log in to ${portalUrl} to review and approve/reject this request.`;

      await emailService.sendAndLogEmail({
        to: recipient,
        subject,
        html: htmlBody,
        text: textBody,
        requestId: details.registrationNo,
        emailType: 'MD_NOTIFICATION'
      });
    } catch (err) {
      console.error('[EmailService] Failed to send MD notification:', err);
    }
  }

  // Helper to determine if work location is Prod 1 or Prod 2 or any combination
  function isProductionWorkLocation(
    venueName?: string | null,
    venueId?: string | null,
    extraDetails?: string | null
  ): boolean {
    const checkString = (str?: string | null): boolean => {
      if (!str) return false;
      const s = str.toLowerCase();
      return (
        s.includes('prod 1') ||
        s.includes('prod 2') ||
        s.includes('prod1') ||
        s.includes('prod2') ||
        s.includes('production 1') ||
        s.includes('production 2') ||
        s.includes('prod-1') ||
        s.includes('prod-2')
      );
    };

    if (checkString(venueName)) return true;
    if (checkString(extraDetails)) return true;

    if (venueId) {
      const venue = db.meetingVenues.find(v => v.id === venueId);
      if (venue) {
        if (checkString(venue.name)) return true;
        if (checkString(venue.buildingBlock)) return true;
        if (venue.buildingBlocks && venue.buildingBlocks.some(b => checkString(b))) return true;
      }
    }

    return false;
  }

  // STAGE 4: Notify Host, and Production Manager (if Prod 1 / Prod 2) on MD Approval
  async function sendApprovedNotification(details: {
    registrationNo: string;
    type: 'Visitor' | 'Contractor';
    visitorOrContractorName: string;
    companyName: string;
    hostName: string;
    hostUserId?: string;
    visitDate: string;
    visitTime?: string;
    approvedBy: string;
    approvedDate: string;
    approvalRemark?: string;
    approvedVenueName?: string;
    approvedVenueId?: string;
    locationDetails?: string;
  }) {
    try {
      const settings = emailService.getSettings();
      const hostEmail = getHostEmail(details.hostUserId);
      const prodMgrEmail = settings.ProductionManagerEmail || 'nakamu@ml.tanaka.co.jp';

      const isProdLocation = isProductionWorkLocation(
        details.approvedVenueName,
        details.approvedVenueId,
        details.locationDetails
      );

      const recipientsList = Array.from(new Set([
        hostEmail,
        isProdLocation ? prodMgrEmail : null
      ].filter((e): e is string => Boolean(e) && e.trim().length > 0)));

      if (recipientsList.length === 0) {
        recipientsList.push('ananth@tanaka.com.my');
      }

      const subject = `VMS Request Approved - ${details.registrationNo}${isProdLocation ? ' [PROD LOCATION]' : ''}`;

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 6px;">
          <div style="background-color: #198754; color: white; padding: 15px 20px; border-radius: 4px 4px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">Tanaka Visitor Management System</h2>
            <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;">Request Status: APPROVED</p>
          </div>
          <div style="padding: 20px; background-color: #fcfcfc;">
            <p style="font-size: 14px; margin-top: 0; color: #198754; font-weight: bold;">
              The ${details.type.toLowerCase()} request has been approved by Executive Management.
            </p>

            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 15px 0;">
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Request Number:</strong></td><td style="padding: 8px 0; font-family: monospace; font-weight: bold; color: #198754;">${details.registrationNo}</td></tr>
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>${details.type}:</strong></td><td style="padding: 8px 0; font-weight: bold;">${details.visitorOrContractorName}</td></tr>
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Company:</strong></td><td style="padding: 8px 0;">${details.companyName}</td></tr>
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Requested By:</strong></td><td style="padding: 8px 0;">${details.hostName}</td></tr>
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Visit Date:</strong></td><td style="padding: 8px 0;">${details.visitDate}</td></tr>
              ${details.visitTime ? `<tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Visit Time:</strong></td><td style="padding: 8px 0; font-weight: bold; color: #003366;">${details.visitTime}</td></tr>` : ''}
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Status:</strong></td><td style="padding: 8px 0;"><span style="background: #d1e7dd; color: #0f5132; border: 1px solid #badbcc; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">APPROVED</span></td></tr>
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Approved By:</strong></td><td style="padding: 8px 0;">${details.approvedBy}</td></tr>
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Approved Date:</strong></td><td style="padding: 8px 0;">${details.approvedDate}</td></tr>
              ${details.approvedVenueName ? `<tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Approved Venue:</strong></td><td style="padding: 8px 0; font-weight: bold; color: #003366;">${details.approvedVenueName}</td></tr>` : ''}
              ${isProdLocation ? `<tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Production Mgr Notified:</strong></td><td style="padding: 8px 0; font-weight: bold; color: #854d0e;">Luqman (${prodMgrEmail}) - Prod 1 / Prod 2 Zone</td></tr>` : ''}
              ${details.approvalRemark ? `<tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>MD Remark:</strong></td><td style="padding: 8px 0; font-style: italic; color: #555;">"${details.approvalRemark}"</td></tr>` : ''}
            </table>

            <div style="background-color: #f8f9fa; border-left: 4px solid #198754; padding: 12px; margin: 20px 0; font-size: 12px; color: #444;">
              <strong>Notice:</strong> The visitor/contractor request has been approved. Security officers may proceed according to the VMS access control procedure upon arrival.
            </div>
          </div>
          <div style="background-color: #f1f1f1; padding: 10px 20px; font-size: 11px; color: #777; text-align: center; border-radius: 0 0 4px 4px;">
            Tanaka Visitor Management System &bull; Automated System Notification
          </div>
        </div>
      `;

      const textBody = `Tanaka Visitor Management System - Request Approved\n\nThe ${details.type.toLowerCase()} request has been approved.\n\nRequest Number: ${details.registrationNo}\n${details.type}: ${details.visitorOrContractorName}\nCompany: ${details.companyName}\nRequested By: ${details.hostName}\nVisit Date: ${details.visitDate}${details.visitTime ? `\nVisit Time: ${details.visitTime}` : ''}\nStatus: APPROVED\nApproved By: ${details.approvedBy}\nApproved Date: ${details.approvedDate}${isProdLocation ? `\nProduction Manager Notified: Luqman (${prodMgrEmail})` : ''}\n\nSecurity may proceed according to the VMS access procedure.`;

      await emailService.sendAndLogEmail({
        to: recipientsList,
        subject,
        html: htmlBody,
        text: textBody,
        requestId: details.registrationNo,
        emailType: 'APPROVED_NOTIFICATION'
      });
    } catch (err) {
      console.error('[EmailService] Failed to send approval notification:', err);
    }
  }

  // STAGE 5: Notify Host on MD Decline
  async function sendDeclinedNotification(details: {
    registrationNo: string;
    type: 'Visitor' | 'Contractor';
    visitorOrContractorName: string;
    companyName: string;
    hostName: string;
    hostUserId?: string;
    visitDate: string;
    declinedBy: string;
    declinedDate: string;
    reason: string;
  }) {
    try {
      const settings = emailService.getSettings();
      const hostEmail = getHostEmail(details.hostUserId);

      const recipientsList = Array.from(new Set([hostEmail].filter((e): e is string => Boolean(e) && e.trim().length > 0)));

      if (recipientsList.length === 0) {
        recipientsList.push('ananth@tanaka.com.my');
      }

      const subject = `VMS Request Declined - ${details.registrationNo}`;

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 6px;">
          <div style="background-color: #dc3545; color: white; padding: 15px 20px; border-radius: 4px 4px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">Tanaka Visitor Management System</h2>
            <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;">Request Status: DECLINED</p>
          </div>
          <div style="padding: 20px; background-color: #fcfcfc;">
            <p style="font-size: 14px; margin-top: 0; color: #dc3545; font-weight: bold;">
              The ${details.type.toLowerCase()} request has been declined by Executive Management.
            </p>

            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 15px 0;">
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Request Number:</strong></td><td style="padding: 8px 0; font-family: monospace; font-weight: bold; color: #dc3545;">${details.registrationNo}</td></tr>
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>${details.type}:</strong></td><td style="padding: 8px 0; font-weight: bold;">${details.visitorOrContractorName}</td></tr>
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Company:</strong></td><td style="padding: 8px 0;">${details.companyName}</td></tr>
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Requested By:</strong></td><td style="padding: 8px 0;">${details.hostName}</td></tr>
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Visit Date:</strong></td><td style="padding: 8px 0;">${details.visitDate}</td></tr>
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Status:</strong></td><td style="padding: 8px 0;"><span style="background: #f8d7da; color: #842029; border: 1px solid #f5c2c7; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">DECLINED</span></td></tr>
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Declined By:</strong></td><td style="padding: 8px 0;">${details.declinedBy}</td></tr>
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Declined Date:</strong></td><td style="padding: 8px 0;">${details.declinedDate}</td></tr>
              <tr style="border-bottom: 1px solid #eeeeee;"><td style="padding: 8px 0; color: #666;"><strong>Reason:</strong></td><td style="padding: 8px 0; font-weight: bold; color: #842029;">${details.reason}</td></tr>
            </table>

            <div style="background-color: #f8f9fa; border-left: 4px solid #dc3545; padding: 12px; margin: 20px 0; font-size: 12px; color: #444;">
              <strong>Notice:</strong> This request has been declined. Gate entry passes will NOT be issued by security officers for this registration.
            </div>
          </div>
          <div style="background-color: #f1f1f1; padding: 10px 20px; font-size: 11px; color: #777; text-align: center; border-radius: 0 0 4px 4px;">
            Tanaka Visitor Management System &bull; Automated System Notification
          </div>
        </div>
      `;

      const textBody = `Tanaka Visitor Management System - Request Declined\n\nThe ${details.type.toLowerCase()} request has been declined.\n\nRequest Number: ${details.registrationNo}\n${details.type}: ${details.visitorOrContractorName}\nCompany: ${details.companyName}\nRequested By: ${details.hostName}\nVisit Date: ${details.visitDate}\nStatus: DECLINED\nDeclined By: ${details.declinedBy}\nDeclined Date: ${details.declinedDate}\nReason: ${details.reason}`;

      await emailService.sendAndLogEmail({
        to: recipientsList,
        subject,
        html: htmlBody,
        text: textBody,
        requestId: details.registrationNo,
        emailType: 'DECLINED_NOTIFICATION'
      });
    } catch (err) {
      console.error('[EmailService] Failed to send decline notification:', err);
    }
  }

  // Send New User Welcome & Password Change Notification
  async function sendNewUserNotification(user: User, rawPassword?: string) {
    if (!user.email || !user.email.trim() || !user.email.includes('@')) {
      console.log(`[EmailService] Skip new user email: User ${user.username} has no valid email address.`);
      return;
    }

    try {
      const portalUrl = process.env.PUBLIC_APP_URL || 'http://157.9.183.151:3000';
      const subject = `Welcome to Tanaka VMS - Account Credentials (${user.role})`;
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden;">
          <div style="background-color: #1e293b; color: white; padding: 18px 20px; font-size: 18px; font-weight: bold;">
            Tanaka Visitor Management System
          </div>
          <div style="padding: 24px; color: #333; line-height: 1.6;">
            <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Dear ${user.fullName},</p>
            <p>Your user account for the <strong>Tanaka Visitor Management System (VMS)</strong> has been successfully created.</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 0 4px 4px 0;">
              <p style="margin: 0 0 8px 0;"><strong>Username:</strong> ${user.username}</p>
              <p style="margin: 0 0 8px 0;"><strong>Role:</strong> ${user.role}</p>
              <p style="margin: 0 0 8px 0;"><strong>Department:</strong> ${user.departmentName}</p>
              ${user.badgeId ? `<p style="margin: 0 0 8px 0;"><strong>Badge / Staff ID:</strong> ${user.badgeId}</p>` : ''}
              ${rawPassword ? `<p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${rawPassword}</code></p>` : ''}
            </div>

            <p style="color: #dc2626; font-size: 14px; font-weight: bold;">
              ⚠️ Security Policy Notice: You are required to log in and change your temporary password upon your first sign-in.
            </p>

            <div style="margin: 25px 0; text-align: center;">
              <a href="${portalUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Log In to VMS Portal
              </a>
            </div>

            <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
              If you did not request this account or have questions, please contact your Security Admin immediately.
            </p>
          </div>
          <div style="background-color: #f1f5f9; padding: 12px 20px; font-size: 11px; color: #64748b; text-align: center;">
            Tanaka Visitor Management System &bull; Automated System Notification
          </div>
        </div>
      `;

      const textBody = `Welcome to Tanaka Visitor Management System\n\nDear ${user.fullName},\n\nYour account has been created.\n\nUsername: ${user.username}\nRole: ${user.role}\nDepartment: ${user.departmentName}\n${rawPassword ? `Temporary Password: ${rawPassword}\n` : ''}\nPlease log in to ${portalUrl} and change your password upon your first sign-in.`;

      await emailService.sendAndLogEmail({
        to: user.email.trim(),
        subject,
        html: htmlBody,
        text: textBody,
        requestId: user.id,
        emailType: 'NEW_USER_NOTIFICATION'
      });
    } catch (err) {
      console.error('[EmailService] Failed to send new user notification:', err);
    }
  }

  app.post('/api/vms/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.users.find(u => u.username.toLowerCase() === (username || '').toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!user.isActive) {
      logAudit(user.id, 'USER_LOGIN_BLOCKED', `Blocked login attempt to deactivated account ${user.fullName}`, req);
      return res.status(400).json({ error: 'Your account is deactivated, please contact Security Administrator.' });
    }

    db.activeUserId = user.id;
    user.lastLoginAt = new Date().toISOString();

    db.loginHistory.unshift({
      id: `lh-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '192.168.10.100',
      status: 'SUCCESS',
      userAgent: req.headers['user-agent'] || 'VMS Web Portal'
    });

    logAudit(user.id, 'LOGIN', `User ${user.fullName} (@${user.username}) logged in successfully`, req);
    res.json({ user });
  });

  app.post('/api/vms/auth/logout', (req, res) => {
    const currentUser = getActiveUser();
    logAudit(currentUser.id, 'LOGOUT', `User ${currentUser.fullName} (@${currentUser.username}) logged out of active session`, req);
    res.json({ message: 'User logged out successfully' });
  });

  // Users Management
  app.get('/api/vms/users', async (req, res) => {
    if (getIsPgConnected()) {
      const pgUsers = await fetchUsersFromPg();
      if (pgUsers) return res.json(pgUsers);
    }
    res.json(db.users);
  });

  app.post('/api/vms/users', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR') {
      return res.status(400).json({ error: 'Permission denied. Administrator access required.' });
    }

    const { username, fullName, email, role, departmentId, companyId, phone, badgeId, password } = req.body;

    if (!username || !fullName) {
      return res.status(400).json({ error: 'Username and Full Name are required.' });
    }

    if (db.users.some(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
      return res.status(400).json({ error: `Username "${username}" is already taken. Please choose a different username.` });
    }

    const rawPassword = (password && password.trim()) ? password.trim() : 'TempPass!2026';

    const policy = db.passwordPolicy;
    const errors: string[] = [];
    if (rawPassword.length < (policy.minLength || 10)) {
      errors.push(`Password must be at least ${policy.minLength || 10} characters long.`);
    }
    if (policy.requireUppercase && !/[A-Z]/.test(rawPassword)) {
      errors.push('Password must contain at least one uppercase letter (A-Z).');
    }
    if (policy.requireNumbers && !/[0-9]/.test(rawPassword)) {
      errors.push('Password must contain at least one number (0-9).');
    }
    if (policy.requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(rawPassword)) {
      errors.push('Password must contain at least one special character (!@#$%^&* etc.).');
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: `Password does not comply with security policy: ${errors.join(' ')}` });
    }

    const dept = db.departments.find(d => d.id === departmentId);

    const newUser: User = {
      id: `usr-${Date.now()}`,
      username: username.trim(),
      fullName: fullName.trim(),
      email: email || '',
      role,
      departmentId: departmentId || 'dept-it',
      departmentName: dept ? dept.name : 'General',
      companyId: companyId || 'comp-internal',
      isActive: true,
      lastLoginAt: new Date().toISOString(),
      badgeId: badgeId || `${role.substring(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`,
      phone: phone || '+1 (555) 000-0000',
      password: rawPassword,
      mustChangePassword: true
    };

    db.users.push(newUser);
    await saveUserToPg(newUser);
    logAudit(currentUser.id, 'CREATE_USER', `Created new ${role} user: ${fullName} (${username}). Initial password assigned with mandatory change on first login.`, req);

    // Dispatch welcome notification email asynchronously
    sendNewUserNotification(newUser, password).catch(err => {
      console.error('[EmailService] Async user email dispatch error:', err);
    });

    res.status(201).json(newUser);
  });

  app.put('/api/vms/users/:id', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR') {
      return res.status(400).json({ error: 'Permission denied. Administrator access required.' });
    }

    const userIndex = db.users.findIndex(u => u.id === req.params.id);
    if (userIndex === -1) return res.status(404).json({ error: 'User not found' });

    const { fullName, email, role, departmentId, phone, isActive, badgeId } = req.body;
    const dept = db.departments.find(d => d.id === departmentId);

    db.users[userIndex] = {
      ...db.users[userIndex],
      fullName: fullName ?? db.users[userIndex].fullName,
      email: email ?? db.users[userIndex].email,
      role: role ?? db.users[userIndex].role,
      departmentId: departmentId ?? db.users[userIndex].departmentId,
      departmentName: dept ? dept.name : db.users[userIndex].departmentName,
      phone: phone ?? db.users[userIndex].phone,
      badgeId: badgeId ?? db.users[userIndex].badgeId,
      isActive: isActive !== undefined ? isActive : db.users[userIndex].isActive
    };

    await saveUserToPg(db.users[userIndex]);
    logAudit(currentUser.id, 'UPDATE_USER', `Updated user details for ${db.users[userIndex].fullName} (@${db.users[userIndex].username})`, req);
    res.json(db.users[userIndex]);
  });

  app.delete('/api/vms/users/:id', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR') {
      return res.status(400).json({ error: 'Permission denied. Administrator access required.' });
    }

    const userId = req.params.id;
    if (userId === currentUser.id) {
      return res.status(400).json({ error: 'Cannot delete or deactivate your own active administrator account.' });
    }

    let targetUser = db.users.find(u => u.id === userId);

    if (getIsPgConnected()) {
      await deleteUserFromPg(userId);
      // Refresh memory list from PG
      const pgUsers = await fetchUsersFromPg();
      if (pgUsers) {
        db.users = pgUsers;
      } else {
        const idx = db.users.findIndex(u => u.id === userId);
        if (idx !== -1) db.users.splice(idx, 1);
      }
    } else {
      const idx = db.users.findIndex(u => u.id === userId);
      if (idx !== -1) {
        db.users.splice(idx, 1);
      } else if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
    }

    const targetName = targetUser ? targetUser.fullName : userId;
    const targetUsername = targetUser ? targetUser.username : userId;
    logAudit(currentUser.id, 'DELETE_USER', `Deleted user account for ${targetName} (@${targetUsername})`, req);
    res.json({ message: `User account for ${targetName} has been permanently deleted.` });
  });

  app.put('/api/vms/users/:id/reset-password', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR') {
      return res.status(400).json({ error: 'Permission denied.' });
    }
    const user = db.users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const tempPassword = req.body.tempPassword || 'TempPass!2026';
    user.password = tempPassword;
    user.mustChangePassword = true;

    await saveUserToPg(user);
    logAudit(currentUser.id, 'RESET_PASSWORD', `Reset password for user ${user.fullName} (${user.username}). User must change password on next login.`, req);

    // Dispatch reset notification email asynchronously
    sendNewUserNotification(user, tempPassword).catch(err => {
      console.error('[EmailService] Async reset-password email dispatch error:', err);
    });

    res.json({ message: `Temporary password set for ${user.username}. User will be forced to change password on login.`, tempPassword });
  });

  app.post('/api/vms/users/:id/change-password', async (req, res) => {
    const currentUser = getActiveUser();
    const userIndex = db.users.findIndex(u => u.id === req.params.id);
    if (userIndex === -1) return res.status(404).json({ error: 'User not found' });

    const { newPassword } = req.body;
    if (!newPassword || !newPassword.trim()) {
      return res.status(400).json({ error: 'New password is required.' });
    }

    const policy = db.passwordPolicy;
    const errors: string[] = [];
    if (newPassword.length < (policy.minLength || 10)) {
      errors.push(`Password must be at least ${policy.minLength || 10} characters long.`);
    }
    if (policy.requireUppercase && !/[A-Z]/.test(newPassword)) {
      errors.push('Password must contain at least one uppercase letter (A-Z).');
    }
    if (policy.requireNumbers && !/[0-9]/.test(newPassword)) {
      errors.push('Password must contain at least one number (0-9).');
    }
    if (policy.requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
      errors.push('Password must contain at least one special character (!@#$%^&* etc.).');
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: `Password does not meet compliance requirements: ${errors.join(' ')}` });
    }

    db.users[userIndex].password = newPassword;
    db.users[userIndex].mustChangePassword = false;

    await saveUserToPg(db.users[userIndex]);
    logAudit(currentUser.id, 'PASSWORD_CHANGE', `User ${db.users[userIndex].fullName} (@${db.users[userIndex].username}) successfully updated password per enterprise password policy.`, req);
    res.json({ user: db.users[userIndex], message: 'Password updated successfully!' });
  });

  // Master Data: Departments
  app.get('/api/vms/departments', async (req, res) => {
    if (getIsPgConnected()) {
      const pgDepts = await fetchDepartmentsFromPg();
      if (pgDepts) return res.json(pgDepts);
    }
    res.json(db.departments);
  });

  app.post('/api/vms/departments', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR') return res.status(403).json({ error: 'Admin only' });
    const { code, name, headOfDepartment, floorLevel } = req.body;
    const newDept: Department = { id: `dept-${Date.now()}`, code, name, headOfDepartment, floorLevel, isActive: true };
    db.departments.push(newDept);
    if (getIsPgConnected()) {
      await saveDepartmentToPg(newDept);
    }
    logAudit(currentUser.id, 'CREATE_DEPARTMENT', `Created department ${name} (${code})`);
    res.status(201).json(newDept);
  });

  app.put('/api/vms/departments/:id', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR') return res.status(403).json({ error: 'Admin only' });
    const deptIndex = db.departments.findIndex(d => d.id === req.params.id);
    if (deptIndex === -1) return res.status(404).json({ error: 'Department not found' });

    const targetDept = db.departments[deptIndex];
    const oldName = targetDept.name;
    const { code, name, headOfDepartment, floorLevel, isActive } = req.body;

    const newName = name !== undefined ? name.trim() : targetDept.name;

    db.departments[deptIndex] = {
      ...targetDept,
      code: code !== undefined ? code.trim() : targetDept.code,
      name: newName,
      headOfDepartment: headOfDepartment !== undefined ? headOfDepartment.trim() : targetDept.headOfDepartment,
      floorLevel: floorLevel !== undefined ? floorLevel.trim() : targetDept.floorLevel,
      isActive: isActive !== undefined ? !!isActive : targetDept.isActive
    };

    if (getIsPgConnected()) {
      await saveDepartmentToPg(db.departments[deptIndex]);
    }

    // Cascade name updates across database if department name changed
    if (oldName && oldName !== newName) {
      db.users.forEach(u => {
        if (u.departmentId === targetDept.id || u.departmentName === oldName) {
          u.departmentName = newName;
          if (getIsPgConnected()) saveUserToPg(u);
        }
      });
      db.companies.forEach(c => {
        if (c.departmentId === targetDept.id || c.departmentName === oldName) {
          c.departmentName = newName;
          if (getIsPgConnected()) saveCompanyToPg(c);
        }
      });
      db.visitors.forEach(v => {
        if (v.hostDepartment === oldName) {
          v.hostDepartment = newName;
          if (getIsPgConnected()) saveVisitorToPg(v);
        }
      });
      db.contractors.forEach(c => {
        if (c.hostDepartment === oldName) {
          c.hostDepartment = newName;
          if (getIsPgConnected()) saveContractorToPg(c);
        }
      });
    }

    logAudit(currentUser.id, 'UPDATE_DEPARTMENT', `Updated department ${targetDept.code} - ${newName}`);
    res.json(db.departments[deptIndex]);
  });

  app.delete('/api/vms/departments/:id', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR') return res.status(403).json({ error: 'Admin only' });
    const deptIndex = db.departments.findIndex(d => d.id === req.params.id);
    if (deptIndex === -1) return res.status(404).json({ error: 'Department not found' });

    const targetDept = db.departments[deptIndex];
    targetDept.isActive = false;
    if (getIsPgConnected()) {
      await saveDepartmentToPg(targetDept);
    }
    logAudit(currentUser.id, 'DELETE_DEPARTMENT', `Deactivated department ${targetDept.code} - ${targetDept.name}`);
    res.json({ message: `Department ${targetDept.name} has been deactivated.` });
  });

  // Master Data: Companies (With Staff Department Scoping & Auto-saving)
  function ensureCompanyExists(
    companyName: string,
    companyType: 'VISITOR_ORGANIZATION' | 'CONTRACTOR_VENDOR' | 'INTERNAL',
    currentUser: any,
    contactEmail?: string,
    contactPhone?: string,
    address?: string
  ) {
    if (!companyName || !companyName.trim()) return null;
    const cleanName = companyName.trim();
    const existing = db.companies.find(c => c.name.trim().toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      if (!existing.departmentName && currentUser?.departmentName) {
        existing.departmentId = currentUser.departmentId;
        existing.departmentName = currentUser.departmentName;
      }
      if (contactEmail && (!existing.contactEmail || existing.contactEmail.includes('@guest.com'))) {
        existing.contactEmail = contactEmail;
      }
      if (contactPhone && (!existing.contactPhone || existing.contactPhone === '+60 3-0000 0000')) {
        existing.contactPhone = contactPhone;
      }
      return existing;
    }

    const newComp: Company = {
      id: `comp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: cleanName,
      registrationNumber: `REG-${Math.floor(100000 + Math.random() * 900000)}`,
      companyType: companyType,
      contactPhone: contactPhone || '+60 3-0000 0000',
      contactEmail: contactEmail || `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}@guest.com`,
      address: address || 'Registered via VMS Pre-Registration',
      isActive: true,
      departmentId: currentUser?.departmentId || null,
      departmentName: currentUser?.departmentName || null,
      registeredByUserId: currentUser?.id || null,
      registeredByUserName: currentUser?.fullName || null,
      createdAt: new Date().toISOString().split('T')[0]
    };

    db.companies.push(newComp);
    saveCompanyToPg(newComp).catch(err => console.error('PG save error in ensureCompanyExists:', err));
    logAudit(currentUser?.id || 'system', 'CREATE_COMPANY', `Auto-registered company/organization "${cleanName}" (${companyType}) by ${currentUser?.fullName || 'Staff'}`);
    return newComp;
  }

  app.get('/api/vms/companies', async (req, res) => {
    const currentUser = getActiveUser();

    let companies = db.companies;
    if (getIsPgConnected()) {
      const pgCompanies = await fetchCompaniesFromPg();
      if (pgCompanies) companies = pgCompanies;
    }

    // Staff sees companies belonging to their department or registered by them or global
    if (currentUser.role === 'STAFF') {
      const myDept = (currentUser.departmentName || '').trim().toLowerCase();
      const myCompanies = companies.filter(c => {
        if (!c.departmentName) return true; // global/unassigned
        const compDept = (c.departmentName || '').trim().toLowerCase();
        return compDept === myDept || c.registeredByUserId === currentUser.id;
      });
      return res.json(myCompanies);
    }

    // Administrators, MD, Security see ALL companies
    res.json(companies);
  });

  app.post('/api/vms/companies', async (req, res) => {
    const currentUser = getActiveUser();
    const { name, registrationNumber, companyType, contactPhone, contactEmail, address } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Company or Guest Organization Name is required.' });
    }

    const cleanName = name.trim();
    const existing = db.companies.find(c => c.name.trim().toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      return res.status(400).json({ error: `A company or guest organization named "${cleanName}" is already registered in the system.` });
    }

    const newComp: Company = {
      id: `comp-${Date.now()}`,
      name: cleanName,
      registrationNumber: registrationNumber || `REG-${Math.floor(100000 + Math.random() * 900000)}`,
      companyType: companyType || 'VISITOR_ORGANIZATION',
      contactPhone: contactPhone || '+60 3-0000 0000',
      contactEmail: contactEmail || `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}@guest.com`,
      address: address || 'N/A',
      isActive: true,
      departmentId: currentUser.departmentId || null,
      departmentName: currentUser.departmentName || null,
      registeredByUserId: currentUser.id,
      registeredByUserName: currentUser.fullName,
      createdAt: new Date().toISOString().split('T')[0]
    };

    db.companies.push(newComp);
    await saveCompanyToPg(newComp);
    logAudit(currentUser.id, 'CREATE_COMPANY', `User ${currentUser.fullName} registered new company/guest org: ${cleanName} (${newComp.companyType})`);
    res.status(201).json(newComp);
  });

  app.put('/api/vms/companies/:id', async (req, res) => {
    const currentUser = getActiveUser();
    const compIndex = db.companies.findIndex(c => c.id === req.params.id);
    if (compIndex === -1) return res.status(404).json({ error: 'Company record not found' });

    const targetComp = db.companies[compIndex];

    if (currentUser.role === 'STAFF') {
      const myDept = (currentUser.departmentName || '').trim().toLowerCase();
      const compDept = (targetComp.departmentName || '').trim().toLowerCase();
      if (compDept && compDept !== myDept && targetComp.registeredByUserId !== currentUser.id) {
        return res.status(403).json({ error: 'Access Denied: You can only manage companies registered under your department.' });
      }
    }

    const oldCompName = targetComp.name;
    const { name, registrationNumber, companyType, contactPhone, contactEmail, address, isActive } = req.body;
    const newCompName = name !== undefined ? name.trim() : targetComp.name;

    db.companies[compIndex] = {
      ...targetComp,
      name: newCompName,
      registrationNumber: registrationNumber !== undefined ? registrationNumber : targetComp.registrationNumber,
      companyType: companyType !== undefined ? companyType : targetComp.companyType,
      contactPhone: contactPhone !== undefined ? contactPhone : targetComp.contactPhone,
      contactEmail: contactEmail !== undefined ? contactEmail : targetComp.contactEmail,
      address: address !== undefined ? address : targetComp.address,
      isActive: isActive !== undefined ? !!isActive : targetComp.isActive
    };

    if (oldCompName && oldCompName !== newCompName) {
      db.visitors.forEach(v => {
        if (v.companyName === oldCompName) {
          v.companyName = newCompName;
        }
      });
      db.contractors.forEach(c => {
        if (c.companyName === oldCompName) {
          c.companyName = newCompName;
        }
      });
    }

    await saveCompanyToPg(db.companies[compIndex]);
    logAudit(currentUser.id, 'UPDATE_COMPANY', `Updated details for company "${db.companies[compIndex].name}"`);
    res.json(db.companies[compIndex]);
  });

  app.delete('/api/vms/companies/:id', async (req, res) => {
    const currentUser = getActiveUser();
    const compIndex = db.companies.findIndex(c => c.id === req.params.id);
    if (compIndex === -1) return res.status(404).json({ error: 'Company record not found' });

    const targetComp = db.companies[compIndex];
    if (currentUser.role === 'STAFF') {
      const myDept = (currentUser.departmentName || '').trim().toLowerCase();
      const compDept = (targetComp.departmentName || '').trim().toLowerCase();
      if (compDept && compDept !== myDept && targetComp.registeredByUserId !== currentUser.id) {
        return res.status(403).json({ error: 'Access Denied: You can only remove companies registered under your department.' });
      }
    }

    if (getIsPgConnected()) {
      await deleteCompanyFromPg(targetComp.id);
    }
    db.companies.splice(compIndex, 1);
    logAudit(currentUser.id, 'DELETE_COMPANY', `Deleted company "${targetComp.name}"`);
    res.json({ message: `Company "${targetComp.name}" has been deleted.` });
  });

  // Master Data: Categories & Venues
  app.get('/api/vms/visitor-categories', async (req, res) => {
    if (getIsPgConnected()) {
      const pgCats = await fetchVisitorCategoriesFromPg();
      if (pgCats) return res.json(pgCats);
    }
    res.json(db.visitorCategories);
  });

  app.post('/api/vms/visitor-categories', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR') {
      return res.status(403).json({ error: 'Administrator role required to manage categories' });
    }
    const { name, description, requiresEscort } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });
    const newCat: VisitorCategory = { id: `vc-${Date.now()}`, name, description: description || '', requiresEscort: !!requiresEscort, isActive: true };
    db.visitorCategories.push(newCat);
    if (getIsPgConnected()) {
      await saveVisitorCategoryToPg(newCat);
    }
    logAudit(currentUser.id, 'CREATE_VISITOR_CATEGORY', `Created visitor category ${name}`);
    res.status(201).json(newCat);
  });

  app.put('/api/vms/visitor-categories/:id', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR') return res.status(403).json({ error: 'Admin only' });
    const catIndex = db.visitorCategories.findIndex(vc => vc.id === req.params.id);
    if (catIndex === -1) return res.status(404).json({ error: 'Visitor category not found' });

    const targetCat = db.visitorCategories[catIndex];
    const oldCatName = targetCat.name;
    const { name, description, requiresEscort, isActive } = req.body;
    const newCatName = name !== undefined ? name.trim() : targetCat.name;

    db.visitorCategories[catIndex] = {
      ...targetCat,
      name: newCatName,
      description: description !== undefined ? description : targetCat.description,
      requiresEscort: requiresEscort !== undefined ? !!requiresEscort : targetCat.requiresEscort,
      isActive: isActive !== undefined ? !!isActive : targetCat.isActive
    };

    if (getIsPgConnected()) {
      await saveVisitorCategoryToPg(db.visitorCategories[catIndex]);
    }

    if (oldCatName && oldCatName !== newCatName) {
      db.visitors.forEach(v => {
        if (v.visitorCategoryName === oldCatName) {
          v.visitorCategoryName = newCatName;
          if (getIsPgConnected()) saveVisitorToPg(v);
        }
      });
    }

    logAudit(currentUser.id, 'UPDATE_VISITOR_CATEGORY', `Updated visitor category ${newCatName}`);
    res.json(db.visitorCategories[catIndex]);
  });

  app.delete('/api/vms/visitor-categories/:id', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR') return res.status(403).json({ error: 'Admin only' });
    const catIndex = db.visitorCategories.findIndex(vc => vc.id === req.params.id);
    if (catIndex === -1) return res.status(404).json({ error: 'Visitor category not found' });

    db.visitorCategories[catIndex].isActive = false;
    if (getIsPgConnected()) {
      await saveVisitorCategoryToPg(db.visitorCategories[catIndex]);
    }
    logAudit(currentUser.id, 'DELETE_VISITOR_CATEGORY', `Deactivated visitor category ${db.visitorCategories[catIndex].name}`);
    res.json({ message: 'Visitor category deactivated successfully' });
  });

  app.get('/api/vms/contractor-categories', async (req, res) => {
    if (getIsPgConnected()) {
      const pgCats = await fetchContractorCategoriesFromPg();
      if (pgCats) return res.json(pgCats);
    }
    res.json(db.contractorCategories);
  });

  app.post('/api/vms/contractor-categories', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR') {
      return res.status(403).json({ error: 'Administrator role required to manage categories' });
    }
    const { name, safetyInductionRequired } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });
    const newCat: ContractorCategory = { id: `cc-${Date.now()}`, name, safetyInductionRequired: !!safetyInductionRequired, isActive: true };
    db.contractorCategories.push(newCat);
    if (getIsPgConnected()) {
      await saveContractorCategoryToPg(newCat);
    }
    logAudit(currentUser.id, 'CREATE_CONTRACTOR_CATEGORY', `Created contractor category ${name}`);
    res.status(201).json(newCat);
  });

  app.put('/api/vms/contractor-categories/:id', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR') return res.status(403).json({ error: 'Admin only' });
    const catIndex = db.contractorCategories.findIndex(cc => cc.id === req.params.id);
    if (catIndex === -1) return res.status(404).json({ error: 'Contractor category not found' });

    const targetCat = db.contractorCategories[catIndex];
    const oldCatName = targetCat.name;
    const { name, safetyInductionRequired, isActive } = req.body;
    const newCatName = name !== undefined ? name.trim() : targetCat.name;

    db.contractorCategories[catIndex] = {
      ...targetCat,
      name: newCatName,
      safetyInductionRequired: safetyInductionRequired !== undefined ? !!safetyInductionRequired : targetCat.safetyInductionRequired,
      isActive: isActive !== undefined ? !!isActive : targetCat.isActive
    };

    if (getIsPgConnected()) {
      await saveContractorCategoryToPg(db.contractorCategories[catIndex]);
    }

    if (oldCatName && oldCatName !== newCatName) {
      db.contractors.forEach(c => {
        if (c.contractorCategoryName === oldCatName) {
          c.contractorCategoryName = newCatName;
          if (getIsPgConnected()) saveContractorToPg(c);
        }
      });
    }

    logAudit(currentUser.id, 'UPDATE_CONTRACTOR_CATEGORY', `Updated contractor category ${newCatName}`);
    res.json(db.contractorCategories[catIndex]);
  });

  app.delete('/api/vms/contractor-categories/:id', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR') return res.status(403).json({ error: 'Admin only' });
    const catIndex = db.contractorCategories.findIndex(cc => cc.id === req.params.id);
    if (catIndex === -1) return res.status(404).json({ error: 'Contractor category not found' });

    db.contractorCategories[catIndex].isActive = false;
    if (getIsPgConnected()) {
      await saveContractorCategoryToPg(db.contractorCategories[catIndex]);
    }
    logAudit(currentUser.id, 'DELETE_CONTRACTOR_CATEGORY', `Deactivated contractor category ${db.contractorCategories[catIndex].name}`);
    res.json({ message: 'Contractor category deactivated successfully' });
  });

  app.get('/api/vms/meeting-venues', async (req, res) => {
    if (getIsPgConnected()) {
      const pgVenues = await fetchMeetingVenuesFromPg();
      if (pgVenues) return res.json(pgVenues);
    }
    res.json(db.meetingVenues);
  });

  app.post('/api/vms/meeting-venues', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR' && currentUser.role !== 'SECURITY') {
      return res.status(403).json({ error: 'Admin or Security authorization required' });
    }
    const { name, buildingBlock, buildingBlocks, floorLevel, floorLevels, capacity } = req.body;
    
    let blocksArr: string[] = [];
    if (Array.isArray(buildingBlocks)) {
      blocksArr = buildingBlocks.map((b: string) => b.trim()).filter(Boolean);
    } else if (typeof buildingBlock === 'string') {
      blocksArr = buildingBlock.split(',').map(b => b.trim()).filter(Boolean);
    }

    let floorsArr: string[] = [];
    if (Array.isArray(floorLevels)) {
      floorsArr = floorLevels.map((f: string) => f.trim()).filter(Boolean);
    } else if (typeof floorLevel === 'string') {
      floorsArr = floorLevel.split(',').map(f => f.trim()).filter(Boolean);
    }

    const bStr = blocksArr.length > 0 ? blocksArr.join(', ') : (buildingBlock || '');
    const fStr = floorsArr.length > 0 ? floorsArr.join(', ') : (floorLevel || '');

    const newVenue: MeetingVenue = {
      id: `mv-${Date.now()}`,
      name,
      buildingBlock: bStr,
      buildingBlocks: blocksArr,
      floorLevel: fStr,
      floorLevels: floorsArr,
      capacity: Number(capacity) || 10,
      isActive: true
    };
    db.meetingVenues.push(newVenue);
    if (getIsPgConnected()) {
      await saveMeetingVenueToPg(newVenue);
    }
    logAudit(currentUser.id, 'CREATE_VENUE', `Created meeting venue ${name}`);
    res.status(201).json(newVenue);
  });

  app.put('/api/vms/meeting-venues/:id', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR' && currentUser.role !== 'SECURITY') {
      return res.status(403).json({ error: 'Admin or Security authorization required' });
    }
    const venueIndex = db.meetingVenues.findIndex(v => v.id === req.params.id);
    if (venueIndex === -1) return res.status(404).json({ error: 'Meeting venue not found' });

    const targetVenue = db.meetingVenues[venueIndex];
    const oldName = targetVenue.name;
    const { name, buildingBlock, buildingBlocks, floorLevel, floorLevels, capacity, isActive } = req.body;
    const newName = name !== undefined ? name.trim() : targetVenue.name;

    let blocksArr: string[] = targetVenue.buildingBlocks || (targetVenue.buildingBlock ? targetVenue.buildingBlock.split(',').map(b => b.trim()).filter(Boolean) : []);
    if (Array.isArray(buildingBlocks)) {
      blocksArr = buildingBlocks.map((b: string) => b.trim()).filter(Boolean);
    } else if (typeof buildingBlock === 'string') {
      blocksArr = buildingBlock.split(',').map(b => b.trim()).filter(Boolean);
    }

    let floorsArr: string[] = targetVenue.floorLevels || (targetVenue.floorLevel ? targetVenue.floorLevel.split(',').map(f => f.trim()).filter(Boolean) : []);
    if (Array.isArray(floorLevels)) {
      floorsArr = floorLevels.map((f: string) => f.trim()).filter(Boolean);
    } else if (typeof floorLevel === 'string') {
      floorsArr = floorLevel.split(',').map(f => f.trim()).filter(Boolean);
    }

    const bStr = blocksArr.length > 0 ? blocksArr.join(', ') : (buildingBlock !== undefined ? buildingBlock : targetVenue.buildingBlock);
    const fStr = floorsArr.length > 0 ? floorsArr.join(', ') : (floorLevel !== undefined ? floorLevel : targetVenue.floorLevel);

    db.meetingVenues[venueIndex] = {
      ...targetVenue,
      name: newName,
      buildingBlock: bStr,
      buildingBlocks: blocksArr,
      floorLevel: fStr,
      floorLevels: floorsArr,
      capacity: capacity !== undefined ? Number(capacity) : targetVenue.capacity,
      isActive: isActive !== undefined ? !!isActive : targetVenue.isActive
    };

    if (getIsPgConnected()) {
      await saveMeetingVenueToPg(db.meetingVenues[venueIndex]);
    }

    if (oldName && oldName !== newName) {
      db.visitors.forEach(v => {
        if (v.meetingVenueName === oldName) v.meetingVenueName = newName;
        if (v.approvedVenueName === oldName) v.approvedVenueName = newName;
        if (getIsPgConnected()) saveVisitorToPg(v);
      });
      db.contractors.forEach(c => {
        if (c.locationVenueName === oldName) c.locationVenueName = newName;
        if (c.approvedVenueName === oldName) c.approvedVenueName = newName;
        if (getIsPgConnected()) saveContractorToPg(c);
      });
    }

    logAudit(currentUser.id, 'UPDATE_VENUE', `Updated meeting venue ${newName}`);
    res.json(db.meetingVenues[venueIndex]);
  });

  app.delete('/api/vms/meeting-venues/:id', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR' && currentUser.role !== 'SECURITY') {
      return res.status(403).json({ error: 'Admin or Security authorization required' });
    }
    const venueIndex = db.meetingVenues.findIndex(v => v.id === req.params.id);
    if (venueIndex === -1) return res.status(404).json({ error: 'Meeting venue not found' });

    db.meetingVenues[venueIndex].isActive = false;
    if (getIsPgConnected()) {
      await saveMeetingVenueToPg(db.meetingVenues[venueIndex]);
    }
    logAudit(currentUser.id, 'DELETE_VENUE', `Deactivated meeting venue ${db.meetingVenues[venueIndex].name}`);
    res.json({ message: 'Meeting venue deactivated successfully' });
  });

  // --- VISITORS ENDPOINTS (With Strict Staff Data Isolation) ---
  app.get('/api/vms/visitors/past-attendees', (req, res) => {
    const currentUser = getActiveUser();
    const company = (req.query.company as string || '').trim().toLowerCase();
    const uniqueMap = new Map<string, Visitor>();

    db.visitors.forEach(v => {
      if (!v.fullName || !v.companyName) return;

      // DEPARTMENT ISOLATION FOR QUICK SELECT:
      // Staff can only view past visitors/companies hosted by staff in their SAME department.
      // Admins & Managing Director can view across all departments.
      if (currentUser.role === 'STAFF') {
        const myDept = (currentUser.departmentName || '').trim().toLowerCase();
        const hostDept = (v.hostDepartment || '').trim().toLowerCase();
        if (myDept && hostDept && myDept !== hostDept) {
          return;
        }
      }

      if (company && v.companyName.trim().toLowerCase() !== company) return;

      const key = `${v.companyName.trim().toLowerCase()}::${(v.idNumber || v.fullName).trim().toLowerCase()}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, v);
      }
    });

    res.json(Array.from(uniqueMap.values()));
  });

  app.get('/api/vms/visitors', async (req, res) => {
    const currentUser = getActiveUser();

    let visitors = db.visitors;
    if (getIsPgConnected()) {
      const pgVisitors = await fetchVisitorsFromPg();
      if (pgVisitors) visitors = pgVisitors;
    }

    // STRICT PERMISSION RULE:
    // If Staff -> Return ONLY visitors where hostUserId === currentUser.id
    if (currentUser.role === 'STAFF') {
      const myVisitors = visitors.filter(v => v.hostUserId === currentUser.id);
      return res.json(myVisitors);
    }

    // Administrators and Security Officers can view ALL visitors
    res.json(visitors);
  });

  app.post('/api/vms/visitors', (req, res) => {
    const currentUser = getActiveUser();

    // Security policy: Only Staff users can pre-register visitors. Administrators and Security cannot register on behalf of staff users.
    if (currentUser.role !== 'STAFF') {
      return res.status(400).json({ error: 'Permission Denied: Administrator accounts do not have access to pre-register visitors on behalf of users. Only Staff can pre-register visitors.' });
    }

    const {
      fullName, idNumber, phone, email, companyName,
      visitorCategoryId, purpose, meetingVenueId,
      scheduledDate, scheduledEndDate, scheduledStartTime, scheduledEndTime,
      vehicleNumber, itemsCarried, notes,
      visitors: visitorsList
    } = req.body;

    // Validate backdate and back time
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const localNowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (scheduledDate && scheduledDate < localToday) {
      return res.status(400).json({ error: `Scheduled start date (${scheduledDate}) cannot be in the past. Please select today's date or a future date.` });
    }

    if (scheduledEndDate && scheduledDate && scheduledEndDate < scheduledDate) {
      return res.status(400).json({ error: `Scheduled end date (${scheduledEndDate}) cannot be earlier than start date (${scheduledDate}).` });
    }

    if (scheduledDate === localToday && scheduledStartTime && scheduledStartTime < localNowTime) {
      return res.status(400).json({ error: `Scheduled start time (${scheduledStartTime}) cannot be in the past for today. Current time is ${localNowTime}.` });
    }

    const category = db.visitorCategories.find(c => c.id === visitorCategoryId);
    const venue = db.meetingVenues.find(v => v.id === meetingVenueId);
    const targetHost = currentUser;

    const sharedRegNo = `VMS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowTs = Date.now();

    const rawList = Array.isArray(visitorsList) && visitorsList.length > 0
      ? visitorsList
      : [{ fullName, idNumber, phone, email, vehicleNumber, itemsCarried }];

    // Single Organization Enforcement: Reject requests with mixed corporate email domains
    const emailDomains = new Set<string>();
    rawList.forEach((vItem: any) => {
      const vEmail = vItem.email || email || '';
      if (vEmail && vEmail.includes('@')) {
        const domain = vEmail.split('@')[1].trim().toLowerCase();
        if (domain) emailDomains.add(domain);
      }
    });

    if (emailDomains.size > 1) {
      return res.status(400).json({
        error: `Single Organization Rule Violation: Detected attendees with different email domains (${Array.from(emailDomains).map(d => '@' + d).join(', ')}). A single request cannot mix attendees from different companies. Please submit separate requests for each company.`
      });
    }

    const createdVisitors: Visitor[] = [];

    rawList.forEach((vItem: any, idx: number) => {
      const vName = vItem.fullName || fullName || 'Visitor';
      const vIdNum = vItem.idNumber || idNumber || '';
      const isBlk = db.blacklist.some(b => b.isActive && b.idNumber.toLowerCase() === (vIdNum || '').toLowerCase());

      const newVisitor: Visitor = {
        id: `vis-${nowTs}-${idx}-${Math.floor(Math.random()*1000)}`,
        registrationNo: sharedRegNo,
        fullName: vName,
        idNumber: vIdNum,
        phone: vItem.phone || phone || '',
        email: vItem.email || email || '',
        companyName: companyName || 'Guest Organization',
        visitorCategoryId: visitorCategoryId || 'vc-5',
        visitorCategoryName: category ? category.name : 'General Visitor',
        purpose: purpose || 'Official Business Meeting',
        hostUserId: targetHost.id,
        hostUserName: targetHost.fullName,
        hostDepartment: targetHost.departmentName,
        meetingVenueId: meetingVenueId || 'mv-2',
        meetingVenueName: venue ? venue.name : 'Conference Room B',
        scheduledDate: scheduledDate || new Date().toISOString().split('T')[0],
        scheduledEndDate: scheduledEndDate || scheduledDate || new Date().toISOString().split('T')[0],
        scheduledStartTime: scheduledStartTime || '09:00',
        scheduledEndTime: scheduledEndTime || '17:00',
        status: 'PENDING_APPROVAL',
        approvalStatus: 'PENDING',
        passBadgeNumber: null,
        checkInTime: null,
        checkOutTime: null,
        checkInSecurityUserId: null,
        checkOutSecurityUserId: null,
        vehicleNumber: vItem.vehicleNumber || vehicleNumber || null,
        itemsCarried: vItem.itemsCarried || itemsCarried || null,
        isBlacklistedAtRegistration: isBlk,
        notes: notes || null,
        createdAt: new Date().toISOString()
      };

      db.visitors.unshift(newVisitor);
      createdVisitors.push(newVisitor);
      saveVisitorToPg(newVisitor).catch(err => console.error('PG visitor save error:', err));
    });

    if (companyName) {
      ensureCompanyExists(companyName, 'VISITOR_ORGANIZATION', currentUser, email, phone);
    }

    logAudit(currentUser.id, 'CREATE_VISITOR', `Registered delegation of ${createdVisitors.length} visitor(s) for ${companyName || 'Organization'} (${sharedRegNo}) hosted by ${targetHost.fullName} - Awaiting Managing Director Approval`, req);

    // Format display date range for notification
    const dateRangeStr = scheduledEndDate && scheduledEndDate !== scheduledDate
      ? `${scheduledDate} to ${scheduledEndDate}`
      : (scheduledDate || new Date().toISOString().split('T')[0]);

    // STAGE 3: Dispatch email notification to Managing Director
    sendMdNewRequestNotification({
      registrationNo: sharedRegNo,
      type: 'Visitor',
      visitorOrContractorName: createdVisitors.map(v => v.fullName).join(', '),
      companyName: companyName || 'Guest Organization',
      hostName: targetHost.fullName,
      department: targetHost.departmentName || 'General',
      visitDate: dateRangeStr,
      expectedTime: `${scheduledStartTime || '09:00'} - ${scheduledEndTime || '17:00'}`,
      purpose: purpose || 'Official Business Meeting'
    });

    res.status(201).json(createdVisitors[0]);
  });

  app.post('/api/vms/visitors/:id/approve', async (req, res) => {
    const currentUser = getActiveUser();
    const authCheck = canUserApproveExecutive(currentUser);
    if (!authCheck.allowed) {
      return res.status(403).json({ error: 'Permission Denied: Only the Managing Director or authorized Acting Approvers can approve visits.' });
    }

    const visitor = db.visitors.find(v => v.id === req.params.id);
    if (!visitor) return res.status(404).json({ error: 'Visitor record not found' });

    // Approve ALL visitors belonging to the same registrationNo request
    const groupVisitors = db.visitors.filter(v => v.registrationNo === visitor.registrationNo);
    const nowFormatted = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const approverDisplay = authCheck.isActing ? `${currentUser.fullName} [Acting Approver for MD]` : currentUser.fullName;

    const { approvalRemark, approvedVenueId, approvedVenueName } = req.body || {};
    for (const v of groupVisitors) {
      v.status = 'SCHEDULED';
      v.approvalStatus = 'APPROVED';
      v.approvedByUserId = currentUser.id;
      v.approvedByUserName = approverDisplay;
      v.approvedAt = nowFormatted;
      if (approvalRemark) v.approvalRemark = approvalRemark;
      if (approvedVenueId) {
        v.approvedVenueId = approvedVenueId;
        v.meetingVenueId = approvedVenueId;
      }
      if (approvedVenueName) {
        v.approvedVenueName = approvedVenueName;
        v.meetingVenueName = approvedVenueName;
      }
      if (approvalRemark || approvedVenueName) {
        v.isConditionalApproval = true;
      }
      await saveVisitorToPg(v);
    }

    const remarkLog = approvalRemark ? ` Remark: "${approvalRemark}"` : '';
    const venueLog = approvedVenueName ? ` Approved Venue: ${approvedVenueName}` : '';
    logAudit(currentUser.id, authCheck.isActing ? 'APPROVE_VISITOR_DELEGATED' : 'APPROVE_VISITOR', `${approverDisplay} APPROVED visitor request ${visitor.registrationNo} (${groupVisitors.length} visitor(s) from ${visitor.companyName}).${venueLog}${remarkLog}`, req);

    // STAGE 4: Dispatch approval email to IT & Host (and Production Manager if Prod 1 / Prod 2)
    sendApprovedNotification({
      registrationNo: visitor.registrationNo,
      type: 'Visitor',
      visitorOrContractorName: groupVisitors.map(v => v.fullName).join(', '),
      companyName: visitor.companyName,
      hostName: visitor.hostUserName,
      hostUserId: visitor.hostUserId,
      visitDate: visitor.scheduledDate,
      visitTime: visitor.scheduledStartTime && visitor.scheduledEndTime
        ? `${visitor.scheduledStartTime} to ${visitor.scheduledEndTime}`
        : (visitor.scheduledStartTime || visitor.scheduledEndTime || '09:00 to 17:00'),
      approvedBy: approverDisplay,
      approvedDate: nowFormatted,
      approvalRemark: approvalRemark || visitor.approvalRemark,
      approvedVenueName: approvedVenueName || visitor.approvedVenueName || visitor.meetingVenueName,
      approvedVenueId: approvedVenueId || visitor.approvedVenueId || visitor.meetingVenueId,
      locationDetails: visitor.purpose
    });

    res.json(visitor);
  });

  app.post('/api/vms/visitors/:id/reject', async (req, res) => {
    const currentUser = getActiveUser();
    const authCheck = canUserApproveExecutive(currentUser);
    if (!authCheck.allowed) {
      return res.status(403).json({ error: 'Permission Denied: Only the Managing Director or authorized Acting Approvers can reject visits.' });
    }

    const visitor = db.visitors.find(v => v.id === req.params.id);
    if (!visitor) return res.status(404).json({ error: 'Visitor record not found' });

    const { reason } = req.body;
    const groupVisitors = db.visitors.filter(v => v.registrationNo === visitor.registrationNo);
    const nowFormatted = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const rejReason = reason || 'Visit request rejected by Executive Management.';
    const approverDisplay = authCheck.isActing ? `${currentUser.fullName} [Acting Approver for MD]` : currentUser.fullName;

    for (const v of groupVisitors) {
      v.status = 'REJECTED';
      v.approvalStatus = 'REJECTED';
      v.approvedByUserId = currentUser.id;
      v.approvedByUserName = approverDisplay;
      v.approvedAt = nowFormatted;
      v.rejectionReason = rejReason;
      await saveVisitorToPg(v);
    }

    logAudit(currentUser.id, authCheck.isActing ? 'REJECT_VISITOR_DELEGATED' : 'REJECT_VISITOR', `${approverDisplay} REJECTED visitor request ${visitor.registrationNo} (${groupVisitors.length} visitor(s) from ${visitor.companyName}). Reason: ${rejReason}`, req);

    // STAGE 5: Dispatch decline email to IT & Host
    sendDeclinedNotification({
      registrationNo: visitor.registrationNo,
      type: 'Visitor',
      visitorOrContractorName: groupVisitors.map(v => v.fullName).join(', '),
      companyName: visitor.companyName,
      hostName: visitor.hostUserName,
      hostUserId: visitor.hostUserId,
      visitDate: visitor.scheduledDate,
      declinedBy: approverDisplay,
      declinedDate: nowFormatted,
      reason: rejReason
    });

    res.json(visitor);
  });

  app.put('/api/vms/visitors/:id', async (req, res) => {
    const currentUser = getActiveUser();
    const visitor = db.visitors.find(v => v.id === req.params.id);
    if (!visitor) return res.status(404).json({ error: 'Visitor record not found' });

    // Staff permission check: Can only edit OWN visitors
    if (currentUser.role === 'STAFF' && visitor.hostUserId !== currentUser.id) {
      return res.status(403).json({ error: 'Access Denied: You cannot modify another staff member\'s visitor registration.' });
    }

    Object.assign(visitor, req.body);
    await saveVisitorToPg(visitor);
    logAudit(currentUser.id, 'UPDATE_VISITOR', `Updated registration details for visitor ${visitor.fullName}`, req);
    res.json(visitor);
  });

  app.post('/api/vms/visitors/:id/cancel', async (req, res) => {
    const currentUser = getActiveUser();
    const visitor = db.visitors.find(v => v.id === req.params.id);
    if (!visitor) return res.status(404).json({ error: 'Visitor record not found' });

    // Staff permission check
    if (currentUser.role === 'STAFF' && visitor.hostUserId !== currentUser.id) {
      return res.status(403).json({ error: 'Access Denied: You cannot cancel another staff member\'s visitor registration.' });
    }

    visitor.status = 'CANCELLED';
    await saveVisitorToPg(visitor);
    logAudit(currentUser.id, 'UPDATE_VISITOR', `Cancelled visitor registration ${visitor.registrationNo} (${visitor.fullName})`, req);
    res.json(visitor);
  });

  app.post('/api/vms/visitors/:id/check-in', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role === 'STAFF') {
      return res.status(403).json({ error: 'Permission Denied: Security officers only can check-in visitors.' });
    }

    const visitor = db.visitors.find(v => v.id === req.params.id);
    if (!visitor) return res.status(404).json({ error: 'Visitor record not found' });

    if (visitor.status === 'PENDING_APPROVAL' || visitor.status === 'REJECTED') {
      return res.status(403).json({ error: 'CHECK-IN BLOCKED: Visit request has not been approved by the Managing Director.' });
    }

    // VERIFY WATCHLIST & BLACKLIST
    const watchMatch = checkWatchlistMatch(visitor.idNumber, visitor.phone, visitor.email);
    if (watchMatch) {
      if (watchMatch.type === 'BLACKLIST') {
        logAudit(currentUser.id, 'BLACKLIST_ALERT', `ALERT! Blacklisted individual ${visitor.fullName} (ID: ${visitor.idNumber}, Phone: ${visitor.phone}) attempted check-in! Reason: ${watchMatch.reason}`, req);
        return res.status(403).json({
          error: 'BLACKLIST_WARNING',
          message: `CHECK-IN BLOCKED: Individual is blacklisted in database! Reason: ${watchMatch.reason}`,
          blacklistDetails: watchMatch
        });
      } else {
        logAudit(currentUser.id, 'WATCHLIST_ALERT', `SECURITY NOTICE: Watchlisted individual ${visitor.fullName} (ID: ${visitor.idNumber}) checked in by Security Officer. Flag Reason: ${watchMatch.reason}`, req);
      }
    }

    const { passBadgeNumber, vehicleNumber, itemsCarried } = req.body;
    const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    visitor.status = 'CHECKED_IN';
    visitor.passBadgeNumber = passBadgeNumber || `${db.settings.passPrefixVisitor}${Math.floor(800 + Math.random() * 100)}`;
    visitor.checkInTime = timestampStr;
    visitor.checkInSecurityUserId = currentUser.id;
    visitor.checkInSecurityUserName = currentUser.fullName;
    if (vehicleNumber) visitor.vehicleNumber = vehicleNumber;
    if (itemsCarried) visitor.itemsCarried = itemsCarried;

    await saveVisitorToPg(visitor);
    logAudit(currentUser.id, 'CHECK_IN', `Checked in visitor ${visitor.fullName}. Issued pass badge ${visitor.passBadgeNumber}`, req);
    res.json(visitor);
  });

  app.post('/api/vms/visitors/:id/check-out', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role === 'STAFF') {
      return res.status(403).json({ error: 'Permission Denied: Security officers only can check-out visitors.' });
    }

    const visitor = db.visitors.find(v => v.id === req.params.id);
    if (!visitor) return res.status(404).json({ error: 'Visitor record not found' });

    const now = new Date();
    const timestampStr = now.toISOString().replace('T', ' ').substring(0, 19);

    // Calculate if scheduled end time was exceeded
    let exceededMins = 0;
    if (visitor.scheduledDate && visitor.scheduledEndTime) {
      try {
        const [endHour, endMin] = visitor.scheduledEndTime.split(':').map(Number);
        const schedEnd = new Date(visitor.scheduledDate);
        schedEnd.setHours(endHour || 17, endMin || 0, 0, 0);

        if (now > schedEnd) {
          exceededMins = Math.floor((now.getTime() - schedEnd.getTime()) / (1000 * 60));
        }
      } catch (e) {
        console.error('Error calculating overstay:', e);
      }
    }

    const { overstayNotes } = req.body || {};

    if (exceededMins > 0 && !overstayNotes?.trim()) {
      return res.status(400).json({ error: 'Security reason/justification for overstay is required before completing check-out.' });
    }

    visitor.status = 'CHECKED_OUT';
    visitor.checkOutTime = timestampStr;
    visitor.checkOutSecurityUserId = currentUser.id;
    visitor.checkOutSecurityUserName = currentUser.fullName;
    visitor.exceededMinutes = exceededMins > 0 ? exceededMins : (visitor.exceededMinutes || 0);
    if (overstayNotes) {
      visitor.overstayNotes = overstayNotes.trim();
    }

    await saveVisitorToPg(visitor);
    const auditMessage = exceededMins > 0 
      ? `Checked out visitor ${visitor.fullName}. Pass Badge ${visitor.passBadgeNumber} returned. [TIME EXCEEDED WARNING: Overstayed scheduled end time (${visitor.scheduledEndTime}) by ${exceededMins} minutes].` 
      : `Checked out visitor ${visitor.fullName}. Collected pass badge ${visitor.passBadgeNumber}`;

    logAudit(currentUser.id, exceededMins > 0 ? 'OVERSTAY_CHECKOUT' : 'CHECK_OUT', auditMessage, req);
    res.json(visitor);
  });

  // --- CONTRACTORS ENDPOINTS (With Strict Staff Data Isolation) ---
  app.get('/api/vms/contractors', async (req, res) => {
    const currentUser = getActiveUser();

    let contractors = db.contractors;
    if (getIsPgConnected()) {
      const pgContractors = await fetchContractorsFromPg();
      if (pgContractors) contractors = pgContractors;
    }

    if (currentUser.role === 'STAFF') {
      const myContractors = contractors.filter(c => c.hostUserId === currentUser.id);
      return res.json(myContractors);
    }

    res.json(contractors);
  });

  app.post('/api/vms/contractors', (req, res) => {
    const currentUser = getActiveUser();

    // Security policy: Only Staff users can pre-register contractors. Administrators and Security cannot register on behalf of staff users.
    if (currentUser.role !== 'STAFF') {
      return res.status(400).json({ error: 'Permission Denied: Administrator accounts do not have access to pre-register contractors on behalf of users. Only Staff can pre-register contractors.' });
    }

    const {
      fullName, idNumber, phone, email, companyName, workOrderNo,
      contractorCategoryId, workScope, locationVenueId,
      startDate, endDate, startTime, endTime, vehicleNumber, toolsEquipmentCarried,
      safetyInductionVerified, contractorsList,
      isForeignWorker, passportNumber, nationality, permitNumber, permitExpiryDate
    } = req.body;

    // Validate backdate for contractor permit
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    if (startDate && startDate < localToday) {
      return res.status(400).json({ error: `Work permit start date (${startDate}) cannot be in the past. Please select today's date or a future date.` });
    }

    if (endDate && endDate < startDate) {
      return res.status(400).json({ error: `Work permit end date (${endDate}) cannot be earlier than start date (${startDate}).` });
    }

    // Foreign Worker Permit Validation
    if (isForeignWorker) {
      if (!passportNumber && !idNumber) {
        return res.status(400).json({ error: 'Foreign worker registration requires a valid Passport Number.' });
      }
      if (!permitExpiryDate) {
        return res.status(400).json({ error: 'Foreign worker registration requires a Work Permit Expiry Date.' });
      }
      if (permitExpiryDate < localToday) {
        return res.status(400).json({ error: `Foreign Worker Permit Expired: Work permit expiry date (${permitExpiryDate}) is in the past. Malaysian Security Guidelines prohibit registration of foreign workers with expired work permits.` });
      }
    }

    const category = db.contractorCategories.find(c => c.id === contractorCategoryId);
    const venue = db.meetingVenues.find(v => v.id === locationVenueId);
    const targetHost = currentUser;

    const rawList = Array.isArray(contractorsList) && contractorsList.length > 0
      ? contractorsList
      : [{ fullName, idNumber, phone, email, vehicleNumber, toolsEquipmentCarried }];

    // Single Organization Enforcement: Reject requests with mixed corporate email domains
    const emailDomains = new Set<string>();
    rawList.forEach((cItem: any) => {
      const cEmail = cItem.email || email || '';
      if (cEmail && cEmail.includes('@')) {
        const domain = cEmail.split('@')[1].trim().toLowerCase();
        if (domain) emailDomains.add(domain);
      }
    });

    if (emailDomains.size > 1) {
      return res.status(400).json({
        error: `Single Organization Rule Violation: Detected contractors with different email domains (${Array.from(emailDomains).map(d => '@' + d).join(', ')}). A single work permit request cannot mix workers from different companies. Please submit separate requests for each contractor company.`
      });
    }

    const sharedRegNo = `CTR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const createdContractors: Contractor[] = [];

    rawList.forEach((cItem: any) => {
      const cName = (cItem.fullName || '').trim();
      const cIdNum = (cItem.idNumber || '').trim();
      if (!cName || !cIdNum) return;

      const newContractor: Contractor = {
        id: `ctr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        registrationNo: sharedRegNo,
        fullName: cName,
        idNumber: cIdNum,
        phone: cItem.phone || phone || '',
        email: cItem.email || email || '',
        companyName: companyName || 'External Contractor',
        workOrderNo: workOrderNo || `WO-${Math.floor(1000 + Math.random() * 9000)}`,
        contractorCategoryId: contractorCategoryId || 'cc-2',
        contractorCategoryName: category ? category.name : 'General Maintenance',
        workScope: workScope || 'Scheduled Maintenance Work',
        hostUserId: targetHost.id,
        hostUserName: targetHost.fullName,
        hostDepartment: targetHost.departmentName,
        locationVenueId: locationVenueId || 'mv-5',
        locationVenueName: venue ? venue.name : 'Facility Maintenance Bay',
        startDate: startDate || new Date().toISOString().split('T')[0],
        endDate: endDate || new Date().toISOString().split('T')[0],
        startTime: startTime || '08:00',
        endTime: endTime || '17:00',
        status: 'PENDING_APPROVAL',
        approvalStatus: 'PENDING',
        safetyInductionVerified: !!safetyInductionVerified,
        passBadgeNumber: null,
        checkInTime: null,
        checkOutTime: null,
        vehicleNumber: cItem.vehicleNumber || vehicleNumber || null,
        toolsEquipmentCarried: cItem.toolsEquipmentCarried || toolsEquipmentCarried || null,
        isForeignWorker: !!(cItem.isForeignWorker ?? isForeignWorker),
        passportNumber: cItem.passportNumber || passportNumber || null,
        nationality: cItem.nationality || nationality || 'Non-Malaysian',
        permitNumber: cItem.permitNumber || permitNumber || null,
        permitExpiryDate: cItem.permitExpiryDate || permitExpiryDate || null,
        permitStatus: (cItem.isForeignWorker ?? isForeignWorker)
          ? ((cItem.permitExpiryDate || permitExpiryDate) >= localToday ? 'VALID' : 'EXPIRED')
          : 'NOT_APPLICABLE',
        createdAt: new Date().toISOString()
      };

      db.contractors.unshift(newContractor);
      createdContractors.push(newContractor);
      saveContractorToPg(newContractor).catch(err => console.error('PG contractor save error:', err));
    });

    if (companyName) {
      ensureCompanyExists(companyName, 'CONTRACTOR_VENDOR', currentUser, email, phone);
    }

    logAudit(currentUser.id, 'CREATE_CONTRACTOR', `Registered ${createdContractors.length} contractor worker(s) for ${companyName || 'Contractor'} (${sharedRegNo}) under Work Order ${workOrderNo} - Awaiting Managing Director Approval`, req);

    // STAGE 3: Dispatch email notification to Managing Director
    sendMdNewRequestNotification({
      registrationNo: sharedRegNo,
      type: 'Contractor',
      visitorOrContractorName: createdContractors.map(c => c.fullName).join(', '),
      companyName: companyName || 'External Contractor',
      hostName: targetHost.fullName,
      department: targetHost.departmentName || 'Facility Management',
      visitDate: `${startDate || 'Today'} to ${endDate || 'Today'}`,
      expectedTime: startTime && endTime ? `${startTime} - ${endTime}` : '08:00 - 17:00',
      purpose: workScope || 'Scheduled Maintenance Work'
    });

    res.status(201).json(createdContractors[0]);
  });

  app.post('/api/vms/contractors/:id/approve', async (req, res) => {
    const currentUser = getActiveUser();
    const authCheck = canUserApproveExecutive(currentUser);
    if (!authCheck.allowed) {
      return res.status(403).json({ error: 'Permission Denied: Only the Managing Director or authorized Acting Approvers can approve contractors.' });
    }

    const contractor = db.contractors.find(c => c.id === req.params.id);
    if (!contractor) return res.status(404).json({ error: 'Contractor record not found' });

    const groupContractors = db.contractors.filter(c => c.registrationNo === contractor.registrationNo);
    const nowFormatted = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const approverDisplay = authCheck.isActing ? `${currentUser.fullName} [Acting Approver for MD]` : currentUser.fullName;

    const { approvalRemark, approvedVenueId, approvedVenueName } = req.body || {};
    for (const c of groupContractors) {
      c.status = 'SCHEDULED';
      c.approvalStatus = 'APPROVED';
      c.approvedByUserId = currentUser.id;
      c.approvedByUserName = approverDisplay;
      c.approvedAt = nowFormatted;
      if (approvalRemark) c.approvalRemark = approvalRemark;
      if (approvedVenueId) {
        c.approvedVenueId = approvedVenueId;
        c.locationVenueId = approvedVenueId;
      }
      if (approvedVenueName) {
        c.approvedVenueName = approvedVenueName;
        c.locationVenueName = approvedVenueName;
      }
      if (approvalRemark || approvedVenueName) {
        c.isConditionalApproval = true;
      }
      await saveContractorToPg(c);
    }

    const remarkLog = approvalRemark ? ` Remark: "${approvalRemark}"` : '';
    const venueLog = approvedVenueName ? ` Approved Venue: ${approvedVenueName}` : '';
    logAudit(currentUser.id, authCheck.isActing ? 'APPROVE_CONTRACTOR_DELEGATED' : 'APPROVE_CONTRACTOR', `${approverDisplay} APPROVED contractor request ${contractor.registrationNo} (${groupContractors.length} worker(s) from ${contractor.companyName}).${venueLog}${remarkLog}`, req);

    // STAGE 4: Dispatch approval email to IT & Host (and Production Manager if Prod 1 / Prod 2)
    sendApprovedNotification({
      registrationNo: contractor.registrationNo,
      type: 'Contractor',
      visitorOrContractorName: groupContractors.map(c => c.fullName).join(', '),
      companyName: contractor.companyName,
      hostName: contractor.hostUserName,
      hostUserId: contractor.hostUserId,
      visitDate: `${contractor.startDate} to ${contractor.endDate}`,
      visitTime: contractor.startTime && contractor.endTime ? `${contractor.startTime} to ${contractor.endTime}` : '08:00 to 17:00',
      approvedBy: approverDisplay,
      approvedDate: nowFormatted,
      approvalRemark: approvalRemark || contractor.approvalRemark,
      approvedVenueName: approvedVenueName || contractor.approvedVenueName || contractor.locationVenueName,
      approvedVenueId: approvedVenueId || contractor.approvedVenueId || contractor.locationVenueId,
      locationDetails: contractor.workScope
    });

    res.json(contractor);
  });

  app.post('/api/vms/contractors/:id/reject', async (req, res) => {
    const currentUser = getActiveUser();
    const authCheck = canUserApproveExecutive(currentUser);
    if (!authCheck.allowed) {
      return res.status(403).json({ error: 'Permission Denied: Only the Managing Director or authorized Acting Approvers can reject contractors.' });
    }

    const contractor = db.contractors.find(c => c.id === req.params.id);
    if (!contractor) return res.status(404).json({ error: 'Contractor record not found' });

    const { reason } = req.body;
    const groupContractors = db.contractors.filter(c => c.registrationNo === contractor.registrationNo);
    const nowFormatted = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const rejReason = reason || 'Contractor work request rejected by Executive Management.';
    const approverDisplay = authCheck.isActing ? `${currentUser.fullName} [Acting Approver for MD]` : currentUser.fullName;

    for (const c of groupContractors) {
      c.status = 'REJECTED';
      c.approvalStatus = 'REJECTED';
      c.approvedByUserId = currentUser.id;
      c.approvedByUserName = approverDisplay;
      c.approvedAt = nowFormatted;
      c.rejectionReason = rejReason;
      await saveContractorToPg(c);
    }

    logAudit(currentUser.id, authCheck.isActing ? 'REJECT_CONTRACTOR_DELEGATED' : 'REJECT_CONTRACTOR', `${approverDisplay} REJECTED contractor request ${contractor.registrationNo} (${groupContractors.length} worker(s) from ${contractor.companyName}). Reason: ${rejReason}`, req);

    // STAGE 5: Dispatch decline email to IT & Host
    sendDeclinedNotification({
      registrationNo: contractor.registrationNo,
      type: 'Contractor',
      visitorOrContractorName: groupContractors.map(c => c.fullName).join(', '),
      companyName: contractor.companyName,
      hostName: contractor.hostUserName,
      hostUserId: contractor.hostUserId,
      visitDate: `${contractor.startDate} to ${contractor.endDate}`,
      declinedBy: approverDisplay,
      declinedDate: nowFormatted,
      reason: rejReason
    });

    res.json(contractor);
  });

  app.post('/api/vms/contractors/:id/check-in', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role === 'STAFF') return res.status(403).json({ error: 'Security role required.' });

    const contractor = db.contractors.find(c => c.id === req.params.id);
    if (!contractor) return res.status(404).json({ error: 'Contractor record not found' });

    if (contractor.status === 'PENDING_APPROVAL' || contractor.status === 'REJECTED') {
      return res.status(403).json({ error: 'CHECK-IN BLOCKED: Contractor work request has not been approved by the Managing Director.' });
    }

    const watchMatch = checkWatchlistMatch(contractor.idNumber, contractor.phone, contractor.email);
    if (watchMatch) {
      if (watchMatch.type === 'BLACKLIST') {
        logAudit(currentUser.id, 'BLACKLIST_ALERT', `ALERT! Blacklisted contractor ${contractor.fullName} (ID: ${contractor.idNumber}, Phone: ${contractor.phone}) attempted check-in! Reason: ${watchMatch.reason}`, req);
        return res.status(403).json({
          error: 'BLACKLIST_WARNING',
          message: `CHECK-IN BLOCKED: Contractor is blacklisted! Reason: ${watchMatch.reason}`,
          blacklistDetails: watchMatch
        });
      } else {
        logAudit(currentUser.id, 'WATCHLIST_ALERT', `SECURITY NOTICE: Watchlisted contractor ${contractor.fullName} (ID: ${contractor.idNumber}) checked in by Security Officer. Flag Reason: ${watchMatch.reason}`, req);
      }
    }

    const { passBadgeNumber, vehicleNumber, toolsEquipmentCarried } = req.body;
    const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    contractor.status = 'CHECKED_IN';
    contractor.passBadgeNumber = passBadgeNumber || `${db.settings.passPrefixContractor}${Math.floor(900 + Math.random() * 100)}`;
    contractor.checkInTime = timestampStr;
    contractor.checkInSecurityUserId = currentUser.id;
    contractor.checkInSecurityUserName = currentUser.fullName;
    if (vehicleNumber) contractor.vehicleNumber = vehicleNumber;
    if (toolsEquipmentCarried) contractor.toolsEquipmentCarried = toolsEquipmentCarried;

    await saveContractorToPg(contractor);
    logAudit(currentUser.id, 'CHECK_IN', `Checked in contractor ${contractor.fullName}. Assigned Badge ${contractor.passBadgeNumber}`, req);
    res.json(contractor);
  });

  app.post('/api/vms/contractors/:id/check-out', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role === 'STAFF') return res.status(403).json({ error: 'Security role required.' });

    const contractor = db.contractors.find(c => c.id === req.params.id);
    if (!contractor) return res.status(404).json({ error: 'Contractor record not found' });

    const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    contractor.status = 'CHECKED_OUT';
    contractor.checkOutTime = timestampStr;
    contractor.checkOutSecurityUserId = currentUser.id;
    contractor.checkOutSecurityUserName = currentUser.fullName;

    await saveContractorToPg(contractor);
    logAudit(currentUser.id, 'CHECK_OUT', `Checked out contractor ${contractor.fullName}`, req);
    res.json(contractor);
  });

  // Watchlist & Blacklist Matching Helper
  function checkWatchlistMatch(idNumber?: string, phone?: string, email?: string): BlacklistEntry | null {
    if (!db.blacklist || db.blacklist.length === 0) return null;
    const cleanId = (idNumber || '').trim().toLowerCase();
    const cleanPhone = (phone || '').trim().replace(/[^0-9]/g, '');
    const cleanEmail = (email || '').trim().toLowerCase();

    for (const entry of db.blacklist) {
      if (!entry.isActive) continue;
      if (cleanId && entry.idNumber && entry.idNumber.trim().toLowerCase() === cleanId) return entry;
      if (cleanEmail && entry.email && entry.email.trim().toLowerCase() === cleanEmail) return entry;
      if (cleanPhone && cleanPhone.length >= 6 && entry.phone && entry.phone.trim().replace(/[^0-9]/g, '') === cleanPhone) return entry;
    }
    return null;
  }

  // --- WATCHLIST & BLACKLIST MANAGEMENT ---
  app.get('/api/vms/blacklist', async (req, res) => {
    let list = db.blacklist;
    if (getIsPgConnected()) {
      const pgList = await fetchBlacklistFromPg();
      if (pgList) list = pgList;
    }
    res.json(list);
  });

  app.post('/api/vms/blacklist', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR' && currentUser.role !== 'SECURITY') {
      return res.status(403).json({ error: 'Permission denied: Administrator or Security Officer role required.' });
    }

    const { fullName, idNumber, phone, email, type, reason, severity } = req.body;

    if (!fullName || !idNumber || !reason) {
      return res.status(400).json({ error: 'Full Name, ID/NRIC/Passport Number, and Reason are required.' });
    }

    const newEntry: BlacklistEntry = {
      id: `blk-${Date.now()}`,
      fullName,
      idNumber,
      phone: phone || null,
      email: email || null,
      type: type === 'WATCHLIST' ? 'WATCHLIST' : 'BLACKLIST',
      reason,
      severity: severity || 'HIGH',
      blockedByUserId: currentUser.id,
      blockedByUserName: currentUser.fullName,
      dateAdded: new Date().toISOString().split('T')[0],
      isActive: true
    };

    db.blacklist.unshift(newEntry);
    if (getIsPgConnected()) {
      await saveBlacklistEntryToPg(newEntry);
    }

    logAudit(currentUser.id, 'SECURITY_ALERT', `Added ${newEntry.type} entry for ${fullName} (ID: ${idNumber}, Phone: ${phone || 'N/A'}). Reason: ${reason}`, req);
    res.status(201).json(newEntry);
  });

  app.delete('/api/vms/blacklist/:id', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR' && currentUser.role !== 'SECURITY') {
      return res.status(403).json({ error: 'Permission denied: Administrator or Security Officer role required.' });
    }

    const index = db.blacklist.findIndex(b => b.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Entry not found' });

    const removed = db.blacklist[index];
    db.blacklist.splice(index, 1);

    if (getIsPgConnected()) {
      await deleteBlacklistEntryFromPg(req.params.id);
    }

    logAudit(currentUser.id, 'SECURITY_ALERT', `Lifted/Removed ${removed.type} entry for ${removed.fullName} (${removed.idNumber})`, req);
    res.json({ message: 'Watchlist/Blacklist entry removed successfully' });
  });

  // --- DATABASE HEALTH & POOL TELEMETRY ---
  app.get('/api/vms/system/db-health', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR') return res.status(403).json({ error: 'Admin access required' });
    const metrics = await getDbPoolMetrics();
    res.json(metrics);
  });

  // --- AUDIT LOGS & LOGIN HISTORY (IMMUTABLE AUDIT TRAIL) ---
  app.get('/api/vms/audit-logs', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR') return res.status(403).json({ error: 'Admin access required' });
    
    let logs = db.auditLogs;
    if (getIsPgConnected()) {
      const pgLogs = await fetchAuditLogsFromPg();
      if (pgLogs) logs = pgLogs;
    }
    res.json(logs);
  });

  // Strict anti-tampering protection: Audit logs cannot be deleted or modified
  app.delete('/api/vms/audit-logs*', (req, res) => {
    return res.status(403).json({
      error: 'IMMUTABLE_LOG_ERROR',
      message: 'SECURITY POLICY ENFORCEMENT: Enterprise audit logs are write-only, tamper-evident, and CANNOT BE DELETED or modified.'
    });
  });

  app.get('/api/vms/login-history', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR') return res.status(403).json({ error: 'Admin access required' });
    if (getIsPgConnected()) {
      const pgHistory = await fetchLoginHistoryFromPg();
      if (pgHistory) return res.json(pgHistory);
    }
    res.json(db.loginHistory);
  });

  // --- SYSTEM SETTINGS & PASSWORD POLICY ---
  app.get('/api/vms/settings', async (req, res) => {
    if (getIsPgConnected()) {
      const pgSettings = await fetchSystemSettingsFromPg();
      if (pgSettings) return res.json(pgSettings);
    }
    res.json(db.settings);
  });
  
  app.put('/api/vms/settings', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR') return res.status(403).json({ error: 'Admin access required' });
    Object.assign(db.settings, req.body);
    if (getIsPgConnected()) {
      await saveSystemSettingsToPg(db.settings);
    }
    logAudit(currentUser.id, 'UPDATE_SETTINGS', 'Updated Enterprise System Settings');
    res.json(db.settings);
  });

  app.get('/api/vms/password-policy', async (req, res) => {
    if (getIsPgConnected()) {
      const pgPolicy = await fetchPasswordPolicyFromPg();
      if (pgPolicy) return res.json(pgPolicy);
    }
    res.json(db.passwordPolicy);
  });
  
  app.put('/api/vms/password-policy', async (req, res) => {
    const currentUser = getActiveUser();
    if (currentUser.role !== 'ADMINISTRATOR') return res.status(403).json({ error: 'Admin access required' });
    Object.assign(db.passwordPolicy, req.body);
    if (getIsPgConnected()) {
      await savePasswordPolicyToPg(db.passwordPolicy);
    }
    logAudit(currentUser.id, 'UPDATE_PASSWORD_POLICY', 'Updated Enterprise Password Policy');
    res.json(db.passwordPolicy);
  });

  // --- ANALYTICS / REPORTS SUMMARY ---
  app.get('/api/vms/reports/summary', (req, res) => {
    const currentUser = getActiveUser();

    // Respect Staff Isolation in summary metrics
    const visitorList = currentUser.role === 'STAFF'
      ? db.visitors.filter(v => v.hostUserId === currentUser.id)
      : db.visitors;

    const contractorList = currentUser.role === 'STAFF'
      ? db.contractors.filter(c => c.hostUserId === currentUser.id)
      : db.contractors;

    const today = new Date().toISOString().split('T')[0];

    const todayVisitors = visitorList.filter(v => v.scheduledDate === today);
    const todayContractors = contractorList.filter(c => c.startDate <= today && c.endDate >= today);

    const onPremiseVisitors = visitorList.filter(v => v.status === 'CHECKED_IN');
    const onPremiseContractors = contractorList.filter(c => c.status === 'CHECKED_IN');

    res.json({
      totalVisitorsToday: todayVisitors.length,
      totalContractorsToday: todayContractors.length,
      onPremiseVisitorsCount: onPremiseVisitors.length,
      onPremiseContractorsCount: onPremiseContractors.length,
      pendingMdApprovalsCount: visitorList.filter(v => v.status === 'PENDING_APPROVAL').length + contractorList.filter(c => c.status === 'PENDING_APPROVAL').length,
      scheduledPendingCount: todayVisitors.filter(v => v.status === 'SCHEDULED').length,
      completedTodayCount: todayVisitors.filter(v => v.status === 'CHECKED_OUT').length,
      blacklistTotalCount: db.blacklist.length,
      totalUsersCount: db.users.length,
      totalDepartmentsCount: db.departments.length
    });
  });

  // --- API 404 & ERROR HANDLING (Prevents falling through to HTML SPA fallback) ---
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint ${req.originalUrl} not found` });
  });

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[API Error]:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  });

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VMS Enterprise Server] Express running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
