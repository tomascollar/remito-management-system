import mongoose, { Document, Schema } from 'mongoose';

export interface IMovimientoStock extends Document {
  fecha: Date;
  producto: mongoose.Types.ObjectId;
  tipo: 'venta' | 'devolucion' | 'ajuste' | 'entrada_adicional';
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
    enum: ['venta', 'devolucion', 'ajuste', 'entrada_adicional'],
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

export default mongoose.model<IMovimientoStock>('MovimientoStock', MovimientoStockSchema);