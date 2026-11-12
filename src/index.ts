import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';
import apiRouter from './routes/index.js';
import { OrderService } from './services/order.service.js';
import { generalLimiter } from './middlewares/rateLimiter.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Cabeceras de seguridad HTTP con Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);

const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: [clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.resolve(process.cwd(), 'uploads');
app.use(
  '/uploads',
  express.static(uploadsDir, {
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  })
);

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'TEDx Ticketing Backend API',
  });
});

// Limitador general de peticiones en la API
app.use('/api', generalLimiter);
app.use('/api', apiRouter);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error no controlado:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Error interno del servidor',
  });
});

setInterval(async () => {
  try {
    const released = await OrderService.checkAndReleaseExpiredOrders();
    if (released > 0) {
      console.log(`[Cleaner] Se liberaron cupos de ${released} órdenes expiradas.`);
    }
  } catch (err) {
    console.error('[Cleaner] Error al limpiar órdenes expiradas:', err);
  }
}, 5 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend TEDx corriendo en http://localhost:${PORT}`);
  console.log(`📂 Carpeta de comprobantes: ${uploadsDir}`);
});

