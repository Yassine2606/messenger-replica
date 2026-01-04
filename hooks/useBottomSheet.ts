import { useCallback, useRef, useState } from 'react';
import BottomSheet from '@gorhom/bottom-sheet';

/**
 * Hook for managing BottomSheet state and controls
 * Provides simplified API for opening/closing and snap control
 * 
 * @returns Object with isOpen state, ref, and control methods
 */
export function useBottomSheet() {
  const [isOpen, setIsOpen] = useState(false);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const open = useCallback(() => {
    setIsOpen(true);
    bottomSheetRef.current?.expand();
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    bottomSheetRef.current?.close();
  }, []);

  const snapTo = useCallback((index: number) => {
    bottomSheetRef.current?.snapToIndex(index);
  }, []);

  return {
    isOpen,
    open,
    close,
    snapTo,
    ref: bottomSheetRef,
  };
}
