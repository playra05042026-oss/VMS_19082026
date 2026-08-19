import pg from 'pg';
import { db } from './db';
import {
  Company,
  Visitor,
  Contractor,
  User,
  Department,
  MeetingVenue,
  VisitorCategory,
  ContractorCategory,
  BlacklistEntry,
  DbPoolMetrics,
  AuditLog,
  LoginHistory,
  EmailLogEntry,
  SystemSettings,
  PasswordPolicy
} from '../types';
import { EmailSettings } from './emailService';

const { Pool } = pg;

// Connection setup with environment variables or default fallbacks for PostgreSQL server at 157.9.183.151
const connectionString = process.env.DATABASE_URL;

export const pool = new Pool(
  connectionString
    ? { connectionString }
    : {
        host: process.env.PGHOST || '157.9.183.151',
        port: parseInt(process.env.PGPORT || '5432', 10),
        user: process.env.PGUSER || 'vms_user',
        password: process.env.PGPASSWORD || 'Anni1234',
        database: process.env.PGDATABASE || 'tanaka_vms',
        connectionTimeoutMillis: 5000
      }
);

pool.on('error', (err) => {
  console.warn('PostgreSQL Pool idle client error:', err.message);
  isPgConnected = false;
});

let isPgConnected = false;

export function getIsPgConnected() {
  return isPgConnected;
}

// Safe formatting helpers for dates from PostgreSQL that prevent UTC day-shifting
function formatPgDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') {
    // If it already contains YYYY-MM-DD, extract the date portion directly
    const match = val.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  if (val instanceof Date) {
    const yyyy = val.getFullYear();
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const dd = String(val.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return String(val);
  }
}

function formatPgTimestamp(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') {
    // If string already has YYYY-MM-DD HH:mm:ss, normalize space/T
    const match = val.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2}:\d{2})/);
    if (match) return `${match[1]} ${match[2]}`;
    const matchShort = val.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/);
    if (matchShort) return `${matchShort[1]} ${matchShort[2]}:00`;
  }
  if (val instanceof Date) {
    const yyyy = val.getFullYear();
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const dd = String(val.getDate()).padStart(2, '0');
    const hh = String(val.getHours()).padStart(2, '0');
    const min = String(val.getMinutes()).padStart(2, '0');
    const ss = String(val.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  }
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  } catch {
    return String(val);
  }
}

// =============================================================================
// ROW MAPPERS
// =============================================================================

function mapRowToCompany(row: any): Company {
  return {
    id: row.id,
    name: row.name,
    registrationNumber: row.registration_number || '',
    companyType: row.company_type || 'VISITOR_ORGANIZATION',
    contactPhone: row.contact_phone || '',
    contactEmail: row.contact_email || '',
    address: row.address || '',
    isActive: row.is_active !== false,
    departmentId: row.department_id || null,
    departmentName: row.department_name || null,
    registeredByUserId: row.registered_by_user_id || undefined,
    registeredByUserName: row.registered_by_user_name || undefined,
    createdAt: formatPgDate(row.created_at) || formatPgDate(new Date())
  };
}

function mapRowToVisitor(row: any): Visitor {
  return {
    id: row.id,
    registrationNo: row.registration_no,
    fullName: row.full_name,
    idNumber: row.id_number,
    phone: row.phone || '',
    email: row.email || '',
    companyName: row.company_name || '',
    visitorCategoryId: row.visitor_category_id || '',
    visitorCategoryName: row.visitor_category_name || '',
    purpose: row.purpose || '',
    hostUserId: row.host_user_id || '',
    hostUserName: row.host_user_name || '',
    hostDepartment: row.host_department || '',
    meetingVenueId: row.meeting_venue_id || '',
    meetingVenueName: row.meeting_venue_name || '',
    scheduledDate: formatPgDate(row.scheduled_date),
    scheduledEndDate: row.scheduled_end_date ? formatPgDate(row.scheduled_end_date) : undefined,
    scheduledStartTime: row.scheduled_start_time || '09:00',
    scheduledEndTime: row.scheduled_end_time || '17:00',
    status: row.status || 'PENDING_APPROVAL',
    approvalStatus: row.approval_status || 'PENDING',
    isConditionalApproval: row.is_conditional_approval || false,
    approvalRemark: row.approval_remark || undefined,
    approvedVenueId: row.approved_venue_id || undefined,
    approvedVenueName: row.approved_venue_name || undefined,
    approvedByUserId: row.approved_by_user_id || undefined,
    approvedByUserName: row.approved_by_user_name || undefined,
    approvedAt: formatPgTimestamp(row.approved_at) || undefined,
    rejectionReason: row.rejection_reason || undefined,
    passBadgeNumber: row.pass_badge_number || undefined,
    checkInTime: formatPgTimestamp(row.check_in_time) || undefined,
    checkOutTime: formatPgTimestamp(row.check_out_time) || undefined,
    checkInSecurityUserId: row.check_in_security_user_id || undefined,
    checkInSecurityUserName: row.check_in_security_user_name || undefined,
    checkOutSecurityUserId: row.check_out_security_user_id || undefined,
    checkOutSecurityUserName: row.check_out_security_user_name || undefined,
    vehicleNumber: row.vehicle_number || undefined,
    itemsCarried: row.items_carried || undefined,
    isBlacklistedAtRegistration: row.is_blacklisted_at_registration || false,
    notes: row.notes || undefined,
    exceededMinutes: row.exceeded_minutes || 0,
    overstayNotes: row.overstay_notes || undefined,
    createdAt: formatPgTimestamp(row.created_at) || formatPgTimestamp(new Date())
  };
}

function mapRowToContractor(row: any): Contractor {
  return {
    id: row.id,
    registrationNo: row.registration_no,
    fullName: row.full_name,
    idNumber: row.id_number,
    phone: row.phone || '',
    email: row.email || '',
    companyName: row.company_name || '',
    workOrderNo: row.work_order_no || '',
    contractorCategoryId: row.contractor_category_id || '',
    contractorCategoryName: row.contractor_category_name || '',
    workScope: row.work_scope || '',
    hostUserId: row.host_user_id || '',
    hostUserName: row.host_user_name || '',
    hostDepartment: row.host_department || '',
    locationVenueId: row.location_venue_id || '',
    locationVenueName: row.location_venue_name || '',
    startDate: formatPgDate(row.start_date),
    endDate: formatPgDate(row.end_date),
    startTime: row.start_time || '08:00',
    endTime: row.end_time || '17:00',
    status: row.status || 'PENDING_APPROVAL',
    approvalStatus: row.approval_status || 'PENDING',
    isConditionalApproval: row.is_conditional_approval || false,
    approvalRemark: row.approval_remark || undefined,
    approvedVenueId: row.approved_venue_id || undefined,
    approvedVenueName: row.approved_venue_name || undefined,
    approvedByUserId: row.approved_by_user_id || undefined,
    approvedByUserName: row.approved_by_user_name || undefined,
    approvedAt: formatPgTimestamp(row.approved_at) || undefined,
    rejectionReason: row.rejection_reason || undefined,
    safetyInductionVerified: row.safety_induction_verified || false,
    passBadgeNumber: row.pass_badge_number || undefined,
    checkInTime: formatPgTimestamp(row.check_in_time) || undefined,
    checkOutTime: formatPgTimestamp(row.check_out_time) || undefined,
    checkInSecurityUserId: row.check_in_security_user_id || undefined,
    checkInSecurityUserName: row.check_in_security_user_name || undefined,
    checkOutSecurityUserId: row.check_out_security_user_id || undefined,
    checkOutSecurityUserName: row.check_out_security_user_name || undefined,
    vehicleNumber: row.vehicle_number || undefined,
    toolsEquipmentCarried: row.tools_equipment_carried || undefined,
    isForeignWorker: row.is_foreign_worker || false,
    passportNumber: row.passport_number || undefined,
    nationality: row.nationality || undefined,
    permitNumber: row.permit_number || undefined,
    permitExpiryDate: formatPgDate(row.permit_expiry_date) || undefined,
    permitStatus: row.permit_status || 'NOT_APPLICABLE',
    createdAt: formatPgTimestamp(row.created_at) || formatPgTimestamp(new Date())
  };
}

function mapRowToUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    departmentId: row.department_id || undefined,
    departmentName: row.department_name || undefined,
    companyId: row.company_id || undefined,
    isActive: row.is_active !== false,
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : undefined,
    badgeId: row.badge_id || undefined,
    phone: row.phone || undefined,
    password: row.password || undefined,
    mustChangePassword: row.must_change_password || false
  };
}

function mapRowToBlacklist(row: any): BlacklistEntry {
  return {
    id: row.id,
    fullName: row.full_name,
    idNumber: row.id_number,
    phone: row.phone || null,
    email: row.email || null,
    type: row.type || 'BLACKLIST',
    reason: row.reason || '',
    severity: row.severity || 'HIGH',
    blockedByUserId: row.blocked_by_user_id || 'system',
    blockedByUserName: row.blocked_by_user_name || 'System Administrator',
    dateAdded: row.date_added ? new Date(row.date_added).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    isActive: row.is_active !== false
  };
}

function mapRowToDepartment(row: any): Department {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    headOfDepartment: row.head_of_department || '',
    floorLevel: row.floor_level || '',
    isActive: row.is_active !== false
  };
}

function mapRowToMeetingVenue(row: any): MeetingVenue {
  return {
    id: row.id,
    name: row.name,
    buildingBlock: row.building_block || 'Tower A',
    floorLevel: row.floor_level || 'Level 1',
    capacity: row.capacity || 10,
    isActive: row.is_active !== false
  };
}

function mapRowToVisitorCategory(row: any): VisitorCategory {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    requiresEscort: !!row.requires_escort,
    isActive: row.is_active !== false
  };
}

function mapRowToContractorCategory(row: any): ContractorCategory {
  return {
    id: row.id,
    name: row.name,
    safetyInductionRequired: row.safety_induction_required !== false,
    isActive: row.is_active !== false
  };
}

function mapRowToEmailSettings(row: any): EmailSettings {
  return {
    SmtpServer: row.smtp_server || '157.9.183.242',
    SmtpPort: parseInt(row.smtp_port || '25', 10),
    FromAddress: row.from_address || 'Administrator@tanaka.com.my',
    FromName: row.from_name || 'Tanaka Visitor Management System',
    MdEmail: row.md_email || 'luqman@tanaka.com.my',
    ItEmail: row.it_email || '',
    ProductionManagerEmail: row.production_manager_email || 'nakamu@ml.tanaka.co.jp, luqman@tanaka.com.my',
    FallbackAdminEmail: row.fallback_admin_email || 'luqman@tanaka.com.my',
    Secure: !!row.secure,
    EnableMdNotifications: row.enable_md_notifications !== false,
    EnableProdManagerNotifications: row.enable_prod_manager_notifications !== false,
    EnableNewUserNotifications: row.enable_new_user_notifications !== false,
    EnableCheckInNotifications: row.enable_check_in_notifications !== false,
    BackupApproverEmail: row.backup_approver_email || '',
    BackupApproverName: row.backup_approver_name || '',
    BackupApproverUserId: row.backup_approver_user_id || '',
    EnableDelegation: !!row.enable_delegation,
    DelegationStartDate: row.delegation_start_date || '',
    DelegationEndDate: row.delegation_end_date || '',
    DelegationRoutingMode: row.delegation_routing_mode || 'BOTH',
    DelegationReason: row.delegation_reason || ''
  };
}

function mapRowToSystemSettings(row: any): SystemSettings {
  return {
    companyName: row.company_name || 'Enterprise Headquarters Corp',
    passPrefixVisitor: row.pass_prefix_visitor || 'V-BADGE-',
    passPrefixContractor: row.pass_prefix_contractor || 'C-BADGE-',
    maxDailyVisitors: parseInt(row.max_daily_visitors || '150', 10),
    autoCheckOutGraceHours: parseInt(row.auto_check_out_grace_hours || '12', 10),
    requireIdVerification: row.require_id_verification !== false,
    requireVehicleRecord: row.require_vehicle_record !== false,
    allowSelfCheckout: !!row.allow_self_checkout,
    onPremiseNoticeText: row.on_premise_notice_text || 'All visitors must display their physical badge visibly at all times.'
  };
}

function mapRowToPasswordPolicy(row: any): PasswordPolicy {
  return {
    minLength: parseInt(row.min_length || '10', 10),
    requireUppercase: row.require_uppercase !== false,
    requireNumbers: row.require_numbers !== false,
    requireSpecialChar: row.require_special_char !== false,
    expirationDays: parseInt(row.expiration_days || '90', 10),
    maxFailedAttempts: parseInt(row.max_failed_attempts || '5', 10)
  };
}

function mapRowToEmailLog(row: any): EmailLogEntry {
  return {
    id: row.id,
    requestId: row.request_id || null,
    emailType: row.email_type,
    recipient: row.recipient,
    subject: row.subject,
    status: row.status,
    errorMessage: row.error_message || null,
    createdDate: row.created_date ? new Date(row.created_date).toISOString().replace('T', ' ').substring(0, 19) : new Date().toISOString()
  };
}

function mapRowToLoginHistory(row: any): LoginHistory {
  return {
    id: row.id,
    timestamp: row.timestamp ? new Date(row.timestamp).toISOString().replace('T', ' ').substring(0, 19) : new Date().toISOString(),
    userId: row.user_id,
    userName: row.user_name,
    userRole: row.user_role,
    ipAddress: row.ip_address || '192.168.1.1',
    status: row.status || 'SUCCESS',
    userAgent: row.user_agent || 'VMS Portal'
  };
}

// =============================================================================
// DATABASE INITIALIZATION & SCHEMA SETUP
// =============================================================================

