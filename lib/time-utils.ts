/**
 * Time utility functions for formatting relative timestamps
 */

const HOURS_PER_DAY = 24;
const MILLIS_PER_MINUTE = 60 * 1000;
const MILLIS_PER_HOUR = 60 * MILLIS_PER_MINUTE;
const MILLIS_PER_DAY = HOURS_PER_DAY * MILLIS_PER_HOUR;

/**
 * Format a timestamp as relative time ago
 * Returns 'Online' if within last minute
 * Returns '3m', '5m', '1h', '2h' format for recent times
 * Returns null if older than 24 hours (to hide the indicator)
 *
 * @param isoTimestamp - ISO timestamp string or Date
 * @returns Formatted time string or null if > 24 hours
 */
export function formatTimeAgo(isoTimestamp: string | Date): string | null {
  const lastSeenDate = typeof isoTimestamp === 'string' ? new Date(isoTimestamp) : isoTimestamp;
  const now = new Date();
  const diffMs = now.getTime() - lastSeenDate.getTime();

  // If difference is negative or within 1 minute, they're online
  if (diffMs < MILLIS_PER_MINUTE) {
    return 'Online';
  }

  // If older than 24 hours, don't show indicator
  if (diffMs > MILLIS_PER_DAY) {
    return null;
  }

  // Format as minutes if less than 1 hour
  if (diffMs < MILLIS_PER_HOUR) {
    const minutes = Math.floor(diffMs / MILLIS_PER_MINUTE);
    return `${minutes}m`;
  }

  // Format as hours
  const hours = Math.floor(diffMs / MILLIS_PER_HOUR);
  return `${hours}h`;
}

/**
 * Check if user is considered online
 * Online if lastSeen is within last minute
 *
 * @param isoTimestamp - ISO timestamp string or Date
 * @returns true if online, false if offline
 */
export function isUserOnline(isoTimestamp?: string | Date): boolean {
  if (!isoTimestamp) return false;
  const result = formatTimeAgo(isoTimestamp);
  return result === 'Online';
}

/**
 * Check if online indicator should be visible
 * Returns false if older than 24 hours
 *
 * @param isoTimestamp - ISO timestamp string or Date
 * @returns true if should show indicator, false otherwise
 */
export function shouldShowOnlineIndicator(isoTimestamp?: string | Date): boolean {
  if (!isoTimestamp) return false;
  const result = formatTimeAgo(isoTimestamp);
  return result !== null;
}
/**
 * Get human-readable date label for message separator
 * Uses Messenger/Instagram style formatting:
 * - Today: "Today"
 * - Yesterday: "Yesterday"
 * - This week: Day name (e.g., "Monday")
 * - This year: "Jan 15"
 * - Other years: "Jan 15, 2025"
 *
 * @param date - ISO timestamp string or Date object
 * @returns Formatted date label string
 */
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function getDateLabel(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();

  // Get start of day for comparison (00:00:00)
  const dateStart = new Date(dateObj);
  dateStart.setHours(0, 0, 0, 0);

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((todayStart.getTime() - dateStart.getTime()) / MILLIS_PER_DAY);

  // Today
  if (diffDays === 0) {
    return 'Today';
  }

  // Yesterday
  if (diffDays === 1) {
    return 'Yesterday';
  }

  // Within the last 6 days (this week)
  if (diffDays > 0 && diffDays <= 6) {
    return WEEKDAYS[dateObj.getDay()];
  }

  // This year
  if (dateObj.getFullYear() === now.getFullYear()) {
    return `${MONTHS[dateObj.getMonth()]} ${dateObj.getDate()}`;
  }

  // Different year
  return `${MONTHS[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;
}

// Fast time formatter used across UI to avoid Intl/locale costs on Android
export function formatTimeShort(date?: Date | string): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const isPM = hours >= 12;
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const mins = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hour12}:${mins}${isPM ? ' PM' : ' AM'}`;
} 
