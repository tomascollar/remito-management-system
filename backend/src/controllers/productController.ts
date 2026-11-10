import { Request, Response } from 'express';
import Product from '../models/Product';

// Un producto que se vende por unidad necesita saber cuántas unidades trae cada bulto: con ese
// dato se calcula cuánto stock se descuenta (11 unidades con 10 por bulto = 1,1 bultos).
const MENSAJE_CONTENIDO_OBLIGATORIO =
  'Indicá cuántas unidades trae cada bulto: es obligatorio si el producto permite venta fraccionada';

// Obtener todos los productos
export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { activo } = req.query;

    const filtro = activo !== undefined ? { activo: activo === 'true' } : {};

    const productos = await Product.find(filtro).sort({ nombre: 1 });
    res.json(productos);
  } catch (error) {
    console.error('Error en getAllProducts:', error);
    res.status(500).json({ message: 'Error al obtener productos' });
  }
};

// Obtener un producto por ID
export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const producto = await Product.findById(id);

    if (!producto) {
      res.status(404).json({ message: 'Producto no encontrado' });
      return;
    }

    res.json(producto);
  } catch (error) {
    console.error('Error en getProductById:', error);
    res.status(500).json({ message: 'Error al obtener producto' });
  }
};

// Crear nuevo producto
export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, categoria, unidad_stock, cantidad_por_bulto, permite_venta_fraccionada } = req.body;

    const productoExistente = await Product.findOne({ nombre: nombre.trim() });
    if (productoExistente) {
      res.status(400).json({ message: 'Ya existe un producto con ese nombre' });
      return;
    }

    if (permite_venta_fraccionada && !cantidad_por_bulto) {
      res.status(400).json({ message: MENSAJE_CONTENIDO_OBLIGATORIO });
      return;
    }

    const nuevoProducto = new Product({
      nombre: nombre.trim(),
      categoria: categoria?.trim(),
        unidad_stock: unidad_stock?.trim() || 'Bulto',
       cantidad_por_bulto: cantidad_por_bulto ?? undefined, // null => no se guarda
      permite_venta_fraccionada: permite_venta_fraccionada || false
    });

    await nuevoProducto.save();

    res.status(201).json({
      message: 'Producto creado exitosamente',
      producto: nuevoProducto
    });
  } catch (error) {
    console.error('Error en createProduct:', error);
    res.status(500).json({ message: 'Error al crear producto' });
  }
};

// Actualizar producto
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { nombre, categoria, unidad_stock, cantidad_por_bulto, permite_venta_fraccionada } = req.body;

    const producto = await Product.findById(id);
    if (!producto) {
      res.status(404).json({ message: 'Producto no encontrado' });
      return;
    }

    // Cómo quedaría el producto: si va a ser fraccionable tiene que quedar con contenido por bulto.
    // (También cubre productos viejos fraccionables sin ese dato: al editarlos hay que cargarlo.)
    const fraccionableFinal = permite_venta_fraccionada ?? producto.permite_venta_fraccionada;
    const contenidoFinal = cantidad_por_bulto === null ? undefined : cantidad_por_bulto ?? producto.cantidad_por_bulto;
    if (fraccionableFinal && !contenidoFinal) {
      res.status(400).json({ message: MENSAJE_CONTENIDO_OBLIGATORIO });
      return;
    }

    if (nombre && nombre.trim() !== producto.nombre) {
      const nombreEnUso = await Product.findOne({
        nombre: nombre.trim(),
        _id: { $ne: producto._id }
      });
      if (nombreEnUso) {
        res.status(400).json({ message: 'Ya existe un producto con ese nombre' });
        return;
      }
      producto.nombre = nombre.trim();
    }

    if (categoria !== undefined) producto.categoria = categoria.trim();
    if (unidad_stock) producto.unidad_stock = unidad_stock.trim();
    
    if (cantidad_por_bulto === null) {
      producto.cantidad_por_bulto = undefined;
    } else if (cantidad_por_bulto !== undefined) {
      if (cantidad_por_bulto < 1) {
        res.status(400).json({ message: 'La cantidad por bulto debe ser mayor o igual a 1' });
        return;
      }
      producto.cantidad_por_bulto = cantidad_por_bulto;
    }




    if (permite_venta_fraccionada !== undefined) {
      producto.permite_venta_fraccionada = permite_venta_fraccionada;
    }

    await producto.save();

    res.json({
      message: 'Producto actualizado exitosamente',
      producto
    });
  } catch (error) {
    console.error('Error en updateProduct:', error);
    res.status(500).json({ message: 'Error al actualizar producto' });
  }
};

// Desactivar producto (soft delete)
export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const producto = await Product.findById(id);
    if (!producto) {
      res.status(404).json({ message: 'Producto no encontrado' });
      return;
    }

    producto.activo = false;
    await producto.save();

    res.json({ message: 'Producto desactivado exitosamente' });
  } catch (error) {
    console.error('Error en deleteProduct:', error);
    res.status(500).json({ message: 'Error al desactivar producto' });
  }
};

// Reactivar producto
export const reactivateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const producto = await Product.findById(id);
    if (!producto) {
      res.status(404).json({ message: 'Producto no encontrado' });
      return;
    }

    producto.activo = true;
    await producto.save();

    res.json({
      message: 'Producto reactivado exitosamente',
      producto
    });
  } catch (error) {
    console.error('Error en reactivateProduct:', error);
    res.status(500).json({ message: 'Error al reactivar producto' });
  }
};

// Eliminar producto permanentemente
export const permanentDeleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const producto = await Product.findByIdAndDelete(id);
    if (!producto) {
      res.status(404).json({ message: 'Producto no encontrado' });
      return;
    }

    res.json({ message: 'Producto eliminado permanentemente' });
  } catch (error) {
    console.error('Error en permanentDeleteProduct:', error);
    res.status(500).json({ message: 'Error al eliminar producto permanentemente' });
  }
};