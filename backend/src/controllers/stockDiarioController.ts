import { Request, Response } from 'express';
import StockDiario from '../models/StockDiario';
import Product from '../models/Product';
import MovimientoStock from '../models/MovimientoStock';

// Registrar nuevo stock vigente para un producto (ej: llegó el camión)
export const registrarStockDiario = async (req: Request, res: Response): Promise<void> => {
  try {
    const { producto, cantidad_bultos_inicial, precio_bulto, precio_unidad } = req.body;

    const productoExistente = await Product.findById(producto);
    if (!productoExistente || !productoExistente.activo) {
      res.status(404).json({ message: 'Producto no encontrado o inactivo' });
      return;
    }

    if (productoExistente.permite_venta_fraccionada && !precio_unidad) {
      res.status(400).json({ message: 'Este producto permite venta fraccionada, se requiere precio_unidad' });
      return;
    }

    // Desactivar el stock vigente anterior (si existe), pasa a ser histórico
    await StockDiario.updateMany(
      { producto, activo: true },
      { $set: { activo: false } }
    );

    const nuevoStock = new StockDiario({
      fecha: new Date(),
      producto,
      cantidad_bultos_inicial,
      cantidad_bultos_actual: cantidad_bultos_inicial,
      precio_bulto,
      precio_unidad: productoExistente.permite_venta_fraccionada ? precio_unidad : undefined,
      activo: true
    });

    await nuevoStock.save();

    res.status(201).json({
      message: 'Stock registrado exitosamente como stock vigente',
      stock: nuevoStock
    });
  } catch (error) {
    console.error('Error en registrarStockDiario:', error);
    res.status(500).json({ message: 'Error al registrar stock' });
  }
};

// Obtener el stock vigente de todos los productos
export const getStockVigente = async (req: Request, res: Response): Promise<void> => {
  try {
    const stock = await StockDiario.find({ activo: true })
      .populate('producto', 'nombre categoria unidad_stock permite_venta_fraccionada');

    res.json(stock);
  } catch (error) {
    console.error('Error en getStockVigente:', error);
    res.status(500).json({ message: 'Error al obtener stock vigente' });
  }
};

// Obtener el stock vigente de un producto específico
export const getStockVigentePorProducto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productoId } = req.params;

    const stock = await StockDiario.findOne({ producto: productoId, activo: true })
      .populate('producto', 'nombre categoria unidad_stock permite_venta_fraccionada');

    if (!stock) {
      res.status(404).json({ message: 'No hay stock vigente registrado para este producto' });
      return;
    }

    res.json(stock);
  } catch (error) {
    console.error('Error en getStockVigentePorProducto:', error);
    res.status(500).json({ message: 'Error al obtener stock del producto' });
  }
};

// Agregar más cantidad al stock vigente (ej: traen más de la cámara frigorífica)
export const agregarStock = async (req: Request, res: Response): Promise<void> => {
  try {
    const productoId = req.params.productoId as string;
    const { cantidad_bultos } = req.body;
    const usuarioId = (req as any).usuario.id;

    const stock = await StockDiario.findOne({ producto: productoId, activo: true });

    if (!stock) {
      res.status(404).json({ message: 'No hay stock vigente para este producto. Registrá el stock inicial primero.' });
      return;
    }

    stock.cantidad_bultos_actual += cantidad_bultos;
    stock.cantidad_bultos_inicial += cantidad_bultos;
    await stock.save();

    await MovimientoStock.create({
      fecha: new Date(),
      producto: productoId,
      tipo: 'entrada_adicional',
      cantidad_bultos,
      usuario: usuarioId,
      observaciones: 'Ingreso adicional de mercadería'
    });

    res.json({ message: 'Stock agregado exitosamente', stock });
  } catch (error) {
    console.error('Error en agregarStock:', error);
    res.status(500).json({ message: 'Error al agregar stock' });
  }
};

// Actualizar precio del stock vigente (no afecta remitos ya generados)
export const actualizarPrecioDia = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productoId } = req.params;
    const { precio_bulto, precio_unidad } = req.body;

    const stock = await StockDiario.findOne({ producto: productoId, activo: true });

    if (!stock) {
      res.status(404).json({ message: 'No hay stock vigente para este producto' });
      return;
    }

    if (precio_bulto !== undefined) stock.precio_bulto = precio_bulto;
    if (precio_unidad !== undefined) stock.precio_unidad = precio_unidad;

    await stock.save();

    res.json({
      message: 'Precio actualizado. Los remitos ya generados mantienen el precio con el que fueron creados.',
      stock
    });
  } catch (error) {
    console.error('Error en actualizarPrecioDia:', error);
    res.status(500).json({ message: 'Error al actualizar precio' });
  }
};

// Ajuste manual de stock (corrección por discrepancias)
export const ajustarStock = async (req: Request, res: Response): Promise<void> => {
  try {
    const productoId = req.params.productoId as string;
    const { cantidad_bultos, observaciones } = req.body;
    const usuarioId = (req as any).usuario.id;

    const stock = await StockDiario.findOne({ producto: productoId, activo: true });

    if (!stock) {
      res.status(404).json({ message: 'No hay stock vigente para este producto' });
      return;
    }

    const nuevaCantidad = stock.cantidad_bultos_actual + cantidad_bultos;
    if (nuevaCantidad < 0) {
      res.status(400).json({ message: 'El ajuste resultaría en stock negativo' });
      return;
    }

    stock.cantidad_bultos_actual = nuevaCantidad;
    await stock.save();

    await MovimientoStock.create({
      fecha: new Date(),
      producto: productoId,
      tipo: 'ajuste',
      cantidad_bultos,
      usuario: usuarioId,
      observaciones: observaciones || 'Ajuste manual de stock'
    });

    res.json({ message: 'Stock ajustado exitosamente', stock });
  } catch (error) {
    console.error('Error en ajustarStock:', error);
    res.status(500).json({ message: 'Error al ajustar stock' });
  }
};