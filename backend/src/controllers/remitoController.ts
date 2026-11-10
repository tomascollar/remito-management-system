import { Request, Response } from 'express';
import Remito from '../models/Remito';
import Product from '../models/Product';
import StockDiario from '../models/StockDiario';
import { registrarMovimiento } from '../services/movimientosStock';
import { calcularTotal } from '../services/cobranzas';
import { bultosDeLinea, bultosDeUnidades, bultosParaMensaje, redondearBultos } from '../services/bultos';

// Crear un nuevo remito (arranca vacío, solo con el nombre del cliente)
export const crearRemito = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre_cliente } = req.body;
    const vendedorId = (req as any).usuario.id;

    const nuevoRemito = new Remito({
      fecha: new Date(),
      nombre_cliente: nombre_cliente.trim(),
      items: [],
      total: 0,
      vendedor: vendedorId,
      estado: 'abierto'
    });

    await nuevoRemito.save();

    res.status(201).json({
      message: 'Remito creado exitosamente',
      remito: nuevoRemito
    });
  } catch (error) {
    console.error('Error en crearRemito:', error);
    res.status(500).json({ message: 'Error al crear remito' });
  }
};

// Agregar un producto a un remito existente.
// - Toda venta descuenta stock en bultos. Por bulto: 1 a 1. Por unidad: cantidad ÷ unidades por
//   bulto del producto (11 remolachas con 10 por bulto = 1,1 bultos), con precio común o P.UxB.
// - Venta por unidad con `precio_x_bulto: true`: usa el precio P.UxB (precio de unidad por bulto).
// - Si el remito ya tiene una línea del mismo producto, misma unidad, mismo precio y mismo
//   contenido por bulto, la cantidad se suma a esa línea en vez de crear otra.
export const agregarItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const remitoId = req.params.id as string;
    const { producto, unidad_venta } = req.body; // unidad_venta: 'bulto' | 'unidad'
    const cantidad = Number(req.body.cantidad);
    // P.UxB: solo aplica a ventas por unidad; en ventas por bulto se ignora
    const xBulto = unidad_venta === 'unidad' && req.body.precio_x_bulto === true;

    const remito = await Remito.findById(remitoId);
    if (!remito) {
      res.status(404).json({ message: 'Remito no encontrado' });
      return;
    }

    if (remito.estado === 'cerrado') {
      res.status(400).json({ message: 'El remito está cerrado, no se pueden agregar productos' });
      return;
    }

    const productoDoc = await Product.findById(producto);
    if (!productoDoc || !productoDoc.activo) {
      res.status(404).json({ message: 'Producto no encontrado o inactivo' });
      return;
    }

    // Validar unidad_venta contra la configuración del producto
    if (unidad_venta === 'unidad' && !productoDoc.permite_venta_fraccionada) {
      res.status(400).json({ message: 'Este producto no permite venta fraccionada, solo se puede vender por bulto' });
      return;
    }

    const stockVigente = await StockDiario.findOne({ producto, activo: true });
    if (!stockVigente) {
      res.status(404).json({ message: 'No hay stock vigente registrado para este producto' });
      return;
    }

    let bultos_consumidos: number;
    let precio_unitario: number;
    // Solo ventas por unidad: cuántas unidades trae cada bulto (se guarda en la línea)
    let contenido_por_bulto: number | undefined;

    if (unidad_venta === 'bulto') {
      bultos_consumidos = redondearBultos(cantidad);
      precio_unitario = stockVigente.precio_bulto;
    } else {
      // Venta por unidad (solo productos fraccionables): se cobra el precio por unidad y se
      // descuenta del stock la fracción de bulto equivalente (cantidad ÷ unidades por bulto).
      if (!stockVigente.precio_unidad) {
        res.status(400).json({ message: 'No hay precio por unidad definido para este producto' });
        return;
      }
      precio_unitario = stockVigente.precio_unidad;

      // P.UxB: el vendedor lo eligió a mano (precio por unidad al llevar cantidad)
      if (xBulto) {
        if (!stockVigente.precio_unidad_x_bulto) {
          res.status(400).json({ message: 'Este producto no tiene precio de unidad por bulto (P.UxB) definido' });
          return;
        }
        precio_unitario = stockVigente.precio_unidad_x_bulto;
      }

      // Sin el contenido por bulto no se puede calcular cuánto stock descontar
      if (!productoDoc.cantidad_por_bulto) {
        res.status(400).json({
          message: 'Este producto no tiene cargadas las unidades por bulto. Editá el producto para poder venderlo por unidad'
        });
        return;
      }
      contenido_por_bulto = productoDoc.cantidad_por_bulto;
      bultos_consumidos = bultosDeUnidades(cantidad, contenido_por_bulto);
    }

    // Control de stock (por bulto o por unidad): no se vende más de lo que hay
    if (stockVigente.cantidad_bultos_actual < bultos_consumidos) {
      res.status(400).json({
        message: `Stock insuficiente. Disponible: ${stockVigente.cantidad_bultos_actual} bultos, se necesitan: ${bultosParaMensaje(bultos_consumidos)}`
      });
      return;
    }

    stockVigente.cantidad_bultos_actual = redondearBultos(stockVigente.cantidad_bultos_actual - bultos_consumidos);
    await stockVigente.save();

    // ¿Ya hay una línea igual? Mismo producto + misma unidad + MISMO PRECIO + mismo contenido por
    // bulto. El precio importa: si cambió durante el día, lo ya vendido conserva el precio viejo y
    // lo nuevo va en otra línea. El contenido importa para que devolver stock use la misma cuenta
    // (y para no mezclar con líneas por unidad anteriores a este control, que no descontaron stock).
    const existente = (remito.items as any[]).find(
      (it) =>
        it.producto.toString() === productoDoc._id.toString() &&
        it.unidad_venta === unidad_venta &&
        it.precio_unitario === precio_unitario &&
        Boolean(it.precio_x_bulto) === xBulto &&
        (it.contenido_por_bulto ?? 0) === (contenido_por_bulto ?? 0)
    );

    if (existente) {
      existente.cantidad += cantidad;
      existente.bultos_consumidos = redondearBultos(existente.bultos_consumidos + bultos_consumidos);
      existente.subtotal = existente.cantidad * existente.precio_unitario;
    } else {
      remito.items.push({
        producto: productoDoc._id,
        nombre_producto: productoDoc.nombre,
        cantidad,
        unidad_venta,
        bultos_consumidos,
        precio_unitario,
        precio_x_bulto: xBulto,
        ...(contenido_por_bulto && { contenido_por_bulto }),
        subtotal: cantidad * precio_unitario
      } as any);
    }

    // Recalcular total (productos + ajustes)
    remito.total = calcularTotal(remito.items, remito.ajustes);

    await remito.save();

    // Historial: toda venta mueve stock (en las ventas por unidad se aclara cuántas unidades fueron)
    if (bultos_consumidos > 0) {
      await registrarMovimiento({
        producto: productoDoc._id,
        tipo: 'venta',
        cantidad_bultos: -bultos_consumidos,
        usuario: (req as any).usuario.id,
        remito: remito._id,
        observaciones:
          `Remito #${remito.numero_remito} - ${remito.nombre_cliente}` +
          (unidad_venta === 'unidad' ? ` (${cantidad} u.)` : '')
      });
    }

    res.status(201).json({
      message: 'Producto agregado al remito exitosamente',
      remito
    });
  } catch (error) {
    console.error('Error en agregarItem:', error);
    res.status(500).json({ message: 'Error al agregar producto al remito' });
  }
};

