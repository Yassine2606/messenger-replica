import React from 'react';
import { View, Text } from 'react-native';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.componentName ? `: ${this.props.componentName}` : ''}]`,
      error,
      errorInfo
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <View className="items-center justify-center rounded-lg border border-red-200 bg-red-50 p-4">
            <Text className="text-sm font-semibold text-red-900">
              {this.props.componentName
                ? `Error in ${this.props.componentName}`
                : 'Something went wrong'}
            </Text>
            <Text className="mt-1 text-xs text-red-700">
              {this.state.error?.message || 'An unexpected error occurred'}
            </Text>
          </View>
        )
      );
    }

    return this.props.children;
  }
}
