import { Model, DataTypes, ForeignKey } from 'sequelize';
import { sequelize } from '../config/database';
import { Message } from './Message';
import { User } from './User';

export enum ReadStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
}

export interface MessageReadAttributes {
  id: number;
  messageId: ForeignKey<Message['id']>;
  userId: ForeignKey<User['id']>;
  status: ReadStatus;
  readAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class MessageRead extends Model<MessageReadAttributes> implements MessageReadAttributes {
  public id!: number;
  public messageId!: ForeignKey<Message['id']>;
  public userId!: ForeignKey<User['id']>;
  public status!: ReadStatus;
  public readAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

MessageRead.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    messageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'messages',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    status: {
      type: DataTypes.ENUM(...Object.values(ReadStatus)),
      allowNull: false,
      defaultValue: ReadStatus.SENT,
    },
    readAt: {
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
    tableName: 'message_reads',
    indexes: [
      {
        unique: true,
        fields: ['messageId', 'userId'],
      },
      {
        fields: ['userId', 'status'],
      },
      {
        fields: ['status'],
      },
      {
        name: 'message_reads_user_status_idx',
        fields: ['userId', 'status', 'messageId'],
      },
    ],
  }
);

export default MessageRead;
