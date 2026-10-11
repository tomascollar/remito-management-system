/**
 * Punto de entrada: conecta a la base de datos y abre el puerto.
 * La aplicación en sí (rutas, seguridad, frontend) está en app.ts.
 */
import { app } from './app';
import { entorno } from './config/entorno';
import { connectDB } from './config/database';

const startServer = async () => {
  await connectDB();
  app.listen(entorno.puerto, () => {
    console.log(`🚀 Servidor corriendo en puerto ${entorno.puerto} (${entorno.produccion ? 'producción' : 'desarrollo'})`);
  });
};

startServer();
