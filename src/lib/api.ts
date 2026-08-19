import {
  User, Department, Company, VisitorCategory, ContractorCategory,
  MeetingVenue, Visitor, Contractor, BlacklistEntry, AuditLog,
  LoginHistory, SystemSettings, PasswordPolicy, EmailLogEntry, DbPoolMetrics
} from '../types';

async function safeJsonFetch<T>(url: string, options?: RequestInit, retries = 2): Promise<T> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      if (res.status === 403 || text.toLowerCase().includes('403 forbidden')) {
        throw new Error('Your account is deactivated, please contact Security Administrator.');
      }
      throw new Error(`Server returned non-JSON response (${res.status} ${res.statusText}): ${text.substring(0, 100)}`);
    }
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || json.error || `HTTP Error ${res.status}`);
    }
    return json as T;
  } catch (err: any) {
    if (retries > 0 && (err?.name === 'TypeError' || err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError'))) {
      await new Promise(r => setTimeout(r, 600));
      return safeJsonFetch<T>(url, options, retries - 1);
    }
    throw err;
  }
}

export async function getCurrentUser(): Promise<{ user: User }> {
  return safeJsonFetch<{ user: User }>('/api/vms/auth/current-user');
}

export async function switchUser(userId: string): Promise<{ user: User }> {
  return safeJsonFetch<{ user: User }>('/api/vms/auth/switch-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });
}

export async function getUsers(): Promise<User[]> {
  return safeJsonFetch<User[]>('/api/vms/users');
}

export async function createUser(userData: Partial<User>): Promise<User> {
  return safeJsonFetch<User>('/api/vms/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
}

export async function updateUser(id: string, userData: Partial<User>): Promise<User> {
  return safeJsonFetch<User>(`/api/vms/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
}

export async function deleteUser(id: string): Promise<{ message: string; user: User }> {
  return safeJsonFetch<{ message: string; user: User }>(`/api/vms/users/${id}`, {
    method: 'DELETE'
  });
}

export async function resetUserPassword(id: string): Promise<{ tempPassword: string }> {
  return safeJsonFetch<{ tempPassword: string }>(`/api/vms/users/${id}/reset-password`, {
    method: 'PUT'
  });
}

export async function changePassword(id: string, newPassword: string): Promise<User> {
  const res = await safeJsonFetch<any>(`/api/vms/users/${id}/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword })
  });
  if (res && typeof res === 'object' && 'user' in res && res.user) {
    return res.user as User;
  }
  return res as User;
}

export async function getDepartments(): Promise<Department[]> {
  return safeJsonFetch<Department[]>('/api/vms/departments');
}

export async function createDepartment(dept: Partial<Department>): Promise<Department> {
  return safeJsonFetch<Department>('/api/vms/departments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dept)
  });
}

export async function updateDepartment(id: string, dept: Partial<Department>): Promise<Department> {
  return safeJsonFetch<Department>(`/api/vms/departments/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dept)
  });
}

export async function deleteDepartment(id: string): Promise<{ message: string }> {
  return safeJsonFetch<{ message: string }>(`/api/vms/departments/${id}`, {
    method: 'DELETE'
  });
}

export async function getCompanies(): Promise<Company[]> {
  return safeJsonFetch<Company[]>('/api/vms/companies');
}

export async function createCompany(comp: Partial<Company>): Promise<Company> {
  return safeJsonFetch<Company>('/api/vms/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(comp)
  });
}

export async function updateCompany(id: string, comp: Partial<Company>): Promise<Company> {
  return safeJsonFetch<Company>(`/api/vms/companies/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(comp)
  });
}

export async function deleteCompany(id: string): Promise<{ message: string }> {
  return safeJsonFetch<{ message: string }>(`/api/vms/companies/${id}`, {
    method: 'DELETE'
  });
}

export async function getVisitorCategories(): Promise<VisitorCategory[]> {
  return safeJsonFetch<VisitorCategory[]>('/api/vms/visitor-categories');
}

export async function createVisitorCategory(cat: Partial<VisitorCategory>): Promise<VisitorCategory> {
  return safeJsonFetch<VisitorCategory>('/api/vms/visitor-categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cat)
  });
}

export async function updateVisitorCategory(id: string, cat: Partial<VisitorCategory>): Promise<VisitorCategory> {
  return safeJsonFetch<VisitorCategory>(`/api/vms/visitor-categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cat)
  });
}

export async function deleteVisitorCategory(id: string): Promise<{ message: string }> {
  return safeJsonFetch<{ message: string }>(`/api/vms/visitor-categories/${id}`, {
    method: 'DELETE'
  });
}

export async function getContractorCategories(): Promise<ContractorCategory[]> {
  return safeJsonFetch<ContractorCategory[]>('/api/vms/contractor-categories');
}

export async function createContractorCategory(cat: Partial<ContractorCategory>): Promise<ContractorCategory> {
  return safeJsonFetch<ContractorCategory>('/api/vms/contractor-categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cat)
  });
}

export async function updateContractorCategory(id: string, cat: Partial<ContractorCategory>): Promise<ContractorCategory> {
  return safeJsonFetch<ContractorCategory>(`/api/vms/contractor-categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cat)
  });
}

export async function deleteContractorCategory(id: string): Promise<{ message: string }> {
  return safeJsonFetch<{ message: string }>(`/api/vms/contractor-categories/${id}`, {
    method: 'DELETE'
  });
}

export async function getMeetingVenues(): Promise<MeetingVenue[]> {
  return safeJsonFetch<MeetingVenue[]>('/api/vms/meeting-venues');
}

export async function createMeetingVenue(v: Partial<MeetingVenue>): Promise<MeetingVenue> {
  return safeJsonFetch<MeetingVenue>('/api/vms/meeting-venues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(v)
  });
}

