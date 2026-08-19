export type UserRole = 'ADMINISTRATOR' | 'STAFF' | 'SECURITY' | 'MANAGING_DIRECTOR';

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  departmentId: string;
  departmentName: string;
  companyId: string;
  isActive: boolean;
  lastLoginAt: string;
  badgeId: string;
  phone: string;
  password?: string;
  mustChangePassword?: boolean;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  headOfDepartment: string;
  floorLevel: string;
  isActive: boolean;
}

export interface Company {
  id: string;
  name: string;
  registrationNumber: string;
  companyType: 'INTERNAL' | 'CONTRACTOR_VENDOR' | 'VISITOR_ORGANIZATION';
  contactPhone: string;
  contactEmail: string;
  address: string;
  isActive: boolean;
  departmentId?: string | null;
  departmentName?: string | null;
  registeredByUserId?: string | null;
  registeredByUserName?: string | null;
  createdAt?: string | null;
}

export interface VisitorCategory {
  id: string;
  name: string;
  description: string;
  requiresEscort: boolean;
  isActive: boolean;
}

export interface ContractorCategory {
  id: string;
  name: string;
  safetyInductionRequired: boolean;
  isActive: boolean;
}

export interface MeetingVenue {
  id: string;
  name: string;
  buildingBlock: string;
  buildingBlocks?: string[];
  floorLevel: string;
  floorLevels?: string[];
  capacity: number;
  isActive: boolean;
}

export interface Visitor {
  id: string;
  registrationNo: string;
  fullName: string;
  idNumber: string;
  phone: string;
  email: string;
  companyName: string;
  visitorCategoryId: string;
  visitorCategoryName: string;
  purpose: string;
  hostUserId: string;
  hostUserName: string;
  hostDepartment: string;
  meetingVenueId: string;
  meetingVenueName: string;
  scheduledDate: string;
  scheduledEndDate?: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  status: 'PENDING_APPROVAL' | 'SCHEDULED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'REJECTED';
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  isConditionalApproval?: boolean;
  approvalRemark?: string | null;
  approvedVenueId?: string | null;
  approvedVenueName?: string | null;
  approvedByUserId?: string | null;
  approvedByUserName?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  passBadgeNumber: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  checkInSecurityUserId: string | null;
  checkInSecurityUserName?: string | null;
  checkOutSecurityUserId: string | null;
  checkOutSecurityUserName?: string | null;
  vehicleNumber: string | null;
  itemsCarried: string | null;
  isBlacklistedAtRegistration: boolean;
  notes: string | null;
  createdAt: string;
  exceededMinutes?: number | null;
  overstayNotes?: string | null;
}

export interface Contractor {
  id: string;
  registrationNo: string;
  fullName: string;
  idNumber: string;
  phone: string;
  email: string;
  companyName: string;
  workOrderNo: string;
  contractorCategoryId: string;
  contractorCategoryName: string;
  workScope: string;
  hostUserId: string;
  hostUserName: string;
  hostDepartment: string;
  locationVenueId: string;
  locationVenueName: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  status: 'PENDING_APPROVAL' | 'SCHEDULED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'REJECTED';
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  isConditionalApproval?: boolean;
  approvalRemark?: string | null;
  approvedVenueId?: string | null;
  approvedVenueName?: string | null;
  approvedByUserId?: string | null;
  approvedByUserName?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  safetyInductionVerified: boolean;
  passBadgeNumber: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  checkInSecurityUserId?: string | null;
  checkInSecurityUserName?: string | null;
  checkOutSecurityUserId?: string | null;
  checkOutSecurityUserName?: string | null;
  vehicleNumber: string | null;
  toolsEquipmentCarried: string | null;
  isForeignWorker?: boolean;
  passportNumber?: string | null;
  nationality?: string | null;
  permitNumber?: string | null;
  permitExpiryDate?: string | null;
  permitStatus?: 'VALID' | 'EXPIRED' | 'NOT_APPLICABLE';
  createdAt: string;
}

export interface BlacklistEntry {
  id: string;
  fullName: string;
  idNumber: string;
  phone?: string | null;
  email?: string | null;
  type: 'BLACKLIST' | 'WATCHLIST';
  reason: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  blockedByUserId: string;
  blockedByUserName: string;
  dateAdded: string;
  isActive: boolean;
}

export interface DbPoolMetrics {
  isConnected: boolean;
  databaseName: string;
  host: string;
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  sslMode: string;
  uptimeSeconds: number;
  avgQueryLatencyMs: number;
  poolMax: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
  ipAddress: string;
  computerName: string;
  category: 'User' | 'Security' | 'Visitor' | 'Contractor' | 'System';
}

export interface LoginHistory {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  ipAddress: string;
  status: 'SUCCESS' | 'FAILED';
  userAgent: string;
}

export interface SystemSettings {
  companyName: string;
  passPrefixVisitor: string;
  passPrefixContractor: string;
  maxDailyVisitors: number;
  autoCheckOutGraceHours: number;
  requireIdVerification: boolean;
  requireVehicleRecord: boolean;
  allowSelfCheckout: boolean;
  onPremiseNoticeText: string;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireNumbers: boolean;
  requireSpecialChar: boolean;
  expirationDays: number;
  maxFailedAttempts: number;
}

export interface EmailLogEntry {
  id: string;
  requestId?: string | null;
  emailType: 'MD_NOTIFICATION' | 'APPROVED_NOTIFICATION' | 'DECLINED_NOTIFICATION' | 'TEST_EMAIL' | 'NEW_USER_NOTIFICATION' | 'ESCALATION_ALERT';
  recipient: string;
  subject: string;
  status: 'Sent' | 'Failed';
  errorMessage?: string | null;
  createdDate: string;
}

export const CONDITIONAL_REMARK_PRESETS = [
  "Standard Approval - No Special Restrictions",
  "Approved for General Reception & Meeting Rooms Only",
  "Approved with Restricted Access: Escort Required At All Times",
  "Approved with Venue Change: Restricted Access to Public Zone Only",
  "Approved - High-Security Zone / Server Room Access strictly DENIED",
  "Approved for Time-Limited Working Hours Only",
  "Custom Location / Approval Remark..."
];
