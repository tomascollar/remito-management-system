/**
 * El corazón del agente: un ciclo "preguntar → imprimir → avisar".
 * Está separado de la red y de la impresora (se le inyectan) para poder probarlo sin hardware.
 */
import { ErrorClave, type ClienteApi } from './api';
import type { Corte } from './config';
import { armarTicket } from './escpos';
import { ErrorImpresora, type EnviarAImpresora } from './impresora';

export type Resultado = 'sin_trabajo' | 'impreso' | 'error_impresion' | 'duplicado';

interface Dependencias {
  api: ClienteApi;
  imprimir: EnviarAImpresora;
  corte: Corte;
  log?: (mensaje: string) => void;
  dormir?: (ms: number) => Promise<void>;
}

/** Cuántos ids de trabajos ya impresos se recuerdan (para no repetir un ticket si el servidor lo ofrece de nuevo). */
const MEMORIA_IMPRESOS = 50;
const INTENTOS_AVISAR = 3;
const ESPERA_ENTRE_AVISOS_MS = 1000;

export class Agente {
  private readonly impresos: string[] = [];
  private readonly log: (mensaje: string) => void;
  private readonly dormir: (ms: number) => Promise<void>;

  constructor(private readonly dep: Dependencias) {
    this.log = dep.log ?? (() => {});
    this.dormir = dep.dormir ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Un ciclo. Los errores de RED con el servidor se propagan (los maneja el bucle con espera creciente). */
  async iterar(): Promise<Resultado> {
    const trabajo = await this.dep.api.siguiente();
    if (!trabajo) return 'sin_trabajo';

    // Si ya lo imprimimos y el servidor lo vuelve a ofrecer (no le llegó nuestro aviso), NO se imprime
    // otra vez: se repite solo el aviso. Un ticket duplicado en el mostrador es peor que uno demorado.
    if (this.impresos.includes(trabajo.id)) {
      this.log(`Trabajo ${trabajo.id} ya impreso antes: solo se repite el aviso`);
      await this.avisar(trabajo.id, true);
      return 'duplicado';
    }

    try {
      await this.dep.imprimir(armarTicket(trabajo.ancho, trabajo.alto, trabajo.datos, this.dep.corte));
    } catch (e) {
      const motivo = e instanceof ErrorImpresora ? e.message : 'No se pudo imprimir';
      this.log(`Trabajo ${trabajo.id}: falló la impresión (${e instanceof Error ? e.message : e})`);
      await this.avisar(trabajo.id, false, motivo);
      return 'error_impresion';
    }

    this.impresos.push(trabajo.id);
    if (this.impresos.length > MEMORIA_IMPRESOS) this.impresos.shift();
    this.log(`Trabajo ${trabajo.id}: impreso (${trabajo.ancho}×${trabajo.alto})`);
    await this.avisar(trabajo.id, true);
    return 'impreso';
  }

  /** Informar es lo único que no se puede perder: se reintenta unas veces antes de rendirse. */
  private async avisar(id: string, ok: boolean, error?: string): Promise<void> {
    for (let intento = 1; ; intento++) {
      try {
        await this.dep.api.informar(id, ok, error);
        return;
      } catch (e) {
        if (e instanceof ErrorClave || intento >= INTENTOS_AVISAR) throw e;
        await this.dormir(ESPERA_ENTRE_AVISOS_MS);
      }
    }
  }

  /**
   * Bucle principal. Si el servidor no responde (internet caído, Render reiniciando), espera cada
   * vez más (hasta 30 s) en lugar de insistir sin pausa, y vuelve al ritmo normal apenas se recupera.
   * Una clave incorrecta se informa claramente en cada intento: hay que corregir la configuración.
   */
  async ejecutar(intervaloMs: number, debeSeguir: () => boolean = () => true): Promise<void> {
    let fallos = 0;
    while (debeSeguir()) {
      let espera = intervaloMs;
      try {
        const r = await this.iterar();
        fallos = 0;
        if (r !== 'sin_trabajo') espera = 200; // si hubo trabajo, se mira enseguida si hay otro
      } catch (e) {
        fallos++;
        espera = Math.min(30_000, intervaloMs * 2 ** Math.min(fallos, 5));
        this.log(e instanceof ErrorClave ? `⚠️  ${e.message}` : `Sin conexión con el servidor (${e instanceof Error ? e.message : e}). Reintento en ${Math.round(espera / 1000)} s`);
      }
      await this.dormir(espera);
    }
  }
}
