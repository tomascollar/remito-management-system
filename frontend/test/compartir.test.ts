/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compartir, puedeCompartir, type ArchivosRemito } from '../src/lib/pdf/acciones';

const archivo = (nombre: string, tipo: string) => new File(['x'], nombre, { type: tipo });
const pdf = archivo('Remito.pdf', 'application/pdf');
const png1 = archivo('Remito (1 de 2).png', 'image/png');
const png2 = archivo('Remito (2 de 2).png', 'image/png');
const archivos = (o: Partial<ArchivosRemito> = {}): ArchivosRemito => ({ digital: pdf, imagenes: [png1, png2], ticket: pdf, ...o });

describe('compartir el remito', () => {
  const share = vi.fn();
  beforeEach(() => {
    share.mockReset().mockResolvedValue(undefined);
    Object.assign(navigator, { share, canShare: () => true });
  });
  afterEach(() => {
    delete (navigator as any).share;
    delete (navigator as any).canShare;
  });

  it('comparte las imágenes (todas las hojas), no el PDF', async () => {
    expect(await compartir(archivos())).toBe(true);
    expect(share).toHaveBeenCalledTimes(1);
    const { files, title } = share.mock.calls[0][0];
    expect(files).toEqual([png1, png2]);
    expect(files.some((f: File) => f.type === 'application/pdf')).toBe(false);
    expect(title).toBeUndefined(); // sin texto de acompañamiento en WhatsApp
  });

  it('si no se pudieron generar las imágenes, comparte el PDF', async () => {
    await compartir(archivos({ imagenes: [] }));
    expect(share.mock.calls[0][0].files).toEqual([pdf]);
  });

  it('si el usuario cierra el menú sin elegir devuelve false; otros errores se propagan', async () => {
    share.mockRejectedValueOnce(new DOMException('cancelado', 'AbortError'));
    expect(await compartir(archivos())).toBe(false);
    share.mockRejectedValueOnce(new Error('falló'));
    await expect(compartir(archivos())).rejects.toThrow('falló');
  });

  it('sin soporte para compartir archivos, descarga las imágenes para adjuntarlas a mano', async () => {
    Object.assign(navigator, { canShare: () => false });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => 'blob:x');
    expect(puedeCompartir([png1])).toBe(false);
    expect(await compartir(archivos())).toBe(true);
    expect(share).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(2); // una descarga por hoja
    click.mockRestore();
  });
});
