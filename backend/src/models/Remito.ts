import mongoose, { Document, Schema } from 'mongoose';
import { redondear, totalEntregado } from '../services/cobranzas';

interface IRemitoItem {
  producto: mongoose.Types.ObjectId;
  nombre_producto: string;
  cantidad: number; // Cantidad vendida
  unidad_venta: string; // "bulto" o "unidad"
  bultos_consumidos: number; // Cuántos bultos se descontaron del stock (puede ser decimal)
  precio_unitario: number; // Precio al momento de la venta
  precio_x_bulto?: boolean; // true si se vendió a P.UxB (precio de unidad por bulto)
  contenido_por_bulto?: number; // Solo ventas por unidad: unidades por bulto del producto al momento de la venta
  subtotal: number;
}

/** Línea sin producto ni stock: "saldo anterior", descuento, recargo… Suma (o resta) al total. */
interface IRemitoAjuste {
  concepto: string;
  monto: number; // positivo suma al total, negativo lo reduce (ej: vacíos devueltos)
  resaltado: boolean; // en el comprobante se dibuja destacado, como con un resaltador
}

/** Pago a cuenta. No se edita ni se borra: si fue un error se ANULA (queda el rastro). */
interface IRemitoEntrega {
  monto: number;
  fecha: Date;
  usuario: mongoose.Types.ObjectId;
  nota?: string;
  anulada: boolean;
  anulada_por?: mongoose.Types.ObjectId;
  anulada_fecha?: Date;
}

export interface IRemito extends Document {
  numero_remito: number;
  fecha: Date;
  nombre_cliente: string;
  items: IRemitoItem[];
  ajustes: IRemitoAjuste[];
  entregas: IRemitoEntrega[];
  total: number; // productos + ajustes
  entregado: number; // virtual: suma de entregas no anuladas
  saldo: number; // virtual: total - entregado
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
    // Marca de qué precio de unidad se usó (común o P.UxB). El precio ya queda congelado en precio_unitario.
    precio_x_bulto: {
      type: Boolean,
      default: false
    },
    // Ventas por unidad: unidades por bulto del producto al vender. Se guarda en la línea para que
    // cambiar la cantidad (o quitarla) devuelva al stock exactamente lo que se descontó, aunque
    // después se edite el producto. En ventas por bulto no se usa.
    contenido_por_bulto: {
      type: Number,
      min: 1
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  ajustes: [{
    concepto: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    monto: {
      type: Number,
      required: true
    },
    resaltado: {
      type: Boolean,
      default: false
    }
  }],
  entregas: [{
    monto: {
      type: Number,
      required: true,
      min: 0.01
    },
    fecha: {
      type: Date,
      default: Date.now
    },
    usuario: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    nota: {
      type: String,
      trim: true,
      maxlength: 100
    },
    anulada: {
      type: Boolean,
      default: false
    },
    anulada_por: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    anulada_fecha: {
      type: Date
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
  timestamps: true,
  id: false, // sin el alias "id" duplicado
  toJSON: { virtuals: true } // para que `entregado` y `saldo` viajen en las respuestas
});

// Lo cobrado y lo que falta se CALCULAN siempre a partir de las entregas: no se guardan,
// así nunca pueden quedar desincronizados con el detalle.
RemitoSchema.virtual('entregado').get(function (this: any) {
  return totalEntregado(this.entregas);
});
RemitoSchema.virtual('saldo').get(function (this: any) {
  return redondear(this.total - totalEntregado(this.entregas));
});


   RemitoSchema.index({ estado: 1, numero_remito: -1 });
   RemitoSchema.index({ vendedor: 1, numero_remito: -1 });

// Auto-incrementar numero_remito
RemitoSchema.pre('save', async function (this: any) {
  if (this.isNew) {
    const RemitoModel = mongoose.model('Remito');
    const lastRemito = await RemitoModel.findOne().sort({ numero_remito: -1 });
    this.numero_remito = lastRemito ? (lastRemito as any).numero_remito + 1 : 1;
  }
});

export default mongoose.model<IRemito>('Remito', RemitoSchema);