export async function initPostgres(): Promise<boolean> {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database at', process.env.PGHOST || '157.9.183.151');
    isPgConnected = true;

    // 1. Blacklist Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS blacklist_entries (
        id VARCHAR(255) PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        id_number VARCHAR(255) NOT NULL,
        phone VARCHAR(255),
        email VARCHAR(255),
        type VARCHAR(50) DEFAULT 'BLACKLIST',
        reason TEXT NOT NULL,
        severity VARCHAR(50) DEFAULT 'HIGH',
        blocked_by_user_id VARCHAR(255),
        blocked_by_user_name VARCHAR(255),
        date_added TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    // 2. Departments Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id VARCHAR(255) PRIMARY KEY,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        head_of_department VARCHAR(255),
        floor_level VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    // 3. Meeting Venues Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS meeting_venues (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        building_block VARCHAR(255),
        floor_level VARCHAR(255),
        capacity INTEGER DEFAULT 10,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    // 4. Visitor Categories Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS visitor_categories (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        requires_escort BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    // 5. Contractor Categories Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS contractor_categories (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        safety_induction_required BOOLEAN DEFAULT TRUE,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    // 6. Companies Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        registration_number VARCHAR(255),
        company_type VARCHAR(50) NOT NULL DEFAULT 'VISITOR_ORGANIZATION',
        contact_phone VARCHAR(255),
        contact_email VARCHAR(255),
        address TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        department_id VARCHAR(255),
        department_name VARCHAR(255),
        registered_by_user_id VARCHAR(255),
        registered_by_user_name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        department_id VARCHAR(255),
        department_name VARCHAR(255),
        company_id VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        last_login_at TIMESTAMP WITH TIME ZONE,
        badge_id VARCHAR(255),
        phone VARCHAR(255),
        password VARCHAR(255),
        must_change_password BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 8. Visitors Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS visitors (
        id VARCHAR(255) PRIMARY KEY,
        registration_no VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        id_number VARCHAR(255) NOT NULL,
        phone VARCHAR(255),
        email VARCHAR(255),
        company_name VARCHAR(255),
        visitor_category_id VARCHAR(255),
        visitor_category_name VARCHAR(255),
        purpose TEXT,
        host_user_id VARCHAR(255),
        host_user_name VARCHAR(255),
        host_department VARCHAR(255),
        meeting_venue_id VARCHAR(255),
        meeting_venue_name VARCHAR(255),
        scheduled_date DATE,
        scheduled_end_date DATE,
        scheduled_start_time VARCHAR(50),
        scheduled_end_time VARCHAR(50),
        status VARCHAR(50) DEFAULT 'PENDING_APPROVAL',
        approval_status VARCHAR(50) DEFAULT 'PENDING',
        is_conditional_approval BOOLEAN DEFAULT FALSE,
        approval_remark TEXT,
        approved_venue_id VARCHAR(255),
        approved_venue_name VARCHAR(255),
        approved_by_user_id VARCHAR(255),
        approved_by_user_name VARCHAR(255),
        approved_at TIMESTAMP WITH TIME ZONE,
        rejection_reason TEXT,
        pass_badge_number VARCHAR(255),
        check_in_time TIMESTAMP WITH TIME ZONE,
        check_out_time TIMESTAMP WITH TIME ZONE,
        check_in_security_user_id VARCHAR(255),
        check_in_security_user_name VARCHAR(255),
        check_out_security_user_id VARCHAR(255),
        check_out_security_user_name VARCHAR(255),
        vehicle_number VARCHAR(255),
        items_carried TEXT,
        is_blacklisted_at_registration BOOLEAN DEFAULT FALSE,
        notes TEXT,
        exceeded_minutes INTEGER DEFAULT 0,
        overstay_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure scheduled_end_date column exists if table was created previously
    await client.query(`
      ALTER TABLE visitors ADD COLUMN IF NOT EXISTS scheduled_end_date DATE;
    `).catch(() => {});

    // 9. Contractors Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS contractors (
        id VARCHAR(255) PRIMARY KEY,
        registration_no VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        id_number VARCHAR(255) NOT NULL,
        phone VARCHAR(255),
        email VARCHAR(255),
        company_name VARCHAR(255),
        work_order_no VARCHAR(255),
        contractor_category_id VARCHAR(255),
        contractor_category_name VARCHAR(255),
        work_scope TEXT,
        host_user_id VARCHAR(255),
        host_user_name VARCHAR(255),
        host_department VARCHAR(255),
        location_venue_id VARCHAR(255),
        location_venue_name VARCHAR(255),
        start_date DATE,
        end_date DATE,
        start_time VARCHAR(50),
        end_time VARCHAR(50),
        status VARCHAR(50) DEFAULT 'PENDING_APPROVAL',
        approval_status VARCHAR(50) DEFAULT 'PENDING',
        is_conditional_approval BOOLEAN DEFAULT FALSE,
        approval_remark TEXT,
        approved_venue_id VARCHAR(255),
        approved_venue_name VARCHAR(255),
        approved_by_user_id VARCHAR(255),
        approved_by_user_name VARCHAR(255),
        approved_at TIMESTAMP WITH TIME ZONE,
        rejection_reason TEXT,
        safety_induction_verified BOOLEAN DEFAULT FALSE,
        pass_badge_number VARCHAR(255),
        check_in_time TIMESTAMP WITH TIME ZONE,
        check_out_time TIMESTAMP WITH TIME ZONE,
        check_in_security_user_id VARCHAR(255),
        check_in_security_user_name VARCHAR(255),
        check_out_security_user_id VARCHAR(255),
        check_out_security_user_name VARCHAR(255),
        vehicle_number VARCHAR(255),
        tools_equipment_carried TEXT,
        is_foreign_worker BOOLEAN DEFAULT FALSE,
        passport_number VARCHAR(255),
        nationality VARCHAR(255),
        permit_number VARCHAR(255),
        permit_expiry_date DATE,
        permit_status VARCHAR(50) DEFAULT 'NOT_APPLICABLE',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 10. Audit Logs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(255) PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        user_id VARCHAR(255),
        user_name VARCHAR(255),
        user_role VARCHAR(50),
        action VARCHAR(255) NOT NULL,
        details TEXT,
        ip_address VARCHAR(100),
        computer_name VARCHAR(255),
        category VARCHAR(50) DEFAULT 'System'
      )
    `);

    // 11. System Settings Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
        company_name VARCHAR(255) NOT NULL,
        pass_prefix_visitor VARCHAR(50) NOT NULL,
        pass_prefix_contractor VARCHAR(50) NOT NULL,
        max_daily_visitors INTEGER NOT NULL,
        auto_check_out_grace_hours INTEGER NOT NULL,
        require_id_verification BOOLEAN NOT NULL,
        require_vehicle_record BOOLEAN NOT NULL,
        allow_self_checkout BOOLEAN NOT NULL,
        on_premise_notice_text TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 12. Email Settings Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_settings (
        id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
        smtp_server VARCHAR(255) NOT NULL,
        smtp_port INTEGER NOT NULL,
        from_address VARCHAR(255) NOT NULL,
        from_name VARCHAR(255) NOT NULL,
        md_email VARCHAR(255) NOT NULL,
        it_email VARCHAR(255),
        production_manager_email VARCHAR(255),
        fallback_admin_email VARCHAR(255),
        secure BOOLEAN DEFAULT FALSE,
        enable_md_notifications BOOLEAN DEFAULT TRUE,
        enable_prod_manager_notifications BOOLEAN DEFAULT TRUE,
        enable_new_user_notifications BOOLEAN DEFAULT TRUE,
        enable_check_in_notifications BOOLEAN DEFAULT TRUE,
        backup_approver_email VARCHAR(255),
        backup_approver_name VARCHAR(255),
        backup_approver_user_id VARCHAR(255),
        enable_delegation BOOLEAN DEFAULT FALSE,
        delegation_start_date VARCHAR(50),
        delegation_end_date VARCHAR(50),
        delegation_routing_mode VARCHAR(50) DEFAULT 'BOTH',
        delegation_reason TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 13. Password Policy Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_policy (
        id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
        min_length INTEGER NOT NULL,
        require_uppercase BOOLEAN NOT NULL,
        require_numbers BOOLEAN NOT NULL,
        require_special_char BOOLEAN NOT NULL,
        expiration_days INTEGER NOT NULL,
        max_failed_attempts INTEGER NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 14. Email Logs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id VARCHAR(255) PRIMARY KEY,
        request_id VARCHAR(255),
        email_type VARCHAR(100) NOT NULL,
        recipient TEXT NOT NULL,
        subject TEXT NOT NULL,
        status VARCHAR(50) NOT NULL,
        error_message TEXT,
        created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 15. Login History Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS login_history (
        id VARCHAR(255) PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        user_id VARCHAR(255),
        user_name VARCHAR(255),
        user_role VARCHAR(50),
        ip_address VARCHAR(100),
        status VARCHAR(50),
        user_agent TEXT
      )
    `);

    // Synchronize initial data from PostgreSQL
    await syncAllFromPg(client);

    client.release();
    return true;
  } catch (err) {
    console.error('⚠️ PostgreSQL database connection/initialization error:', (err as Error).message);
    isPgConnected = false;
    return false;
  }
}

