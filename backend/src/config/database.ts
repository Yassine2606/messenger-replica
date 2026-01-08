import { Sequelize } from 'sequelize';
import { config } from './index';

export const sequelize = new Sequelize({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  username: config.db.username,
  password: config.db.password,
  dialect: 'postgres',
  logging: config.env === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

export const initDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connection established');
    await sequelize.sync({ alter: true });
    console.log('✓ Database models synchronized');
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    process.exit(1);
  }
};
