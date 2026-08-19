import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { db } from './db';
import { EmailLogEntry } from '../types';
import { saveEmailSettingsToPg, fetchEmailSettingsFromPg, saveEmailLogToPg } from './postgres';

export interface EmailSettings {
  SmtpServer: string;
  SmtpPort: number;
  FromAddress: string;
  FromName: string;
  MdEmail: string;
  ItEmail?: string;
  ProductionManagerEmail?: string;
  FallbackAdminEmail?: string;
  Secure?: boolean;
  // Recommendation 4: Notification Type Toggles
  EnableMdNotifications?: boolean;
  EnableProdManagerNotifications?: boolean;
  EnableNewUserNotifications?: boolean;
  EnableCheckInNotifications?: boolean;
  // Feature 4: Department-Level Notification Delegation (Backup Approvers)
  BackupApproverEmail?: string;
  BackupApproverName?: string;
  BackupApproverUserId?: string;
  EnableDelegation?: boolean;
  DelegationStartDate?: string;
  DelegationEndDate?: string;
  DelegationRoutingMode?: 'BOTH' | 'BACKUP_ONLY';
  DelegationReason?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendAndLogEmailOptions extends SendEmailOptions {
  requestId?: string | null;
  emailType: 'MD_NOTIFICATION' | 'APPROVED_NOTIFICATION' | 'DECLINED_NOTIFICATION' | 'TEST_EMAIL' | 'NEW_USER_NOTIFICATION' | 'ESCALATION_ALERT';
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface IEmailService {
  getSettings(): EmailSettings;
  updateSettings(newSettings: Partial<EmailSettings>): Promise<EmailSettings>;
  testConnection(): Promise<EmailSendResult>;
  sendEmail(options: SendEmailOptions): Promise<EmailSendResult>;
  sendAndLogEmail(options: SendAndLogEmailOptions): Promise<EmailSendResult>;
  syncWithPostgres(): Promise<void>;
}

class EmailService implements IEmailService {
  private settings: EmailSettings;
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.settings = this.loadConfig();
    this.initTransporter();
    // Background async sync with PostgreSQL
    this.syncWithPostgres().catch(err => {
      console.warn('[EmailService] PostgreSQL email settings initial sync notice:', err.message);
    });
  }

  public async syncWithPostgres(): Promise<void> {
    try {
      const pgSettings = await fetchEmailSettingsFromPg();
      if (pgSettings) {
        this.settings = {
          ...this.settings,
          ...pgSettings
        };
        this.initTransporter();
        console.log('✅ Synchronized Email settings from PostgreSQL');
      } else {
        // Seed default settings to PostgreSQL
        await saveEmailSettingsToPg(this.settings);
      }
    } catch (err) {
      console.warn('[EmailService] Could not sync email settings with PostgreSQL:', err);
    }
  }

  private loadConfig(): EmailSettings {
    const defaultConfig: EmailSettings = {
      SmtpServer: '157.9.183.242',
      SmtpPort: 25,
      FromAddress: 'Administrator@tanaka.com.my',
      FromName: 'Tanaka Visitor Management System',
      MdEmail: 'luqman@tanaka.com.my',
      ItEmail: '',
      ProductionManagerEmail: 'nakamu@ml.tanaka.co.jp, luqman@tanaka.com.my',
      FallbackAdminEmail: 'luqman@tanaka.com.my',
      Secure: false,
      EnableMdNotifications: true,
      EnableProdManagerNotifications: true,
      EnableNewUserNotifications: true,
      EnableCheckInNotifications: true,
      BackupApproverEmail: 'luqman@tanaka.com.my',
      BackupApproverName: 'Luqman (Acting MD)',
      BackupApproverUserId: '',
      EnableDelegation: false,
      DelegationStartDate: '',
      DelegationEndDate: '',
      DelegationRoutingMode: 'BOTH',
      DelegationReason: 'Executive Out of Office / Annual Leave'
    };

    try {
      const configPath = path.join(process.cwd(), 'appsettings.json');
      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(fileContent);
        if (parsed && parsed.Email) {
          return {
            ...defaultConfig,
            ...parsed.Email
          };
        }
      }
    } catch (err) {
      console.warn('[EmailService] Warning: Could not parse appsettings.json, using defaults.', err);
    }

    return defaultConfig;
  }