async function syncAllFromPg(client: any) {
  // Departments
  const deptRes = await client.query('SELECT * FROM departments ORDER BY code ASC');
  if (deptRes.rows.length > 0) {
    db.departments = deptRes.rows.map(mapRowToDepartment);
  } else {
    for (const d of db.departments) {
      await saveDepartmentToPg(d);
    }
  }

  // Companies
  const compRes = await client.query('SELECT * FROM companies ORDER BY created_at DESC');
  if (compRes.rows.length > 0) {
    db.companies = compRes.rows.map(mapRowToCompany);
  } else {
    for (const c of db.companies) {
      await saveCompanyToPg(c);
    }
  }

  // Users
  const userRes = await client.query('SELECT * FROM users ORDER BY created_at ASC');
  if (userRes.rows.length > 0) {
    db.users = userRes.rows.map(mapRowToUser);
  } else {
    for (const u of db.users) {
      await saveUserToPg(u);
    }
  }

  // Visitors
  const visRes = await client.query('SELECT * FROM visitors ORDER BY created_at DESC');
  if (visRes.rows.length > 0) {
    db.visitors = visRes.rows.map(mapRowToVisitor);
  }

  // Contractors
  const conRes = await client.query('SELECT * FROM contractors ORDER BY created_at DESC');
  if (conRes.rows.length > 0) {
    db.contractors = conRes.rows.map(mapRowToContractor);
  }

  // Blacklist
  const blRes = await client.query('SELECT * FROM blacklist_entries ORDER BY date_added DESC');
  if (blRes.rows.length > 0) {
    db.blacklist = blRes.rows.map(mapRowToBlacklist);
  } else {
    for (const b of db.blacklist) {
      await saveBlacklistEntryToPg(b);
    }
  }

  // System Settings
  const sysRes = await client.query('SELECT * FROM system_settings WHERE id = $1', ['default']);
  if (sysRes.rows.length > 0) {
    db.settings = mapRowToSystemSettings(sysRes.rows[0]);
  } else {
    await saveSystemSettingsToPg(db.settings);
  }

  // Password Policy
  const passRes = await client.query('SELECT * FROM password_policy WHERE id = $1', ['default']);
  if (passRes.rows.length > 0) {
    db.passwordPolicy = mapRowToPasswordPolicy(passRes.rows[0]);
  } else {
    await savePasswordPolicyToPg(db.passwordPolicy);
  }

  // Email Logs
  const emailLogRes = await client.query('SELECT * FROM email_logs ORDER BY created_date DESC LIMIT 500');
  if (emailLogRes.rows.length > 0) {
    db.emailLogs = emailLogRes.rows.map(mapRowToEmailLog);
  }

  // Login History
  const loginRes = await client.query('SELECT * FROM login_history ORDER BY timestamp DESC LIMIT 500');
  if (loginRes.rows.length > 0) {
    db.loginHistory = loginRes.rows.map(mapRowToLoginHistory);
  }

  // Audit Logs
  const auditRes = await client.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 1000');
  if (auditRes.rows.length > 0) {
    db.auditLogs = auditRes.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp ? new Date(row.timestamp).toISOString().replace('T', ' ').substring(0, 19) : new Date().toISOString(),
      userId: row.user_id,
      userName: row.user_name,
      userRole: row.user_role,
      action: row.action,
      details: row.details,
      ipAddress: row.ip_address,
      computerName: row.computer_name,
      category: row.category || 'System'
    }));
  }
}

// =============================================================================
// DATABASE CRUD HELPERS (ALL DATA SAVED TO POSTGRESQL)
// =============================================================================

export async function saveCompanyToPg(comp: Company): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    const query = `
      INSERT INTO companies (
        id, name, registration_number, company_type, contact_phone, contact_email,
        address, is_active, department_id, department_name, registered_by_user_id,
        registered_by_user_name, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        registration_number = EXCLUDED.registration_number,
        company_type = EXCLUDED.company_type,
        contact_phone = EXCLUDED.contact_phone,
        contact_email = EXCLUDED.contact_email,
        address = EXCLUDED.address,
        is_active = EXCLUDED.is_active,
        department_id = EXCLUDED.department_id,
        department_name = EXCLUDED.department_name,
        registered_by_user_id = EXCLUDED.registered_by_user_id,
        registered_by_user_name = EXCLUDED.registered_by_user_name;
    `;
    const values = [
      comp.id,
      comp.name,
      comp.registrationNumber || null,
      comp.companyType,
      comp.contactPhone || null,
      comp.contactEmail || null,
      comp.address || null,
      comp.isActive !== false,
      comp.departmentId || null,
      comp.departmentName || null,
      comp.registeredByUserId || null,
      comp.registeredByUserName || null,
      comp.createdAt ? new Date(comp.createdAt) : new Date()
    ];
    await pool.query(query, values);
    return true;
  } catch (err) {
    console.error('Failed to save company to PostgreSQL:', err);
    return false;
  }
}

export async function deleteCompanyFromPg(id: string): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    await pool.query('DELETE FROM companies WHERE id = $1', [id]);
    return true;
  } catch (err) {
    console.error('Failed to delete company from PostgreSQL:', err);
    return false;
  }
}

export async function fetchCompaniesFromPg(): Promise<Company[] | null> {
  if (!isPgConnected) return null;
  try {
    const res = await pool.query('SELECT * FROM companies ORDER BY created_at DESC');
    const companies = res.rows.map(mapRowToCompany);
    db.companies = companies;
    return companies;
  } catch (err) {
    console.error('Failed to fetch companies from PostgreSQL:', err);
    return null;
  }
}

