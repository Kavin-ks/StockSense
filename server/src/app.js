import express from 'express';
import './config/zod.js';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import { warehouseRouter, locationRouter } from './modules/warehouses/warehouses.routes.js';
import { productRouter, categoryRouter } from './modules/products/products.routes.js';
import operationRoutes from './modules/operations/operations.routes.js';
import moveRoutes from './modules/stock/stock.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import userRoutes from './modules/users/users.routes.js';
import realtimeRoutes from './modules/realtime/realtime.routes.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // Public
  app.use('/api/auth', authRoutes);
  // Live updates: token endpoint uses the session header, the stream uses a 60s stream token.
  app.use('/api/events', realtimeRoutes);

  // Everything below requires a valid session
  const api = express.Router();
  api.use(requireAuth);
  api.use('/dashboard', dashboardRoutes);
  api.use('/warehouses', warehouseRouter);
  api.use('/locations', locationRouter);
  api.use('/categories', categoryRouter);
  api.use('/products', productRouter);
  api.use('/operations', operationRoutes);
  api.use('/moves', moveRoutes);
  api.use('/users', userRoutes);
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
