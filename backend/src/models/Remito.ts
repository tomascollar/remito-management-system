import mongoose, { Document, Schema } from 'mongoose';

interface IRemitoItem {
  producto: mongoose.Types.ObjectId;
  nombre_producto: string;
  cantidad: number; // Cantidad vendida
  unidad_venta: string; // "bulto" o "unidad"
  bultos_consumidos: number; // Cuántos bultos se descontaron del stock (puede ser decimal)
  precio_unitario: number; // Precio al momento de la venta
  subtotal: number;
}

export interface IRemito extends Document {
  numero_remito: number;
  fecha: Date;
  nombre_cliente: string;
  items: IRemitoItem[];
  total: number;
  vendedor: mongoose.Types.ObjectId;
  estado: 'abierto' | 'cerrado';
  createdAt: Date;
  updatedAt: Date;
}

const RemitoSchema: Schema = new Schema({
  numero_remito: {
    type: Number,
    unique: true
  },
  fecha: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  nombre_cliente: {
    type: String,
    required: [true, 'El nombre del cliente es requerido'],
    trim: true
  },
  items: [{
    producto: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    nombre_producto: {
      type: String,
      required: true
    },
    cantidad: {
      type: Number,
      required: true,
      min: 0.01
    },
    unidad_venta: {
      type: String,
      required: true
      // "bulto" o "unidad"
    },
    bultos_consumidos: {
      type: Number,
      required: true,
      min: 0
      // Ejemplo: vendió 15 unidades de repollo (cajón de 10) = 1.5 bultos
    },
    precio_unitario: {
      type: Number,
      required: true,
      min: 0
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  total: {
    type: Number,
    required: true,
    default: 0
  },
  vendedor: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  estado: {
    type: String,
    enum: ['abierto', 'cerrado'],
    default: 'abierto'
  }
}, {
  timestamps: true
});

// Auto-incrementar numero_remito
RemitoSchema.pre('save', function(this: any, next: any) {
  if (this.isNew) {
    mongoose.model('Remito')
      .findOne()
      .sort({ numero_remito: -1 })
      .exec()
      .then((lastRemito: any) => {
        this.numero_remito = lastRemito ? lastRemito.numero_remito + 1 : 1;
        next();
      })
      .catch((err: any) => {
        next(err);
      });
  } else {
    next();
  }
});

export default mongoose.model<IRemito>('Remito', RemitoSchema);