/**
 * Carga de pdf.js (el motor que convierte un PDF en imagen). Se importa recién cuando hace falta
 * (import dinámico): pesa bastante y no debe sumarse a la carga inicial de la app. Se usa su versión
 * "legacy" para que funcione también en celulares con navegadores viejos.
 */
let cargado: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null;

export function cargarPdfjs() {
  cargado ??= (async () => {
    const [pdfjs, { default: urlWorker }] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = urlWorker;
    return pdfjs;
  })().catch((e) => {
    cargado = null; // si falló la descarga (sin red), se vuelve a intentar la próxima vez
    throw e;
  });
  return cargado;
}
