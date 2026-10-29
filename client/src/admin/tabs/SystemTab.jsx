import { useState } from 'react';
import { adminPost, usePolling } from '../api';
import { ActionDialog, Badge, Btn, Card, Empty, ErrorNote, Stat } from '../ui';
import { fmtBytes, fmtDate, fmtDuration } from '../format';
import { useGame } from '../../context/GameContext';

export function SystemTab() {
  const { data, error, reload } = usePolling('/system', 10_000);
  const { addToast } = useGame();
  const [dialog, setDialog] = useState(null); // 'cleanup' | 'clear-errors'

  const confirm = async () => {
    if (dialog === 'cleanup') {
      const r = await adminPost('/live/cleanup');
      if (r.ok) addToast(r.data.closed.length ? `Cerradas: ${r.data.closed.join(', ')}` : 'No había salas vacías', 'success');
      reload();
      return r;
    }
    const r = await adminPost('/system/errors/clear');
    reload();
    return r;
  };

  return (
    <div className="space-y-7">
      <ErrorNote>{error}</ErrorNote>
      <Card title="Servidor" actions={<Btn onClick={reload}>Actualizar</Btn>}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <Stat label="Encendido hace" value={data ? fmtDuration(data.uptimeS) : '…'} hint={data ? `desde ${fmtDate(data.startedAt)}` : null} />
          <Stat label="Node" value={data ? data.node : '…'} hint={data ? data.platform : null} />
          <Stat label="Memoria (RSS)" value={data ? fmtBytes(data.memory.rss) : '…'} hint={data ? `heap ${fmtBytes(data.memory.heapUsed)} / ${fmtBytes(data.memory.heapTotal)}` : null} />
          <Stat
            label="Base de datos"
            value={data ? (data.db.ok ? `${data.db.latencyMs} ms` : 'Sin conexión') : '…'}
            tone={data && !data.db.ok ? 'shu' : 'leaf'}
            hint={data && data.db.error ? data.db.error : 'latencia de SELECT 1'}
          />
          <Stat label="Salas" value={data ? data.rooms.total : '…'} hint={data ? `${data.rooms.running} en juego` : null} />
          <Stat label="Conexiones" value={data ? data.connections.sockets : '…'} hint={data ? `${data.connections.players} ninjas` : null} />
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Btn onClick={() => setDialog('cleanup')}>Limpiar salas vacías</Btn>
          {data && data.maintenance.on && <Badge tone="shu">Mantenimiento activo</Badge>}
        </div>
      </Card>

      <Card
        title="Últimos errores del servidor"
        actions={data && data.errors.length > 0 && <Btn onClick={() => setDialog('clear-errors')}>Vaciar lista</Btn>}
      >
        {data && data.errors.length === 0 ? (
          <Empty>Sin errores desde el último reinicio.</Empty>
        ) : (
          <ul className="space-y-2">
            {(data ? data.errors : []).map((e) => (
              <li key={e.id} className="border-t border-ink/10 pt-1.5">
                <p className="text-[12px] text-ink-faint">{fmtDate(e.at)} · {e.source}</p>
                <pre className="text-[12px] whitespace-pre-wrap break-words font-mono text-ink">{e.text}</pre>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[12px] text-ink-faint">Se guardan los últimos 50 en memoria (se pierden al reiniciar).</p>
      </Card>

      {dialog && (
        <ActionDialog
          key={dialog}
          title={dialog === 'cleanup' ? 'Limpiar salas vacías' : 'Vaciar la lista de errores'}
          confirmLabel={dialog === 'cleanup' ? 'Limpiar' : 'Vaciar'}
          onConfirm={confirm}
          onClose={() => setDialog(null)}
        >
          <p className="text-[14px]">
            {dialog === 'cleanup'
              ? 'Se cierran las salas sin ningún jugador conectado ni espectadores. Las demás no se tocan.'
              : 'Los errores se borran de la memoria del servidor.'}
          </p>
        </ActionDialog>
      )}
    </div>
  );
}
