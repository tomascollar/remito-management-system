import { Request, Response } from 'express';
import Remito from '../models/Remito';
import Product from '../models/Product';
import StockDiario from '../models/StockDiario';

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

// Agregar un producto a un remito existente (descuenta stock)
export const agregarItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const remitoId = req.params.id as string;
    const { producto, cantidad, unidad_venta } = req.body; // unidad_venta: 'bulto' | 'unidad'

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

    // Calcular cuántos bultos consume esta venta y el precio unitario correspondiente

    
    let bultos_consumidos: number;
    let precio_unitario: number;

    if (unidad_venta === 'bulto') {
      bultos_consumidos = cantidad;
      precio_unitario = stockVigente.precio_bulto;
    } else {
      // unidad_venta === 'unidad'
      if (!productoDoc.cantidad_por_bulto) {
        res.status(400).json({ message: 'El producto no tiene definida una cantidad por bulto' });
        return;
      }
      if (!stockVigente.precio_unidad) {
        res.status(400).json({ message: 'No hay precio por unidad definido para este producto' });
        return;
      }
      bultos_consumidos = cantidad / productoDoc.cantidad_por_bulto;
      precio_unitario = stockVigente.precio_unidad;
    }

    // Verificar que haya stock suficiente
    if (stockVigente.cantidad_bultos_actual < bultos_consumidos) {
      res.status(400).json({
        message: `Stock insuficiente. Disponible: ${stockVigente.cantidad_bultos_actual} bultos, se necesitan: ${bultos_consumidos}`
      });
      return;
    }

    const subtotal = cantidad * precio_unitario;

    // Descontar stock
    stockVigente.cantidad_bultos_actual -= bultos_consumidos;
    await stockVigente.save();

    // Agregar ítem al remito
    remito.items.push({
      producto: productoDoc._id,
      nombre_producto: productoDoc.nombre,
      cantidad,
      unidad_venta,
      bultos_consumidos,
      precio_unitario,
      subtotal
    } as any);

    // Recalcular total
    remito.total = remito.items.reduce((acc, item: any) => acc + item.subtotal, 0);

    await remito.save();

    res.status(201).json({
      message: 'Producto agregado al remito exitosamente',
      remito
    });
  } catch (error) {
    console.error('Error en agregarItem:', error);
    res.status(500).json({ message: 'Error al agregar producto al remito' });
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

    // Devolver stock
    const stockVigente = await StockDiario.findOne({ producto: item.producto, activo: true });
    if (stockVigente) {
      stockVigente.cantidad_bultos_actual += item.bultos_consumidos;
      await stockVigente.save();
    }

    // Quitar el ítem del array
    (remito.items as any).pull(itemId);

    // Recalcular total
    remito.total = remito.items.reduce((acc, it: any) => acc + it.subtotal, 0);

    await remito.save();

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

// Listar remitos con filtros opcionales
export const getRemitos = async (req: Request, res: Response): Promise<void> => {
  try {
    const { estado, vendedor, fecha_desde, fecha_hasta } = req.query;

    const filtro: any = {};
    if (estado) filtro.estado = estado;
    if (vendedor) filtro.vendedor = vendedor;
    if (fecha_desde || fecha_hasta) {
      filtro.fecha = {};
      if (fecha_desde) filtro.fecha.$gte = new Date(fecha_desde as string);
      if (fecha_hasta) filtro.fecha.$lte = new Date(fecha_hasta as string);
    }

    const remitos = await Remito.find(filtro)
      .populate('vendedor', 'nombre email')
      .sort({ numero_remito: -1 });

    res.json(remitos);
  } catch (error) {
    console.error('Error en getRemitos:', error);
    res.status(500).json({ message: 'Error al obtener remitos' });
  }
};

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

