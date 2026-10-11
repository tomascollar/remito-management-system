/**
 * Crea el PRIMER usuario superadmin (o resetea su contraseña si el email ya existe).
 *
 * Se usa una sola vez después de desplegar, porque en una base nueva no hay ningún usuario
 * con el que iniciar sesión (no existe registro público a propósito: es una decisión de seguridad).
 *
 * Uso (desde backend/, con MONGODB_URI en el entorno o en .env):
 *   SUPERADMIN_EMAIL=tu@correo.com SUPERADMIN_PASSWORD='una-clave-larga' SUPERADMIN_NOMBRE='Tomás' \
 *     npx tsx scripts/crear-superadmin.ts
 *
 * La contraseña se pasa por variable de entorno (no por argumento) para que no quede en el
 * historial de comandos de la terminal con los argumentos visibles en `ps`.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../src/models/User';

const main = async (): Promise<void> => {
  const { MONGODB_URI, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD } = process.env;
  const nombre = process.env.SUPERADMIN_NOMBRE || 'Superadmin';

  if (!MONGODB_URI) throw new Error('Falta MONGODB_URI.');
  if (!SUPERADMIN_EMAIL || !SUPERADMIN_PASSWORD) throw new Error('Faltan SUPERADMIN_EMAIL y/o SUPERADMIN_PASSWORD.');
  if (SUPERADMIN_PASSWORD.length < 12) throw new Error('La contraseña del superadmin debe tener al menos 12 caracteres.');

  await mongoose.connect(MONGODB_URI);
  const hash = await bcrypt.hash(SUPERADMIN_PASSWORD, await bcrypt.genSalt(10));
  const email = SUPERADMIN_EMAIL.toLowerCase().trim();

  const existente = await User.findOne({ email });
  if (existente) {
    existente.password = hash;
    existente.rol = 'superadmin';
    existente.activo = true;
    await existente.save();
    console.log(`✅ Usuario existente ${email} actualizado: rol superadmin, contraseña nueva.`);
  } else {
    await User.create({ nombre, email, password: hash, rol: 'superadmin' });
    console.log(`✅ Superadmin ${email} creado.`);
  }
  await mongoose.disconnect();
};

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
