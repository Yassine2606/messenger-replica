/**
 * Bottom Sheet Models
 * Type definitions for bottom sheet component behavior and configuration
 */

/**
 * Snap point definition
 * Can be a percentage (0-100) or fixed height in pixels
 */
export type SnapPoint = number | string;

/**
 * Configuration for bottom sheet behavior
 */
export interface BottomSheetConfig {
  /** Snap points for the sheet (percentages like "50%" or pixel values like 400) */
  snapPoints: SnapPoint[];
  /** Enable backdrop tap to close (default: true) */
  enableBackdropDismiss?: boolean;
  /** Backdrop opacity (0-1, default: 0.5) */
  backdropOpacity?: number;
  /** Enable drag handle (default: true) */
  enableHandle?: boolean;
  /** Animation duration in ms (default: 300) */
  animationDuration?: number;
}

/**
 * Props for the BottomSheet component
 */
export interface BottomSheetProps extends Partial<BottomSheetConfig> {
  /** Whether the sheet is visible */
  isOpen: boolean;
  /** Callback when sheet closes */
  onClose: () => void;
  /** Callback when snap point changes */
  onSnapChange?: (index: number) => void;
  /** Sheet content */
  children: React.ReactNode;
  /** Test ID for testing */
  testID?: string;
}
