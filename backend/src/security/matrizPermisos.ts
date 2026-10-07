import type { Router } from 'express';

/**
 * Matriz de permisos DERIVADA DEL CÓDIGO REAL: se recorren las rutas registradas en cada
 * router y se leen las marcas que dejan los middlewares `verificarToken` (requiereLogin) y
 * `verificarRol` (rolesPermitidos). Así la tabla del laboratorio no puede quedar
 * desactualizada respecto de lo que realmente protege cada ruta.
 */

export interface PermisoRuta {
  metodo: string; // GET, POST…
  ruta: string; // /api/products/:id
  requiereLogin: boolean;
  roles: string[] | null; // null = cualquier usuario autenticado
}

export interface Montaje {
  prefijo: string;
  router: Router;
}

// Forma mínima de lo que se lee de las capas internas de Express
interface Handler {
  requiereLogin?: boolean;
  rolesPermitidos?: string[];
}
interface Capa {
  handle: Handler;
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: Handler }[] };
}

/** Si ambas listas existen se exige estar en las dos (los middlewares se acumulan). */
const interseccion = (a: string[] | null, b: string[]): string[] => (a === null ? [...b] : a.filter((r) => b.includes(r)));

export const calcularMatriz = (montajes: Montaje[]): PermisoRuta[] => {
  const filas: PermisoRuta[] = [];

  for (const { prefijo, router } of montajes) {
    // Lo declarado con router.use(...) rige solo para las rutas que se registran DESPUÉS
    let loginRouter = false;
    let rolesRouter: string[] | null = null;

    for (const capa of (router as unknown as { stack: Capa[] }).stack) {
      if (!capa.route) {
        if (capa.handle.requiereLogin) loginRouter = true;
        if (capa.handle.rolesPermitidos) rolesRouter = interseccion(rolesRouter, capa.handle.rolesPermitidos);
        continue;
      }

      let login = loginRouter;
      let roles = rolesRouter;
      for (const { handle } of capa.route.stack) {
        if (handle.requiereLogin) login = true;
        if (handle.rolesPermitidos) roles = interseccion(roles, handle.rolesPermitidos);
      }
      if (roles !== null) login = true; // para evaluar un rol hay que estar autenticado

      const ruta = `${prefijo}${capa.route.path === '/' ? '' : capa.route.path}`;
      for (const metodo of Object.keys(capa.route.methods)) {
        filas.push({ metodo: metodo.toUpperCase(), ruta, requiereLogin: login, roles });
      }
    }
  }

  return filas;
};
