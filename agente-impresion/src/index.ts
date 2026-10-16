/**
 * Agente de impresión del sistema de remitos.
 *
 * Corre en un equipo del puesto (PC, notebook o Raspberry Pi) que está en la misma red que la
 * impresora. Cada pocos segundos le pregunta al servidor si hay tickets para imprimir y los manda
 * a la impresora. Solo hace conexiones SALIENTES: no hay que abrir ningún puerto en el router.
 *
 *   npm start           funcionamiento normal
 *   npm run probar      imprime una hoja de prueba directo en la impresora (no usa el servidor)
 */
import path from 'path';
import { Agente } from './agente';
import { crearClienteApi } from './api';
import { cargarArchivoEnv, cargarConfig } from './config';
import { hojaDePrueba } from './escpos';
import { crearEnvio } from './impresora';

const marca = () => new Date().toLocaleString('es-AR', { hour12: false });
const log = (mensaje: string) => console.log(`[${marca()}] ${mensaje}`);

const main = async (): Promise<void> => {
  cargarArchivoEnv(path.resolve(__dirname, '../.env'));
  const probar = process.argv.includes('--probar');

  // Para probar solo la impresora no hacen falta los datos del servidor
  if (probar) {
    process.env.SERVIDOR_URL ||= 'https://no-se-usa.example.com';
    process.env.AGENTE_TOKEN ||= 'x'.repeat(32);
  }
  const config = cargarConfig();
  const enviar = crearEnvio(config.impresoraHost, config.impresoraPuerto, config.timeoutImpresoraMs);

  if (probar) {
    log(`Imprimiendo hoja de prueba en ${config.impresoraHost}:${config.impresoraPuerto}…`);
    await enviar(hojaDePrueba(config.corte));
    log('Hoja de prueba enviada. Revisá que haya salido el marco completo.');
    return;
  }

  const agente = new Agente({ api: crearClienteApi(config), imprimir: enviar, corte: config.corte, log });
  let seguir = true;
  const detener = () => {
    log('Deteniendo el agente…');
    seguir = false;
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.on('SIGINT', detener);
  process.on('SIGTERM', detener);

  log(`Agente iniciado. Servidor: ${config.servidorUrl} · Impresora: ${config.impresoraHost}:${config.impresoraPuerto} · cada ${config.intervaloMs / 1000} s`);
  await agente.ejecutar(config.intervaloMs, () => seguir);
};

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
