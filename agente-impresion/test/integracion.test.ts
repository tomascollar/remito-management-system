/**
 * Prueba de punta a punta del agente con DOS servidores falsos de verdad:
 *   - un servidor HTTP que hace de "la app en Render" (cola de trabajos),
 *   - un servidor TCP que hace de "la impresora" (recibe los bytes por el puerto, como la real).
 * Se usa el cliente HTTP real (fetch) y el envío TCP real: lo único simulado son los dos extremos.
 */
import http from 'http';
import net from 'net';
import { AddressInfo } from 'net';
import { Agente } from '../src/agente';
import { crearClienteApi, ErrorClave } from '../src/api';
import { armarTicket } from '../src/escpos';
import { crearEnvio, ErrorImpresora } from '../src/impresora';

const TOKEN = 'k'.repeat(40);

interface Servidor {
  url: string;
  cola: { id: string; ancho: number; alto: number; datos: string }[];
  resultados: { id: string; cuerpo: any }[];
  autorizaciones: (string | undefined)[];
  cerrar: () => Promise<void>;
}

const iniciarServidorApi = (): Promise<Servidor> =>
  new Promise((resolver) => {
    const estado: Servidor = { url: '', cola: [], resultados: [], autorizaciones: [], cerrar: async () => {} };
    const servidor = http.createServer((req, res) => {
      let cuerpo = '';
      req.on('data', (c) => (cuerpo += c));
      req.on('end', () => {
        estado.autorizaciones.push(req.headers.authorization);
        if (req.headers.authorization !== `Bearer ${TOKEN}`) return void res.writeHead(401).end();
        if (req.url === '/api/impresion/agente/siguiente') {
          const t = estado.cola.shift();
          if (!t) return void res.writeHead(204).end();
          return void res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(t));
        }
        const m = req.url?.match(/^\/api\/impresion\/agente\/trabajos\/([^/]+)\/resultado$/);
        if (m) {
          estado.resultados.push({ id: m[1], cuerpo: JSON.parse(cuerpo) });
          return void res.writeHead(200, { 'Content-Type': 'application/json' }).end('{}');
        }
        res.writeHead(404).end();
      });
    });
    servidor.listen(0, '127.0.0.1', () => {
      estado.url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
      estado.cerrar = () => new Promise((ok) => servidor.close(() => ok()));
      resolver(estado);
    });
  });

/** "Impresora": acepta conexiones y guarda todo lo recibido. */
const iniciarImpresoraFalsa = (): Promise<{ puerto: number; recibido: Buffer[]; cerrar: () => Promise<void> }> =>
  new Promise((resolver) => {
    const recibido: Buffer[] = [];
    const servidor = net.createServer((socket) => {
      const partes: Buffer[] = [];
      socket.on('data', (d: Buffer) => partes.push(d));
      socket.on('end', () => {
        recibido.push(Buffer.concat(partes));
        socket.end();
      });
    });
    servidor.listen(0, '127.0.0.1', () =>
      resolver({ puerto: (servidor.address() as AddressInfo).port, recibido, cerrar: () => new Promise((ok) => servidor.close(() => ok())) })
    );
  });

describe('agente de punta a punta', () => {
  let api: Servidor;
  let impresora: Awaited<ReturnType<typeof iniciarImpresoraFalsa>>;

  beforeEach(async () => {
    api = await iniciarServidorApi();
    impresora = await iniciarImpresoraFalsa();
  });
  afterEach(async () => {
    await api.cerrar();
    await impresora.cerrar();
  });

  it('toma un ticket de la cola, lo recibe la impresora byte por byte y se informa "ok" con la clave correcta', async () => {
    const datos = Buffer.alloc(72 * 300);
    for (let i = 0; i < datos.length; i++) datos[i] = (i * 7) % 256;
    api.cola.push({ id: 'abc123', ancho: 576, alto: 300, datos: datos.toString('base64') });

    const agente = new Agente({
      api: crearClienteApi({ servidorUrl: api.url, token: TOKEN }),
      imprimir: crearEnvio('127.0.0.1', impresora.puerto, 3000),
      corte: 'parcial',
    });

    expect(await agente.iterar()).toBe('impreso');
    expect(impresora.recibido).toHaveLength(1);
    expect(impresora.recibido[0].equals(armarTicket(576, 300, datos, 'parcial'))).toBe(true); // 300 filas = 2 franjas, íntegras
    expect(api.resultados).toEqual([{ id: 'abc123', cuerpo: { ok: true } }]);
    expect(api.autorizaciones.every((a) => a === `Bearer ${TOKEN}`)).toBe(true);

    expect(await agente.iterar()).toBe('sin_trabajo'); // la cola quedó vacía
  });

  it('con la impresora apagada informa el error y no se cuelga', async () => {
    api.cola.push({ id: 'x1', ancho: 576, alto: 8, datos: Buffer.alloc(72 * 8).toString('base64') });
    const puertoCerrado = impresora.puerto;
    await impresora.cerrar(); // nadie escucha ya en ese puerto
    impresora = await iniciarImpresoraFalsa(); // (para que afterEach pueda cerrar algo)

    const agente = new Agente({
      api: crearClienteApi({ servidorUrl: api.url, token: TOKEN }),
      imprimir: crearEnvio('127.0.0.1', puertoCerrado, 1500),
      corte: 'parcial',
    });
    expect(await agente.iterar()).toBe('error_impresion');
    expect(api.resultados).toEqual([{ id: 'x1', cuerpo: { ok: false, error: 'La impresora no responde' } }]);
  });

  it('el envío a una impresora que no existe da un error legible, sin la IP', async () => {
    await impresora.cerrar();
    const enviar = crearEnvio('127.0.0.1', impresora.puerto, 1500);
    const fallo = await enviar(Buffer.from([1])).catch((e) => e);
    expect(fallo).toBeInstanceOf(ErrorImpresora);
    expect(fallo.message).toBe('La impresora no responde');
    impresora = await iniciarImpresoraFalsa();
  });

  it('con una clave incorrecta el servidor responde 401 y el agente lo reconoce como error de clave', async () => {
    const mal = crearClienteApi({ servidorUrl: api.url, token: 'z'.repeat(40) });
    await expect(mal.siguiente()).rejects.toBeInstanceOf(ErrorClave);
    await expect(mal.informar('a', true)).rejects.toThrow(/rechazó la clave/);
  });

  it('un servidor caído se informa como error de red (no de clave)', async () => {
    const url = api.url;
    await api.cerrar();
    const cliente = crearClienteApi({ servidorUrl: url, token: TOKEN });
    const fallo = await cliente.siguiente().catch((e) => e);
    expect(fallo.message).toMatch(/fetch failed/); // error de red de fetch (en Jest viene de otro contexto, por eso no se usa instanceof Error)
    expect(fallo).not.toBeInstanceOf(ErrorClave);
    api = await iniciarServidorApi();
  });
});
