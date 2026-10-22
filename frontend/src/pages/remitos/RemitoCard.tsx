import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { EstadoCobro } from './EstadoCobro';
import { EstadoRemito } from './EstadoRemito';
import { formatFechaHora } from '../../lib/fechas';
import { formatMoneda } from '../../lib/format';
import { nombreVendedor } from '../../lib/remitos';
import type { RemitoResumen } from '../../types/remito';

/** Tarjeta de un remito en los listados. Todo el bloque es un enlace al detalle. */
export function RemitoCard({ remito }: { remito: RemitoResumen }) {
  const vendedor = nombreVendedor(remito);
  const cantidad = remito.cantidad_items;

  return (
    <li>
      <Link to={`/remitos/${remito._id}`} className="card flex items-center gap-4 p-4 transition hover:-translate-y-px">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted">#{remito.numero_remito}</span>
            <EstadoRemito estado={remito.estado} />
            <EstadoCobro estado={remito.estado_pago} />
          </div>
          <p className="truncate font-semibold">{remito.nombre_cliente}</p>
          <p className="truncate text-xs text-muted">
            {formatFechaHora(remito.fecha)} · {cantidad} {cantidad === 1 ? 'producto' : 'productos'}
            {vendedor ? ` · ${vendedor}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold">{formatMoneda(remito.total)}</p>
          {remito.estado_pago === 'parcial' && (
            <p className="text-xs font-medium text-warning-700">Debe {formatMoneda(remito.saldo)}</p>
          )}
          {remito.saldo < 0 && (
           <p className="text-xs font-medium text-success-700">A favor {formatMoneda(-remito.saldo)}</p>
          )}
        </div>
        <ChevronRight size={18} className="shrink-0 text-muted" />
      </Link>
    </li>
  );
}
