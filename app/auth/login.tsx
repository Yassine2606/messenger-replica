import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useTheme } from '@/contexts';
import { Input } from '@/components/common';
import { useLogin } from '@/hooks';

export default function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
      await loginMutation.mutateAsync({ email, password });
      router.replace('/(tabs)' as any);
    } catch (error: any) {
      const status = error?.response?.status;
      let errorMessage = error?.message || 'An error occurred during login';

      if (status === 429) {
        errorMessage = 'Too many login attempts. Please try again in 15 minutes.';
      } else if (status === 401) {
        errorMessage = 'Invalid email or password.';
      } else if (status === 400) {
        errorMessage =
          error?.response?.data?.error || 'Invalid input. Please check your credentials.';
      }

      Alert.alert('Login Failed', errorMessage);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary, paddingTop: insets.top }}>
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
          <Text style={{ color: colors.text.primary }} className="mb-2 text-3xl font-bold">
            Welcome Back
          </Text>
          <Text style={{ color: colors.text.secondary }} className="text-base">
            Sign in to continue
          </Text>
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
          style={{
            backgroundColor: loginMutation.isPending ? `${colors.primary}80` : colors.primary,
            marginTop: 24,
            borderRadius: 8,
            paddingVertical: 16,
          }}
          onPress={handleLogin}
          disabled={loginMutation.isPending}>
          <Text
            style={{ color: colors.text.inverted }}
            className="text-center text-base font-semibold">
            {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
          </Text>
        </TouchableOpacity>

        <View className="mt-6 flex-row justify-center">
          <Text style={{ color: colors.text.secondary }} className="text-base">
            Don&apos;t have an account?{' '}
          </Text>
          <Link href="/auth/register" asChild>
            <TouchableOpacity>
              <Text style={{ color: colors.primary }} className="text-base font-semibold">
                Sign Up
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
