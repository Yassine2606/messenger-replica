import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts';

interface HeaderProps {
  title: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightElement?: React.ReactNode;
}

export function Header({ title, showBackButton = true, onBackPress, rightElement }: HeaderProps) {
  const { colors } = useTheme();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  return (
    <View
      style={{
        borderBottomColor: colors.border.primary,
        backgroundColor: colors.bg.primary,
      }}
      className="border-b">
      <View className="flex-row items-center justify-between px-4 py-3">
        {/* Left Section: Back Button or Spacer */}
        <View className="w-10">
          {showBackButton && (
            <TouchableOpacity
              onPress={handleBack}
              className="h-10 w-10 items-center justify-center"
              activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={28} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Center Section: Title */}
        <Text
          style={{ color: colors.text.primary }}
          className="flex-1 text-center text-lg font-semibold"
          numberOfLines={1}>
          {title}
        </Text>

        {/* Right Section: Custom Element or Spacer */}
        <View className="w-10 items-end">{rightElement}</View>
      </View>
    </View>
  );
}
