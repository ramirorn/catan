import { useState } from 'react';
import { usePolling } from '../api';
import { Bars, Btn, Card, DayColumns, ErrorNote, Stat } from '../ui';
import { BOARD_LABELS, fmtDate, fmtDuration, fmtNum, fmtTime, pct } from '../format';

export function StatsTab() {
  const [fresh, setFresh] = useState(0);
  const { data, error, reload } = usePolling(fresh ? `/stats?fresh=1&n=${fresh}` : '/stats', 30_000);
  const db = data && data.db;
  const live = data && data.live;
  const t = db && db.totals;
  const c = live && live.counters;
  const finishedLive = c ? c.victory + c.vote + c.abandoned + c.closedByAdmin : 0;

  return (
    <div className="space-y-7">
      <ErrorNote>{error}</ErrorNote>
      <Card title="Ahora mismo" actions={<Btn onClick={reload}>Actualizar</Btn>}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Ninjas conectados" value={live ? live.connections.players : '…'} hint={live ? `${live.connections.accounts} con cuenta` : null} />
          <Stat label="Partidas en curso" value={live ? live.rooms.running : '…'} tone="leaf" />
          <Stat label="Salas esperando" value={live ? live.rooms.lobby : '…'} />
          <Stat label="Tableros en uso" value={live ? `${live.boards.standard} / ${live.boards.extended}` : '…'} hint="estándar / ampliado" />
        </div>
      </Card>

      <Card
        title="Desde el último reinicio del servidor"
        actions={c && <span className="text-[12px] text-ink-faint">desde {fmtDate(c.since)}</span>}
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Stat label="Empezadas" value={c ? c.started : '…'} />
          <Stat label="Con ganador" value={c ? c.victory : '…'} hint={c ? pct(c.victory, finishedLive) : null} />
          <Stat label="Por votación" value={c ? c.vote : '…'} hint={c ? pct(c.vote, finishedLive) : null} />
          <Stat label="Abandonadas" value={c ? c.abandoned : '…'} hint={c ? pct(c.abandoned, finishedLive) : null} tone="chakra" />
          <Stat label="Cerradas por admin" value={c ? c.closedByAdmin : '…'} />
        </div>
        <p className="mt-2 text-[12px] text-ink-faint">Incluye partidas de invitados. Se reinicia con cada despliegue.</p>
      </Card>

      <Card
        title="Historial (base de datos)"
        actions={
          <>
            {data && <span className="text-[12px] text-ink-faint">calculado a las {fmtTime(data.cachedAt)}</span>}
            <Btn onClick={() => setFresh((n) => n + 1)}>Recalcular</Btn>
          </>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          <Stat label="Cuentas" value={t ? fmtNum(t.accounts) : '…'} />
          <Stat label="Partidas" value={t ? fmtNum(t.games) : '…'} />
          <Stat label="Duración media" value={t ? fmtDuration(t.avgDurationS) : '…'} />
          <Stat label="Con ganador" value={t ? pct(t.byVictory, t.games) : '…'} />
          <Stat label="Por votación" value={t ? pct(t.byVote, t.games) : '…'} />
          <Stat label="Ryō en circulación" value={t ? fmtNum(t.coins) : '…'} />
          <Stat label="Sancionadas" value={t ? t.restricted : '…'} hint={t ? `${t.admins} admin(s)` : null} />
        </div>
        <p className="mt-2 text-[12px] text-ink-faint">
          La base de datos solo guarda partidas terminadas con al menos una cuenta que cobró Ryō (2+ ninjas hasta el final). Las abandonadas no se guardan.
        </p>

        <div className="grid gap-6 md:grid-cols-2 mt-4">
          <div>
            <h3 className="font-display text-[16px] mb-1">Partidas por día (14 días)</h3>
            {db ? <DayColumns rows={db.gamesPerDay.map((r) => ({ day: r.day, value: r.games }))} label="Partidas por día" /> : null}
          </div>
          <div>
            <h3 className="font-display text-[16px] mb-1">Cuentas nuevas por día (14 días)</h3>
            {db ? <DayColumns rows={db.accountsPerDay.map((r) => ({ day: r.day, value: r.accounts }))} label="Cuentas nuevas por día" /> : null}
          </div>
          <div>
            <h3 className="font-display text-[16px] mb-1">Tablero</h3>
            {db ? <Bars rows={db.boards.map((r) => ({ label: BOARD_LABELS[r.board] || r.board, value: r.games }))} /> : null}
          </div>
          <div>
            <h3 className="font-display text-[16px] mb-1">Cantidad de jugadores</h3>
            {db ? <Bars rows={db.playerCounts.map((r) => ({ label: `${r.players} ninjas`, value: r.games }))} /> : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
