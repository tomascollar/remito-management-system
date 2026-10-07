import mongoose, { Document, Schema } from 'mongoose';

// Tipos de movimiento:
//  - stock_inicial:    se cargó el stock del día/lote de un producto
//  - entrada_adicional: llegó más mercadería durante el día
//  - ajuste:           corrección manual por discrepancias
//  - venta:            bultos que salieron por un remito
//  - devolucion:       bultos que volvieron al stock (línea quitada o cantidad reducida)
export const TIPOS_MOVIMIENTO = ['stock_inicial', 'entrada_adicional', 'ajuste', 'venta', 'devolucion'] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

export interface IMovimientoStock extends Document {
  fecha: Date;
  producto: mongoose.Types.ObjectId;
  tipo: TipoMovimiento;
  cantidad_bultos: number; // Puede ser negativo (venta) o positivo (devolución/entrada)
  remito?: mongoose.Types.ObjectId; // Opcional, si está asociado a un remito
  usuario: mongoose.Types.ObjectId;
  observaciones?: string;
  createdAt: Date;
}

const MovimientoStockSchema: Schema = new Schema({
  fecha: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  producto: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  tipo: {
    type: String,
    enum: TIPOS_MOVIMIENTO,
    required: true
  },
  cantidad_bultos: {
    type: Number,
    required: true
    // Negativo = salida (venta)
    // Positivo = entrada (devolución, ajuste, entrada adicional)
  },
  remito: {
    type: Schema.Types.ObjectId,
    ref: 'Remito'
  },
  usuario: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  observaciones: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Índices para el historial: más nuevos primero, y filtrado por producto o tipo
MovimientoStockSchema.index({ fecha: -1, _id: -1 });
MovimientoStockSchema.index({ producto: 1, fecha: -1 });
MovimientoStockSchema.index({ tipo: 1, fecha: -1 });

export default mongoose.model<IMovimientoStock>('MovimientoStock', MovimientoStockSchema);