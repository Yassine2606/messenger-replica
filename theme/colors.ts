import { ThemeColors } from './types';

export const lightColors: ThemeColors = {
  bg: {
    primary: '#FFFFFF',
    secondary: '#F9FAFB',
    tertiary: '#F3F4F6',
    inverted: '#1F2937',
  },
  text: {
    primary: '#1F2937',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    inverted: '#FFFFFF',
  },
  border: {
    primary: '#E5E7EB',
    light: '#F3F4F6',
  },
  primary: '#3B82F6',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#06B6D4',
  bubble: {
    own: {
      bg: '#3B82F6',
      text: '#FFFFFF',
    },
    other: {
      // Use a neutral light grey for other users' bubbles in light mode for better contrast
      bg: '#F3F4F6',
      text: '#1F2937',
    },
  },
  status: {
    sent: '#9CA3AF',
    delivered: '#6B7280',
    read: '#3B82F6',
    online: '#10B981',
    offline: '#9CA3AF',
  },
  input: {
    bg: '#FFFFFF',
    text: '#1F2937',
    placeholder: '#9CA3AF',
    border: '#E5E7EB',
    focusBorder: '#3B82F6',
  },
  overlay: 'rgba(0, 0, 0, 0.5)',
  audio: {
    own: {
      bg: '#3B82F6',
      waveColor: '#FFFFFF',
      playButtonColor: '#FFFFFF',
      text: '#FFFFFF',
    },
    other: {
      // Match bubble.other: neutral light grey background with darker controls for light mode
      bg: '#F3F4F6',
      waveColor: '#9CA3AF',
      playButtonColor: '#1F2937',
      text: '#1F2937',
    },
  },
  avatarBg: '#3B82F6',
};

export const darkColors: ThemeColors = {
  bg: {
    primary: '#000000',
    secondary: '#0F0F0F',
    tertiary: '#1A1A1A',
    inverted: '#F9FAFB',
  },
  text: {
    primary: '#F9FAFB',
    secondary: '#D1D5DB',
    tertiary: '#9CA3AF',
    inverted: '#111827',
  },
  border: {
    primary: '#262626',
    light: '#1A1A1A',
  },
  primary: '#60A5FA',
  success: '#34D399',
  error: '#F87171',
  warning: '#FBBF24',
  info: '#22D3EE',
  bubble: {
    own: {
      bg: '#3B82F6',
      text: '#FFFFFF',
    },
    other: {
      bg: '#1A1A1A',
      text: '#D1D5DB',
    },
  },
  status: {
    sent: '#9CA3AF',
    delivered: '#6B7280',
    read: '#60A5FA',
    online: '#34D399',
    offline: '#9CA3AF',
  },
  input: {
    bg: '#0F0F0F',
    text: '#F9FAFB',
    placeholder: '#9CA3AF',
    border: '#262626',
    focusBorder: '#60A5FA',
  },
  overlay: 'rgba(0, 0, 0, 0.8)',
  audio: {
    own: {
      bg: '#3B82F6',
      waveColor: '#FFFFFF',
      playButtonColor: '#FFFFFF',
      text: '#FFFFFF',
    },
    other: {
      bg: '#1A1A1A',
      waveColor: '#60A5FA',
      playButtonColor: '#60A5FA',
      text: '#D1D5DB',
    },
  },
  avatarBg: '#60A5FA',
};
