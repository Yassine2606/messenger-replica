/**
 * Theme type definitions for light/dark mode support
 */

export interface ThemeColors {
  // Background
  bg: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverted: string;
  };

  // Text
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverted: string;
  };

  // Borders & Dividers
  border: {
    primary: string;
    light: string;
  };

  // Semantic Colors
  primary: string;
  success: string;
  error: string;
  warning: string;
  info: string;

  // Chat Bubbles
  bubble: {
    own: {
      bg: string;
      text: string;
    };
    other: {
      bg: string;
      text: string;
    };
  };

  // Message Status
  status: {
    sent: string;
    delivered: string;
    read: string;
    online: string;
    offline: string;
  };

  // Inputs & Controls
  input: {
    bg: string;
    text: string;
    placeholder: string;
    border: string;
    focusBorder: string;
  };

  // Modals & Overlays
  overlay: string;

  // Keyboard / Audio
  audio: {
    own: {
      bg: string;
      waveColor: string;
      playButtonColor: string;
      text: string;
    };
    other: {
      bg: string;
      waveColor: string;
      playButtonColor: string;
      text: string;
    };
  };

  // Avatar placeholder
  avatarBg: string;
}

export type Theme = 'light' | 'dark';

export interface ThemeContextType {
  theme: Theme;
  colors: ThemeColors;
  toggleTheme: () => void;
}
