import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NotFoundScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-white"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-xl font-bold text-gray-900">This screen doesn&apos;t exist.</Text>
        <Link href="/" className="mt-4 pt-4">
          <Text className="text-base text-blue-600">Go to home screen</Text>
        </Link>
      </View>
    </View>
  );
}
