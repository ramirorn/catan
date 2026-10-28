import { useState } from 'react';
import { adminPost, usePolling } from '../api';
import { ActionDialog, Badge, Btn, Card, ErrorNote, Field, Stat } from '../ui';
import { fmtAgo, fmtDate, fmtTime } from '../format';
import { useGame } from '../../context/GameContext';
import { Dropdown, SegmentedControl } from '../../components/Shared/Choice';

const SEVERITY_OPTIONS = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Atención' },
  { value: 'danger', label: 'Urgente' },
];
const TTL_OPTIONS = [
  { value: '0', label: 'Solo a los conectados ahora' },
  { value: '5', label: 'También a quien entre en 5 min' },
  { value: '15', label: 'También a quien entre en 15 min' },
  { value: '60', label: 'También a quien entre en 1 hora' },
];
const SEVERITY_LABEL = { info: 'Info', warning: 'Atención', danger: 'Urgente' };

export function NoticesTab() {
  const { data, error, reload } = usePolling('/live', 4000);
  const { addToast } = useGame();
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('info');
  const [minutes, setMinutes] = useState('15');
  const [maintMessage, setMaintMessage] = useState('');
  const [dialog, setDialog] = useState(null); // 'send' | 'clear' | 'maint-on' | 'maint-off'

  const maint = data ? data.maintenance : null;
  const counts = data ? data.counts : null;

  const confirm = async () => {
    let r;
    if (dialog === 'send') {
      r = await adminPost('/live/broadcast', { message, severity, minutes: Number(minutes) });
      if (r.ok) {
        addToast(`Aviso enviado a ${r.data.reached.players} ninja(s) conectados`, 'success');
        setMessage('');
      }
    } else if (dialog === 'clear') {
      r = await adminPost('/live/broadcast/clear');
      if (r.ok) addToast('Aviso retirado', 'success');
    } else {
      const on = dialog === 'maint-on';
      r = await adminPost('/live/maintenance', { on, message: maintMessage });
      if (r.ok) addToast(on ? 'Modo mantenimiento activado' : 'Modo mantenimiento desactivado', 'success');
    }
    reload();
    return r;
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <Card title="Aviso global">
        <p className="text-[13px] text-ink-soft mb-3">Aparece arriba de la pantalla a todos los conectados, en el menú y en partida.</p>
        <Field label="Mensaje" hint={`${message.trim().length}/300`}>
          <textarea className="field min-h-[80px] text-[14px]" maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ej.: En 10 minutos reiniciamos el servidor. Terminen sus partidas." />
        </Field>
        <Field label="Tono">
          <SegmentedControl options={SEVERITY_OPTIONS} value={severity} onChange={setSeverity} ariaLabel="Tono del aviso" />
        </Field>
        <Field label="Alcance">
          <Dropdown options={TTL_OPTIONS} value={minutes} onChange={setMinutes} ariaLabel="Alcance del aviso" />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Btn variant="primary" disabled={message.trim().length < 3} onClick={() => setDialog('send')}>Enviar aviso</Btn>
          {data && data.announcement && <Btn onClick={() => setDialog('clear')}>Retirar el aviso activo</Btn>}
        </div>
        {data && data.announcement && (
          <p className="mt-3 text-[13px] text-ink-soft">
            Activo ({SEVERITY_LABEL[data.announcement.severity]}, enviado {fmtAgo(data.announcement.at, data.now)}, visible para nuevos hasta {fmtTime(data.announcement.expiresAt)}): «{data.announcement.message}»
          </p>
        )}
      </Card>

      <Card
        title="Modo mantenimiento"
        actions={maint && <Badge tone={maint.on ? 'shu' : 'leaf'}>{maint.on ? 'Activo' : 'Desactivado'}</Badge>}
      >
        <p className="text-[13px] text-ink-soft mb-3">
          Con el modo activo nadie puede crear salas ni sentarse en una nueva (verán tu mensaje y un cartel en el menú), pero las partidas en curso siguen hasta terminar. Se guarda en la base de datos y sobrevive a reinicios.
        </p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Stat label="En juego" value={counts ? counts.running : '…'} tone={counts && counts.running > 0 ? 'chakra' : 'leaf'} />
          <Stat label="Esperando" value={counts ? counts.lobby : '…'} />
          <Stat label="Conectados" value={data ? data.connections.players : '…'} />
        </div>
        {counts && (
          <p className={`text-[13px] font-bold mb-3 ${counts.running === 0 ? 'text-leaf' : 'text-chakra-dark'}`}>
            {counts.running === 0
              ? 'No hay partidas en curso: es seguro desplegar.'
              : `Quedan ${counts.running} partida(s) en curso. Un despliegue ahora las cerraría.`}
          </p>
        )}
        {maint && maint.on && (
          <p className="text-[13px] text-ink-soft mb-3">Activo desde {fmtDate(maint.since)}. Mensaje actual: «{maint.message}»</p>
        )}
        <Field label="Mensaje para los jugadores (opcional)" hint="Si lo dejas vacío se usa un mensaje genérico.">
          <textarea className="field min-h-[70px] text-[14px]" maxLength={300} value={maintMessage} onChange={(e) => setMaintMessage(e.target.value)} placeholder="Ej.: Actualizamos la aldea. Volvemos en 15 minutos." />
        </Field>
        {maint && (maint.on ? (
          <div className="flex flex-wrap gap-2">
            <Btn variant="leaf" onClick={() => setDialog('maint-off')}>Desactivar mantenimiento</Btn>
            <Btn onClick={() => setDialog('maint-on')}>Cambiar mensaje</Btn>
          </div>
        ) : (
          <Btn variant="primary" onClick={() => setDialog('maint-on')}>Activar mantenimiento</Btn>
        ))}
        <div className="mt-2"><ErrorNote>{error}</ErrorNote></div>
      </Card>

      {dialog && (
        <ActionDialog
          key={dialog}
          title={{ send: 'Enviar aviso global', clear: 'Retirar el aviso', 'maint-on': 'Activar mantenimiento', 'maint-off': 'Desactivar mantenimiento' }[dialog]}
          confirmLabel={{ send: 'Enviar', clear: 'Retirar', 'maint-on': 'Activar', 'maint-off': 'Desactivar' }[dialog]}
          onConfirm={confirm}
          onClose={() => setDialog(null)}
        >
          {dialog === 'send' && <p className="text-[14px]">Lo verán ahora mismo los {data ? data.connections.players : ''} ninjas conectados: «{message.trim()}»</p>}
          {dialog === 'clear' && <p className="text-[14px]">Los que entren a partir de ahora ya no lo verán.</p>}
          {dialog === 'maint-on' && <p className="text-[14px]">No se podrán crear ni unirse a salas nuevas hasta que lo desactives. Las {counts ? counts.running : ''} partidas en curso siguen.</p>}
          {dialog === 'maint-off' && <p className="text-[14px]">Los jugadores podrán volver a crear y unirse a salas.</p>}
        </ActionDialog>
      )}
    </div>
  );
}
