import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/error.middleware.js';
import authRoutes from './routes/auth.routes.js';
import deviceRoutes from './routes/device.routes.js';
import userRoutes from './routes/user.routes.js';
import statsRoutes from './routes/stats.routes.js';
import intuneRoutes from './routes/intune.routes.js';
import stockAlertRoutes from './routes/stockAlert.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import deviceModelRoutes from './routes/deviceModel.routes.js';
import lookupRoutes from './routes/lookup.routes.js';
import purchaseOrderRoutes from './routes/purchaseOrder.routes.js';
import { startStockAlertJob } from './jobs/stockAlert.job.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Sécurité ────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Rate limiting strict sur les routes auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Trop de tentatives, réessayez dans 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Parsing ─────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ──────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), mode: process.env.AUTH_MODE || 'local' });
});

app.use('/api/auth',    authLimiter, authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/users',   userRoutes);
app.use('/api/stats',   statsRoutes);
app.use('/api/intune',       intuneRoutes);
app.use('/api/stockalerts',   stockAlertRoutes);
app.use('/api/reports',       reportsRoutes);
app.use('/api/devicemodels',  deviceModelRoutes);
app.use('/api/lookup',        lookupRoutes);
app.use('/api/orders',        purchaseOrderRoutes);

// ─── Gestion des erreurs ──────────────────────────────────────
app.use(errorHandler);

// ─── Démarrage ───────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀 Backend ITAM Pro démarré sur http://localhost:${PORT}`);
  logger.info(`📋 Mode authentification : ${process.env.AUTH_MODE || 'local'}`);
  startStockAlertJob();
});

export default app;
