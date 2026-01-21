import { Model, DataTypes, ForeignKey } from 'sequelize';
import { sequelize } from '../config/database';
import { User } from './User';
import { Conversation } from './Conversation';

export interface ConversationParticipantAttributes {
  conversationId: ForeignKey<Conversation['id']>;
  userId: ForeignKey<User['id']>;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ConversationParticipant
  extends Model<ConversationParticipantAttributes>
  implements ConversationParticipantAttributes
{
  public conversationId!: ForeignKey<Conversation['id']>;
  public userId!: ForeignKey<User['id']>;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ConversationParticipant.init(
  {
    conversationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'conversations',
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
    tableName: 'conversation_participants',
    indexes: [
      {
        unique: true,
        fields: ['conversationId', 'userId'],
      },
      {
        fields: ['userId', 'conversationId'],
      },
    ],
  }
);

export default ConversationParticipant;
