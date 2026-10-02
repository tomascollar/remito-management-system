import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  nombre: string;
  categoria?: string;
  unidad_stock: string;
  cantidad_por_bulto?: number; // Ahora opcional
  permite_venta_fraccionada: boolean;
  activo: boolean;
  createdAt: Date;
}

const ProductSchema: Schema = new Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre del producto es requerido'],
    trim: true,
    unique: true
  },
  categoria: {
    type: String,
    trim: true
  },
  unidad_stock: {
    type: String,
    required: [true, 'La unidad de stock es requerida'],
    trim: true
  },
  cantidad_por_bulto: {
    type: Number,
    min: 1
  },
  permite_venta_fraccionada: {
    type: Boolean,
    default: false
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export default mongoose.model<IProduct>('Product', ProductSchema);