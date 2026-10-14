import { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { useSocket } from '../../context/SocketContext';
import { IslandChart } from './IslandChart';
import { ScrollPanel } from '../Shared/ScrollPanel';
import { BrandPlate } from '../Shared/Brand';
import { RoomRules } from './RoomRules';
import { DEFAULT_VP_TO_WIN } from '../../utils/constants';

export function LobbyScreen() {
  const { createRoom, joinRoom, playerName, setPlayerName } = useGame();
  const { socket, connected } = useSocket();
  const [tab, setTab] = useState('create');
  const [name, setName] = useState(playerName);
  const [roomCode, setRoomCode] = useState('');
  const [boardType, setBoardType] = useState('standard');
  const [rules, setRules] = useState({ vpToWin: DEFAULT_VP_TO_WIN, turnTimeLimit: 0 });
  const [publicRooms, setPublicRooms] = useState([]);
  // Only rooms still waiting for players and with a free seat
  const openRooms = publicRooms.filter((r) => r.phase === 'lobby' && r.playerCount < r.maxPlayers);

  useEffect(() => {
    if (!socket) return;
    socket.emit('listRooms', {}, (res) => {
      if (res && res.rooms) setPublicRooms(res.rooms);
    });

    const interval = setInterval(() => {
      socket.emit('listRooms', {}, (res) => {
        if (res && res.rooms) setPublicRooms(res.rooms);
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [socket]);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    createRoom(name.trim(), boardType, rules);
  };

  const handleJoin = (e, codeToJoin = null) => {
    if (e) e.preventDefault();
    const code = codeToJoin || roomCode;
    if (!name.trim() || !code.trim()) return;
    joinRoom(code.trim(), name.trim());
  };

  const tabClass = (isActive) =>
    `flex-1 pb-2.5 text-[15px] font-bold border-b-2 transition-colors cursor-pointer ${
      isActive ? 'border-chakra text-ink' : 'border-transparent text-ink-faint hover:text-ink-soft'
    }`;

  const boardOptions = [
    { value: 'standard', title: 'Aldea estándar', detail: '2 – 4 ninjas · 19 hexágonos' },
    { value: 'extended', title: 'Gran país', detail: '2 – 6 ninjas · 30 hexágonos' },
  ];

  return (
    <div className="night-surface relative h-dvh w-full overflow-y-auto lg:overflow-hidden">
      <div className="min-h-full lg:h-full w-full max-w-6xl mx-auto px-5 sm:px-8 py-4 sm:py-10 lg:py-6 grid lg:grid-cols-[1.15fr_1fr] lg:grid-rows-[minmax(0,1fr)] gap-4 sm:gap-7 lg:gap-12 items-center">
        {/* Title & chart */}
        <section className="flex flex-col items-center lg:items-start text-center lg:text-left lg:h-full lg:min-h-0 lg:justify-center">
          <p className="flex items-center gap-2 text-[11px] sm:text-xs font-bold uppercase tracking-[0.24em] text-chakra-light/85">
            <BrandPlate className="w-8 h-5" />
            Partida multijugador en tiempo real
          </p>
          <div className="flex items-start gap-3 sm:gap-4 mt-3">
            <h1 className="font-display leading-[0.85] text-paper-light drop-shadow-[0_3px_0_rgba(0,0,0,0.5)]">
              <span className="block text-[68px] sm:text-[96px]">Catán</span>
              <span className="block text-[38px] sm:text-[52px] text-chakra mt-1 sm:mt-0 lg:pl-1">Shinobi</span>
            </h1>
            <span
              className="hanko !rounded-[6px] mt-2 w-11 h-11 sm:w-14 sm:h-14 font-display text-[28px] sm:text-[36px] leading-none -rotate-6 shrink-0"
              aria-hidden="true"
            >
              忍
            </span>
          </div>
          <p className="text-paper/75 text-[15px] sm:text-lg mt-3 max-w-md">
            Comercia, construye y expande tu aldea oculta en el país de las hojas.
          </p>
          <IslandChart className="hidden lg:block w-full lg:max-w-[520px] lg:flex-1 lg:min-h-0 lg:h-auto lg:max-h-[520px] mt-6" />
        </section>

        {/* Registration scroll */}
        <ScrollPanel className="w-full max-w-md mx-auto lg:mx-0 animate-modal-pop lg:max-h-full lg:min-h-0 lg:flex lg:flex-col" bodyClassName="px-5 sm:px-8 pt-6 pb-7 lg:min-h-0 lg:overflow-y-auto">
          <h2 className="font-display text-[28px] leading-tight text-ink">Registro de ninjas</h2>
          <p className="text-[14px] text-ink-soft mt-0.5 mb-5">Funda una nueva partida o únete a una existente.</p>

          {/* Tab switch */}
          <div className="flex gap-4 mb-6 border-b border-ink/15" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'create'}
              onClick={() => setTab('create')}
              className={tabClass(tab === 'create')}
            >
              Crear partida
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'join'}
              onClick={() => setTab('join')}
              className={tabClass(tab === 'join')}
            >
              Unirse a partida
            </button>
          </div>

          <form onSubmit={tab === 'create' ? handleCreate : (e) => handleJoin(e)} className="space-y-5">
            <div>
              <label htmlFor="lobby-name" className="label-caps block mb-1.5">
                Nombre del ninja
              </label>
              <input
                id="lobby-name"
                type="text"
                className="field"
                placeholder="ej. Kaito, Sombra del Este…"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setPlayerName(e.target.value);
                }}
                maxLength={20}
                required
              />
            </div>

            {tab === 'create' ? (
              <>
                <div>
                  <span className="label-caps block mb-1.5">Mapa de la misión</span>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Mapa de la misión">
                    {boardOptions.map((opt) => {
                      const isSelected = boardType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => setBoardType(opt.value)}
                          className={`text-left px-3 py-2.5 rounded-[3px] border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-paper-light border-shu shadow-[0_0_0_1px_var(--color-shu)]'
                              : 'border-ink/25 hover:border-ink/45 hover:bg-paper-light/50'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 font-bold text-[14px] text-ink">
                            <span
                              className={`w-3 h-3 rounded-full border shrink-0 ${
                                isSelected ? 'border-shu bg-shu shadow-[inset_0_0_0_2px_var(--color-paper-light)]' : 'border-ink/40'
                              }`}
                            />
                            {opt.title}
                          </span>
                          <span className="block text-[12px] text-ink-faint mt-0.5 pl-[18px]">{opt.detail}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Room rules (on small phones the host sets them in the waiting room) */}
                <div className="hidden sm:block">
                  <RoomRules
                    idPrefix="create"
                    vpToWin={rules.vpToWin}
                    turnTimeLimit={rules.turnTimeLimit}
                    onChange={(change) => setRules((prev) => ({ ...prev, ...change }))}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!connected || !name.trim()}
                  className="btn btn-primary w-full py-3 text-[15px]"
                >
                  {connected ? 'Crear sala de juego' : 'Conectando al servidor…'}
                </button>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="lobby-code" className="label-caps block mb-1.5">
                    Código de la sala
                  </label>
                  <input
                    id="lobby-code"
                    type="text"
                    className="field font-serif font-bold tracking-[0.3em] uppercase text-lg"
                    placeholder="ej. X9K2W"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    maxLength={10}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={!connected || !name.trim() || !roomCode.trim()}
                  className="btn btn-primary w-full py-3 text-[15px]"
                >
                  {connected ? 'Entrar a la sala' : 'Conectando al servidor…'}
                </button>

                {openRooms.length > 0 && (
                  <div className="pt-1">
                    <div className="label-caps mb-1">Salas públicas disponibles</div>
                    <ul className="max-h-32 overflow-y-auto border-t border-ink/15">
                      {openRooms.map((r) => (
                        <li
                          key={r.roomId}
                          className="flex items-center justify-between gap-3 py-2 border-b border-ink/15"
                        >
                          <div className="min-w-0">
                            <span className="font-serif font-bold tracking-[0.15em] text-ink">{r.roomId}</span>
                            <span className="block text-[12px] text-ink-faint">
                              {r.playerCount}/{r.maxPlayers} ninjas · {r.boardType === 'extended' ? 'Extendida' : 'Estándar'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleJoin(null, r.roomId)}
                            disabled={!name.trim()}
                            className="btn btn-ghost px-3 py-1 text-[13px] shrink-0"
                          >
                            Unirse
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </form>

          <div className="mt-6 flex items-center gap-2 text-[12px] text-ink-faint">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-leaf' : 'bg-shu-light'}`} />
            {connected ? 'Conectado al servidor' : 'Sin conexión con el servidor'}
          </div>
        </ScrollPanel>
      </div>
    </div>
  );
}
