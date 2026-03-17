import mongoose, { Document, Schema } from 'mongoose';

export interface IStockDiario extends Document {
  fecha: Date;
  producto: mongoose.Types.ObjectId;
  cantidad_bultos_inicial: number;
  cantidad_bultos_actual: number; // Se irá descontando (puede ser decimal: 15.5 cajones)
  precio_bulto: number;
  precio_unidad?: number; // Solo si permite venta fraccionada
  createdAt: Date;
  updatedAt: Date;
}

const StockDiarioSchema: Schema = new Schema({
  fecha: {
    type: Date,
    required: true,
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
    // Solo se usa si el producto permite venta fraccionada
  }
}, {
  timestamps: true
});

// Índice compuesto para evitar duplicados producto-fecha del mismo día
StockDiarioSchema.index({ producto: 1, fecha: 1 });

export default mongoose.model<IStockDiario>('StockDiario', StockDiarioSchema);