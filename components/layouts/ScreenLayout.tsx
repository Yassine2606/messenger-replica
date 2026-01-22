import React, { ReactNode } from 'react';
import { View, Platform, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useTheme } from '@/contexts';

interface ScreenLayoutProps {
  children: ReactNode;
  keyboardAvoidingEnabled?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
}

/**
 * Reusable screen layout component that handles:
 * - SafeAreaView integration from react-native-safe-area-context
 * - KeyboardAvoidingView from react-native-keyboard-controller
 * - Platform-specific spacing and keyboard behavior
 * 
 * @param children - Screen content
 * @param edges - Which edges to apply safe area to (default: all)
 * @param keyboardAvoidingEnabled - Enable keyboard avoiding (default: true)
 * @param style - Custom style for outer view
 * @param contentContainerStyle - Custom style for inner content container
 */
export function ScreenLayout({
  children,
  keyboardAvoidingEnabled = true,
  style,
  contentContainerStyle,
}: ScreenLayoutProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      enabled={keyboardAvoidingEnabled}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.bg.primary, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View
          style={[
            { flex: 1 },
            contentContainerStyle,
          ]}>
          {children}
        </View>
    </KeyboardAvoidingView>
  );
}

/**
 * Variant for scrollable form screens (login, register, etc.)
 * Includes KeyboardAwareScrollView-like behavior with padding
 */
export function FormScreenLayout({
  children,
  keyboardAvoidingEnabled = true,
  style,
}: {
  children: ReactNode;
  keyboardAvoidingEnabled?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      enabled={keyboardAvoidingEnabled}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.bg.primary, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={{ flex: 1 }}>
          {children}
        </View>
    </KeyboardAvoidingView>
  );
}

/**
 * Variant for chat/messaging screens that need special handling
 */
export function ChatScreenLayout({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      enabled
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.bg.primary, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={[{ flex: 1, backgroundColor: colors.bg.primary }, style]}>
        <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
          {children}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
