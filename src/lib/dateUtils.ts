/**
 * Standardized Date and Time Utilities for Enterprise VMS
 * Ensures consistent date formatting across Registration, MD Approvals, Guard Desk, Reports, and Badges.
 */

// Helper to format YYYY-MM-DD from a Date or Date string in local time without UTC offset bugs
export function getLocalTodayStr(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to get local time string HH:mm
export function getLocalTimeStr(d = new Date()): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Helper to get local timestamp string YYYY-MM-DD HH:mm:ss
export function getLocalTimestampStr(d = new Date()): string {
  const dateStr = getLocalTodayStr(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${dateStr} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format any date or timestamp string into DD/MM/YYYY
 * Handles YYYY-MM-DD, ISO timestamps (2026-08-18T...), and space-separated timestamps (2026-08-18 09:30:00)
 * Safely parses date parts to avoid UTC time zone shifts (e.g. converting UTC midnight to previous day in Western time zones).
 */
export function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const trimmed = String(dateStr).trim();
    // Extract YYYY-MM-DD part if present
    const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      const [, yyyy, mm, dd] = dateMatch;
      return `${dd}/${mm}/${yyyy}`;
    }
    
    // Check if already in DD/MM/YYYY format
    const ddmmyyyyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (ddmmyyyyMatch) {
      return trimmed;
    }

    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return trimmed;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateStr);
  }
}

/**
 * Format date & time into DD/MM/YYYY HH:mm or DD/MM/YYYY hh:mm AM/PM
 */
export function formatDisplayDateTime(dateStr?: string | null, includeSeconds = false): string {
  if (!dateStr) return '—';
  try {
    const trimmed = String(dateStr).trim();
    // Check for standard timestamp formats YYYY-MM-DD HH:mm:ss or YYYY-MM-DDTHH:mm:ss
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      const [, yyyy, mm, dd, hh, min, sec] = match;
      const timePart = includeSeconds && sec ? `${hh}:${min}:${sec}` : `${hh}:${min}`;
      return `${dd}/${mm}/${yyyy} ${timePart}`;
    }

    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return trimmed;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const timePart = includeSeconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`;
    return `${day}/${month}/${year} ${timePart}`;
  } catch {
    return String(dateStr);
  }
}

/**
 * Format for executive approval cards: "18 Aug 2026 • 09:30 AM"
 */
export function formatExecutiveDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const trimmed = String(dateStr).trim();
    // Parse directly if formatted
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
    if (match) {
      const [, yyyy, mm, dd, hh, min] = match;
      const d = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10), parseInt(hh, 10), parseInt(min, 10));
      const formattedDate = d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      const formattedTime = d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      return `${formattedDate} • ${formattedTime}`;
    }

    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return trimmed;
    const formattedDate = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const formattedTime = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return `${formattedDate} • ${formattedTime}`;
  } catch {
    return String(dateStr);
  }
}
