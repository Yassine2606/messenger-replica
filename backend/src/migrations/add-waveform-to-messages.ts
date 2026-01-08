import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.addColumn('messages', 'waveform', {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Compressed audio waveform data as JSON array',
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.removeColumn('messages', 'waveform');
}
