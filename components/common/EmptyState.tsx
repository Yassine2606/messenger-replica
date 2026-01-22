import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts';

interface EmptyStateProps {
  iconName?: string;
  title: string;
  description?: string;
  compact?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  flipX?: boolean;
  flipY?: boolean;
}

export function EmptyState({
  iconName = 'chatbubble-ellipses-outline',
  title,
  description,
  compact = false,
  actionLabel,
  onAction,
  flipX = false,
  flipY = false,
}: EmptyStateProps) {
  const { colors } = useTheme();

  // Root is flipped to counter parent inversion (e.g., inverted FlatList).
  // Inner content remains untransformed so text, icon and button stay upright and centered.
  const rootTransform = [{ scaleX: flipX ? -1 : 1 }, { scaleY: flipY ? -1 : 1 }];

  return (
    <View
      style={{ flex: 1, transform: rootTransform, alignItems: 'center', justifyContent: 'center' }}
      className={`${compact ? 'py-6' : 'py-20'}`}>
      <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <Ionicons name={iconName as any} size={compact ? 40 : 48} color={colors.text.tertiary} />

        <Text
          style={{ color: colors.text.primary, textAlign: 'center', marginTop: compact ? 8 : 12 }}
          className={`${compact ? 'text-lg' : 'text-xl'} font-semibold`}>
          {title}
        </Text>

        {description ? (
          <Text
            style={{ color: colors.text.secondary, textAlign: 'center', marginTop: compact ? 4 : 8, paddingHorizontal: 16 }}
            className={`${compact ? 'text-sm' : 'text-base'}`}>
            {description}
          </Text>
        ) : null}

        {actionLabel && onAction ? (
          <TouchableOpacity
            onPress={onAction}
            activeOpacity={0.8}
            className="mt-4 rounded-md px-4 py-2 shadow-sm"
            style={{ backgroundColor: colors.primary }}>
            <Text style={{ color: colors.text.inverted }} className="font-medium">
              {actionLabel}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export default React.memo(EmptyState);