export async function saveVisitorToPg(visitor: Visitor): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    const query = `
      INSERT INTO visitors (
        id, registration_no, full_name, id_number, phone, email, company_name,
        visitor_category_id, visitor_category_name, purpose, host_user_id, host_user_name,
        host_department, meeting_venue_id, meeting_venue_name, scheduled_date, scheduled_end_date,
        scheduled_start_time, scheduled_end_time, status, approval_status,
        is_conditional_approval, approval_remark, approved_venue_id, approved_venue_name,
        approved_by_user_id, approved_by_user_name, approved_at, rejection_reason,
        pass_badge_number, check_in_time, check_out_time, check_in_security_user_id,
        check_in_security_user_name, check_out_security_user_id, check_out_security_user_name,
        vehicle_number, items_carried, is_blacklisted_at_registration, notes,
        exceeded_minutes, overstay_notes, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43
      )
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        company_name = EXCLUDED.company_name,
        visitor_category_id = EXCLUDED.visitor_category_id,
        visitor_category_name = EXCLUDED.visitor_category_name,
        purpose = EXCLUDED.purpose,
        host_user_id = EXCLUDED.host_user_id,
        host_user_name = EXCLUDED.host_user_name,
        host_department = EXCLUDED.host_department,
        meeting_venue_id = EXCLUDED.meeting_venue_id,
        meeting_venue_name = EXCLUDED.meeting_venue_name,
        scheduled_date = EXCLUDED.scheduled_date,
        scheduled_end_date = EXCLUDED.scheduled_end_date,
        scheduled_start_time = EXCLUDED.scheduled_start_time,
        scheduled_end_time = EXCLUDED.scheduled_end_time,
        status = EXCLUDED.status,
        approval_status = EXCLUDED.approval_status,
        is_conditional_approval = EXCLUDED.is_conditional_approval,
        approval_remark = EXCLUDED.approval_remark,
        approved_venue_id = EXCLUDED.approved_venue_id,
        approved_venue_name = EXCLUDED.approved_venue_name,
        approved_by_user_id = EXCLUDED.approved_by_user_id,
        approved_by_user_name = EXCLUDED.approved_by_user_name,
        approved_at = EXCLUDED.approved_at,
        rejection_reason = EXCLUDED.rejection_reason,
        pass_badge_number = EXCLUDED.pass_badge_number,
        check_in_time = EXCLUDED.check_in_time,
        check_out_time = EXCLUDED.check_out_time,
        check_in_security_user_id = EXCLUDED.check_in_security_user_id,
        check_in_security_user_name = EXCLUDED.check_in_security_user_name,
        check_out_security_user_id = EXCLUDED.check_out_security_user_id,
        check_out_security_user_name = EXCLUDED.check_out_security_user_name,
        vehicle_number = EXCLUDED.vehicle_number,
        items_carried = EXCLUDED.items_carried,
        notes = EXCLUDED.notes,
        exceeded_minutes = EXCLUDED.exceeded_minutes,
        overstay_notes = EXCLUDED.overstay_notes;
    `;
    const values = [
      visitor.id,
      visitor.registrationNo,
      visitor.fullName,
      visitor.idNumber,
      visitor.phone || null,
      visitor.email || null,
      visitor.companyName || null,
      visitor.visitorCategoryId || null,
      visitor.visitorCategoryName || null,
      visitor.purpose || null,
      visitor.hostUserId || null,
      visitor.hostUserName || null,
      visitor.hostDepartment || null,
      visitor.meetingVenueId || null,
      visitor.meetingVenueName || null,
      visitor.scheduledDate ? new Date(visitor.scheduledDate) : null,
      visitor.scheduledEndDate ? new Date(visitor.scheduledEndDate) : (visitor.scheduledDate ? new Date(visitor.scheduledDate) : null),
      visitor.scheduledStartTime || '09:00',
      visitor.scheduledEndTime || '17:00',
      visitor.status || 'PENDING_APPROVAL',
      visitor.approvalStatus || 'PENDING',
      !!visitor.isConditionalApproval,
      visitor.approvalRemark || null,
      visitor.approvedVenueId || null,
      visitor.approvedVenueName || null,
      visitor.approvedByUserId || null,
      visitor.approvedByUserName || null,
      visitor.approvedAt ? new Date(visitor.approvedAt) : null,
      visitor.rejectionReason || null,
      visitor.passBadgeNumber || null,
      visitor.checkInTime ? new Date(visitor.checkInTime) : null,
      visitor.checkOutTime ? new Date(visitor.checkOutTime) : null,
      visitor.checkInSecurityUserId || null,
      visitor.checkInSecurityUserName || null,
      visitor.checkOutSecurityUserId || null,
      visitor.checkOutSecurityUserName || null,
      visitor.vehicleNumber || null,
      visitor.itemsCarried || null,
      !!visitor.isBlacklistedAtRegistration,
      visitor.notes || null,
      visitor.exceededMinutes || 0,
      visitor.overstayNotes || null,
      visitor.createdAt ? new Date(visitor.createdAt) : new Date()
    ];
    await pool.query(query, values);
    return true;
  } catch (err) {
    console.error('Failed to save visitor to PostgreSQL:', err);
    return false;
  }
}

export async function deleteVisitorFromPg(id: string): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    await pool.query('DELETE FROM visitors WHERE id = $1', [id]);
    return true;
  } catch (err) {
    console.error('Failed to delete visitor from PostgreSQL:', err);
    return false;
  }
}

export async function fetchVisitorsFromPg(): Promise<Visitor[] | null> {
  if (!isPgConnected) return null;
  try {
    const res = await pool.query('SELECT * FROM visitors ORDER BY created_at DESC');
    const visitors = res.rows.map(mapRowToVisitor);
    db.visitors = visitors;
    return visitors;
  } catch (err) {
    console.error('Failed to fetch visitors from PostgreSQL:', err);
    return null;
  }
}

export async function saveContractorToPg(contractor: Contractor): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    const query = `
      INSERT INTO contractors (
        id, registration_no, full_name, id_number, phone, email, company_name,
        work_order_no, contractor_category_id, contractor_category_name, work_scope,
        host_user_id, host_user_name, host_department, location_venue_id, location_venue_name,
        start_date, end_date, start_time, end_time, status, approval_status,
        is_conditional_approval, approval_remark, approved_venue_id, approved_venue_name,
        approved_by_user_id, approved_by_user_name, approved_at, rejection_reason,
        safety_induction_verified, pass_badge_number, check_in_time, check_out_time,
        check_in_security_user_id, check_in_security_user_name, check_out_security_user_id,
        check_out_security_user_name, vehicle_number, tools_equipment_carried,
        is_foreign_worker, passport_number, nationality, permit_number,
        permit_expiry_date, permit_status, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44,
        $45, $46, $47
      )
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        company_name = EXCLUDED.company_name,
        work_order_no = EXCLUDED.work_order_no,
        contractor_category_id = EXCLUDED.contractor_category_id,
        contractor_category_name = EXCLUDED.contractor_category_name,
        work_scope = EXCLUDED.work_scope,
        host_user_id = EXCLUDED.host_user_id,
        host_user_name = EXCLUDED.host_user_name,
        host_department = EXCLUDED.host_department,
        location_venue_id = EXCLUDED.location_venue_id,
        location_venue_name = EXCLUDED.location_venue_name,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        status = EXCLUDED.status,
        approval_status = EXCLUDED.approval_status,
        is_conditional_approval = EXCLUDED.is_conditional_approval,
        approval_remark = EXCLUDED.approval_remark,
        approved_venue_id = EXCLUDED.approved_venue_id,
        approved_venue_name = EXCLUDED.approved_venue_name,
        approved_by_user_id = EXCLUDED.approved_by_user_id,
        approved_by_user_name = EXCLUDED.approved_by_user_name,
        approved_at = EXCLUDED.approved_at,
        rejection_reason = EXCLUDED.rejection_reason,
        safety_induction_verified = EXCLUDED.safety_induction_verified,
        pass_badge_number = EXCLUDED.pass_badge_number,
        check_in_time = EXCLUDED.check_in_time,
        check_out_time = EXCLUDED.check_out_time,
        check_in_security_user_id = EXCLUDED.check_in_security_user_id,
        check_in_security_user_name = EXCLUDED.check_in_security_user_name,
        check_out_security_user_id = EXCLUDED.check_out_security_user_id,
        check_out_security_user_name = EXCLUDED.check_out_security_user_name,
        vehicle_number = EXCLUDED.vehicle_number,
        tools_equipment_carried = EXCLUDED.tools_equipment_carried,
        is_foreign_worker = EXCLUDED.is_foreign_worker,
        passport_number = EXCLUDED.passport_number,
        nationality = EXCLUDED.nationality,
        permit_number = EXCLUDED.permit_number,
        permit_expiry_date = EXCLUDED.permit_expiry_date,
        permit_status = EXCLUDED.permit_status;
    `;
    const values = [
      contractor.id,
      contractor.registrationNo,
      contractor.fullName,
      contractor.idNumber,
      contractor.phone || null,
      contractor.email || null,
      contractor.companyName || null,
      contractor.workOrderNo || null,
      contractor.contractorCategoryId || null,
      contractor.contractorCategoryName || null,
      contractor.workScope || null,
      contractor.hostUserId || null,
      contractor.hostUserName || null,
      contractor.hostDepartment || null,
      contractor.locationVenueId || null,
      contractor.locationVenueName || null,
      contractor.startDate ? new Date(contractor.startDate) : null,
      contractor.endDate ? new Date(contractor.endDate) : null,
      contractor.startTime || '08:00',
      contractor.endTime || '17:00',
      contractor.status || 'PENDING_APPROVAL',
      contractor.approvalStatus || 'PENDING',
      !!contractor.isConditionalApproval,
      contractor.approvalRemark || null,
      contractor.approvedVenueId || null,
      contractor.approvedVenueName || null,
      contractor.approvedByUserId || null,
      contractor.approvedByUserName || null,
      contractor.approvedAt ? new Date(contractor.approvedAt) : null,
      contractor.rejectionReason || null,
      !!contractor.safetyInductionVerified,
      contractor.passBadgeNumber || null,
      contractor.checkInTime ? new Date(contractor.checkInTime) : null,
      contractor.checkOutTime ? new Date(contractor.checkOutTime) : null,
      contractor.checkInSecurityUserId || null,
      contractor.checkInSecurityUserName || null,
      contractor.checkOutSecurityUserId || null,
      contractor.checkOutSecurityUserName || null,
      contractor.vehicleNumber || null,
      contractor.toolsEquipmentCarried || null,
      !!contractor.isForeignWorker,
      contractor.passportNumber || null,
      contractor.nationality || null,
      contractor.permitNumber || null,
      contractor.permitExpiryDate ? new Date(contractor.permitExpiryDate) : null,
      contractor.permitStatus || 'NOT_APPLICABLE',
      contractor.createdAt ? new Date(contractor.createdAt) : new Date()
    ];
    await pool.query(query, values);
    return true;
  } catch (err) {
    console.error('Failed to save contractor to PostgreSQL:', err);
    return false;
  }
}

