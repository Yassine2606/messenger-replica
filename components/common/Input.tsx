import { TextInput, Text, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/contexts';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, ...props }: InputProps) {
  const { colors } = useTheme();

  return (
    <View className="mb-4">
      {label && (
        <Text style={{ color: colors.text.primary }} className="mb-2 text-sm font-medium">
          {label}
        </Text>
      )}
      <TextInput
        style={{
          borderColor: error ? colors.error : colors.input.border,
          backgroundColor: colors.input.bg,
          color: colors.input.text,
        }}
        className="rounded-lg border px-4 py-3 text-base"
        placeholderTextColor={colors.input.placeholder}
        autoCapitalize="none"
        {...props}
      />
      {error && (
        <Text style={{ color: colors.error }} className="mt-1 text-sm">
          {error}
        </Text>
      )}
    </View>
  );
}
