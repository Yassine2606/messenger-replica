import { User } from './User';
import { Conversation } from './Conversation';
import { ConversationParticipant } from './ConversationParticipant';
import { Message } from './Message';
import { MessageRead } from './MessageRead';

// Setup associations
const setupAssociations = () => {
  // User to Conversations (many-to-many through ConversationParticipant)
  User.belongsToMany(Conversation, {
    through: ConversationParticipant,
    foreignKey: 'userId',
    otherKey: 'conversationId',
    as: 'conversations',
  });

  Conversation.belongsToMany(User, {
    through: ConversationParticipant,
    foreignKey: 'conversationId',
    otherKey: 'userId',
    as: 'participants',
  });

  // Conversation to Messages
  Conversation.hasMany(Message, {
    foreignKey: 'conversationId',
    as: 'messages',
  });

  Message.belongsTo(Conversation, {
    foreignKey: 'conversationId',
    as: 'conversation',
  });

  // User to Messages (as sender)
  User.hasMany(Message, {
    foreignKey: 'senderId',
    as: 'sentMessages',
  });

  Message.belongsTo(User, {
    foreignKey: 'senderId',
    as: 'sender',
  });

  // Message to Message (reply)
  Message.belongsTo(Message, {
    foreignKey: 'replyToId',
    as: 'replyTo',
  });

  Message.hasMany(Message, {
    foreignKey: 'replyToId',
    as: 'replies',
  });

  // Message to MessageRead
  Message.hasMany(MessageRead, {
    foreignKey: 'messageId',
    as: 'reads',
  });

  MessageRead.belongsTo(Message, {
    foreignKey: 'messageId',
    as: 'message',
  });

  // User to MessageRead
  User.hasMany(MessageRead, {
    foreignKey: 'userId',
    as: 'messageReads',
  });

  MessageRead.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
  });
};

setupAssociations();

export { User, Conversation, ConversationParticipant, Message, MessageRead };
export { MessageType } from './Message';
export { ReadStatus } from './MessageRead';
