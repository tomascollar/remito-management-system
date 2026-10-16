import fs from 'fs';
import os from 'os';
import path from 'path';
import { cargarArchivoEnv, cargarConfig } from '../src/config';

const TOKEN = 'a'.repeat(40);
const base = { SERVIDOR_URL: 'https://remitos.onrender.com', AGENTE_TOKEN: TOKEN, IMPRESORA_HOST: '192.168.0.228' };

describe('configuración del agente', () => {
  it('con lo mínimo usa los valores por defecto', () => {
    expect(cargarConfig(base)).toEqual({
      servidorUrl: 'https://remitos.onrender.com',
      token: TOKEN,
      impresoraHost: '192.168.0.228',
      impresoraPuerto: 9100,
      intervaloMs: 3000,
      timeoutImpresoraMs: 8000,
      corte: 'parcial',
    });
  });

  it('quita la barra final de la dirección y cualquier ruta', () => {
    expect(cargarConfig({ ...base, SERVIDOR_URL: 'https://remitos.onrender.com/' }).servidorUrl).toBe('https://remitos.onrender.com');
  });

  it('acepta http solo para localhost (pruebas en la propia PC)', () => {
    expect(cargarConfig({ ...base, SERVIDOR_URL: 'http://localhost:5000' }).servidorUrl).toBe('http://localhost:5000');
    expect(() => cargarConfig({ ...base, SERVIDOR_URL: 'http://remitos.onrender.com' })).toThrow(/https/);
    expect(() => cargarConfig({ ...base, SERVIDOR_URL: 'http://192.168.0.10:5000' })).toThrow(/https/);
  });

  it.each([
    ['falta la dirección', { SERVIDOR_URL: '' }, /SERVIDOR_URL no está definida/],
    ['dirección inválida', { SERVIDOR_URL: 'esto no es una url' }, /no es una dirección válida/],
    ['falta la clave', { AGENTE_TOKEN: '' }, /AGENTE_TOKEN no está definida/],
    ['clave demasiado corta', { AGENTE_TOKEN: 'corta' }, /demasiado corta/],
    ['falta la IP de la impresora', { IMPRESORA_HOST: '' }, /IMPRESORA_HOST no está definida/],
    ['IP con caracteres raros', { IMPRESORA_HOST: '192.168.0.1; rm -rf' }, /solo puede ser una IP/],
    ['puerto fuera de rango', { IMPRESORA_PUERTO: '70000' }, /IMPRESORA_PUERTO/],
    ['intervalo muy corto (saturaría el servidor)', { INTERVALO_MS: '100' }, /INTERVALO_MS/],
    ['intervalo que no es número', { INTERVALO_MS: 'rapido' }, /INTERVALO_MS/],
    ['corte desconocido', { CORTE: 'a medias' }, /CORTE/],
  ])('rechaza: %s', (_caso, cambio, mensaje) => {
    expect(() => cargarConfig({ ...base, ...cambio })).toThrow(mensaje);
  });

  it('junta todos los problemas en un solo mensaje', () => {
    expect(() => cargarConfig({})).toThrow(/SERVIDOR_URL[\s\S]*AGENTE_TOKEN[\s\S]*IMPRESORA_HOST/);
  });

  it('el archivo .env se lee sin pisar lo que ya está definido en el entorno', () => {
    const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'agente-'));
    const ruta = path.join(carpeta, '.env');
    fs.writeFileSync(ruta, '# comentario\nSERVIDOR_URL="https://desde-archivo.com"\nIMPRESORA_HOST=10.0.0.5\r\n\nAGENTE_TOKEN=desde-archivo\n');
    const env: NodeJS.ProcessEnv = { AGENTE_TOKEN: 'del-entorno' };
    cargarArchivoEnv(ruta, env);
    expect(env.SERVIDOR_URL).toBe('https://desde-archivo.com'); // sin comillas
    expect(env.IMPRESORA_HOST).toBe('10.0.0.5');
    expect(env.AGENTE_TOKEN).toBe('del-entorno'); // el entorno real manda
    cargarArchivoEnv(path.join(carpeta, 'no-existe'), env); // un .env inexistente no es un error
  });
});
