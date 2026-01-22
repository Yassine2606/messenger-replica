import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import { useTheme } from '@/contexts';
import { Input } from '@/components/common';
import { FormScreenLayout } from '@/components/layouts';
import { useRegister } from '@/hooks';

export default function RegisterScreen() {
  const { colors } = useTheme();
  const registerMutation = useRegister();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validate = () => {
    const newErrors: {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

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

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    try {
      await registerMutation.mutateAsync({
        name,
        email,
        password,
      });
      router.replace('/(tabs)' as any);
    } catch (error: any) {
      const status = error?.response?.status;
      let errorMessage = error?.message || 'An error occurred during registration';

      if (status === 429) {
        errorMessage = 'Too many registration attempts. Please try again in 15 minutes.';
      } else if (status === 400) {
        errorMessage = error?.response?.data?.error || 'Email already registered or invalid input.';
      }

      Alert.alert('Registration Failed', errorMessage);
    }
  };

  return (
    <FormScreenLayout>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingBottom: 16,
        }}
        keyboardShouldPersistTaps="handled">
        <View className="mb-8">
          <Text style={{ color: colors.text.primary }} className="mb-2 text-3xl font-bold">
            Create Account
          </Text>
          <Text style={{ color: colors.text.secondary }} className="text-base">
            Sign up to get started
          </Text>
        </View>

        <Input
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="John Doe"
          autoComplete="name"
          error={errors.name}
          editable={!registerMutation.isPending}
        />

        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          keyboardType="email-address"
          autoComplete="email"
          error={errors.email}
          editable={!registerMutation.isPending}
        />

        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          autoComplete="password-new"
          error={errors.password}
          editable={!registerMutation.isPending}
        />

        <Input
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="••••••••"
          secureTextEntry
          autoComplete="password-new"
          error={errors.confirmPassword}
          editable={!registerMutation.isPending}
        />

        <TouchableOpacity
          style={{
            backgroundColor: registerMutation.isPending ? `${colors.primary}80` : colors.primary,
            marginTop: 24,
            borderRadius: 8,
            paddingVertical: 16,
          }}
          onPress={handleRegister}
          disabled={registerMutation.isPending}>
          <Text
            style={{ color: colors.text.inverted }}
            className="text-center text-base font-semibold">
            {registerMutation.isPending ? 'Creating account...' : 'Sign Up'}
          </Text>
        </TouchableOpacity>

        <View className="mt-6 flex-row justify-center">
          <Text style={{ color: colors.text.secondary }} className="text-base">
            Already have an account?{' '}
          </Text>
          <Link href="/auth/login" asChild>
            <TouchableOpacity>
              <Text style={{ color: colors.primary }} className="text-base font-semibold">
                Sign In
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </FormScreenLayout>
  );
}
