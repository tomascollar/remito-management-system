// Prueba la configuración de PRODUCCIÓN de la aplicación: validación de variables de entorno,
// cabeceras de seguridad, servicio del frontend compilado y manejo de rutas/errores.
// No necesita base de datos ni internet: usa un frontend de mentira en una carpeta temporal.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

// Entorno de producción simulado, ANTES de importar la app (que lo lee al cargarse)
const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-'));
fs.mkdirSync(path.join(dist, 'assets'));
fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Remitos</title><div id="root"></div>');
fs.writeFileSync(path.join(dist, 'assets', 'app-abc123.js'), 'console.log(1)');
Object.assign(process.env, {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb+srv://usuario:clave@cluster.mongodb.net/prueba',
  JWT_SECRET: 'x'.repeat(48),
  FRONTEND_DIST: dist,
});
delete process.env.SECURITY_LAB;

let n = 0;
const ok = (t: string) => console.log(`  ✔ ${t}`) || n++;

(async () => {
  const { cargarEntorno } = await import('../src/config/entorno');
  const base = { MONGODB_URI: 'mongodb://localhost/x', JWT_SECRET: 'y'.repeat(40), NODE_ENV: 'production' } as NodeJS.ProcessEnv;

  // ---------- Validación del entorno ----------
  assert.throws(() => cargarEntorno({ ...base, JWT_SECRET: undefined }), /JWT_SECRET no está definida/);
  assert.throws(() => cargarEntorno({ ...base, MONGODB_URI: undefined }), /MONGODB_URI no está definida/);
  assert.throws(() => cargarEntorno({ ...base, JWT_SECRET: 'corta' }), /demasiado corta/);
  assert.throws(() => cargarEntorno({ ...base, JWT_SECRET: 'cambiar-por-un-secreto-largo-y-aleatorio-123456' }), /valor de ejemplo/);
  assert.throws(() => cargarEntorno({ ...base, MONGODB_URI: 'http://no-es-mongo' }), /mongodb/);
  assert.throws(() => cargarEntorno({ ...base, CORS_ORIGIN: '*' }), /no puede ser "\*"/);
  assert.throws(() => cargarEntorno({ ...base, PORT: 'abc' }), /PORT/);
  assert.throws(() => cargarEntorno({ ...base, TRUST_PROXY: '99' }), /TRUST_PROXY/);
  ok('entorno: falta de variables, secreto corto o de ejemplo, URI, "*" en CORS, PORT y TRUST_PROXY inválidos → no arranca');

  const prod = cargarEntorno(base);
  assert.equal(prod.trustProxy, 1); assert.equal(prod.puerto, 5000); assert.deepEqual(prod.corsOrigenes, []);
  assert.equal(cargarEntorno({ ...base, NODE_ENV: 'development', JWT_SECRET: 'corta-pero-en-desarrollo' }).trustProxy, false);
  assert.equal(cargarEntorno({ ...base, TRUST_PROXY: '2' }).trustProxy, 2);
  assert.equal(cargarEntorno({ ...base, TRUST_PROXY: 'false' }).trustProxy, false);
  assert.deepEqual(cargarEntorno({ ...base, CORS_ORIGIN: 'https://a.com, https://b.com' }).corsOrigenes, ['https://a.com', 'https://b.com']);
  ok('entorno: en producción confía en 1 proxy y cierra CORS; en desarrollo acepta secreto corto; TRUST_PROXY y CORS_ORIGIN se leen bien');

  // ---------- Aplicación ----------
  const { app } = await import('../src/app');
  const servidor = app.listen(0);
  const url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  const pedir = (ruta: string, init: RequestInit = {}) => fetch(url + ruta, init);

  try {
    let r = await pedir('/');
    let html = await r.text();
    assert.equal(r.status, 200); assert.match(html, /<div id="root">/);
    assert.equal(r.headers.get('cache-control'), 'no-cache');
    ok('/ devuelve la app (index.html) sin caché');

    r = await pedir('/remitos/123/detalle');
    html = await r.text();
    assert.equal(r.status, 200); assert.match(html, /<div id="root">/);
    ok('una ruta del frontend recargada directamente (/remitos/123/detalle) devuelve la app');

    r = await pedir('/assets/app-abc123.js');
    assert.equal(r.status, 200); assert.match(r.headers.get('cache-control') ?? '', /immutable/);
    ok('los archivos de /assets se guardan en caché un año (immutable)');

    r = await pedir('/assets/no-existe.js');
    assert.equal(r.status, 404); assert.ok(!(await r.text()).includes('<div id="root">'));
    ok('un archivo inexistente da 404 (no devuelve la página principal)');

    r = await pedir('/api/ruta-inexistente');
    assert.equal(r.status, 404); assert.equal((await r.json()).message, 'Ruta no encontrada');
    ok('una ruta desconocida de /api da 404 en JSON');

    r = await pedir('/api/health');
    assert.equal(r.status, 503); assert.equal((await r.json()).status, 'sin base de datos');
    ok('/api/health informa 503 si no hay conexión con la base');

    // Cabeceras de seguridad
    r = await pedir('/');
    const csp = r.headers.get('content-security-policy') ?? '';
    assert.match(csp, /default-src 'self'/); assert.match(csp, /script-src 'self'(;|$)/);
    assert.match(csp, /frame-ancestors 'none'/); assert.ok(!csp.includes('unsafe-eval'), 'sin unsafe-eval');
    assert.ok(!/script-src[^;]*unsafe-inline/.test(csp), 'sin scripts en línea');
    assert.match(csp, /upgrade-insecure-requests/);
    assert.equal(r.headers.get('x-powered-by'), null);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.match(r.headers.get('strict-transport-security') ?? '', /max-age=/);
    assert.equal(r.headers.get('access-control-allow-origin'), null);
    ok('cabeceras: CSP estricta (sin unsafe-eval ni scripts en línea), nosniff, HSTS, sin X-Powered-By y sin CORS');

    r = await pedir('/api/auth/login', { method: 'OPTIONS', headers: { Origin: 'https://sitio-ajeno.com', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(r.headers.get('access-control-allow-origin'), null);
    ok('un sitio ajeno no obtiene permiso CORS');

    // JSON mal formado: error controlado, sin detalles internos
    r = await pedir('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email": ' });
    assert.equal(r.status, 400); const cuerpo = await r.json();
    assert.equal(cuerpo.message, 'El cuerpo de la petición no es un JSON válido'); assert.ok(!JSON.stringify(cuerpo).includes('at '), 'sin stack');
    ok('un JSON mal formado da 400 sin exponer detalles internos');

    r = await pedir('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a@b.com', password: 'x'.repeat(200_000) }) });
    assert.equal(r.status, 413);
    ok('un cuerpo mayor a 100 kb se rechaza (413)');

    // El laboratorio no existe si SECURITY_LAB no está activo
    r = await pedir('/api/security-lab/estado');
    assert.equal(r.status, 404);
    ok('con SECURITY_LAB apagado el laboratorio no existe (404)');
  } finally {
    servidor.close();
    fs.rmSync(dist, { recursive: true, force: true });
  }

  console.log(`\n${n} bloques OK`);
  process.exit(0);
})().catch((err) => { console.error('✘', err); process.exit(1); });
