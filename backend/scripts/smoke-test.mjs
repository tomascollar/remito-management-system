// backend/scripts/smoke-test.mjs
//
// Pruebas de humo de la API: recorre los flujos críticos (productos, stock, ventas por
// unidad y por bulto, permisos por rol) y muestra ✔ / ✘ por cada verificación.
//
// Uso (PowerShell, desde la carpeta backend):
//   $env:ADMIN_EMAIL="tu@email.com"; $env:ADMIN_PASSWORD="tu-clave"; node scripts/smoke-test.mjs
//
// Variables opcionales:
//   VENDEDOR_EMAIL / VENDEDOR_PASSWORD  -> activan también las pruebas de permisos del vendedor
//   API_URL                             -> por defecto http://localhost:5000/api
//
// Requiere Node 18+ (trae fetch). Crea datos con el prefijo "TEST" y al final desactiva
// los productos creados. Idealmente correrlo contra una base de pruebas, porque los
// registros de stock y el remito de prueba no se pueden borrar desde la API.

const API = process.env.API_URL ?? 'http://localhost:5000/api';
const { ADMIN_EMAIL, ADMIN_PASSWORD, VENDEDOR_EMAIL, VENDEDOR_PASSWORD } = process.env;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Faltan las variables de entorno ADMIN_EMAIL y ADMIN_PASSWORD.');
  process.exit(1);
}

let ok = 0;
let fallos = 0;
let limitado = false; // se activa si el limitador de peticiones respondió 429
const creados = []; // ids de productos de prueba, para desactivarlos al final

/**
 * Hace una petición a la API y devuelve { status, data }.
 * No lanza excepción por códigos de error (4xx/5xx): las pruebas necesitan
 * inspeccionarlos, porque muchas esperan justamente un 400 o un 403.
 */
async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429) limitado = true;
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

/** Registra un resultado. El detalle solo se muestra cuando la verificación falla. */
function check(nombre, condicion, detalle = '') {
  if (condicion) {
    ok++;
    console.log(`  ✔ ${nombre}`);
  } else {
    fallos++;
    console.log(`  ✘ ${nombre}${detalle ? `\n      → ${detalle}` : ''}`);
  }
}

const seccion = (titulo) => console.log(`\n${titulo}`);
const msg = (r) => `estado ${r.status}: ${r.data?.message ?? JSON.stringify(r.data)}`;
const stamp = Date.now().toString().slice(-6); // evita choques con el nombre único de producto

