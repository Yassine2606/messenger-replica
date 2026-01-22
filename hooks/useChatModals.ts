import { useState, useCallback } from 'react';
import { Message } from '@/models';

/**
 * Manages modal states for chat screen:
 * - Leave conversation modal
 * - Message context menu (delete)
 * - Image viewer
 */
export function useChatModals() {
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [activeContextMessage, setActiveContextMessage] = useState<Message | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerUri, setImageViewerUri] = useState('');
  const [imageViewerDimensions, setImageViewerDimensions] = useState<
    { width: number; height: number } | undefined
  >();
  const [imageSourceLayout, setImageSourceLayout] = useState<
    { x: number; y: number; width: number; height: number } | undefined
  >();

  const closeContextMenu = useCallback(() => {
    setActiveContextMessage(null);
  }, []);

  const closeImageViewer = useCallback(() => {
    setImageViewerVisible(false);
    setImageViewerUri('');
    setImageViewerDimensions(undefined);
    setImageSourceLayout(undefined);
  }, []);

  const handleImagePress = useCallback(
    (imageUri: string, layout?: { x: number; y: number; width: number; height: number }) => {
      const API_BASE_URL =
        process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3000';
      setImageViewerUri(`${API_BASE_URL}${imageUri}`);
      setImageSourceLayout(layout);
      // Pass the rendered image dimensions (120x200 from MessageBubble) to skip Image.getSize() call
      setImageViewerDimensions({ width: 120, height: 200 });
      setImageViewerVisible(true);
    },
    []
  );

  return {
    leaveModalVisible,
    setLeaveModalVisible,
    isLeaving,
    setIsLeaving,
    activeContextMessage,
    setActiveContextMessage,
    closeContextMenu,
    imageViewerVisible,
    imageViewerUri,
    imageViewerDimensions,
    imageSourceLayout,
    handleImagePress,
    closeImageViewer,
  };
}
