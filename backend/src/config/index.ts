import dotenv from 'dotenv';

dotenv.config();

if (!process.env.PORT || !process.env.DB_PORT) {
  throw new Error('Environment variables PORT and DB_PORT must be defined');
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10),
  jwt: {
    secret: process.env.JWT_SECRET || 'development-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  db: {
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME || 'messenger_db',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : '*',
  },
  storage: {
    type: process.env.STORAGE_TYPE || 'local',
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10),
    imageMaxSize: parseInt(process.env.IMAGE_MAX_SIZE || '5242880', 10),
    audioMaxSize: parseInt(process.env.AUDIO_MAX_SIZE || '20971520', 10),
  },
};