export async function deleteContractorFromPg(id: string): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    await pool.query('DELETE FROM contractors WHERE id = $1', [id]);
    return true;
  } catch (err) {
    console.error('Failed to delete contractor from PostgreSQL:', err);
    return false;
  }
}

export async function fetchContractorsFromPg(): Promise<Contractor[] | null> {
  if (!isPgConnected) return null;
  try {
    const res = await pool.query('SELECT * FROM contractors ORDER BY created_at DESC');
    const contractors = res.rows.map(mapRowToContractor);
    db.contractors = contractors;
    return contractors;
  } catch (err) {
    console.error('Failed to fetch contractors from PostgreSQL:', err);
    return null;
  }
}

export async function saveUserToPg(user: User): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    const query = `
      INSERT INTO users (
        id, username, full_name, email, role, department_id, department_name,
        company_id, is_active, last_login_at, badge_id, phone, password, must_change_password
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        department_id = EXCLUDED.department_id,
        department_name = EXCLUDED.department_name,
        company_id = EXCLUDED.company_id,
        is_active = EXCLUDED.is_active,
        last_login_at = EXCLUDED.last_login_at,
        badge_id = EXCLUDED.badge_id,
        phone = EXCLUDED.phone,
        password = EXCLUDED.password,
        must_change_password = EXCLUDED.must_change_password;
    `;
    const values = [
      user.id,
      user.username,
      user.fullName,
      user.email,
      user.role,
      user.departmentId || null,
      user.departmentName || null,
      user.companyId || null,
      user.isActive !== false,
      user.lastLoginAt ? new Date(user.lastLoginAt) : null,
      user.badgeId || null,
      user.phone || null,
      user.password || null,
      !!user.mustChangePassword
    ];
    await pool.query(query, values);
    return true;
  } catch (err) {
    console.error('Failed to save user to PostgreSQL:', err);
    return false;
  }
}

export async function fetchUsersFromPg(): Promise<User[] | null> {
  if (!isPgConnected) return null;
  try {
    const userRes = await pool.query('SELECT * FROM users ORDER BY created_at ASC');
    const users = userRes.rows.map(mapRowToUser);
    db.users = users;
    return users;
  } catch (err) {
    console.error('Failed to fetch users from PostgreSQL:', err);
    return null;
  }
}

export async function deleteUserFromPg(id: string): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    return true;
  } catch (err) {
    console.error('Failed to delete user from PostgreSQL:', err);
    return false;
  }
}

export async function saveDepartmentToPg(dept: Department): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    const query = `
      INSERT INTO departments (id, code, name, head_of_department, floor_level, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        head_of_department = EXCLUDED.head_of_department,
        floor_level = EXCLUDED.floor_level,
        is_active = EXCLUDED.is_active;
    `;
    await pool.query(query, [dept.id, dept.code, dept.name, dept.headOfDepartment || null, dept.floorLevel || null, dept.isActive !== false]);
    return true;
  } catch (err) {
    console.error('Failed to save department to PostgreSQL:', err);
    return false;
  }
}

export async function deleteDepartmentFromPg(id: string): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    await pool.query('DELETE FROM departments WHERE id = $1', [id]);
    return true;
  } catch (err) {
    console.error('Failed to delete department from PostgreSQL:', err);
    return false;
  }
}

export async function fetchDepartmentsFromPg(): Promise<Department[] | null> {
  if (!isPgConnected) return null;
  try {
    const res = await pool.query('SELECT * FROM departments ORDER BY code ASC');
    const depts = res.rows.map(mapRowToDepartment);
    db.departments = depts;
    return depts;
  } catch (err) {
    console.error('Failed to fetch departments from PostgreSQL:', err);
    return null;
  }
}

export async function saveMeetingVenueToPg(venue: MeetingVenue): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    const query = `
      INSERT INTO meeting_venues (id, name, building_block, floor_level, capacity, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        building_block = EXCLUDED.building_block,
        floor_level = EXCLUDED.floor_level,
        capacity = EXCLUDED.capacity,
        is_active = EXCLUDED.is_active;
    `;
    await pool.query(query, [venue.id, venue.name, venue.buildingBlock || null, venue.floorLevel || null, venue.capacity || 10, venue.isActive !== false]);
    return true;
  } catch (err) {
    console.error('Failed to save meeting venue to PostgreSQL:', err);
    return false;
  }
}

export async function deleteMeetingVenueFromPg(id: string): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    await pool.query('DELETE FROM meeting_venues WHERE id = $1', [id]);
    return true;
  } catch (err) {
    console.error('Failed to delete meeting venue from PostgreSQL:', err);
    return false;
  }
}

export async function fetchMeetingVenuesFromPg(): Promise<MeetingVenue[] | null> {
  if (!isPgConnected) return null;
  try {
    const res = await pool.query('SELECT * FROM meeting_venues ORDER BY name ASC');
    const venues = res.rows.map(mapRowToMeetingVenue);
    db.meetingVenues = venues;
    return venues;
  } catch (err) {
    console.error('Failed to fetch meeting venues from PostgreSQL:', err);
    return null;
  }
}

