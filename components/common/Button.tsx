import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'large',
  loading = false,
  disabled = false,
  icon,
}: ButtonProps) {
  const { colors } = useTheme();

  const getVariantBgColor = () => {
    switch (variant) {
      case 'secondary':
        return colors.input.bg;
      case 'destructive':
        return colors.error;
      default:
        return colors.primary;
    }
  };

  const getVariantBorderColor = () => {
    switch (variant) {
      case 'secondary':
        return colors.border.primary;
      default:
        return 'transparent';
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'secondary':
        return colors.text.primary;
      default:
        return colors.text.inverted;
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return 'px-3 py-2';
      case 'medium':
        return 'px-4 py-2.5';
      default:
        return 'px-6 py-3';
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={{
        backgroundColor: getVariantBgColor(),
        borderColor: getVariantBorderColor(),
        borderWidth: variant === 'secondary' ? 1 : 0,
        opacity: disabled || loading ? 0.6 : 1,
      }}
      className={`flex-row items-center justify-center rounded-lg ${getSizeStyles()}`}>
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon as any}
              size={16}
              color={getTextColor()}
              style={{ marginRight: 8 }}
            />
          )}
          <Text style={{ color: getTextColor() }} className="text-center text-sm font-semibold">
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
