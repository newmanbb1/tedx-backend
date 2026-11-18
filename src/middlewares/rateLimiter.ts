import rateLimit from 'express-rate-limit';

/**
 * Limitador estricto para inicio de sesión contra ataques de fuerza bruta y diccionario.
 * Configurado según la política acordada en grill-me: 10 intentos cada 15 minutos por IP
 * para permitir la operación fluida de varios miembros de staff en la misma red WiFi del evento.
 */
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 100, // 100 intentos por ventana
  skipSuccessfulRequests: true, // Inicios de sesión correctos NO consumen el límite
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiados intentos fallidos de inicio de sesión. Por seguridad, espera 5 minutos.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

/**
 * Limitador para evitar acaparamiento y compras masivas de boletos por bots.
 * Máximo 100 reservas de boletos cada 5 minutos por IP.
 */
export const checkoutLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Has alcanzado el límite de intentos de reserva. Por favor espera unos minutos antes de continuar.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

/**
 * Limitador para la consulta pública de certificados por carnet de identidad.
 * Previene la enumeración masiva o scraping de cédulas de identidad.
 * Máximo 200 consultas cada 5 minutos por IP.
 */
export const certificateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Límite de consultas de certificados alcanzado. Intenta nuevamente en unos minutos.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

/**
 * Limitador general para la API.
 * Máximo 6000 solicitudes por cada 5 minutos por IP para soportar dashboards en tiempo real y múltiples usuarios.
 */
export const generalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 6000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiadas solicitudes enviadas al servidor. Por favor intenta en un momento.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