// Cambiar la cantidad de un ítem ya cargado. Mantiene el precio con el que se vendió.
// Ajusta el stock por la diferencia de bultos (por bulto o por unidad). Las líneas por unidad
// vendidas antes de que la venta por unidad descontara stock no tienen contenido guardado y
// siguen sin mover stock.
export const modificarCantidadItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const remitoId = req.params.id as string;
    const itemId = req.params.itemId as string;
    const cantidad = Number(req.body.cantidad);

    const remito = await Remito.findById(remitoId);
    if (!remito) {
      res.status(404).json({ message: 'Remito no encontrado' });
      return;
    }

    if (remito.estado === 'cerrado') {
      res.status(400).json({ message: 'El remito está cerrado, no se pueden modificar sus productos' });
      return;
    }

    const item = (remito.items as any).id(itemId);
    if (!item) {
      res.status(404).json({ message: 'Ítem no encontrado en el remito' });
      return;
    }

    const cantidadAnterior: number = item.cantidad;

    // Bultos que tiene que tener descontados la línea con la nueva cantidad (por bulto 1 a 1; por
    // unidad, cantidad ÷ contenido guardado en la línea). Se compara contra lo que realmente se
    // descontó: diferencia > 0 = se llevan más (hay que verificar stock); < 0 = se devuelven.
    const bultosNuevos = bultosDeLinea(item.unidad_venta, cantidad, item.contenido_por_bulto);
    const diferencia = redondearBultos(bultosNuevos - item.bultos_consumidos);
    let movido = 0; // bultos que realmente se movieron en el stock (para el historial)

    if (diferencia !== 0) {
      const stockVigente = await StockDiario.findOne({ producto: item.producto, activo: true });

      if (diferencia > 0) {
        if (!stockVigente) {
          res.status(404).json({ message: 'No hay stock vigente registrado para este producto' });
          return;
        }
        if (stockVigente.cantidad_bultos_actual < diferencia) {
          res.status(400).json({
            message: `Stock insuficiente. Disponible: ${stockVigente.cantidad_bultos_actual} bultos, se necesitan: ${bultosParaMensaje(diferencia)} más`
          });
          return;
        }
      }

      if (stockVigente) {
        stockVigente.cantidad_bultos_actual = redondearBultos(stockVigente.cantidad_bultos_actual - diferencia);
        await stockVigente.save();
        movido = diferencia;
      }
      item.bultos_consumidos = bultosNuevos;
    }

    item.cantidad = cantidad;
    item.subtotal = cantidad * item.precio_unitario;

    remito.total = calcularTotal(remito.items, remito.ajustes);
    await remito.save();

    // Historial: la diferencia de bultos es una venta (si aumentó) o una devolución (si bajó)
    if (movido !== 0) {
      await registrarMovimiento({
        producto: item.producto,
        tipo: movido > 0 ? 'venta' : 'devolucion',
        cantidad_bultos: -movido,
        usuario: (req as any).usuario.id,
        remito: remito._id,
        observaciones:
          `Remito #${remito.numero_remito} - cantidad modificada de ${cantidadAnterior} a ${cantidad}` +
          (item.unidad_venta === 'unidad' ? ' u.' : '')
      });
    }

    res.json({ message: 'Cantidad actualizada exitosamente', remito });
  } catch (error) {
    console.error('Error en modificarCantidadItem:', error);
    res.status(500).json({ message: 'Error al modificar la cantidad' });
  }
};

