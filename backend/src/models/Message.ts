import { Model, DataTypes, Optional, ForeignKey } from 'sequelize';
import { sequelize } from '../config/database';
import { Conversation } from './Conversation';
import { User } from './User';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO = 'audio',
}

export interface MessageAttributes {
  id: number;
  conversationId: ForeignKey<Conversation['id']>;
  senderId: ForeignKey<User['id']>;
  type: MessageType;
  content?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaDuration?: number;
  waveform?: string; // JSON stringified number[] for audio waveform
  replyToId?: ForeignKey<Message['id']>;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MessageCreationAttributes extends Optional<MessageAttributes, 'id' | 'isDeleted' | 'createdAt' | 'updatedAt'> {}

export class Message extends Model<MessageAttributes, MessageCreationAttributes> implements MessageAttributes {
  public id!: number;
  public conversationId!: ForeignKey<Conversation['id']>;
  public senderId!: ForeignKey<User['id']>;
  public type!: MessageType;
  public content?: string;
  public mediaUrl?: string;
  public mediaMimeType?: string;
  public mediaDuration?: number;
  public waveform?: string;
  public replyToId?: ForeignKey<Message['id']>;
  public isDeleted!: boolean;
  public deletedAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Message.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    conversationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'conversations',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    senderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    type: {
      type: DataTypes.ENUM(...Object.values(MessageType)),
      allowNull: false,
      defaultValue: MessageType.TEXT,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    mediaUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mediaMimeType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mediaDuration: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    waveform: {
      type: DataTypes.TEXT, // Store as JSON string
      allowNull: true,
      comment: 'Compressed audio waveform data as JSON array',
    },
    replyToId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'messages',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'messages',
    indexes: [
      {
        fields: ['conversationId', 'createdAt'],
      },
      {
        fields: ['conversationId', 'isDeleted', 'createdAt'],
      },
      {
        fields: ['senderId'],
      },
      {
        fields: ['replyToId'],
      },
    ],
  }
);

export default Message;