  private initTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: this.settings.SmtpServer,
        port: this.settings.SmtpPort,
        secure: this.settings.Secure || false, // false for port 25
        tls: {
          rejectUnauthorized: false // Relay compatibility
        },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000
      });
    } catch (err) {
      console.error('[EmailService] Failed to create nodemailer transporter:', err);
      this.transporter = null;
    }
  }

  public getSettings(): EmailSettings {
    return { ...this.settings };
  }

  public async updateSettings(newSettings: Partial<EmailSettings>): Promise<EmailSettings> {
    this.settings = {
      ...this.settings,
      ...newSettings
    };

    // Re-initialize transporter with new settings
    this.initTransporter();

    // Persist directly to PostgreSQL database
    try {
      await saveEmailSettingsToPg(this.settings);
      console.log('✅ Successfully saved email settings directly to PostgreSQL.');
    } catch (err) {
      console.error('Failed to persist email settings to PostgreSQL:', err);
    }

    return this.getSettings();
  }

  public async testConnection(): Promise<EmailSendResult> {
    if (!this.transporter) {
      this.initTransporter();
    }
    if (!this.transporter) {
      return { success: false, error: 'Transporter not initialized' };
    }

    try {
      await this.transporter.verify();
      return { success: true };
    } catch (err: any) {
      console.error('[EmailService] SMTP Connection test failed:', err);
      return {
        success: false,
        error: err.message || 'SMTP Relay host unreachable or refused connection'
      };
    }
  }

  public async sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
    if (!this.transporter) {
      this.initTransporter();
    }

    if (!this.transporter) {
      return { success: false, error: 'Transporter unavailable' };
    }

    const rawRecipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;
    const formattedRecipients = rawRecipients
      .split(/[,;]+/)
      .map(e => e.trim())
      .filter(e => e.length > 0 && e.includes('@'))
      .join(', ');

    if (!formattedRecipients) {
      return { success: false, error: 'No valid recipient email address provided' };
    }

    try {
      const mailOptions = {
        from: `"${this.settings.FromName}" <${this.settings.FromAddress}>`,
        to: formattedRecipients,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]+>/g, '') // plain text fallback
      };

      console.log(`[EmailService] Attempting to send email [${options.subject}] to: ${formattedRecipients}`);
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`[EmailService] Email sent successfully to [${formattedRecipients}]. MessageID: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId
      };
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to dispatch email via SMTP relay';
      console.error(`[EmailService] Failed to send email [${options.subject}] to ${formattedRecipients}:`, errorMsg);

      if (this.settings.FallbackAdminEmail && this.settings.FallbackAdminEmail.trim() && !options.subject.includes('[ESCALATION ALERT]')) {
        this.triggerEscalationAlert(options, formattedRecipients, errorMsg).catch(escErr => {
          console.error('[EmailService] Failed to dispatch escalation alert:', escErr);
        });
      }

      return {
        success: false,
        error: errorMsg
      };
    }
  }

  private async triggerEscalationAlert(originalOptions: SendEmailOptions, originalRecipients: string, failureReason: string) {
    const fallbackTo = this.settings.FallbackAdminEmail!;
    console.warn(`[EmailService] Triggering Fallback Escalation Alert to ${fallbackTo} for failed email: [${originalOptions.subject}]`);
    
    const html = `
      <div style="font-family: Arial, sans-serif; border: 2px solid #dc2626; border-radius: 6px; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h3 style="color: #dc2626; margin-top: 0;">⚠️ Tanaka VMS Email Delivery Escalation Alert</h3>
        <p>An automated notification failed to deliver to its intended primary recipient(s).</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px; margin: 15px 0;">
          <p style="margin: 0 0 6px 0;"><strong>Original Subject:</strong> ${originalOptions.subject}</p>
          <p style="margin: 0 0 6px 0;"><strong>Intended Recipients:</strong> ${originalRecipients}</p>
          <p style="margin: 0;"><strong>Error Reason:</strong> ${failureReason}</p>
        </div>
        <p style="font-size: 13px; color: #64748b;">Please inspect your SMTP server settings or verify the recipient email address in System Administration.</p>
      </div>
    `;

    await this.sendAndLogEmail({
      to: fallbackTo,
      subject: `[ESCALATION ALERT] Delivery Failure: ${originalOptions.subject}`,
      html,
      emailType: 'ESCALATION_ALERT'
    });
  }

  public async sendAndLogEmail(options: SendAndLogEmailOptions): Promise<EmailSendResult> {
    const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;
    const result = await this.sendEmail(options);

    try {
      const logEntry: EmailLogEntry = {
        id: `elog-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        requestId: options.requestId || null,
        emailType: options.emailType,
        recipient: recipients,
        subject: options.subject,
        status: result.success ? 'Sent' : 'Failed',
        errorMessage: result.error || null,
        createdDate: new Date().toISOString().replace('T', ' ').substring(0, 19)
      };

      if (!db.emailLogs) {
        db.emailLogs = [];
      }
      db.emailLogs.unshift(logEntry);

      // Save directly to PostgreSQL
      await saveEmailLogToPg(logEntry);
    } catch (logErr) {
      console.error('[EmailService] Failed to save EmailLog record to PostgreSQL:', logErr);
    }

    return result;
  }
}

// Export singleton instance as default dependency
export const emailService: IEmailService = new EmailService();