// Quitar un producto del remito (devuelve stock)
export const quitarItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const remitoId = req.params.id as string;
    const itemId = req.params.itemId as string;

    const remito = await Remito.findById(remitoId);
    if (!remito) {
      res.status(404).json({ message: 'Remito no encontrado' });
      return;
    }

    if (remito.estado === 'cerrado') {
      res.status(400).json({ message: 'El remito está cerrado, no se pueden quitar productos' });
      return;
    }

    const item = (remito.items as any).id(itemId);
    if (!item) {
      res.status(404).json({ message: 'Ítem no encontrado en el remito' });
      return;
    }

    // Devolver stock: exactamente los bultos que se descontaron al vender (por bulto o por unidad)
    const stockVigente = await StockDiario.findOne({ producto: item.producto, activo: true });
    if (stockVigente) {
      stockVigente.cantidad_bultos_actual = redondearBultos(stockVigente.cantidad_bultos_actual + item.bultos_consumidos);
      await stockVigente.save();
    }

    // Se guardan estos datos antes de quitar la línea, para el historial
    const productoQuitado = item.producto;
    const bultosDevueltos = stockVigente ? item.bultos_consumidos : 0;

    // Quitar el ítem del array
    (remito.items as any).pull(itemId);

    // Recalcular total (productos + ajustes)
    remito.total = calcularTotal(remito.items, remito.ajustes);

    await remito.save();

    await registrarMovimiento({
      producto: productoQuitado,
      tipo: 'devolucion',
      cantidad_bultos: bultosDevueltos,
      usuario: (req as any).usuario.id,
      remito: remito._id,
      observaciones: `Remito #${remito.numero_remito} - producto quitado`
    });

    res.json({
      message: 'Producto quitado del remito exitosamente',
      remito
    });
  } catch (error) {
    console.error('Error en quitarItem:', error);
    res.status(500).json({ message: 'Error al quitar producto del remito' });
  }
};

// Cerrar remito
export const cerrarRemito = async (req: Request, res: Response): Promise<void> => {
  try {
    const remitoId = req.params.id as string;

    const remito = await Remito.findById(remitoId);
    if (!remito) {
      res.status(404).json({ message: 'Remito no encontrado' });
      return;
    }

    remito.estado = 'cerrado';
    await remito.save();

    res.json({ message: 'Remito cerrado exitosamente', remito });
  } catch (error) {
    console.error('Error en cerrarRemito:', error);
    res.status(500).json({ message: 'Error al cerrar remito' });
  }
};

// Reabrir remito
export const reabrirRemito = async (req: Request, res: Response): Promise<void> => {
  try {
    const remitoId = req.params.id as string;

    const remito = await Remito.findById(remitoId);
    if (!remito) {
      res.status(404).json({ message: 'Remito no encontrado' });
      return;
    }

    remito.estado = 'abierto';
    await remito.save();

    res.json({ message: 'Remito reabierto exitosamente', remito });
  } catch (error) {
    console.error('Error en reabrirRemito:', error);
    res.status(500).json({ message: 'Error al reabrir remito' });
  }
};

// (El listado paginado de remitos vive en remitoListado.ts)

// Obtener un remito por ID
export const getRemitoById = async (req: Request, res: Response): Promise<void> => {
  try {
    const remitoId = req.params.id as string;

    const remito = await Remito.findById(remitoId).populate('vendedor', 'nombre email');
    if (!remito) {
      res.status(404).json({ message: 'Remito no encontrado' });
      return;
    }

    res.json(remito);
  } catch (error) {
    console.error('Error en getRemitoById:', error);
    res.status(500).json({ message: 'Error al obtener remito' });
  }
};

