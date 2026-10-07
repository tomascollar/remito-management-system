import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { registrarEvento } from '../security/eventosSeguridad';
import { getConfig } from '../security/securityConfig';


const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no está configurado en las variables de entorno');
}

// Registrar nuevo usuario (solo superadmin puede crear usuarios)
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, email, password } = req.body; // "rol" ya no se acepta desde el registro público

    // Verificar si el usuario ya existe
    const existeUsuario = await User.findOne({ email });
    if (existeUsuario) {
      res.status(400).json({ message: 'El email ya está registrado' });
      return;
    }

    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Crear nuevo usuario
    const nuevoUsuario = new User({
      nombre,
      email,
      password: hashedPassword,
      rol: 'vendedor' // Registro público siempre crea el rol de menor privilegio
    });

    await nuevoUsuario.save();

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      usuario: {
        id: nuevoUsuario._id,
        nombre: nuevoUsuario.nombre,
        email: nuevoUsuario.email,
        rol: nuevoUsuario.rol
      }
    });
  } catch (error) {
    console.error('Error en register:', error);
    res.status(500).json({ message: 'Error al crear usuario' });
  }
};

// Login. Cada resultado (correcto o fallido) queda en el registro de eventos de seguridad.
// El mensaje al cliente es el mismo para "usuario inexistente" y "contraseña incorrecta":
// así un atacante no puede averiguar qué emails están registrados. El detalle real solo va al registro.
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Verificar si el usuario existe
    const usuario = await User.findOne({ email });
    if (!usuario) {
      registrarEvento('login_fallido', { ip: req.ip, detalle: `Usuario inexistente: ${email}` });
      res.status(400).json({ message: 'Credenciales inválidas' });
      return;
    }

    // Verificar si el usuario está activo
    if (!usuario.activo) {
      registrarEvento('login_fallido', { ip: req.ip, usuario: String(usuario._id), detalle: `Usuario inactivo: ${email}` });
      res.status(403).json({ message: 'Usuario inactivo' });
      return;
    }

    // Verificar contraseña
    const passwordValido = await bcrypt.compare(password, usuario.password);
    if (!passwordValido) {
      registrarEvento('login_fallido', { ip: req.ip, usuario: String(usuario._id), detalle: `Contraseña incorrecta: ${email}` });
      res.status(400).json({ message: 'Credenciales inválidas' });
      return;
    }

    // Generar token JWT. La duración (8 h por defecto) sale de la configuración de seguridad,
    // que el Laboratorio puede acortar para demostrar el vencimiento de la sesión.
    const token = jwt.sign(
      { id: usuario._id, rol: usuario.rol },
      JWT_SECRET,
      { expiresIn: getConfig().jwtDuracionSeg }
    );

    registrarEvento('login_ok', { ip: req.ip, usuario: String(usuario._id), detalle: `Inicio de sesión: ${email}` });

    res.json({
      message: 'Login exitoso',
      token,
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error al iniciar sesión' });
  }
};

// Obtener perfil del usuario autenticado
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    // El usuario viene del middleware de autenticación
    const usuario = await User.findById((req as any).usuario.id).select('-password');
    
    if (!usuario) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    res.json(usuario);
  } catch (error) {
    console.error('Error en getProfile:', error);
    res.status(500).json({ message: 'Error al obtener perfil' });
  }
};