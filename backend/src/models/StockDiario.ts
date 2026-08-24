import mongoose, { Document, Schema } from 'mongoose';

export interface IStockDiario extends Document {
  fecha: Date;
  producto: mongoose.Types.ObjectId;
  cantidad_bultos_inicial: number;
  cantidad_bultos_actual: number;
  precio_bulto: number;
  precio_unidad?: number;
  activo: boolean; // Solo un registro activo por producto a la vez
  createdAt: Date;
  updatedAt: Date;
}

const StockDiarioSchema: Schema = new Schema({
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
  cantidad_bultos_inicial: {
    type: Number,
    required: true,
    min: 0
  },
  cantidad_bultos_actual: {
    type: Number,
    required: true,
    min: 0
  },
  precio_bulto: {
    type: Number,
    required: true,
    min: 0
  },
  precio_unidad: {
    type: Number,
    min: 0
  },
  activo: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

export default mongoose.model<IStockDiario>('StockDiario', StockDiarioSchema);