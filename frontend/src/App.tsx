import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider } from './context/AuthProvider';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { rolesDe } from './config/navigation';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
//import Placeholder from './pages/Placeholder';
import Productos from './pages/productos/Productos';
import Stock from './pages/stock/Stock';
import NuevoRemito from './pages/remitos/NuevoRemito';
import Remitos from './pages/remitos/Remitos';
import RemitoDetalle from './pages/remitos/RemitoDetalle';
import Usuarios from './pages/usuarios/Usuarios';


export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* 1) Exige sesión  2) Envuelve todo en el layout con navegación */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/nuevo-remito" element={<NuevoRemito />} />
<Route path="/remitos" element={<Remitos />} />
<Route path="/remitos/:id" element={<RemitoDetalle />} />
              <Route path="/stock" element={<Stock />} />   {/* reemplaza el Placeholder de /stock */}

              {/* Rutas por rol: los roles salen de la misma config que arma el menú */}
              <Route element={<ProtectedRoute roles={rolesDe('/productos')} />}>
                <Route path="/productos" element={<Productos />} />
              </Route>
              <Route element={<ProtectedRoute roles={rolesDe('/usuarios')} />}>
                <Route path="/usuarios" element={<Usuarios />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}