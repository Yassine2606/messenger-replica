import { View, Text, TextInput, TextInputProps } from 'react-native';

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function FormField({ label, error, ...props }: FormFieldProps) {
  return (
    <View className="mb-0">
      <Text className="mb-2 text-sm font-medium text-gray-700">{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#9CA3AF"
        className={`rounded-lg border px-4 py-3 text-base text-gray-900 ${
          error ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'
        }`}
      />
      {error && <Text className="mt-1.5 text-xs font-medium text-red-600">{error}</Text>}
    </View>
  );
}