export async function saveVisitorCategoryToPg(cat: VisitorCategory): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    const query = `
      INSERT INTO visitor_categories (id, name, description, requires_escort, is_active)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        requires_escort = EXCLUDED.requires_escort,
        is_active = EXCLUDED.is_active;
    `;
    await pool.query(query, [cat.id, cat.name, cat.description || null, !!cat.requiresEscort, cat.isActive !== false]);
    return true;
  } catch (err) {
    console.error('Failed to save visitor category to PostgreSQL:', err);
    return false;
  }
}

export async function fetchVisitorCategoriesFromPg(): Promise<VisitorCategory[] | null> {
  if (!isPgConnected) return null;
  try {
    const res = await pool.query('SELECT * FROM visitor_categories ORDER BY name ASC');
    const cats = res.rows.map(mapRowToVisitorCategory);
    db.visitorCategories = cats;
    return cats;
  } catch (err) {
    console.error('Failed to fetch visitor categories from PostgreSQL:', err);
    return null;
  }
}

export async function saveContractorCategoryToPg(cat: ContractorCategory): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    const query = `
      INSERT INTO contractor_categories (id, name, safety_induction_required, is_active)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        safety_induction_required = EXCLUDED.safety_induction_required,
        is_active = EXCLUDED.is_active;
    `;
    await pool.query(query, [cat.id, cat.name, cat.safetyInductionRequired !== false, cat.isActive !== false]);
    return true;
  } catch (err) {
    console.error('Failed to save contractor category to PostgreSQL:', err);
    return false;
  }
}

export async function fetchContractorCategoriesFromPg(): Promise<ContractorCategory[] | null> {
  if (!isPgConnected) return null;
  try {
    const res = await pool.query('SELECT * FROM contractor_categories ORDER BY name ASC');
    const cats = res.rows.map(mapRowToContractorCategory);
    db.contractorCategories = cats;
    return cats;
  } catch (err) {
    console.error('Failed to fetch contractor categories from PostgreSQL:', err);
    return null;
  }
}

export async function saveBlacklistEntryToPg(entry: BlacklistEntry): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    const query = `
      INSERT INTO blacklist_entries (
        id, full_name, id_number, phone, email, type, reason, severity,
        blocked_by_user_id, blocked_by_user_name, date_added, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        id_number = EXCLUDED.id_number,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        type = EXCLUDED.type,
        reason = EXCLUDED.reason,
        severity = EXCLUDED.severity,
        blocked_by_user_id = EXCLUDED.blocked_by_user_id,
        blocked_by_user_name = EXCLUDED.blocked_by_user_name,
        is_active = EXCLUDED.is_active;
    `;
    const values = [
      entry.id,
      entry.fullName,
      entry.idNumber,
      entry.phone || null,
      entry.email || null,
      entry.type || 'BLACKLIST',
      entry.reason,
      entry.severity || 'HIGH',
      entry.blockedByUserId || 'system',
      entry.blockedByUserName || 'System Administrator',
      entry.dateAdded ? new Date(entry.dateAdded) : new Date(),
      entry.isActive !== false
    ];
    await pool.query(query, values);
    return true;
  } catch (err) {
    console.error('Failed to save watchlist/blacklist entry to PostgreSQL:', err);
    return false;
  }
}

export async function deleteBlacklistEntryFromPg(id: string): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    await pool.query('DELETE FROM blacklist_entries WHERE id = $1', [id]);
    return true;
  } catch (err) {
    console.error('Failed to delete watchlist/blacklist entry from PostgreSQL:', err);
    return false;
  }
}

export async function fetchBlacklistFromPg(): Promise<BlacklistEntry[] | null> {
  if (!isPgConnected) return null;
  try {
    const res = await pool.query('SELECT * FROM blacklist_entries ORDER BY date_added DESC');
    const entries = res.rows.map(mapRowToBlacklist);
    db.blacklist = entries;
    return entries;
  } catch (err) {
    console.error('Failed to fetch watchlist/blacklist from PostgreSQL:', err);
    return null;
  }
}