export async function updateMeetingVenue(id: string, v: Partial<MeetingVenue>): Promise<MeetingVenue> {
  return safeJsonFetch<MeetingVenue>(`/api/vms/meeting-venues/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(v)
  });
}

export async function deleteMeetingVenue(id: string): Promise<{ message: string }> {
  return safeJsonFetch<{ message: string }>(`/api/vms/meeting-venues/${id}`, {
    method: 'DELETE'
  });
}

export async function getVisitors(): Promise<Visitor[]> {
  return safeJsonFetch<Visitor[]>('/api/vms/visitors');
}

export async function getPastVisitorsByCompany(companyName?: string): Promise<Visitor[]> {
  const query = companyName ? `?company=${encodeURIComponent(companyName)}` : '';
  return safeJsonFetch<Visitor[]>(`/api/vms/visitors/past-attendees${query}`);
}

export async function registerVisitor(v: Partial<Visitor>): Promise<Visitor> {
  return safeJsonFetch<Visitor>('/api/vms/visitors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(v)
  });
}

export async function cancelVisitor(id: string): Promise<Visitor> {
  return safeJsonFetch<Visitor>(`/api/vms/visitors/${id}/cancel`, { method: 'POST' });
}

export async function approveVisitor(id: string, options?: { approvalRemark?: string; approvedVenueId?: string; approvedVenueName?: string }): Promise<Visitor> {
  return safeJsonFetch<Visitor>(`/api/vms/visitors/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options || {})
  });
}

export async function rejectVisitor(id: string, reason: string): Promise<Visitor> {
  return safeJsonFetch<Visitor>(`/api/vms/visitors/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  });
}

export async function checkInVisitor(id: string, data: { passBadgeNumber?: string; vehicleNumber?: string; itemsCarried?: string }): Promise<any> {
  return safeJsonFetch<any>(`/api/vms/visitors/${id}/check-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

export async function checkOutVisitor(id: string, data?: { overstayNotes?: string }): Promise<Visitor> {
  return safeJsonFetch<Visitor>(`/api/vms/visitors/${id}/check-out`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data || {})
  });
}

export async function getContractors(): Promise<Contractor[]> {
  return safeJsonFetch<Contractor[]>('/api/vms/contractors');
}

export async function registerContractor(c: Partial<Contractor>): Promise<Contractor> {
  return safeJsonFetch<Contractor>('/api/vms/contractors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(c)
  });
}

export async function checkInContractor(id: string, data: { passBadgeNumber?: string; vehicleNumber?: string; toolsEquipmentCarried?: string }): Promise<any> {
  return safeJsonFetch<any>(`/api/vms/contractors/${id}/check-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

export async function checkOutContractor(id: string): Promise<Contractor> {
  return safeJsonFetch<Contractor>(`/api/vms/contractors/${id}/check-out`, { method: 'POST' });
}

export async function approveContractor(id: string, options?: { approvalRemark?: string; approvedVenueId?: string; approvedVenueName?: string }): Promise<Contractor> {
  return safeJsonFetch<Contractor>(`/api/vms/contractors/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options || {})
  });
}

export async function rejectContractor(id: string, reason: string): Promise<Contractor> {
  return safeJsonFetch<Contractor>(`/api/vms/contractors/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  });
}

export async function getBlacklist(): Promise<BlacklistEntry[]> {
  return safeJsonFetch<BlacklistEntry[]>('/api/vms/blacklist');
}

export async function addBlacklist(entry: Partial<BlacklistEntry>): Promise<BlacklistEntry> {
  return safeJsonFetch<BlacklistEntry>('/api/vms/blacklist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry)
  });
}

export async function deleteBlacklist(id: string): Promise<any> {
  return safeJsonFetch<any>(`/api/vms/blacklist/${id}`, { method: 'DELETE' });
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  return safeJsonFetch<AuditLog[]>('/api/vms/audit-logs');
}

export async function getLoginHistory(): Promise<LoginHistory[]> {
  return safeJsonFetch<LoginHistory[]>('/api/vms/login-history');
}

export async function getSettings(): Promise<SystemSettings> {
  return safeJsonFetch<SystemSettings>('/api/vms/settings');
}

export async function updateSettings(s: Partial<SystemSettings>): Promise<SystemSettings> {
  return safeJsonFetch<SystemSettings>('/api/vms/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(s)
  });
}

export async function getPasswordPolicy(): Promise<PasswordPolicy> {
  return safeJsonFetch<PasswordPolicy>('/api/vms/password-policy');
}

export async function updatePasswordPolicy(p: Partial<PasswordPolicy>): Promise<PasswordPolicy> {
  return safeJsonFetch<PasswordPolicy>('/api/vms/password-policy', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p)
  });
}

// EMAIL API ENDPOINTS
export async function getEmailSettings(): Promise<{ settings: any }> {
  return safeJsonFetch<{ settings: any }>('/api/vms/email/settings');
}

export async function testSmtpConnection(): Promise<{ success: boolean; error?: string }> {
  return safeJsonFetch<{ success: boolean; error?: string }>('/api/vms/email/test-smtp', { method: 'POST' });
}

export async function getEmailLogs(): Promise<EmailLogEntry[]> {
  return safeJsonFetch<EmailLogEntry[]>('/api/vms/email/logs');
}

export async function sendTestEmail(recipient: string, subject: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return safeJsonFetch<{ success: boolean; messageId?: string; error?: string }>('/api/vms/email/send-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient, subject, message })
  });
}

export async function getReportsSummary(): Promise<any> {
  return safeJsonFetch<any>('/api/vms/reports/summary');
}

export async function getDbPoolHealth(): Promise<DbPoolMetrics> {
  return safeJsonFetch<DbPoolMetrics>('/api/vms/system/db-health');
}
