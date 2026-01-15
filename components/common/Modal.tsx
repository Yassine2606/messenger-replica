import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, ScrollView, Platform } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '@/contexts';

interface ModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function CustomModal({ visible, title, onClose, children }: ModalProps) {
  const { colors } = useTheme();
  const [displayModal, setDisplayModal] = useState(visible);

  // Animated values
  const backdropOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(600);

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
      contentTranslateY.value = withTiming(600, {
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
    <Modal visible={displayModal} animationType="none" transparent statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View
        style={[
          { flex: 1, backgroundColor: colors.overlay },
          backdropStyle,
        ]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Modal Content with Keyboard Avoiding */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            maxHeight: '90%',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: colors.bg.primary,
          },
          contentStyle,
        ]}>
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          {/* Header */}
          <View
            style={{
              borderBottomColor: colors.border.primary,
              backgroundColor: colors.bg.primary,
            }}
            className="flex-row items-center justify-between border-b px-6 py-4">
            <Text style={{ color: colors.text.primary }} className="text-lg font-semibold">
              {title}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={{ backgroundColor: colors.bg.secondary }}
              className="h-8 w-8 items-center justify-center rounded-full"
              activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Content with ScrollView to prevent overflow */}
          <ScrollView
            className="px-6 py-6"
            scrollEnabled={true}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}
