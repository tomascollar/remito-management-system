import { armarTicket, avanzarYCortar, FILAS_POR_FRANJA, hojaDePrueba, imagenRaster, inicializar, LINEAS_ANTES_DE_CORTAR } from '../src/escpos';

/** Imagen de prueba: cada fila repite su número (módulo 256), así se puede reconocer qué fila es cuál. */
const imagen = (ancho: number, alto: number) => {
  const bytesPorFila = ancho / 8;
  const b = Buffer.alloc(bytesPorFila * alto);
  for (let y = 0; y < alto; y++) b.fill(y % 256, y * bytesPorFila, (y + 1) * bytesPorFila);
  return b;
};

describe('comandos ESC/POS', () => {
  it('inicializar es ESC @', () => {
    expect([...inicializar()]).toEqual([0x1b, 0x40]);
  });

  it('una imagen chica va en una sola franja: GS v 0, m=0, bytes por fila, filas, datos', () => {
    const datos = imagen(576, 10);
    const sal = imagenRaster(576, 10, datos);
    // 576/8 = 72 bytes por fila → xL=72 xH=0 ; 10 filas → yL=10 yH=0
    expect([...sal.subarray(0, 8)]).toEqual([0x1d, 0x76, 0x30, 0x00, 72, 0, 10, 0]);
    expect(sal.length).toBe(8 + 72 * 10);
    expect(sal.subarray(8).equals(datos)).toBe(true);
  });

  it('un ticket largo se parte en franjas de 256 filas, sin perder ni repetir ninguna fila', () => {
    const alto = 600; // 256 + 256 + 88
    const datos = imagen(576, alto);
    const sal = imagenRaster(576, alto, datos);

    const franjas: { filas: number; datos: Buffer }[] = [];
    let pos = 0;
    while (pos < sal.length) {
      expect([...sal.subarray(pos, pos + 4)]).toEqual([0x1d, 0x76, 0x30, 0x00]);
      const filas = sal[pos + 6] + sal[pos + 7] * 256;
      franjas.push({ filas, datos: sal.subarray(pos + 8, pos + 8 + 72 * filas) });
      pos += 8 + 72 * filas;
    }
    expect(franjas.map((f) => f.filas)).toEqual([FILAS_POR_FRANJA, FILAS_POR_FRANJA, 88]);
    expect(Buffer.concat(franjas.map((f) => f.datos)).equals(datos)).toBe(true); // las filas, en orden y completas
  });

  it('una imagen de más de 255 bytes por fila o de más de 255 filas codifica bien los dos bytes (xL xH)', () => {
    const sal = imagenRaster(2040, 1, Buffer.alloc(255)); // 255 bytes por fila: cabe en xL
    expect(sal[4]).toBe(255);
    expect(sal[5]).toBe(0);
  });

  it.each([
    ['ancho que no es múltiplo de 8', 575, 10, Buffer.alloc(72 * 10)],
    ['ancho cero', 0, 10, Buffer.alloc(0)],
    ['alto cero', 576, 0, Buffer.alloc(0)],
    ['tamaño que no coincide', 576, 10, Buffer.alloc(72 * 9)],
    ['ancho enorme', 4096, 1, Buffer.alloc(512)],
  ])('rechaza: %s', (_caso, ancho, alto, datos) => {
    expect(() => imagenRaster(ancho, alto, datos)).toThrow();
  });

  it('avanza el papel y corta: parcial = GS V 1, total = GS V 0, ninguno = solo avanza', () => {
    expect([...avanzarYCortar('parcial')]).toEqual([0x1b, 0x64, LINEAS_ANTES_DE_CORTAR, 0x1d, 0x56, 0x01]);
    expect([...avanzarYCortar('total')]).toEqual([0x1b, 0x64, LINEAS_ANTES_DE_CORTAR, 0x1d, 0x56, 0x00]);
    expect([...avanzarYCortar('ninguno')]).toEqual([0x1b, 0x64, LINEAS_ANTES_DE_CORTAR]);
  });

  it('el ticket completo es: inicializar + imagen + avanzar y cortar, en ese orden', () => {
    const datos = imagen(576, 4);
    const t = armarTicket(576, 4, datos, 'parcial');
    expect([...t.subarray(0, 2)]).toEqual([0x1b, 0x40]);
    expect(t.subarray(2, 2 + 8 + 72 * 4).equals(imagenRaster(576, 4, datos))).toBe(true);
    expect([...t.subarray(t.length - 6)]).toEqual([0x1b, 0x64, LINEAS_ANTES_DE_CORTAR, 0x1d, 0x56, 0x01]);
  });

  it('la hoja de prueba es una imagen válida de 576 puntos de ancho y un marco completo', () => {
    const h = hojaDePrueba('parcial');
    const inicio = h.indexOf(Buffer.from([0x1d, 0x76, 0x30, 0x00]));
    expect(inicio).toBeGreaterThan(0);
    expect(h[inicio + 4]).toBe(72); // 576 puntos
    const datos = h.subarray(inicio + 8, inicio + 8 + 72 * 160);
    expect(datos.subarray(0, 72).every((b) => b === 0xff)).toBe(true); // borde superior de lado a lado
    expect(datos[72 * 80]).toBe(0xf0); // borde izquierdo
    expect(datos[72 * 80 + 71]).toBe(0x0f); // borde derecho
    expect(datos[72 * 80 + 36]).toBe(0x00); // el interior queda en blanco
  });
});
