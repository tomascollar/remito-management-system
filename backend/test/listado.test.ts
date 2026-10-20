/**
 * Pruebas del ORDEN del listado de remitos: por defecto los últimos creados primero y,
 * a pedido, por cliente de la A a la Z (para gestionar los cobros en orden alfabético).
 * Se reemplaza solo la consulta a la base; el resto (validación, rutas, permisos) es el real.
 */
import request from 'supertest';
import { app } from '../src/app';
import Remito from '../src/models/Remito';
import { ordenRemitos } from '../src/controllers/remitoListado';
import { reiniciarLimitadores } from '../src/middleware/rateLimiter';
import { conToken, iniciarSesionComo } from './ayudas';

describe('ordenRemitos (función pura)', () => {
  it('por defecto: el último remito creado primero, sin collation', () => {
    for (const valor of [undefined, 'recientes', '', 'cualquier-cosa']) {
      expect(ordenRemitos(valor)).toEqual({ sort: { numero_remito: -1 }, collation: undefined });
    }
  });

  it('alfabético: por cliente A–Z, desempata por número descendente y no distingue mayúsculas ni tildes', () => {
    const { sort, collation } = ordenRemitos('alfabetico');
    expect(sort).toEqual({ nombre_cliente: 1, numero_remito: -1 });
    expect(Object.keys(sort)).toEqual(['nombre_cliente', 'numero_remito']); // el orden de las claves importa
    expect(collation).toEqual({ locale: 'es', strength: 2 });
  });
});

describe('GET /api/remitos?orden=…', () => {
  let token: string;
  let cadena: any;

  beforeEach(() => {
    reiniciarLimitadores();
    token = iniciarSesionComo('vendedor');
    // Consulta encadenada simulada: cada método devuelve la misma cadena y lean() entrega las filas
    cadena = {};
    for (const metodo of ['select', 'populate', 'sort', 'collation', 'skip', 'limit']) cadena[metodo] = jest.fn(() => cadena);
    cadena.lean = jest.fn(async () => []);
    jest.spyOn(Remito, 'find').mockReturnValue(cadena);
    jest.spyOn(Remito, 'countDocuments').mockResolvedValue(0 as any);
  });

  const listar = (consulta = '') => request(app).get(`/api/remitos${consulta}`).set(conToken(token));

  it('sin parámetro: los más nuevos primero', async () => {
    await listar().expect(200);
    expect(cadena.sort).toHaveBeenCalledWith({ numero_remito: -1 });
    expect(cadena.collation).not.toHaveBeenCalled(); // sin collation: comparación normal
  });

  it('orden=recientes equivale al valor por defecto', async () => {
    await listar('?orden=recientes').expect(200);
    expect(cadena.sort).toHaveBeenCalledWith({ numero_remito: -1 });
  });

  it('orden=alfabetico: ordena por cliente con collation en español', async () => {
    await listar('?orden=alfabetico').expect(200);
    expect(cadena.sort).toHaveBeenCalledWith({ nombre_cliente: 1, numero_remito: -1 });
    expect(cadena.collation).toHaveBeenCalledWith({ locale: 'es', strength: 2 });
  });

  it('el orden alfabético se combina con los filtros y la paginación', async () => {
    await listar('?orden=alfabetico&estado=abierto&pagina=2&limite=10').expect(200);
    expect(Remito.find).toHaveBeenCalledWith(expect.objectContaining({ estado: 'abierto' }));
    expect(cadena.skip).toHaveBeenCalledWith(10);
    expect(cadena.limit).toHaveBeenCalledWith(10);
    expect(cadena.sort).toHaveBeenCalledWith({ nombre_cliente: 1, numero_remito: -1 });
  });

  it.each(['nombre_cliente', 'total', '-numero_remito', '$where', 'alfabetico;drop'])(
    'un orden inválido (%s) se rechaza con 400 y no llega a la base',
    async (valor) => {
      const r = await listar(`?orden=${encodeURIComponent(valor)}`).expect(400);
      expect(r.body.errors ?? r.body.message).toBeDefined();
      expect(Remito.find).not.toHaveBeenCalled();
    }
  );

  it('sin sesión sigue dando 401', async () => {
    await request(app).get('/api/remitos?orden=alfabetico').expect(401);
  });
});
