// Tipos del Laboratorio de seguridad (demostración de las medidas de seguridad en vivo)

export interface ConfigSeguridad {
  loginMax: number; // intentos de login fallidos permitidos por IP en la ventana
  loginVentanaSeg: number;
  generalMax: number; // peticiones totales permitidas por IP en la ventana
  generalVentanaSeg: number;
  jwtDuracionSeg: number; // validez de los tokens al iniciar sesión
}

export interface EstadoLaboratorio {
  config: ConfigSeguridad;
  porDefecto: ConfigSeguridad;
  limites: Record<keyof ConfigSeguridad, [number, number]>; // [mínimo, máximo] de cada parámetro
  costoBcrypt: [number, number];
  ahora: number; // hora del servidor (ms)
}

export interface TokenDemo {
  token: string;
  emitidoEn: number; // ms
  venceEn: number; // ms
  duracionSeg: number;
  ahora: number; // hora del servidor al emitirlo (ms)
}

export interface MedicionBcrypt {
  costo: number;
  ms: number;
  hash: string;
}

export type TipoEvento =
  | 'login_ok'
  | 'login_fallido'
  | 'login_bloqueado'
  | 'peticiones_bloqueadas'
  | 'token_expirado'
  | 'token_invalido'
  | 'acceso_denegado'
  | 'config_cambiada'
  | 'contadores_reiniciados';

export interface EventoSeguridad {
  id: number;
  fecha: string;
  tipo: TipoEvento;
  detalle: string;
  ip?: string;
  usuario?: string;
}

export interface PermisoRuta {
  metodo: string;
  ruta: string;
  requiereLogin: boolean;
  roles: string[] | null; // null = cualquier usuario con sesión
}

export interface MatrizPermisos {
  roles: string[];
  rutas: PermisoRuta[];
}

/** Resultado de un intento de login de la simulación de fuerza bruta. */
export interface ResultadoIntento {
  estado: number; // 400 = el limitador lo dejó pasar y las credenciales fallaron; 429 = bloqueado
  restantes: number | null; // intentos que quedan antes del bloqueo (header RateLimit-Remaining)
  limite: number | null;
  mensaje: string;
}

/** Resultado de consultar la API con un token de demostración. */
export interface ResultadoConsulta {
  estado: number; // 200 aceptado, 401 rechazado
  mensaje: string;
}
