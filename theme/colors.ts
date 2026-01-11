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
      bg: '#DBEAFE',
      text: '#1E40AF',
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
      bg: '#DBEAFE',
      waveColor: '#3B82F6',
      playButtonColor: '#3B82F6',
      text: '#1E40AF',
    },
  },
  avatarBg: '#3B82F6',
};

export const darkColors: ThemeColors = {
  bg: {
    primary: '#111827',
    secondary: '#1F2937',
    tertiary: '#374151',
    inverted: '#F9FAFB',
  },
  text: {
    primary: '#F9FAFB',
    secondary: '#D1D5DB',
    tertiary: '#9CA3AF',
    inverted: '#111827',
  },
  border: {
    primary: '#374151',
    light: '#1F2937',
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
      bg: '#374151',
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
    bg: '#1F2937',
    text: '#F9FAFB',
    placeholder: '#9CA3AF',
    border: '#374151',
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
      bg: '#374151',
      waveColor: '#60A5FA',
      playButtonColor: '#60A5FA',
      text: '#D1D5DB',
    },
  },
  avatarBg: '#60A5FA',
};
