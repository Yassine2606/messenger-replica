import { MessageService } from '../services/message.service';
import { MessageDTO, UnifiedMessageEvent, UnifiedStatusUpdateEvent } from '../types';
import { ReadStatus } from '../models/MessageRead';

/**
 * Batch mark messages with status for multiple users in single query
 */
export async function batchMarkMessages(
  messageIds: number[],
  userIds: number[],
  status: ReadStatus,
  messageService: MessageService
): Promise<void> {
  if (!messageIds.length || !userIds.length) return;
  
  const rows = messageIds.flatMap(msgId =>
    userIds.map(userId => ({ messageId: msgId, userId, status, readAt: new Date() }))
  );
  
  await messageService.bulkUpsertMessageReads(rows);
}

/**
 * Create unified message event with unread counts
 */
export async function createMessageEvent(
  conversationId: number,
  message: MessageDTO,
  participantIds: number[],
  messageService: MessageService
): Promise<UnifiedMessageEvent> {
  const unreadCounts = await messageService.getUnreadCountsForConversation(
    conversationId,
    participantIds
  );

  return {
    conversationId,
    message,
    conversationUpdates: participantIds.map(id => ({
      userId: id,
      unreadCount: unreadCounts.get(id) || 0,
    })),
  };
}

/**
 * Create unified status update event
 */
export async function createStatusEvent(
  conversationId: number,
  messageIds: number[],
  userId: number,
  status: ReadStatus,
  participantIds: number[],
  messageService: MessageService
): Promise<UnifiedStatusUpdateEvent> {
  const unreadCounts = await messageService.getUnreadCountsForConversation(
    conversationId,
    participantIds
  );

  return {
    conversationId,
    updates: messageIds.map(id => ({
      messageId: id,
      userId,
      status,
      readAt: new Date().toISOString(),
    })),
    conversationUpdates: participantIds.map(id => ({
      userId: id,
      unreadCount: unreadCounts.get(id) || 0,
    })),
  };
}
