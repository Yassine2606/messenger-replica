import { View, Text, TextInput, TextInputProps } from 'react-native';
import { useTheme } from '@/contexts';

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function FormField({ label, error, ...props }: FormFieldProps) {
  const { colors } = useTheme();

  return (
    <View className="mb-0">
      <Text style={{ color: colors.text.primary }} className="mb-2 text-sm font-medium">
        {label}
      </Text>
      <TextInput
        {...props}
        style={{
          borderColor: error ? colors.error : colors.input.border,
          backgroundColor: error ? `${colors.error}20` : colors.input.bg,
          color: colors.input.text,
        }}
        placeholderTextColor={colors.input.placeholder}
        className="rounded-lg border px-4 py-3 text-base"
      />
      {error && (
        <Text style={{ color: colors.error }} className="mt-1.5 text-xs font-medium">
          {error}
        </Text>
      )}
    </View>
  );
}
