/**
 * Pruebas del formato de los nombres de cliente: se guardan siempre como "Nombre",
 * sin importar cómo los escriba el usuario.
 */
import request from 'supertest';
import { app } from '../src/app';
import Remito from '../src/models/Remito';
import { formatearNombre } from '../src/services/formatoNombre';
import { reiniciarLimitadores } from '../src/middleware/rateLimiter';
import { conToken, iniciarSesionComo } from './ayudas';

describe('formatearNombre (función pura)', () => {
  it.each([
    ['CARLOS', 'Carlos'],
    ['carlos', 'Carlos'],
    ['cARLOS', 'Carlos'],
    ['Carlos', 'Carlos'],
  ])('"%s" → "%s"', (entrada, esperado) => {
    expect(formatearNombre(entrada)).toBe(esperado);
  });

  it('con varias palabras, cada una empieza en mayúscula', () => {
    expect(formatearNombre('lorena CUCCOL')).toBe('Lorena Cuccol');
    expect(formatearNombre('VERDULERÍA el sol')).toBe('Verdulería El Sol');
  });

  it('quita los espacios de los bordes y junta los repetidos', () => {
    expect(formatearNombre('   juan    perez  ')).toBe('Juan Perez');
    expect(formatearNombre('ana\tmaria')).toBe('Ana Maria');
  });

  it('respeta las tildes y la ñ, también en mayúsculas', () => {
    expect(formatearNombre('JOSÉ')).toBe('José');
    expect(formatearNombre('ñandú')).toBe('Ñandú');
    expect(formatearNombre('ÁNGELES MUÑOZ')).toBe('Ángeles Muñoz');
    expect(formatearNombre('ángel')).toBe('Ángel');
  });

  it('capitaliza también después de guion y apóstrofo', () => {
    expect(formatearNombre('ana-maría')).toBe('Ana-María');
    expect(formatearNombre("o'BRIEN")).toBe("O'Brien");
  });

  it('los números y símbolos quedan como están', () => {
    expect(formatearNombre('kiosco 24 HS')).toBe('Kiosco 24 Hs');
    expect(formatearNombre('pedro (Mercado)')).toBe('Pedro (Mercado)');
  });

  it('es idempotente: formatear dos veces da lo mismo', () => {
    for (const nombre of ['cARLOS', 'ana-maría PEREZ', "o'brien", '  juan   perez ']) {
      expect(formatearNombre(formatearNombre(nombre))).toBe(formatearNombre(nombre));
    }
  });

  it('un texto vacío o de espacios queda vacío', () => {
    expect(formatearNombre('')).toBe('');
    expect(formatearNombre('    ')).toBe('');
  });
});

describe('POST /api/remitos: el cliente se guarda con formato "Nombre"', () => {
  let token: string;
  beforeEach(() => {
    reiniciarLimitadores();
    token = iniciarSesionComo('vendedor');
    // No se usa la base: se simula el guardado devolviendo el mismo documento
    jest.spyOn(Remito.prototype, 'save').mockImplementation(async function (this: any) { return this; });
  });
  const crear = (nombre_cliente: unknown) => request(app).post('/api/remitos').set(conToken(token)).send({ nombre_cliente });

  it.each([
    ['CARLOS', 'Carlos'],
    ['carlos', 'Carlos'],
    ['cARLOS', 'Carlos'],
    ['  lorena   CUCCOL ', 'Lorena Cuccol'],
  ])('"%s" se guarda como "%s"', async (escrito, guardado) => {
    const r = await crear(escrito).expect(201);
    expect(r.body.remito.nombre_cliente).toBe(guardado);
  });

  it('las reglas de validación siguen vigentes (vacío, muy corto, muy largo, no es texto)', async () => {
    await crear('').expect(400);
    await crear('   ').expect(400);
    await crear('a').expect(400);
    await crear('x'.repeat(101)).expect(400);
  });
});
