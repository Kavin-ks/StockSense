import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import { warehouseRouter, locationRouter } from './modules/warehouses/warehouses.routes.js';
import { productRouter, categoryRouter } from './modules/products/products.routes.js';
import operationRoutes from './modules/operations/operations.routes.js';
import moveRoutes from './modules/stock/stock.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import exportRoutes from './modules/export/export.routes.js';
import { avatarUpload } from './middleware/upload.js';
import { asyncHandler } from './utils/asyncHandler.js';
import { pool } from './db/pool.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN }));
  app.use(express.json({ limit: '100kb' }));

  // Static files (uploaded avatars)
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // Public
  app.use('/api/auth', authRoutes);

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
  api.use('/export', exportRoutes);

  // Avatar upload
  api.post('/auth/me/avatar', avatarUpload.single('avatar'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: { message: 'No valid image file provided. Accepted: JPEG, PNG, GIF, WebP (max 2MB).' } });
    const avatarUrl = '/uploads/avatars/' + req.file.filename;
    await pool.query('UPDATE users SET avatar_url = , updated_at = now() WHERE id = ', [avatarUrl, req.user.id]);
    res.json({ avatarUrl });
  }));

  api.delete('/auth/me/avatar', asyncHandler(async (req, res) => {
    await pool.query('UPDATE users SET avatar_url = NULL, updated_at = now() WHERE id = ', [req.user.id]);
    res.json({ avatarUrl: null });
  }));

  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
