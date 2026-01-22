import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/contexts';
import { CustomModal, Button } from '@/components/common';

interface LeaveConversationModalProps {
  visible: boolean;
  conversationName: string;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

function LeaveConversationModalComponent({
  visible,
  conversationName,
  onClose,
  onConfirm,
  isLoading = false,
}: LeaveConversationModalProps) {
  const { colors } = useTheme();

  return (
    <CustomModal
      visible={visible}
      title="Leave Conversation"
      onClose={onClose}>
      <View className="pb-8">
        {/* Warning Content */}
        <View className="mb-6">
          <Text style={{ color: colors.text.secondary }} className="mb-4 text-base leading-6">
            Are you sure you want to leave{' '}
            <Text style={{ color: colors.text.primary }} className="font-semibold">
              {conversationName}
            </Text>
            ? You won't be able to see messages from this conversation anymore.
          </Text>
        </View>

        {/* Action Buttons */}
        <View className="gap-2">
          <Button
            label={isLoading ? 'Leaving...' : 'Leave Conversation'}
            onPress={onConfirm}
            loading={isLoading}
            variant="destructive"
          />
          <Button
            label="Cancel"
            onPress={onClose}
            variant="secondary"
            disabled={isLoading}
          />
        </View>
      </View>
    </CustomModal>
  );
}

export const LeaveConversationModal = React.memo(LeaveConversationModalComponent, (prev, next) => {
  return (
    prev.visible === next.visible &&
    prev.conversationName === next.conversationName &&
    prev.onClose === next.onClose &&
    prev.onConfirm === next.onConfirm &&
    prev.isLoading === next.isLoading
  );
});
LeaveConversationModal.displayName = 'LeaveConversationModal';
