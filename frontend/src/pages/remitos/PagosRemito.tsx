import { useState } from 'react';
import { Plus, Trash2, Wallet } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { FormAjuste } from './FormAjuste';
import { FormEntrega } from './FormEntrega';
import { formatFechaHora } from '../../lib/fechas';
import { formatMoneda } from '../../lib/format';
import type { Remito, RemitoAjuste, RemitoEntrega } from '../../types/remito';

interface Props {
  remito: Remito;
  onAgregarAjuste: (concepto: string, monto: number, resaltado: boolean) => Promise<void>;
  onQuitarAjuste: (ajuste: RemitoAjuste) => void;
  onRegistrarEntrega: (monto: number, nota?: string) => Promise<void>;
  onAnularEntrega: (entrega: RemitoEntrega) => void;
}

/**
 * Bloques de "Ajustes" (saldo anterior, descuentos) y "Entregas" (pagos a cuenta) de un remito.
 *
 * - Los ajustes se agregan y quitan solo con el remito abierto, igual que los productos.
 * - Las entregas se pueden registrar siempre (el cliente suele pagar después de retirar) mientras
 *   quede saldo. Una entrega cargada por error se ANULA (con confirmación): no se borra.
 */
export function PagosRemito({ remito, onAgregarAjuste, onQuitarAjuste, onRegistrarEntrega, onAnularEntrega }: Props) {
  const abierto = remito.estado === 'abierto';
  const [ajustando, setAjustando] = useState(false);
  const [entregando, setEntregando] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null); // id de la entrega por anular

  const hayEntregas = remito.entregas.length > 0;
  const aFavor = remito.saldo < 0;

  return (
    <div className="space-y-4">
      {(abierto || remito.ajustes.length > 0) && (
        <section className="card space-y-3 p-4" aria-label="Ajustes">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Ajustes</h2>
            {abierto && (
              <Button variant="soft" className="px-3 py-1.5 text-sm" onClick={() => setAjustando(true)}>
                <Plus size={16} /> Ajuste
              </Button>
            )}
          </div>

          {remito.ajustes.length === 0 ? (
            <p className="text-sm text-muted">
              Para sumar un saldo anterior o aplicar un descuento sin cargar un producto.
            </p>
          ) : (
            <ul className="divide-y divide-canvas">
              {remito.ajustes.map((a) => (
                <li
                  key={a._id}
                  className={`flex items-center gap-3 py-2 ${a.resaltado ? '-mx-2 rounded-xl bg-yellow-200/70 px-2' : ''}`}
                >
                  <span className="min-w-0 flex-1 truncate">{a.concepto}</span>
                  <span className={`shrink-0 font-semibold ${a.monto < 0 ? 'text-success-700' : ''}`}>
                    {formatMoneda(a.monto)}
                  </span>
                  {abierto && (
                    <button
                      className="btn btn-ghost -my-1.5 -mr-2 shrink-0 p-2.5"
                      aria-label={`Quitar ajuste ${a.concepto}`}
                      title="Quitar"
                      onClick={() => onQuitarAjuste(a)}
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="card space-y-3 p-4" aria-label="Entregas">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Entregas</h2>
          {remito.saldo > 0 && (
            <Button variant="soft" className="px-3 py-1.5 text-sm" onClick={() => setEntregando(true)}>
              <Wallet size={16} /> Registrar entrega
            </Button>
          )}
        </div>

        {hayEntregas && (
          <ul className="divide-y divide-canvas">
            {remito.entregas.map((e) => (
              <li key={e._id} className="py-2">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${e.anulada ? 'text-muted line-through' : ''}`}>
                      {formatFechaHora(e.fecha)}
                      {e.nota ? ` · ${e.nota}` : ''}
                    </p>
                    {e.anulada && <p className="text-xs text-danger-700">Anulada</p>}
                  </div>
                  <span className={`shrink-0 font-semibold ${e.anulada ? 'text-muted line-through' : ''}`}>
                    {formatMoneda(e.monto)}
                  </span>
                  {!e.anulada && confirmando !== e._id && (
                    <button
                      className="btn btn-ghost shrink-0 px-2.5 py-1 text-xs"
                      aria-label={`Anular entrega de ${formatMoneda(e.monto)}`}
                      onClick={() => setConfirmando(e._id)}
                    >
                      Anular
                    </button>
                  )}
                </div>
                {confirmando === e._id && (
                  <div className="mt-2 flex items-center justify-end gap-2 text-sm">
                    <span className="text-muted">¿Anular esta entrega?</span>
                    <Button variant="ghost" className="px-3 py-1" onClick={() => setConfirmando(null)}>
                      No
                    </Button>
                    <Button
                      className="px-3 py-1"
                      onClick={() => {
                        setConfirmando(null);
                        onAnularEntrega(e);
                      }}
                    >
                      Sí, anular
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <dl className="space-y-1 rounded-2xl bg-canvas p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Total</dt>
            <dd className="font-semibold">{formatMoneda(remito.total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Entregado</dt>
            <dd className="font-semibold">{formatMoneda(remito.entregado)}</dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="font-medium">{aFavor ? 'A favor del cliente' : 'A pagar'}</dt>
            <dd className={`text-xl font-bold ${remito.saldo === 0 && hayEntregas ? 'text-success-700' : ''}`}>
              {formatMoneda(Math.abs(remito.saldo))}
            </dd>
          </div>
        </dl>
      </section>

      <Modal open={ajustando} title="Agregar ajuste" onClose={() => setAjustando(false)}>
        <FormAjuste
          onGuardar={async (concepto, monto, resaltado) => {
            await onAgregarAjuste(concepto, monto, resaltado);
            setAjustando(false);
          }}
        />
      </Modal>

      <Modal open={entregando} title="Registrar entrega" onClose={() => setEntregando(false)}>
        <FormEntrega
          saldo={remito.saldo}
          onGuardar={async (monto, nota) => {
            await onRegistrarEntrega(monto, nota);
            setEntregando(false);
          }}
        />
      </Modal>
    </div>
  );
}
