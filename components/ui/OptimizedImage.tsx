import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import type { ImageProps } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

interface OptimizedImageProps extends Omit<ImageProps, 'style'> {
  style?: ImageProps['style'];
  timeout?: number;
  fallbackSize?: number;
}

/**
 * Image component with timeout and error handling
 * Falls back to error state if image takes too long to load
 */
export function OptimizedImage({
  timeout = 15000,
  fallbackSize = 48,
  onError,
  ...props
}: OptimizedImageProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set timeout for image load
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        setLoadFailed(true);
        setIsLoading(false);
        console.warn(`[OptimizedImage] Image load timeout (${timeout}ms):`, props.source);
      }
    }, timeout);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [timeout, isLoading, props.source]);

  const handleLoadStart = () => {
    setIsLoading(true);
    if (props.onLoadStart) {
      props.onLoadStart();
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
    if (props.onLoad) {
      (props.onLoad as any)();
    }
  };

  const handleError = (error: any) => {
    setLoadFailed(true);
    setIsLoading(false);
    console.error('[OptimizedImage] Image load error:', props.source, error);
    if (onError) {
      onError(error);
    }
  };

  if (loadFailed) {
    return (
      <View
        className="items-center justify-center bg-gray-200"
        style={{
          width: typeof props.style === 'object' && props.style && 'width' in props.style
            ? (props.style as any).width
            : fallbackSize * 4,
          height: typeof props.style === 'object' && props.style && 'height' in props.style
            ? (props.style as any).height
            : fallbackSize * 4,
        }}>
        <Ionicons name="image-outline" size={fallbackSize} color="#9CA3AF" />
      </View>
    );
  }

  return (
    <Image
      {...props}
      onLoadStart={handleLoadStart}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}
