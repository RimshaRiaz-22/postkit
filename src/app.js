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
  const allowAll = allowedOrigins.includes('*');

  // Any localhost / 127.0.0.1 / LAN dev origin on any port is always allowed,
  // so changing the Vite port (5173, 5174, ...) never causes a CORS error.
  const devOrigin =
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|(192\.168|10)\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+)(:\d+)?$/;

  const corsOptions = {
    origin(origin, callback) {
      // No Origin header (curl, server-to-server) or an allowed origin.
      if (!origin || allowAll || devOrigin.test(origin) || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
  };

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors(corsOptions));
  app.use(morgan('dev'));
  app.use(express.json());

  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
