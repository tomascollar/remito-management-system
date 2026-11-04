# Sistema de remitos digitales — "DOÑA LOLI"

Proyecto Final de Carrera de la **Licenciatura en Sistemas de Información (FaCENA, UNNE)**:
**_Técnicas de Seguridad aplicadas a un Sistema de Gestión de Remitos Digitales_**.

**Autor:** Tomas Collar

El sistema digitaliza los remitos de un puesto de mercado que antes registraba sus ventas en papel, y está en uso en el puesto. La app de remitos es el **banco de pruebas**. El foco del trabajo está en diseñar, aplicar y evaluar técnicas de seguridad web, documentando cada una con pruebas antes/después.

## Técnicas de seguridad aplicadas

- **Autenticación con JWT**. Además de verificar la firma, en cada request se consulta el estado vigente del usuario (`activo`, `rol`), así que un usuario desactivado pierde el acceso al instante.
- **RBAC** con tres perfiles (`superadmin`, `administrador`, `vendedor`) y una matriz de permisos explícita por endpoint.
- **Contraseñas con bcrypt**. El login no permite enumerar emails: el mensaje y el tiempo de respuesta son los mismos para un usuario inexistente que para una contraseña incorrecta.
- **Rate limiting**, **validación y sanitización** de entradas, **Helmet con CSP** propia y **CORS cerrado** por defecto.
- **Gestión de secretos**. El servidor no arranca si falta un secreto o es débil, y no hay valores por defecto inseguros.
- **Backups diarios cifrados** (GPG AES-256) con un usuario de base de datos de solo lectura.
- **Agente de impresión** con clave propia y solo conexiones de salida (no abre puertos en el puesto).
- **Laboratorio de seguridad**: panel solo para el superadmin, apagado por defecto, para demostrar las defensas en vivo.

## Stack

TypeScript · Node.js + Express 5 · MongoDB Atlas + Mongoose · React 19 + Vite + Tailwind CSS ·
Jest + Supertest y Vitest · GitHub Actions · Render.

## Estructura

```
backend/           API REST (Express)
frontend/          Aplicación web (React + Vite)
agente-impresion/  Agente local que imprime los tickets en la térmica (ESC/POS)
render.yaml        Despliegue en Render
.github/workflows/ CI (tests) y backup diario de MongoDB
```

## Ejecutar en local

Requisitos: Node.js 22 y una base MongoDB.

```bash
# Backend
cd backend
cp .env.example .env    # completar MONGODB_URI y JWT_SECRET
npm install
npm run dev

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```

El primer usuario superadmin se crea con `backend/scripts/crear-superadmin.ts`. Las instrucciones de uso están al principio del script.

## Pruebas

```bash
cd backend && npm test
cd frontend && npm test
cd agente-impresion && npm test
```

El CI corre las tres suites en cada push y pull request.

## Licencia

© 2026 Tomas Collar. **Todos los derechos reservados.** El código se publica solo para consulta y evaluación académica. Ver [LICENSE](LICENSE).
