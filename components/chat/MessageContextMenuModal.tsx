import React, { useEffect, useState } from 'react';
import { View, Pressable, Text, ActivityIndicator, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '@/contexts';
import type { Message } from '@/models';

interface MessageContextMenuModalProps {
  visible: boolean;
  message: Message | null;
  currentUserId?: number;
  onClose: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

export function MessageContextMenuModal({
  visible,
  message,
  currentUserId,
  onClose,
  onDelete,
  isDeleting = false,
}: MessageContextMenuModalProps) {
  const { colors } = useTheme();
  const [displayModal, setDisplayModal] = useState(visible);
  const isOwnMessage = message && currentUserId && message.senderId === currentUserId;
  const canDelete = !message?.isDeleted && isOwnMessage;

  // Animated values
  const backdropOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(400);

  // Backdrop animation style
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Content animation style
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: contentTranslateY.value }],
  }));

  useEffect(() => {
    if (visible) {
      // Show modal and animate in
      setDisplayModal(true);
      
      // Delay animation start on Android to ensure modal is rendered
      const delay = Platform.OS === 'android' ? 50 : 0;
      const timer = setTimeout(() => {
        backdropOpacity.value = withTiming(1, {
          duration: 300,
          easing: Easing.inOut(Easing.ease),
        });
        contentTranslateY.value = withTiming(0, {
          duration: 300,
          easing: Easing.out(Easing.ease),
        });
      }, delay);
      
      return () => clearTimeout(timer);
    } else {
      // Animate out first, then hide modal
      backdropOpacity.value = withTiming(0, {
        duration: 200,
        easing: Easing.in(Easing.ease),
      });
      contentTranslateY.value = withTiming(400, {
        duration: 200,
        easing: Easing.in(Easing.ease),
      });
      
      // Hide modal after animation completes
      const timer = setTimeout(() => {
        setDisplayModal(false);
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [visible, backdropOpacity, contentTranslateY]);

  return (
    <Modal
      visible={displayModal}
      transparent={true}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }, backdropStyle]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} disabled={isDeleting} />
      </Animated.View>
      
      <Animated.View style={[{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.bg.primary, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 }, contentStyle]}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text.tertiary, marginBottom: 16, textTransform: 'uppercase' }}>
          Message Actions
        </Text>

        {/* Message Preview */}
        {message && (
          <View style={{ marginBottom: 20, borderRadius: 8, backgroundColor: colors.bg.secondary, padding: 16 }}>
            <Text
              style={{ fontSize: 14, color: colors.text.primary }}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {message.content || '[Media Message]'}
            </Text>
          </View>
        )}

        {/* Delete Action */}
        <Pressable
          onPress={onDelete}
          disabled={!canDelete || isDeleting}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderRadius: 8,
            opacity: (!canDelete || isDeleting) ? 0.5 : 1,
          }}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '500', color: '#DC2626' }}>
              Delete
            </Text>
            {!isOwnMessage && (
              <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 2 }}>
                You can only delete your own messages
              </Text>
            )}
          </View>
        </Pressable>

        {/* Cancel Button */}
        <Pressable
          onPress={onClose}
          disabled={isDeleting}
          style={{ paddingVertical: 12, marginTop: 12, alignItems: 'center', opacity: isDeleting ? 0.5 : 1 }}
        >
          <Text style={{ fontSize: 16, color: colors.text.secondary, fontWeight: '500' }}>Cancel</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}
