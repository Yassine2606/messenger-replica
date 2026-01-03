import { Model, DataTypes, Optional, BelongsToManyAddAssociationsMixin } from 'sequelize';
import { sequelize } from '../config/database';
import { User } from './User';

export interface ConversationAttributes {
  id: number;
  lastMessageId?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ConversationCreationAttributes extends Optional<ConversationAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class Conversation extends Model<ConversationAttributes, ConversationCreationAttributes> implements ConversationAttributes {
  public id!: number;
  public lastMessageId?: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association methods
  public addParticipant!: BelongsToManyAddAssociationsMixin<User, 'id'>;
  public getParticipants?: () => Promise<User[]>;
}

Conversation.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    lastMessageId: {
      type: DataTypes.INTEGER,
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
    tableName: 'conversations',
    indexes: [
      {
        fields: ['lastMessageId'],
      },
      {
        fields: ['updatedAt'],
      },
    ],
  }
);

export default Conversation;
