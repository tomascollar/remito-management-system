import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User';

// Obtener todos los usuarios (solo superadmin)
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuarios = await User.find().select('-password');
    res.json(usuarios);
  } catch (error) {
    console.error('Error en getAllUsers:', error);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
};

// Obtener un usuario por ID
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const usuario = await User.findById(id).select('-password');
    
    if (!usuario) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    res.json(usuario);
  } catch (error) {
    console.error('Error en getUserById:', error);
    res.status(500).json({ message: 'Error al obtener usuario' });
  }
};

// Crear nuevo usuario (solo superadmin)
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, email, password, rol } = req.body;

    // Validar que no exista el email
    const existeUsuario = await User.findOne({ email });
    if (existeUsuario) {
      res.status(400).json({ message: 'El email ya está registrado' });
      return;
    }

    // Validar rol
    const rolesValidos = ['superadmin', 'administrador', 'vendedor'];
    if (rol && !rolesValidos.includes(rol)) {
      res.status(400).json({ message: 'Rol inválido' });
      return;
    }

    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Crear usuario
    const nuevoUsuario = new User({
      nombre,
      email,
      password: hashedPassword,
      rol: rol || 'vendedor'
    });

    await nuevoUsuario.save();

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      usuario: {
        id: nuevoUsuario._id,
        nombre: nuevoUsuario.nombre,
        email: nuevoUsuario.email,
        rol: nuevoUsuario.rol,
        activo: nuevoUsuario.activo
      }
    });
  } catch (error) {
    console.error('Error en createUser:', error);
    res.status(500).json({ message: 'Error al crear usuario' });
  }
};

// Actualizar usuario
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { nombre, email, rol, activo, password } = req.body;

    const usuario = await User.findById(id);
    if (!usuario) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    // Actualizar campos
    if (nombre) usuario.nombre = nombre;
    if (email) {
      // Verificar que el email no esté en uso por otro usuario
 
      const emailEnUso = await User.findOne({
        email,
        _id: { $ne: usuario._id } 
      });
      if (emailEnUso) {
        res.status(400).json({ message: 'El email ya está en uso' });
        return;
      }
      usuario.email = email;
    }
    if (rol) usuario.rol = rol;
    if (activo !== undefined) usuario.activo = activo;
    
    // Si se proporciona nueva contraseña
    if (password) {
      const salt = await bcrypt.genSalt(10);
      usuario.password = await bcrypt.hash(password, salt);
    }

    await usuario.save();

    res.json({
      message: 'Usuario actualizado exitosamente',
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        activo: usuario.activo
      }
    });
  } catch (error) {
    console.error('Error en updateUser:', error);
    res.status(500).json({ message: 'Error al actualizar usuario' });
  }
};

// Eliminar usuario (soft delete - solo lo desactiva)
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const usuario = await User.findById(id);
    if (!usuario) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    // Soft delete - solo desactivamos el usuario
    usuario.activo = false;
    await usuario.save();

    res.json({ message: 'Usuario desactivado exitosamente' });
  } catch (error) {
    console.error('Error en deleteUser:', error);
    res.status(500).json({ message: 'Error al eliminar usuario' });
  }
};

// Eliminar permanentemente (hard delete)
export const permanentDeleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const usuario = await User.findByIdAndDelete(id);
    if (!usuario) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    res.json({ message: 'Usuario eliminado permanentemente' });
  } catch (error) {
    console.error('Error en permanentDeleteUser:', error);
    res.status(500).json({ message: 'Error al eliminar usuario permanentemente' });
  }
};