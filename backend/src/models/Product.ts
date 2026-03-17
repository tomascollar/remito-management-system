import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  nombre: string;
  categoria?: string;
  unidad_stock: string; // Cómo se almacena (cajon, bolsa, etc.)
  cantidad_por_bulto: number; // Cuántas unidades trae el bulto
  permite_venta_fraccionada: boolean; // Si se puede vender por unidad
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
    // Ejemplo: "cajon", "bolsa", "atado", etc.
  },
  cantidad_por_bulto: {
    type: Number,
    required: [true, 'La cantidad por bulto es requerida'],
    min: 1,
    default: 1
  },
  permite_venta_fraccionada: {
    type: Boolean,
    default: false
    // true = se puede vender por unidad (ej: repollo)
    // false = solo se vende por bulto completo (ej: banana)
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export default mongoose.model<IProduct>('Product', ProductSchema);