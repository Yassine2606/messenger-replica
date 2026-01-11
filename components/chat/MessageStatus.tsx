import { Text } from 'react-native';
import type { MessageRead } from '@/models';

interface MessageStatusProps {
  reads?: MessageRead[];
  currentUserId?: number;
}

function getStatus(reads?: MessageRead[], currentUserId?: number): 'sent' | 'delivered' | 'read' {
  if (!reads?.length || !currentUserId) return 'sent';

  // Find the recipient's read status (not the sender)
  const recipientRead = reads.find((r) => r.userId !== currentUserId);
  return recipientRead?.status || 'sent';
}

function getStatusDisplay(status: 'sent' | 'delivered' | 'read') {
  switch (status) {
    case 'read':
      return { text: 'Read', color: 'text-blue-500' };
    case 'delivered':
      return { text: 'Delivered', color: 'text-gray-500' };
    case 'sent':
    default:
      return { text: 'Sent', color: 'text-gray-500' };
  }
}

export function MessageStatus({ reads, currentUserId }: MessageStatusProps) {
  const status = getStatus(reads, currentUserId);
  const display = getStatusDisplay(status);

  return <Text className={`text-xs ${display.color}`}>{display.text}</Text>;
}
