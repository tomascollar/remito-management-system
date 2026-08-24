import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/database';

// Importar rutas
import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import stockDiarioRoutes from './routes/stockDiarioRoutes';
import remitoRoutes from './routes/remitoRoutes';
import userRoutes from './routes/userRoutes';
import { limiteGeneral } from './middleware/rateLimiter';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(limiteGeneral); // Protección general para toda la API

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stock-diario', stockDiarioRoutes);
app.use('/api/remitos', remitoRoutes);
app.use('/api/users', userRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ message: 'API de Remitos funcionando!' });
});

// Conectar a la base de datos y arrancar servidor
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  });
};

startServer();