/**
 * Pruebas UNITARIAS de la lógica de cobranzas (src/services/cobranzas.ts) y de los cálculos
 * derivados del modelo Remito (entregado y saldo).
 *
 * Son funciones puras: no hay base de datos, red ni mocks. Cubren los casos borde del dinero:
 * redondeo de centavos, entregas anuladas, ajustes negativos, pagos parciales, exactos y de más.
 */
import mongoose from 'mongoose';
import Remito from '../src/models/Remito';
import { calcularTotal, estadoPago, redondear, totalEntregado } from '../src/services/cobranzas';

const oid = () => new mongoose.Types.ObjectId();

describe('redondear', () => {
  it('evita los errores de coma flotante: 0.1 + 0.2 queda en 0.3', () => {
    expect(0.1 + 0.2).not.toBe(0.3); // el problema que se corrige
    expect(redondear(0.1 + 0.2)).toBe(0.3);
  });

  it('redondea a dos decimales (centavos)', () => {
    expect(redondear(1.234)).toBe(1.23);
    expect(redondear(1.236)).toBe(1.24);
    expect(redondear(12500)).toBe(12500);
  });

  it('también redondea los negativos (descuentos)', () => {
    expect(redondear(-1.236)).toBe(-1.24);
    expect(redondear(-15000)).toBe(-15000);
  });
});

describe('totalEntregado', () => {
  it('sin entregas (vacío, null o undefined) es 0', () => {
    expect(totalEntregado([])).toBe(0);
    expect(totalEntregado(null)).toBe(0);
    expect(totalEntregado(undefined)).toBe(0);
  });

  it('suma las entregas vigentes', () => {
    expect(totalEntregado([{ monto: 5000 }, { monto: 2500 }])).toBe(7500);
  });

  it('las entregas anuladas NO cuentan', () => {
    expect(totalEntregado([{ monto: 5000 }, { monto: 9999, anulada: true }])).toBe(5000);
    expect(totalEntregado([{ monto: 5000, anulada: true }])).toBe(0);
  });

  it('una entrega con anulada = false sí cuenta', () => {
    expect(totalEntregado([{ monto: 300, anulada: false }])).toBe(300);
  });

  it('la suma de centavos no arrastra error de coma flotante', () => {
    expect(totalEntregado([{ monto: 0.1 }, { monto: 0.2 }])).toBe(0.3);
  });
});

describe('calcularTotal', () => {
  it('suma los subtotales de los productos', () => {
    expect(calcularTotal([{ subtotal: 37500 }, { subtotal: 12500 }], [])).toBe(50000);
  });

  it('un ajuste positivo (saldo anterior) suma y uno negativo (vacíos, descuento) resta', () => {
    const items = [{ subtotal: 100000 }];
    expect(calcularTotal(items, [{ monto: 20000 }])).toBe(120000);
    expect(calcularTotal(items, [{ monto: -15000 }])).toBe(85000);
    expect(calcularTotal(items, [{ monto: 20000 }, { monto: -15000 }])).toBe(105000);
  });

  it('sin productos ni ajustes (vacío, null o undefined) es 0', () => {
    expect(calcularTotal([], [])).toBe(0);
    expect(calcularTotal(null, null)).toBe(0);
    expect(calcularTotal(undefined, undefined)).toBe(0);
  });

  it('solo ajustes, sin productos', () => {
    expect(calcularTotal([], [{ monto: 8000 }])).toBe(8000);
  });

  it('redondea a centavos', () => {
    expect(calcularTotal([{ subtotal: 0.1 }, { subtotal: 0.2 }], [])).toBe(0.3);
  });

  it('no limita por sí misma: puede dar negativo (el controlador es quien lo rechaza)', () => {
    expect(calcularTotal([{ subtotal: 1000 }], [{ monto: -1500 }])).toBe(-500);
  });
});

describe('estadoPago', () => {
  it('pendiente: no se entregó nada', () => {
    expect(estadoPago(10000, 0)).toBe('pendiente');
  });

  it('parcial: se entregó algo pero falta', () => {
    expect(estadoPago(10000, 4000)).toBe('parcial');
    expect(estadoPago(10000, 9999.99)).toBe('parcial');
  });

  it('pagado: lo entregado cubre exactamente el total', () => {
    expect(estadoPago(10000, 10000)).toBe('pagado');
  });

  it('pagado también si se entregó de más (el sistema no lo permite, pero el cálculo es seguro)', () => {
    expect(estadoPago(10000, 12000)).toBe('pagado');
  });

  it('un monto entregado negativo o cero cuenta como pendiente', () => {
    expect(estadoPago(10000, -50)).toBe('pendiente');
  });

  it('un remito de total 0 sin entregas figura como pendiente', () => {
    expect(estadoPago(0, 0)).toBe('pendiente');
  });
});

describe('Remito: entregado y saldo (campos calculados, no guardados)', () => {
  const remito = (total: number, entregas: object[] = []) =>
    new Remito({ nombre_cliente: 'Jose', vendedor: oid(), items: [], total, entregas }) as any;
  const pago = (monto: number, extra: object = {}) => ({ monto, usuario: oid(), ...extra });

  it('sin entregas: entregado 0 y saldo = total', () => {
    const r = remito(10000);
    expect(r.entregado).toBe(0);
    expect(r.saldo).toBe(10000);
  });

  it('con una entrega parcial el saldo baja', () => {
    const r = remito(10000, [pago(4000)]);
    expect(r.entregado).toBe(4000);
    expect(r.saldo).toBe(6000);
  });

  it('con varias entregas se acumulan', () => {
    const r = remito(10000, [pago(4000), pago(1500)]);
    expect(r.entregado).toBe(5500);
    expect(r.saldo).toBe(4500);
  });

  it('pagado por completo: saldo 0', () => {
    const r = remito(10000, [pago(6000), pago(4000)]);
    expect(r.saldo).toBe(0);
    expect(estadoPago(r.total, r.entregado)).toBe('pagado');
  });

  it('una entrega anulada vuelve a sumar su monto al saldo', () => {
    const r = remito(10000, [pago(4000), pago(6000)]);
    expect(r.saldo).toBe(0);
    r.entregas[1].anulada = true; // se anula la segunda
    expect(r.entregado).toBe(4000);
    expect(r.saldo).toBe(6000);
    expect(estadoPago(r.total, r.entregado)).toBe('parcial');
  });

  it('si cambia el total (se agrega un ajuste) el saldo se recalcula solo', () => {
    const r = remito(10000, [pago(10000)]);
    expect(r.saldo).toBe(0);
    r.total = 12000; // por ejemplo, se suma un "saldo anterior"
    expect(r.saldo).toBe(2000);
  });

  it('el saldo no arrastra error de coma flotante', () => {
    const r = remito(100.3, [pago(0.1), pago(0.2)]);
    expect(r.saldo).toBe(100);
  });

  it('viaja en el JSON de la respuesta de la API', () => {
    const json = remito(10000, [pago(2500)]).toJSON();
    expect(json.entregado).toBe(2500);
    expect(json.saldo).toBe(7500);
  });
});
