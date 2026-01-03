import express, { Application } from 'express';
import { createServer, Server as HTTPServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { config } from './config';
import { initDatabase } from './config/database';
import { initializeSocket } from './socket';
import routes from './routes';
import { errorHandler } from './middleware';
import './models';

export class App {
  public app: Application;
  public httpServer: HTTPServer;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupSocket();
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(
      cors({
        origin: config.cors.origin,
        credentials: true,
      })
    );
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Serve uploaded files statically
    this.app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

    if (config.env === 'development') {
      this.app.use(morgan('dev'));
    }
  }

  private setupRoutes(): void {
    this.app.get('/health', (_req, res) => {
      res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    this.app.use('/api', routes);
  }

  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  private setupSocket(): void {
    initializeSocket(this.httpServer);
  }

  public async start(): Promise<void> {
    try {
      await initDatabase();

      this.httpServer.listen(config.port, () => {
        console.log(`✓ Server running on port ${config.port}`);
        console.log(`✓ Environment: ${config.env}`);
        console.log(`✓ Socket.IO initialized`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

const app = new App();
app.start();