async function main() {
  // ---------- Login ----------
  seccion('Acceso');
  const login = await api('POST', '/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  check('login del administrador', login.status === 200 && !!login.data?.token, msg(login));
  const token = login.data?.token;
  if (!token) return;

  const sinToken = await api('GET', '/products');
  check('sin token la API responde 401', sinToken.status === 401, msg(sinToken));

  // ---------- Productos ----------
  seccion('Productos');
  const crearProducto = (extra) =>
    api('POST', '/products', {
      token,
      body: { categoria: 'Verduras', unidad_stock: 'Cajón', ...extra },
    });

  // Se busca en el listado por nombre: no depende de la forma de la respuesta del alta.
  const buscar = async (nombre) =>
    (await api('GET', '/products', { token })).data?.find((p) => p.nombre === nombre);

  const nRepollo = `TEST Repollo ${stamp}`;
  const nPapa = `TEST Papa ${stamp}`;
  const nEspecial = `TEST Ají / morrón & 'Spunta' ${stamp}`;

  let r = await crearProducto({ nombre: nRepollo, permite_venta_fraccionada: true });
  check('crear fraccionable SIN cantidad_por_bulto (201)', r.status === 201, msg(r));

  r = await crearProducto({ nombre: nPapa, unidad_stock: 'Bolsa', permite_venta_fraccionada: false });
  check('crear no fraccionable (201)', r.status === 201, msg(r));

  await crearProducto({ nombre: nEspecial });
  const especial = await buscar(nEspecial);
  if (especial) creados.push(especial._id);
  check(
    "el nombre con / & ' se guarda tal cual (sin entidades HTML)",
    especial?.nombre === nEspecial,
    `se guardó: ${especial?.nombre}`,
  );

  const repollo = await buscar(nRepollo);
  const papa = await buscar(nPapa);
  if (repollo) creados.push(repollo._id);
  if (papa) creados.push(papa._id);
  if (!repollo || !papa) {
    console.log('  No se pudieron crear los productos base; se corta acá.');
    return;
  }

  r = await crearProducto({ nombre: `TEST Unidad ${stamp}`, unidad_stock: 'Bosla' });
  check('unidad de stock fuera del catálogo → 400', r.status === 400, msg(r));

  r = await crearProducto({ nombre: `TEST Categoria ${stamp}`, categoria: 'Inventada' });
  check('categoría fuera del catálogo → 400', r.status === 400, msg(r));

  r = await crearProducto({
    nombre: `TEST Negativo ${stamp}`,
    permite_venta_fraccionada: true,
    cantidad_por_bulto: -5,
  });
  check('cantidad_por_bulto negativa → 400', r.status === 400, msg(r));

  r = await api('PUT', `/products/${repollo._id}`, { token, body: { cantidad_por_bulto: 12 } });
  const conValor = await buscar(nRepollo);
  check('editar: guardar cantidad_por_bulto = 12', r.status === 200 && conValor?.cantidad_por_bulto === 12, msg(r));

  r = await api('PUT', `/products/${repollo._id}`, { token, body: { cantidad_por_bulto: null } });
  const sinValor = await buscar(nRepollo);
  check(
    'editar: cantidad_por_bulto = null la borra',
    r.status === 200 && sinValor?.cantidad_por_bulto == null,
    `${msg(r)} | valor actual: ${sinValor?.cantidad_por_bulto}`,
  );

  r = await api('PUT', `/products/${repollo._id}`, { token, body: { cantidad_por_bulto: 0 } });
  check('editar: cantidad_por_bulto = 0 → 400', r.status === 400, msg(r));

  // ---------- Stock y ventas ----------
  seccion('Stock y ventas (regla: solo los bultos descuentan stock)');

  r = await api('POST', '/stock-diario', {
    token,
    body: { producto: repollo._id, cantidad_bultos_inicial: 10, precio_bulto: 12000 },
  });
  check('stock de fraccionable sin precio_unidad → 400', r.status === 400, msg(r));

  r = await api('POST', '/stock-diario', {
    token,
    body: { producto: repollo._id, cantidad_bultos_inicial: 10, precio_bulto: 12000, precio_unidad: 700 },
  });
  check('registrar stock del repollo: 10 bultos (201)', r.status === 201, msg(r));

  r = await api('POST', '/stock-diario', {
    token,
    body: { producto: papa._id, cantidad_bultos_inicial: 20, precio_bulto: 8000 },
  });
  check('registrar stock de la papa: 20 bultos (201)', r.status === 201, msg(r));

  /** Stock vigente actual (en bultos) de un producto. */
  const stock = async (id) =>
    (await api('GET', `/stock-diario/${id}`, { token })).data?.cantidad_bultos_actual;

  r = await api('POST', '/remitos', { token, body: { nombre_cliente: `TEST Cliente ${stamp}` } });
  const remitoId = r.data?.remito?._id;
  check('crear remito (201)', r.status === 201 && !!remitoId, msg(r));
  if (!remitoId) return;

  const agregar = (producto, cantidad, unidad_venta) =>
    api('POST', `/remitos/${remitoId}/items`, { token, body: { producto, cantidad, unidad_venta } });
  const quitar = (itemId) => api('DELETE', `/remitos/${remitoId}/items/${itemId}`, { token });

  // Venta por unidad: NO debe tocar el stock
  r = await agregar(repollo._id, 25, 'unidad');
  const itemUnidad = r.data?.remito?.items?.find((i) => i.unidad_venta === 'unidad');
  check(
    'venta por unidad (201): subtotal 25 × 700 = 17500',
    r.status === 201 && itemUnidad?.subtotal === 17500,
    `${msg(r)} | subtotal: ${itemUnidad?.subtotal}`,
  );
  let s = await stock(repollo._id);
  check('venta por unidad NO descuenta stock (sigue en 10)', s === 10, `stock actual: ${s}`);

  // Venta por bulto: descuenta exactamente lo vendido
  r = await agregar(repollo._id, 2, 'bulto');
  const itemBulto = r.data?.remito?.items?.find((i) => i.unidad_venta === 'bulto');
  check(
    'venta por bulto (201): subtotal 2 × 12000 = 24000',
    r.status === 201 && itemBulto?.subtotal === 24000,
    `${msg(r)} | subtotal: ${itemBulto?.subtotal}`,
  );
  s = await stock(repollo._id);
  check('venta por bulto descuenta exactamente 2 (queda 8)', s === 8, `stock actual: ${s} (6 = se descontó dos veces)`);
  check('total del remito = 41500', r.data?.remito?.total === 41500, `total: ${r.data?.remito?.total}`);

  // Rechazos
  r = await agregar(repollo._id, 50, 'bulto');
  check('sobreventa por bulto → 400', r.status === 400, msg(r));
  s = await stock(repollo._id);
  check('el stock no cambia tras un rechazo (sigue en 8)', s === 8, `stock actual: ${s}`);

  r = await agregar(papa._id, 3, 'unidad');
  check('venta por unidad en producto NO fraccionable → 400', r.status === 400, msg(r));

  // Quitar ítems
  r = await quitar(itemUnidad?._id);
  s = await stock(repollo._id);
  check(
    'quitar el ítem por unidad: el stock sigue en 8 y el total baja a 24000',
    r.status === 200 && s === 8 && r.data?.remito?.total === 24000,
    `${msg(r)} | stock: ${s} | total: ${r.data?.remito?.total}`,
  );

  r = await quitar(itemBulto?._id);
  s = await stock(repollo._id);
  check(
    'quitar el ítem por bulto: el stock vuelve a 10 y el total a 0',
    r.status === 200 && s === 10 && r.data?.remito?.total === 0,
    `${msg(r)} | stock: ${s} | total: ${r.data?.remito?.total}`,
  );

  // Corrección manual del stock
  r = await api('PATCH', `/stock-diario/${repollo._id}/ajuste`, {
    token,
    body: { cantidad_bultos: -1, observaciones: 'TEST ajuste' },
  });
  s = await stock(repollo._id);
  check('ajuste manual de −1 (200): el stock queda en 9', r.status === 200 && s === 9, `${msg(r)} | stock: ${s}`);

  r = await api('PATCH', `/stock-diario/${repollo._id}/ajuste`, {
    token,
    body: { cantidad_bultos: -100 },
  });
  check('ajuste que dejaría el stock negativo → 400', r.status === 400, msg(r));

  // ---------- Permisos del vendedor ----------
  if (VENDEDOR_EMAIL && VENDEDOR_PASSWORD) {
    seccion('Permisos del vendedor');
    const lv = await api('POST', '/auth/login', {
      body: { email: VENDEDOR_EMAIL, password: VENDEDOR_PASSWORD },
    });
    const tv = lv.data?.token;
    check('login del vendedor', lv.status === 200 && !!tv, msg(lv));

    if (tv) {
      r = await api('GET', '/products', { token: tv });
      check('puede leer productos (200)', r.status === 200, msg(r));

      r = await api('POST', '/products', {
        token: tv,
        body: { nombre: `TEST Vendedor ${stamp}`, categoria: 'Verduras', unidad_stock: 'Cajón' },
      });
      check('NO puede crear productos (403)', r.status === 403, msg(r));

      r = await api('POST', '/stock-diario', {
        token: tv,
        body: { producto: papa._id, cantidad_bultos_inicial: 1, precio_bulto: 1 },
      });
      check('NO puede registrar stock (403)', r.status === 403, msg(r));

      r = await api('GET', '/users', { token: tv });
      check('NO puede listar usuarios (403)', r.status === 403, msg(r));

      r = await api('POST', '/remitos', { token: tv, body: { nombre_cliente: `TEST Vendedor ${stamp}` } });
      check('SÍ puede crear remitos (201)', r.status === 201, msg(r));
    }
  } else {
    console.log('\n(Permisos del vendedor omitidos: definí VENDEDOR_EMAIL y VENDEDOR_PASSWORD para incluirlos)');
  }

  // ---------- Limpieza ----------
  // Los productos de prueba se desactivan para que no aparezcan como activos.
  for (const id of creados) await api('PATCH', `/products/${id}/desactivar`, { token });
}

main()
  .catch((e) => {
    fallos++;
    const caido = e?.cause?.code === 'ECONNREFUSED';
    console.error(`\nNo se pudo completar: ${caido ? `el backend no responde en ${API}` : e.message}`);
  })
  .finally(() => {
    console.log(`\nResultado: ${ok} ✔  |  ${fallos} ✘`);
    if (limitado) console.log('Aviso: el limitador de peticiones respondió 429; esperá unos minutos y repetí.');
    process.exit(fallos ? 1 : 0);
  });
