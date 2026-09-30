import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // CORS_ORIGIN: "*" (default) allows any origin, or a comma-separated list to restrict.
  const allowedOrigins = (process.env.CORS_ORIGIN || '*')
    .split(',')
    .map((origin) => origin.trim());
  const corsOrigin = allowedOrigins.includes('*') ? '*' : allowedOrigins;

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: corsOrigin }));
  app.use(morgan('dev'));
  app.use(express.json());

  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
