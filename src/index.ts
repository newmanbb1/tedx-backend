import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';
import apiRouter from './routes/index.js';
import { OrderService } from './services/order.service.js';
import { generalLimiter } from './middlewares/rateLimiter.js';
import { prisma } from './config/prisma.js';

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

// Configuración dinámica de CORS para producción y desarrollo
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((url) => url.trim().replace(/\/$/, ''));

if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173');
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones sin origen (curl, apps móviles, proxy inverso en mismo host)
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/$/, '');
      if (allowedOrigins.includes(cleanOrigin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} no permitido por política CORS`));
    },
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

// Health check para monitoreo en producción (Docker, Kubernetes, UptimeRobot)
app.get('/api/health', async (_req: Request, res: Response) => {
  let dbStatus = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    dbStatus = 'disconnected';
  }

  const isHealthy = dbStatus === 'ok';
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    database: dbStatus,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    service: 'TEDx Ticketing Backend API',
  });
});

// Limitador general de peticiones en la API
app.use('/api', generalLimiter);
app.use('/api', apiRouter);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error procesando solicitud:', err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'El archivo es demasiado grande (máximo 50MB permitidos). Por favor comprime o reduce el peso de la imagen.',
    });
  }
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Error interno del servidor',
  });
});

const cleanupInterval = setInterval(async () => {
  try {
    const released = await OrderService.checkAndReleaseExpiredOrders();
    if (released > 0) {
      console.log(`[Cleaner] Se liberaron cupos de ${released} órdenes expiradas.`);
    }
  } catch (err) {
    console.error('[Cleaner] Error al limpiar órdenes expiradas:', err);
  }
}, 5 * 60 * 1000);

const server = app.listen(PORT, () => {
  console.log(`Servidor backend TEDx corriendo en http://localhost:${PORT}`);
  console.log(`Carpeta de comprobantes: ${uploadsDir}`);
});

// Cierre graceful ante señales de detención en entornos productivos
const gracefulShutdown = (signal: string) => {
  console.log(`[Server] Recibida señal ${signal}. Cerrando servidor limpiamente...`);
  clearInterval(cleanupInterval);
  server.close(async () => {
    console.log('[Server] Servidor HTTP cerrado.');
    try {
      await prisma.$disconnect();
      console.log('[Prisma] Conexión a base de datos finalizada.');
      process.exit(0);
    } catch (e) {
      console.error('[Prisma] Error cerrando conexión:', e);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

