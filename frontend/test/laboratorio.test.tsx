/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import * as lab from '../src/api/laboratorio';
import Laboratorio from '../src/pages/laboratorio/Laboratorio';
import { FuerzaBruta } from '../src/pages/laboratorio/FuerzaBruta';
import { SesionJwt } from '../src/pages/laboratorio/SesionJwt';
import { MatrizPermisos } from '../src/pages/laboratorio/MatrizPermisos';
import { RegistroEventos } from '../src/pages/laboratorio/RegistroEventos';
import { CostoBcrypt } from '../src/pages/laboratorio/CostoBcrypt';

vi.mock('../src/api/laboratorio');

const config = { loginMax: 5, loginVentanaSeg: 900, generalMax: 10000, generalVentanaSeg: 900, jwtDuracionSeg: 28800 };
const estado: any = {
  config,
  porDefecto: config,
  limites: { loginMax: [1, 1000], loginVentanaSeg: [10, 3600], generalMax: [1, 100000], generalVentanaSeg: [10, 3600], jwtDuracionSeg: [30, 86400] },
  costoBcrypt: [4, 14],
  ahora: Date.now(),
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Laboratorio (página)', () => {
  it('si el servidor no tiene el laboratorio activado (404) lo explica', async () => {
    vi.mocked(lab.getEstado).mockRejectedValue(new AxiosError('x', '404', undefined, undefined, { status: 404 } as any));
    render(<Laboratorio />);
    expect(await screen.findByText('El laboratorio está desactivado')).toBeInTheDocument();
    expect(screen.getByText('SECURITY_LAB=true')).toBeInTheDocument();
  });

  it('muestra las secciones y permite restaurar los valores por defecto', async () => {
    vi.mocked(lab.getEstado).mockResolvedValue(estado);
    vi.mocked(lab.restaurarConfig).mockResolvedValue(config);
    vi.mocked(lab.listEventos).mockResolvedValue([]);
    vi.mocked(lab.getPermisos).mockResolvedValue({ roles: [], rutas: [] });
    render(<Laboratorio />);
    expect(await screen.findByText('Fuerza bruta: límite de intentos de login')).toBeInTheDocument();
    expect(screen.getByText('Sesión: expiración del token (JWT)')).toBeInTheDocument();
    expect(screen.getByText('Registro de eventos de seguridad')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Restaurar valores por defecto/ }));
    await waitFor(() => expect(lab.restaurarConfig).toHaveBeenCalled());
  });
});

