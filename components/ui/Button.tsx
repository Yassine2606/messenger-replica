import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return 'border border-gray-300 bg-white';
      case 'destructive':
        return 'bg-red-600';
      default:
        return 'bg-blue-600';
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'secondary':
        return 'text-gray-900';
      default:
        return 'text-white';
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
      className={`flex-row items-center justify-center rounded-lg ${getVariantStyles()} ${getSizeStyles()} ${
        disabled || loading ? 'opacity-60' : ''
      }`}>
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? '#374151' : '#FFFFFF'} />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon as any}
              size={16}
              color={variant === 'secondary' ? '#374151' : '#FFFFFF'}
              style={{ marginRight: 8 }}
            />
          )}
          <Text className={`text-center text-sm font-semibold ${getTextColor()}`}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
