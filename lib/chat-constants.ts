/**
 * Chat Screen Constants
 * Centralized magic numbers and configuration for the chat screen
 */

// Gesture Handling
export const GESTURE = {
  // Pan gesture thresholds
  ACTIVE_OFFSET_X: 15,
  ACTIVE_OFFSET_Y: 10,

  // Timestamp reveal
  MAX_TIMESTAMP_DRAG: 80,
  TIMESTAMP_REVEAL_THRESHOLD: 0.5,

  // Reply swipe
  MAX_REPLY_SWIPE: 60,
  REPLY_SWIPE_THRESHOLD: 40,

  // Long press timing
  LONG_PRESS_DELAY_BUBBLE: 1000,
  LONG_PRESS_DELAY_MESSAGE: 300,
} as const;

// Animation Timing
export const ANIMATION = {
  EMOJI_MENU_IN: 150,
  EMOJI_MENU_OUT: 100,
  GESTURE_SNAP_BACK: 300,
  GESTURE_SNAP_TIMING: 200,
  SCROLL_TO_BOTTOM: 120,
} as const;

// Message Display
export const MESSAGE = {
  MAX_LENGTH: 1000,
  IMAGE_ASPECT: 1,
  IMAGE_QUALITY: 1,
  IMAGE_SIZE_WIDTH: 200,
  IMAGE_SIZE_HEIGHT: 200,
  IMAGE_BORDER_RADIUS: 12,
  BORDER_RADIUS_BASE: 18,
  BORDER_RADIUS_TIGHT: 4,
  // Time threshold for grouping messages (in milliseconds)
  GROUPING_TIME_THRESHOLD: 300000, // 5 minutes
  // Threshold for inserting a time separator / breaking clusters (e.g., long inactivity)
  SEPARATOR_TIME_THRESHOLD: 3 * 60 * 60 * 1000, // 3 hours
} as const;

// Typing Indicator
export const TYPING = {
  DEBOUNCE_STOP_TIMEOUT: 3000, // 3 seconds
} as const;

// Image Picker
export const IMAGE_PICKER = {
  CAMERA_QUALITY: 0.8,
  LIBRARY_QUALITY: 1,
  ASPECT_RATIO: [1, 1] as [number, number],
} as const;

// Padding & Spacing
export const SPACING = {
  MESSAGE_HORIZONTAL: 16,
  MESSAGE_VERTICAL: 12,
  MESSAGE_MARGIN_GROUPED: 2,
  MESSAGE_MARGIN_DEFAULT: 8,
} as const;

// Colors (if not using Tailwind)
export const COLORS = {
  PRIMARY: '#3B82F6',
  ERROR: '#EF4444',
  WARNING: '#D97706',
  SUCCESS: '#10B981',
  GRAY: '#9CA3AF',
  DISABLED: '#D1D5DB',
} as const;
