// Variables de entorno de PRUEBA. Se cargan antes que cualquier otro módulo (setupFiles de Jest).
// La base de datos no se usa: los modelos se simulan en cada test, así que esta URI nunca se conecta.
//
// IMPORTANTE: todas las variables que la app lee se definen acá de forma explícita. La app carga
// además el archivo .env (dotenv) pero dotenv NO pisa las variables ya definidas; así los tests
// dan el mismo resultado en mi PC (con mi .env de desarrollo) que en GitHub (sin .env).
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/no-se-usa';
process.env.JWT_SECRET = 'secreto-solo-para-pruebas-automaticas-0123456789';
process.env.SECURITY_LAB = 'false'; // el laboratorio debe estar APAGADO (como en producción)
process.env.TRUST_PROXY = '0';
process.env.CORS_ORIGIN = '';
process.env.PORT = '5000';
process.env.FRONTEND_DIST = '/ruta/que/no/existe'; // no se sirve ningún frontend compilado