export async function saveAuditLogToPg(log: AuditLog): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    const query = `
      INSERT INTO audit_logs (id, timestamp, user_id, user_name, user_role, action, details, ip_address, computer_name, category)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;
    const values = [
      log.id,
      log.timestamp ? new Date(log.timestamp) : new Date(),
      log.userId || null,
      log.userName || null,
      log.userRole || null,
      log.action,
      log.details || null,
      log.ipAddress || null,
      log.computerName || null,
      log.category || 'System'
    ];
    await pool.query(query, values);
    return true;
  } catch (err) {
    console.error('Failed to save audit log to PostgreSQL:', err);
    return false;
  }
}

export async function fetchAuditLogsFromPg(): Promise<AuditLog[] | null> {
  if (!isPgConnected) return null;
  try {
    const res = await pool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 1000');
    const logs = res.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp ? new Date(row.timestamp).toISOString().replace('T', ' ').substring(0, 19) : new Date().toISOString(),
      userId: row.user_id,
      userName: row.user_name,
      userRole: row.user_role,
      action: row.action,
      details: row.details,
      ipAddress: row.ip_address,
      computerName: row.computer_name,
      category: row.category || 'System'
    }));
    db.auditLogs = logs;
    return logs;
  } catch (err) {
    console.error('Failed to fetch audit logs from PostgreSQL:', err);
    return null;
  }
}

export async function saveSystemSettingsToPg(settings: SystemSettings): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    const query = `
      INSERT INTO system_settings (
        id, company_name, pass_prefix_visitor, pass_prefix_contractor,
        max_daily_visitors, auto_check_out_grace_hours, require_id_verification,
        require_vehicle_record, allow_self_checkout, on_premise_notice_text, updated_at
      ) VALUES ('default', $1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        company_name = EXCLUDED.company_name,
        pass_prefix_visitor = EXCLUDED.pass_prefix_visitor,
        pass_prefix_contractor = EXCLUDED.pass_prefix_contractor,
        max_daily_visitors = EXCLUDED.max_daily_visitors,
        auto_check_out_grace_hours = EXCLUDED.auto_check_out_grace_hours,
        require_id_verification = EXCLUDED.require_id_verification,
        require_vehicle_record = EXCLUDED.require_vehicle_record,
        allow_self_checkout = EXCLUDED.allow_self_checkout,
        on_premise_notice_text = EXCLUDED.on_premise_notice_text,
        updated_at = CURRENT_TIMESTAMP;
    `;
    await pool.query(query, [
      settings.companyName,
      settings.passPrefixVisitor,
      settings.passPrefixContractor,
      settings.maxDailyVisitors,
      settings.autoCheckOutGraceHours,
      settings.requireIdVerification,
      settings.requireVehicleRecord,
      settings.allowSelfCheckout,
      settings.onPremiseNoticeText
    ]);
    return true;
  } catch (err) {
    console.error('Failed to save system settings to PostgreSQL:', err);
    return false;
  }
}

export async function fetchSystemSettingsFromPg(): Promise<SystemSettings | null> {
  if (!isPgConnected) return null;
  try {
    const res = await pool.query('SELECT * FROM system_settings WHERE id = $1', ['default']);
    if (res.rows.length > 0) {
      const settings = mapRowToSystemSettings(res.rows[0]);
      db.settings = settings;
      return settings;
    }
    return null;
  } catch (err) {
    console.error('Failed to fetch system settings from PostgreSQL:', err);
    return null;
  }
}

export async function savePasswordPolicyToPg(policy: PasswordPolicy): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    const query = `
      INSERT INTO password_policy (
        id, min_length, require_uppercase, require_numbers,
        require_special_char, expiration_days, max_failed_attempts, updated_at
      ) VALUES ('default', $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        min_length = EXCLUDED.min_length,
        require_uppercase = EXCLUDED.require_uppercase,
        require_numbers = EXCLUDED.require_numbers,
        require_special_char = EXCLUDED.require_special_char,
        expiration_days = EXCLUDED.expiration_days,
        max_failed_attempts = EXCLUDED.max_failed_attempts,
        updated_at = CURRENT_TIMESTAMP;
    `;
    await pool.query(query, [
      policy.minLength,
      policy.requireUppercase,
      policy.requireNumbers,
      policy.requireSpecialChar,
      policy.expirationDays,
      policy.maxFailedAttempts
    ]);
    return true;
  } catch (err) {
    console.error('Failed to save password policy to PostgreSQL:', err);
    return false;
  }
}

export async function fetchPasswordPolicyFromPg(): Promise<PasswordPolicy | null> {
  if (!isPgConnected) return null;
  try {
    const res = await pool.query('SELECT * FROM password_policy WHERE id = $1', ['default']);
    if (res.rows.length > 0) {
      const policy = mapRowToPasswordPolicy(res.rows[0]);
      db.passwordPolicy = policy;
      return policy;
    }
    return null;
  } catch (err) {
    console.error('Failed to fetch password policy from PostgreSQL:', err);
    return null;
  }
}

export async function saveEmailSettingsToPg(s: EmailSettings): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    const query = `
      INSERT INTO email_settings (
        id, smtp_server, smtp_port, from_address, from_name, md_email,
        it_email, production_manager_email, fallback_admin_email, secure,
        enable_md_notifications, enable_prod_manager_notifications,
        enable_new_user_notifications, enable_check_in_notifications,
        backup_approver_email, backup_approver_name, backup_approver_user_id,
        enable_delegation, delegation_start_date, delegation_end_date,
        delegation_routing_mode, delegation_reason, updated_at
      ) VALUES (
        'default', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP
      )
      ON CONFLICT (id) DO UPDATE SET
        smtp_server = EXCLUDED.smtp_server,
        smtp_port = EXCLUDED.smtp_port,
        from_address = EXCLUDED.from_address,
        from_name = EXCLUDED.from_name,
        md_email = EXCLUDED.md_email,
        it_email = EXCLUDED.it_email,
        production_manager_email = EXCLUDED.production_manager_email,
        fallback_admin_email = EXCLUDED.fallback_admin_email,
        secure = EXCLUDED.secure,
        enable_md_notifications = EXCLUDED.enable_md_notifications,
        enable_prod_manager_notifications = EXCLUDED.enable_prod_manager_notifications,
        enable_new_user_notifications = EXCLUDED.enable_new_user_notifications,
        enable_check_in_notifications = EXCLUDED.enable_check_in_notifications,
        backup_approver_email = EXCLUDED.backup_approver_email,
        backup_approver_name = EXCLUDED.backup_approver_name,
        backup_approver_user_id = EXCLUDED.backup_approver_user_id,
        enable_delegation = EXCLUDED.enable_delegation,
        delegation_start_date = EXCLUDED.delegation_start_date,
        delegation_end_date = EXCLUDED.delegation_end_date,
        delegation_routing_mode = EXCLUDED.delegation_routing_mode,
        delegation_reason = EXCLUDED.delegation_reason,
        updated_at = CURRENT_TIMESTAMP;
    `;
    const values = [
      s.SmtpServer,
      s.SmtpPort,
      s.FromAddress,
      s.FromName,
      s.MdEmail,
      s.ItEmail || '',
      s.ProductionManagerEmail || '',
      s.FallbackAdminEmail || '',
      !!s.Secure,
      s.EnableMdNotifications !== false,
      s.EnableProdManagerNotifications !== false,
      s.EnableNewUserNotifications !== false,
      s.EnableCheckInNotifications !== false,
      s.BackupApproverEmail || '',
      s.BackupApproverName || '',
      s.BackupApproverUserId || '',
      !!s.EnableDelegation,
      s.DelegationStartDate || '',
      s.DelegationEndDate || '',
      s.DelegationRoutingMode || 'BOTH',
      s.DelegationReason || ''
    ];
    await pool.query(query, values);
    return true;
  } catch (err) {
    console.error('Failed to save email settings to PostgreSQL:', err);
    return false;
  }
}

export async function fetchEmailSettingsFromPg(): Promise<EmailSettings | null> {
  if (!isPgConnected) return null;
  try {
    const res = await pool.query('SELECT * FROM email_settings WHERE id = $1', ['default']);
    if (res.rows.length > 0) {
      return mapRowToEmailSettings(res.rows[0]);
    }
    return null;
  } catch (err) {
    console.error('Failed to fetch email settings from PostgreSQL:', err);
    return null;
  }
}

export async function saveEmailLogToPg(log: EmailLogEntry): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    const query = `
      INSERT INTO email_logs (id, request_id, email_type, recipient, subject, status, error_message, created_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    await pool.query(query, [
      log.id,
      log.requestId || null,
      log.emailType,
      log.recipient,
      log.subject,
      log.status,
      log.errorMessage || null,
      log.createdDate ? new Date(log.createdDate) : new Date()
    ]);
    return true;
  } catch (err) {
    console.error('Failed to save email log to PostgreSQL:', err);
    return false;
  }
}

export async function fetchEmailLogsFromPg(): Promise<EmailLogEntry[] | null> {
  if (!isPgConnected) return null;
  try {
    const res = await pool.query('SELECT * FROM email_logs ORDER BY created_date DESC LIMIT 500');
    const logs = res.rows.map(mapRowToEmailLog);
    db.emailLogs = logs;
    return logs;
  } catch (err) {
    console.error('Failed to fetch email logs from PostgreSQL:', err);
    return null;
  }
}

export async function saveLoginHistoryToPg(entry: LoginHistory): Promise<boolean> {
  if (!isPgConnected) return false;
  try {
    const query = `
      INSERT INTO login_history (id, timestamp, user_id, user_name, user_role, ip_address, status, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    await pool.query(query, [
      entry.id,
      entry.timestamp ? new Date(entry.timestamp) : new Date(),
      entry.userId,
      entry.userName,
      entry.userRole,
      entry.ipAddress,
      entry.status,
      entry.userAgent
    ]);
    return true;
  } catch (err) {
    console.error('Failed to save login history to PostgreSQL:', err);
    return false;
  }
}

export async function fetchLoginHistoryFromPg(): Promise<LoginHistory[] | null> {
  if (!isPgConnected) return null;
  try {
    const res = await pool.query('SELECT * FROM login_history ORDER BY timestamp DESC LIMIT 500');
    const history = res.rows.map(mapRowToLoginHistory);
    db.loginHistory = history;
    return history;
  } catch (err) {
    console.error('Failed to fetch login history from PostgreSQL:', err);
    return null;
  }
}

export async function getDbPoolMetrics(): Promise<DbPoolMetrics> {
  const startTime = Date.now();
  let queryLatency = 0;
  let isConnected = isPgConnected;

  if (isPgConnected) {
    try {
      await pool.query('SELECT 1');
      queryLatency = Date.now() - startTime;
    } catch (e) {
      isConnected = false;
    }
  }

  return {
    isConnected,
    databaseName: process.env.PGDATABASE || 'tanaka_vms',
    host: process.env.PGHOST || '157.9.183.151',
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    poolMax: (pool as any).options?.max || 10,
    sslMode: process.env.PGSSLMODE || 'disable',
    uptimeSeconds: Math.floor(process.uptime()),
    avgQueryLatencyMs: queryLatency
  };
}
