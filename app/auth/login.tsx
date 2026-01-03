import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Input } from '@/components/ui';
import { useLogin } from '@/hooks/useAuth';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { setUser } = useAuth();
  const loginMutation = useLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    try {
      const response = await loginMutation.mutateAsync({ email, password });
      setUser?.(response.user);
      // Tabs layout will now see isAuthenticated=true and allow navigation
      router.replace('/(tabs)' as any);
    } catch (error: any) {
      const status = error?.response?.status;
      let errorMessage = error?.message || 'An error occurred during login';

      if (status === 429) {
        errorMessage = 'Too many login attempts. Please try again in 15 minutes.';
      } else if (status === 401) {
        errorMessage = 'Invalid email or password.';
      } else if (status === 400) {
        errorMessage = error?.response?.data?.error || 'Invalid input. Please check your credentials.';
      }

      Alert.alert('Login Failed', errorMessage);
    }
  };

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      <KeyboardAwareScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingBottom: Math.max(insets.bottom, 16),
        }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={8}>
        <View className="mb-8">
          <Text className="mb-2 text-3xl font-bold text-gray-900">Welcome Back</Text>
          <Text className="text-base text-gray-600">Sign in to continue</Text>
        </View>

        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          keyboardType="email-address"
          autoComplete="email"
          error={errors.email}
          editable={!loginMutation.isPending}
        />

        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          autoComplete="password"
          error={errors.password}
          editable={!loginMutation.isPending}
        />

        <TouchableOpacity
          className={`mt-6 rounded-lg py-4 ${loginMutation.isPending ? 'bg-blue-400' : 'bg-blue-600'}`}
          onPress={handleLogin}
          disabled={loginMutation.isPending}>
          <Text className="text-center text-base font-semibold text-white">
            {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
          </Text>
        </TouchableOpacity>

        <View className="mt-6 flex-row justify-center">
          <Text className="text-base text-gray-600">Don&apos;t have an account? </Text>
          <Link href="/auth/register" asChild>
            <TouchableOpacity>
              <Text className="text-base font-semibold text-blue-600">Sign Up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
