import rateLimit from 'express-rate-limit';

/**
 * Limitador estricto para inicio de sesión contra ataques de fuerza bruta y diccionario.
 * Configurado según la política acordada en grill-me: 10 intentos cada 15 minutos por IP
 * para permitir la operación fluida de varios miembros de staff en la misma red WiFi del evento.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 solicitudes por ventana
  standardHeaders: true, // Retorna RateLimit-* en cabeceras
  legacyHeaders: false, // Deshabilita cabeceras X-RateLimit-* obsoletas
  message: {
    error: 'Demasiados intentos de inicio de sesión desde esta conexión. Por seguridad, intenta nuevamente en 15 minutos.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

/**
 * Limitador para evitar acaparamiento y compras masivas de boletos por bots.
 * Máximo 25 reservas de boletos cada 15 minutos por IP.
 */
export const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
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
 * Máximo 60 consultas cada 15 minutos por IP.
 */
export const certificateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Límite de consultas de certificados alcanzado. Intenta nuevamente en unos minutos.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

/**
 * Limitador general para la API.
 * Máximo 400 solicitudes por cada 15 minutos por IP.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiadas solicitudes enviadas al servidor. Por favor intenta más tarde.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

