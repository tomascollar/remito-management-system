/**
 * Aplicación Express (sin arrancar el servidor ni conectar a la base).
 *
 * Está separada de server.ts para poder importarla en pruebas (Supertest) sin abrir un puerto.
 * En producción esta misma aplicación sirve la API (/api) Y el frontend compilado, así hay un
 * solo origen: no hace falta CORS y el navegador habla con un único dominio con HTTPS.
 */
import 'dotenv/config'; // PRIMERO: los módulos de abajo leen process.env al cargarse
import fs from 'fs';
import path from 'path';
import express, { Application, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { entorno } from './config/entorno';

import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import stockDiarioRoutes from './routes/stockDiarioRoutes';
import remitoRoutes from './routes/remitoRoutes';
import userRoutes from './routes/userRoutes';
import securityLabRoutes from './routes/securityLabRoutes';
import { limiteGeneral } from './middleware/rateLimiter';
import { laboratorioActivo } from './security/securityConfig';
import impresionRoutes from './routes/impresionRoutes';
import impresionAgenteRoutes from './routes/impresionAgenteRoutes';
import { limiteAgente, limiteFallosAgente, verificarAgente } from './middleware/agenteMiddleware';

export const app: Application = express();

// Detrás de Render hay un proxy: sin esto req.ip sería la IP del proxy y el rate limiting no serviría.
app.set('trust proxy', entorno.trustProxy);

/*
 * Cabeceras de seguridad (helmet). La política de contenido (CSP) solo permite cargar scripts,
 * estilos, fuentes e imágenes del propio dominio: si alguien lograra inyectar un <script> ajeno
 * (XSS), el navegador se negaría a ejecutarlo. Los comentarios explican cada excepción.
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"], // React usa estilos en línea (p. ej. el modal)
        'img-src': ["'self'", 'data:', 'blob:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        // El ticket se abre como PDF desde un blob: del propio navegador
        'object-src': ["'self'", 'blob:'],
        'frame-src': ["'self'", 'blob:'],
        'frame-ancestors': ["'none'"], // nadie puede incrustar la app en otra página (clickjacking)
        // Si se prueba el build por http (sin HTTPS) esta directiva rompería la carga
        'upgrade-insecure-requests': entorno.produccion ? [] : null,
      },
    },
  })
);

// CORS: cerrado por defecto (mismo origen). Solo se abre a los orígenes listados en CORS_ORIGIN.
if (entorno.corsOrigenes.length > 0) {
  app.use(cors({ origin: entorno.corsOrigenes }));
}

    const jsonGeneral = express.json({ limit: '100kb' });
    app.use((req, res, next) => (req.method === 'POST' && req.path === '/api/impresion/trabajos' ? next() : jsonGeneral(req, res, next)));

/** Chequeo de salud para la plataforma (Render lo consulta). Va antes del limitador a propósito. */
app.get('/api/health', (_req, res) => {
  const baseOk = mongoose.connection.readyState === 1;
  res.status(baseOk ? 200 : 503).json({ status: baseOk ? 'ok' : 'sin base de datos' });
});

// Laboratorio de seguridad (demostración): solo existe si SECURITY_LAB=true. Se monta ANTES del
// limitador general para que, al demostrar límites bajos, el propio laboratorio no quede bloqueado.
if (laboratorioActivo()) {
  app.use('/api/security-lab', securityLabRoutes);
  console.warn('⚠️  SECURITY_LAB activo: el laboratorio de seguridad está disponible.');
  if (entorno.produccion) console.warn('⚠️  Estás en producción con el laboratorio ACTIVO. Desactivalo (SECURITY_LAB=false) cuando termine la demostración.');
}

app.use('/api/impresion/agente', limiteAgente, limiteFallosAgente, verificarAgente, impresionAgenteRoutes);

// El límite general protege solo la API: cargar el frontend (muchos archivos) no debe gastar el cupo.
app.use('/api', limiteGeneral);

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stock-diario', stockDiarioRoutes);
app.use('/api/remitos', remitoRoutes);
app.use('/api/users', userRoutes);


app.use('/api/impresion', impresionRoutes);

// Cualquier otra ruta de /api es un error 404 en JSON (no debe devolver la página del frontend)
app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

/*
 * Frontend compilado. Solo se sirve si existe la carpeta (en desarrollo no existe y se usa
 * el servidor de Vite). Los archivos de /assets llevan un hash en el nombre, por eso pueden
 * guardarse en caché un año; index.html nunca, para que las versiones nuevas se vean enseguida.
 */
const indexHtml = path.join(entorno.frontendDist, 'index.html');
if (fs.existsSync(indexHtml)) {
  app.use(
    express.static(entorno.frontendDist, {
      index: false,
      setHeaders: (res, ruta) => {
        if (ruta.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    })
  );

  // Rutas del frontend (React Router): al recargar /remitos/123 el servidor devuelve la app
  app.get('/{*ruta}', (req, res, next) => {
    // Un archivo que no existe (.js, .css, .map…) debe dar 404, no la página principal
    if (path.extname(req.path)) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });
} else {
  app.get('/', (_req, res) => {
    res.json({ message: 'API de Remitos funcionando! (frontend sin compilar: usar el servidor de Vite)' });
  });
}

// Manejo final de errores: nunca se devuelve el detalle interno al cliente
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ message: 'El cuerpo de la petición no es un JSON válido' });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ message: 'La petición es demasiado grande' });
    return;
  }
  console.error('Error no controlado:', err);
  res.status(500).json({ message: 'Error interno del servidor' });
});
