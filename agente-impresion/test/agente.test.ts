import { Agente } from '../src/agente';
import { ErrorClave, type ClienteApi, type Trabajo } from '../src/api';
import { armarTicket } from '../src/escpos';
import { ErrorImpresora } from '../src/impresora';

const trabajo = (id = 't1'): Trabajo => ({ id, ancho: 576, alto: 4, datos: Buffer.alloc(72 * 4, 0xff) });

/** API falsa: entrega los trabajos de la lista y registra lo que se informa. */
const crearApi = (trabajos: (Trabajo | null)[]) => {
  const informes: { id: string; ok: boolean; error?: string }[] = [];
  const api: ClienteApi = {
    siguiente: jest.fn(async () => trabajos.shift() ?? null),
    informar: jest.fn(async (id, ok, error) => void informes.push({ id, ok, error })),
  };
  return { api, informes };
};

describe('ciclo del agente', () => {
  it('sin trabajos no imprime ni informa nada', async () => {
    const { api, informes } = crearApi([]);
    const imprimir = jest.fn();
    expect(await new Agente({ api, imprimir, corte: 'parcial' }).iterar()).toBe('sin_trabajo');
    expect(imprimir).not.toHaveBeenCalled();
    expect(informes).toEqual([]);
  });

  it('imprime el ticket completo (ESC/POS) y recién después informa "ok"', async () => {
    const { api } = crearApi([trabajo()]);
    const orden: string[] = [];
    const imprimir = jest.fn(async () => void orden.push('imprimir'));
    (api.informar as jest.Mock).mockImplementation(async (_id, ok) => void orden.push(`informar:${ok}`));

    expect(await new Agente({ api, imprimir, corte: 'parcial' }).iterar()).toBe('impreso');
    expect((imprimir.mock.calls[0] as unknown as [Buffer])[0].equals(armarTicket(576, 4, trabajo().datos, 'parcial'))).toBe(true);
    expect(orden).toEqual(['imprimir', 'informar:true']); // nunca se avisa "impreso" antes de imprimir
  });

  it('si la impresora falla, informa el error SIN datos internos de la red (ni IP)', async () => {
    const { api, informes } = crearApi([trabajo()]);
    const imprimir = jest.fn().mockRejectedValue(new ErrorImpresora('La impresora no responde'));
    expect(await new Agente({ api, imprimir, corte: 'parcial' }).iterar()).toBe('error_impresion');
    expect(informes).toEqual([{ id: 't1', ok: false, error: 'La impresora no responde' }]);

    // Un error inesperado nunca filtra su texto al servidor
    const otra = crearApi([trabajo('t2')]);
    const rara = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 192.168.0.228:9100'));
    await new Agente({ api: otra.api, imprimir: rara, corte: 'parcial' }).iterar();
    expect(otra.informes[0]).toEqual({ id: 't2', ok: false, error: 'No se pudo imprimir' });
  });

  it('un trabajo con imagen mal formada no llega a la impresora: se informa como error', async () => {
    const malo: Trabajo = { id: 'x', ancho: 576, alto: 4, datos: Buffer.alloc(10) };
    const { api, informes } = crearApi([malo]);
    const imprimir = jest.fn();
    expect(await new Agente({ api, imprimir, corte: 'parcial' }).iterar()).toBe('error_impresion');
    expect(imprimir).not.toHaveBeenCalled();
    expect(informes[0].ok).toBe(false);
  });

  it('si el servidor ofrece de nuevo un ticket ya impreso, NO se imprime otra vez: solo repite el aviso', async () => {
    const { api, informes } = crearApi([trabajo('t1'), trabajo('t1')]);
    const imprimir = jest.fn(async () => {});
    const agente = new Agente({ api, imprimir, corte: 'parcial' });
    expect(await agente.iterar()).toBe('impreso');
    expect(await agente.iterar()).toBe('duplicado');
    expect(imprimir).toHaveBeenCalledTimes(1);
    expect(api.informar).toHaveBeenCalledTimes(2);
    expect(informes.map((i) => i.ok)).toEqual([true, true]);
  });

  it('el aviso se reintenta si falla la red; con la clave mal no se reintenta', async () => {
    const { api } = crearApi([trabajo()]);
    (api.informar as jest.Mock).mockRejectedValueOnce(new Error('red')).mockRejectedValueOnce(new Error('red')).mockResolvedValue(undefined);
    const dormir = jest.fn(async () => {});
    expect(await new Agente({ api, imprimir: async () => {}, corte: 'parcial', dormir }).iterar()).toBe('impreso');
    expect(api.informar).toHaveBeenCalledTimes(3);
    expect(dormir).toHaveBeenCalledTimes(2);

    const mala = crearApi([trabajo()]);
    (mala.api.informar as jest.Mock).mockRejectedValue(new ErrorClave('clave'));
    await expect(new Agente({ api: mala.api, imprimir: async () => {}, corte: 'parcial', dormir }).iterar()).rejects.toBeInstanceOf(ErrorClave);
    expect(mala.api.informar).toHaveBeenCalledTimes(1);
  });
});

describe('bucle principal', () => {
  it('ante un corte de internet espera cada vez más (hasta 30 s) y se recupera solo', async () => {
    const esperas: number[] = [];
    let vueltas = 0;
    const api: ClienteApi = {
      siguiente: jest.fn(async () => {
        if (++vueltas <= 7) throw new Error('sin internet');
        return null;
      }),
      informar: jest.fn(),
    };
    const mensajes: string[] = [];
    const agente = new Agente({ api, imprimir: async () => {}, corte: 'parcial', log: (m) => mensajes.push(m), dormir: async (ms) => void esperas.push(ms) });
    await agente.ejecutar(3000, () => esperas.length < 9);
    expect(esperas.slice(0, 7)).toEqual([6000, 12000, 24000, 30000, 30000, 30000, 30000]); // crece y se frena en 30 s
    expect(esperas[7]).toBe(3000); // al volver la conexión, ritmo normal
    expect(mensajes[0]).toMatch(/Sin conexión con el servidor/);
  });

  it('con la clave incorrecta lo dice claramente en el registro', async () => {
    const api: ClienteApi = { siguiente: jest.fn().mockRejectedValue(new ErrorClave('El servidor rechazó la clave')), informar: jest.fn() };
    const mensajes: string[] = [];
    let n = 0;
    await new Agente({ api, imprimir: async () => {}, corte: 'parcial', log: (m) => mensajes.push(m), dormir: async () => {} }).ejecutar(3000, () => n++ < 1);
    expect(mensajes[0]).toMatch(/rechazó la clave/);
  });

  it('si hubo trabajo mira enseguida si hay otro (no espera el intervalo completo)', async () => {
    const { api } = crearApi([trabajo('a'), null]);
    const esperas: number[] = [];
    let n = 0;
    await new Agente({ api, imprimir: async () => {}, corte: 'parcial', dormir: async (ms) => void esperas.push(ms) }).ejecutar(3000, () => n++ < 2);
    expect(esperas).toEqual([200, 3000]);
  });
});
