/**
 * Generate a temporary ID for optimistic messages
 * Format: `temp_${timestamp}_${random}`
 */
export function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if a message ID is temporary (optimistic)
 */
export function isTempId(id: string | number): boolean {
  return typeof id === 'string' && id.startsWith('temp_');
}
