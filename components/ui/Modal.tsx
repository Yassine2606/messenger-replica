import React, { useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, ScrollView } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

interface ModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function CustomModal({ visible, title, onClose, children }: ModalProps) {
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
      // Animate in
      backdropOpacity.value = withTiming(1, {
        duration: 300,
        easing: Easing.inOut(Easing.ease),
      });
      contentTranslateY.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.ease),
      });
    } else {
      // Animate out
      backdropOpacity.value = withTiming(0, {
        duration: 200,
        easing: Easing.in(Easing.ease),
      });
      contentTranslateY.value = withTiming(600, {
        duration: 200,
        easing: Easing.in(Easing.ease),
      });
    }
  }, [visible, backdropOpacity, contentTranslateY]);

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }, backdropStyle]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Modal Content with Keyboard Avoiding */}
      <Animated.View style={[{ position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: 'white' }, contentStyle]}>
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-gray-200 px-6 py-4">
            <Text className="text-lg font-semibold text-gray-900">{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              className="h-8 w-8 items-center justify-center rounded-full bg-gray-100"
              activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#374151" />
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
