import { Message, PaginatedResponse } from '@/models';

export interface MessagesPages { pages?: PaginatedResponse<Message>[] }

/**
 * Check whether the message ID exists in any page
 */
export function messageExistsInPages(old: MessagesPages | undefined, messageId: number): boolean {
  if (!old?.pages) return false;
  return old.pages.some((p) => (p.data || []).some((m) => m.id === messageId));
}

/**
 * Prepend a server message into pages[0] (newest page) if it doesn't already exist.
 * Returns a new object reference when modified, otherwise returns the original `old`.
 */
export function prependMessageToPages(old: MessagesPages | undefined, message: Message) {
  if (!old) {
    return {
      pages: [{ data: [message], pagination: { hasNext: false, hasPrevious: false } }],
      pageParams: [undefined],
    } as any;
  }

  if (!old.pages || !Array.isArray(old.pages)) return old;

  if (messageExistsInPages(old, message.id)) return old;

  const newPages = [...old.pages];
  const firstPage = newPages[0] || { data: [], pagination: { hasNext: false, hasPrevious: false } };

  newPages[0] = {
    ...firstPage,
    data: [message, ...(firstPage.data || [])],
  };

  return { ...old, pages: newPages };
}
