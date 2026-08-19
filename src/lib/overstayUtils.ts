import { Visitor, UserRole } from '../types';

export interface OverstayInfo {
  isOverstay: boolean;
  exceededSeconds: number;
  exceededMinutes: number;
  formattedLiveTimer: string;
  formattedDuration: string;
  scheduledEndDateTime: Date | null;
}

/**
 * Checks if the current user role has access permissions to view time-exceeded timers and audit stats.
 * Per security policy, only SECURITY officers and ADMINISTRATORS can view time-exceeded overstay data.
 */
export function canViewOverstay(role?: UserRole): boolean {
  if (!role) return false;
  return role === 'ADMINISTRATOR' || role === 'SECURITY';
}

/**
 * Calculates overstay time information for a given visitor record.
 */
export function calculateOverstayInfo(visitor: Visitor, currentTime: Date = new Date()): OverstayInfo {
  if (!visitor.scheduledDate || !visitor.scheduledEndTime) {
    return {
      isOverstay: false,
      exceededSeconds: 0,
      exceededMinutes: visitor.exceededMinutes || 0,
      formattedLiveTimer: '00:00:00',
      formattedDuration: visitor.exceededMinutes ? `${visitor.exceededMinutes} mins` : '0 mins',
      scheduledEndDateTime: null
    };
  }

  try {
    const [endHour, endMin] = visitor.scheduledEndTime.split(':').map(Number);
    const targetEndDateStr = visitor.scheduledEndDate || visitor.scheduledDate;
    const [yr, mo, dy] = targetEndDateStr.split('-').map(Number);
    const schedEnd = new Date(yr, mo - 1, dy, endHour || 17, endMin || 0, 0, 0);

    // If already checked out, use recorded checkOutTime or recorded exceededMinutes
    if (visitor.status === 'CHECKED_OUT') {
      let mins = visitor.exceededMinutes || 0;
      if (!mins && visitor.checkOutTime) {
        const checkOutDate = new Date(visitor.checkOutTime.replace(' ', 'T'));
        if (checkOutDate > schedEnd) {
          mins = Math.floor((checkOutDate.getTime() - schedEnd.getTime()) / (1000 * 60));
        }
      }

      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      let durStr = `${mins} mins`;
      if (hours > 0) {
        durStr = `${hours}h ${remainingMins}m`;
      }

      return {
        isOverstay: mins > 0,
        exceededSeconds: mins * 60,
        exceededMinutes: mins,
        formattedLiveTimer: formatHHMMSS(mins * 60),
        formattedDuration: durStr,
        scheduledEndDateTime: schedEnd
      };
    }

    // For currently checked-in visitors, check if currentTime > scheduledEndDateTime
    if (visitor.status === 'CHECKED_IN' && currentTime > schedEnd) {
      const diffMs = currentTime.getTime() - schedEnd.getTime();
      const exceededSecs = Math.floor(diffMs / 1000);
      const exceededMins = Math.floor(exceededSecs / 60);

      const hours = Math.floor(exceededMins / 60);
      const remainingMins = exceededMins % 60;
      let durStr = `${exceededMins} mins`;
      if (hours > 0) {
        durStr = `${hours}h ${remainingMins}m`;
      }

      return {
        isOverstay: true,
        exceededSeconds: exceededSecs,
        exceededMinutes: exceededMins,
        formattedLiveTimer: formatHHMMSS(exceededSecs),
        formattedDuration: durStr,
        scheduledEndDateTime: schedEnd
      };
    }
  } catch (e) {
    console.error('Failed to parse scheduled end time for overstay calculation:', e);
  }

  return {
    isOverstay: false,
    exceededSeconds: 0,
    exceededMinutes: 0,
    formattedLiveTimer: '00:00:00',
    formattedDuration: '0 mins',
    scheduledEndDateTime: null
  };
}

function formatHHMMSS(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
