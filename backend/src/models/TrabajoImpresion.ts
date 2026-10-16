import mongoose, { Document, Schema } from 'mongoose';

/**
 * Cola de impresión del ticket.
 *
 * La app web NO puede hablar con la impresora (está en la red local del puesto y el navegador no
 * abre conexiones directas a una impresora). Por eso el celular deja acá un "trabajo" y un
 * pequeño programa del puesto (el agente) lo busca, lo imprime y avisa el resultado.
 *
 * Ciclo de vida:  pendiente → imprimiendo → impreso | error      (o "vencido" si nadie lo tomó a tiempo)
 *
 * Privacidad: la imagen del ticket contiene el nombre del cliente y los montos, por eso se BORRA
 * apenas termina el trabajo. Queda solo el registro (quién, cuándo, qué remito, cómo terminó),
 * que se elimina solo a los 30 días.
 */
export const ESTADOS_TRABAJO = ['pendiente', 'imprimiendo', 'impreso', 'error', 'vencido'] as const;
export type EstadoTrabajo = (typeof ESTADOS_TRABAJO)[number];

export interface ITrabajoImpresion extends Document {
  usuario: mongoose.Types.ObjectId; // quién pidió imprimir (auditoría)
  remito?: mongoose.Types.ObjectId;
  /** Ancho de la imagen en puntos (múltiplo de 8). La térmica de 80 mm imprime hasta 576. */
  ancho: number;
  /** Alto de la imagen en puntos. */
  alto: number;
  /**
   * Imagen en blanco y negro, 1 bit por punto, fila por fila, bit más significativo primero
   * (1 = punto negro). Es el formato que entiende la impresora (ESC/POS), así el agente no
   * necesita librerías de imágenes. Largo exacto: (ancho / 8) × alto bytes.
   */
  datos?: Buffer;
  estado: EstadoTrabajo;
  intentos: number;
  error?: string;
  /** Si nadie lo toma antes de esta fecha se considera vencido (no se imprime un ticket "viejo"). */
  vence: Date;
  tomadoEn?: Date;
  finalizadoEn?: Date;
  createdAt: Date;
}

const TrabajoImpresionSchema = new Schema<ITrabajoImpresion>(
  {
    usuario: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    remito: { type: Schema.Types.ObjectId, ref: 'Remito' },
    ancho: { type: Number, required: true },
    alto: { type: Number, required: true },
    // select:false → las consultas normales no arrastran la imagen; solo se pide al entregarla al agente
    datos: { type: Buffer, select: false },
    estado: { type: String, enum: ESTADOS_TRABAJO, default: 'pendiente', index: true },
    intentos: { type: Number, default: 0 },
    error: { type: String },
    vence: { type: Date, required: true },
    tomadoEn: { type: Date },
    finalizadoEn: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Limpieza automática de MongoDB: borra el registro 30 días después de crearse
TrabajoImpresionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.model<ITrabajoImpresion>('TrabajoImpresion', TrabajoImpresionSchema);