describe('FuerzaBruta', () => {
  const ui = (aplicar = vi.fn().mockResolvedValue(undefined)) => {
    render(<FuerzaBruta estado={estado} aplicar={aplicar} />);
    return aplicar;
  };

  it('aplica el nuevo límite de intentos y la ventana', async () => {
    const aplicar = ui();
    const campo = screen.getByLabelText(/Intentos fallidos permitidos/);
    await userEvent.clear(campo);
    await userEvent.type(campo, '100');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    await waitFor(() => expect(aplicar).toHaveBeenCalledWith({ loginMax: 100, loginVentanaSeg: 900 }));
  });

  it('con un límite bajo el ataque se corta y se indica en qué intento', async () => {
    vi.mocked(lab.intentoLoginFalso).mockImplementation(async (n) =>
      n <= 5
        ? { estado: 400, restantes: 5 - n, limite: 5, mensaje: 'Credenciales inválidas' }
        : { estado: 429, restantes: 0, limite: 5, mensaje: 'Demasiados intentos de inicio de sesión. Intentá de nuevo en 15 minutos.' },
    );
    ui();
    const cantidad = screen.getByLabelText(/Intentos a enviar/);
    await userEvent.clear(cantidad);
    await userEvent.type(cantidad, '8');
    await userEvent.click(screen.getByRole('button', { name: /Lanzar ataque/ }));
    expect(await screen.findByText(/El servidor cortó el ataque en el intento 6/, undefined, { timeout: 3000 })).toBeInTheDocument();
    // El mensaje aparece apenas se bloquea el primero; el resumen final llega cuando termina la tanda
    expect(await screen.findByText('3 bloqueados', undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('5 procesados por el servidor')).toBeInTheDocument();
    expect(lab.intentoLoginFalso).toHaveBeenCalledTimes(8);
  });

  it('con un límite alto no se bloquea nada y lo avisa', async () => {
    vi.mocked(lab.intentoLoginFalso).mockResolvedValue({ estado: 400, restantes: 90, limite: 100, mensaje: 'Credenciales inválidas' });
    ui();
    await userEvent.click(screen.getByRole('button', { name: /Lanzar ataque/ }));
    expect(await screen.findByText(/Ningún intento fue bloqueado/, undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('10 procesados por el servidor')).toBeInTheDocument();
  });

  it('reiniciar contadores llama al servidor y limpia el resultado', async () => {
    vi.mocked(lab.intentoLoginFalso).mockResolvedValue({ estado: 400, restantes: 1, limite: 5, mensaje: '' });
    vi.mocked(lab.reiniciarContadores).mockResolvedValue();
    ui();
    await userEvent.click(screen.getByRole('button', { name: /Lanzar ataque/ }));
    await screen.findByText('10 procesados por el servidor', undefined, { timeout: 3000 });
    await userEvent.click(screen.getByRole('button', { name: /Reiniciar contadores/ }));
    await waitFor(() => expect(lab.reiniciarContadores).toHaveBeenCalled());
    expect(screen.queryByText('10 procesados por el servidor')).toBeNull();
  });
});

describe('SesionJwt', () => {
  const tokenFalso = (exp: number) => `x.${btoa(JSON.stringify({ rol: 'superadmin', iat: 1, exp }))}.y`;

  it('aplica la duración de la sesión', async () => {
    const aplicar = vi.fn().mockResolvedValue(undefined);
    render(<SesionJwt estado={estado} aplicar={aplicar} />);
    await userEvent.click(screen.getByRole('button', { name: '2 minutos' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Aplicar' })[0]);
    await waitFor(() => expect(aplicar).toHaveBeenCalledWith({ jwtDuracionSeg: 120 }));
  });

  it('el token de prueba es aceptado al principio y rechazado cuando vence', async () => {
    let vence = 0;
    vi.mocked(lab.emitirTokenDemo).mockImplementation(async () => {
      const ahora = Date.now();
      vence = ahora + 1000;
      return { token: tokenFalso(Math.floor(vence / 1000)), emitidoEn: ahora, venceEn: vence, duracionSeg: 1, ahora };
    });
    vi.mocked(lab.consultarConToken).mockImplementation(async () =>
      Date.now() < vence
        ? { estado: 200, mensaje: 'Token aceptado' }
        : { estado: 401, mensaje: 'Token expirado. Iniciá sesión de nuevo.' },
    );
    render(<SesionJwt estado={estado} aplicar={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Emitir token/ }));

    const respuestas = await screen.findByLabelText('Respuestas del servidor');
    expect(await within(respuestas).findByText(/200 · Token aceptado/)).toBeInTheDocument();
    expect(await screen.findByText(/El servidor rechazó el token porque venció/, undefined, { timeout: 4500 })).toBeInTheDocument();
    expect(within(respuestas).getByText(/401 · Token expirado/)).toBeInTheDocument();
  }, 8000);
});

describe('MatrizPermisos', () => {
  it('muestra qué puede hacer cada rol, incluyendo rutas públicas', async () => {
    vi.mocked(lab.getPermisos).mockResolvedValue({
      roles: ['superadmin', 'administrador', 'vendedor'],
      rutas: [
        { metodo: 'GET', ruta: '/api/users', requiereLogin: true, roles: ['superadmin'] },
        { metodo: 'POST', ruta: '/api/auth/login', requiereLogin: false, roles: null },
      ],
    });
    render(<MatrizPermisos />);
    const fila = (await screen.findByText('/api/users')).closest('tr')!;
    expect(within(fila).getAllByLabelText('Permitido')).toHaveLength(1); // solo superadmin
    expect(within(fila).getAllByLabelText('Denegado')).toHaveLength(2); // administrador y vendedor
    const login = screen.getByText('/api/auth/login').closest('tr')!;
    expect(within(login).getAllByLabelText('Público')).toHaveLength(3);
  });
});

describe('RegistroEventos', () => {
  const eventos = [
    { id: 3, fecha: '2026-10-04T12:00:03.000Z', tipo: 'login_bloqueado', detalle: 'Más de 5 intentos fallidos en 15 minutos', ip: '::1' },
    { id: 2, fecha: '2026-10-04T12:00:02.000Z', tipo: 'login_fallido', detalle: 'Contraseña incorrecta: a@a.com' },
    { id: 1, fecha: '2026-10-04T12:00:01.000Z', tipo: 'login_ok', detalle: 'Inicio de sesión: b@b.com' },
  ];

  it('lista los eventos, filtra por grupo y vacía el registro', async () => {
    vi.mocked(lab.listEventos).mockResolvedValueOnce(eventos as any).mockResolvedValue([]);
    vi.mocked(lab.borrarEventos).mockResolvedValue();
    render(<RegistroEventos />);
    expect(await screen.findByText('Inicio de sesión: b@b.com')).toBeInTheDocument();
    expect(screen.getByText('Más de 5 intentos fallidos en 15 minutos')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Bloqueos' }));
    expect(screen.queryByText('Inicio de sesión: b@b.com')).toBeNull();
    expect(screen.getByText('Más de 5 intentos fallidos en 15 minutos')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Vaciar/ }));
    await waitFor(() => expect(lab.borrarEventos).toHaveBeenCalled());
    expect(await screen.findByText('Todavía no hay eventos para mostrar.')).toBeInTheDocument();
  });

  it('pedir solo los eventos nuevos: a la segunda consulta manda el último id recibido', async () => {
    vi.mocked(lab.listEventos).mockResolvedValueOnce(eventos as any).mockResolvedValue([]);
    render(<RegistroEventos />);
    await screen.findByText('Inicio de sesión: b@b.com');
    await waitFor(() => expect(lab.listEventos).toHaveBeenLastCalledWith(3), { timeout: 3500 });
  }, 6000);
});

describe('CostoBcrypt', () => {
  it('mide los costos en orden y muestra el tiempo de cada uno', async () => {
    vi.mocked(lab.medirBcrypt).mockImplementation(async (costo) => ({ costo, ms: 2 ** costo / 4, hash: `$2b$${costo}$abc` }));
    render(<CostoBcrypt />);
    await userEvent.click(screen.getByRole('button', { name: /Medir costos/ }));
    expect(await screen.findByText(/Costo 13/)).toBeInTheDocument();
    expect(lab.medirBcrypt).toHaveBeenCalledTimes(4);
    expect(vi.mocked(lab.medirBcrypt).mock.calls.map((c) => c[0])).toEqual([8, 10, 12, 13]);
  });
});
