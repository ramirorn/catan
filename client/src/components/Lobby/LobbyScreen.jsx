import { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { useSocket } from '../../context/SocketContext';
import { IslandChart } from './IslandChart';
import { ScrollPanel } from '../Shared/ScrollPanel';
import { BrandPlate } from '../Shared/Brand';
import { RoomRules } from './RoomRules';
import { InstallAppButton } from '../Shared/Pwa';
import { DEFAULT_VP_TO_WIN } from '../../utils/constants';
import { EyeIcon } from '../Shared/Icons';

export function LobbyScreen() {
  const { createRoom, joinRoom, spectateRoom, playerName, setPlayerName } = useGame();
  const { socket, connected } = useSocket();
  const [tab, setTab] = useState('create');
  const [name, setName] = useState(playerName);
  const [roomCode, setRoomCode] = useState('');
  const [boardType, setBoardType] = useState('standard');
  const [rules, setRules] = useState({ vpToWin: DEFAULT_VP_TO_WIN, turnTimeLimit: 90 });
  const [publicRooms, setPublicRooms] = useState([]);
  // Rooms that can be joined (waiting with a free seat) or watched (any not finished)
  const openRooms = publicRooms.filter((r) => r.phase !== 'gameOver');
  const canSit = (r) => r.phase === 'lobby' && r.playerCount < r.maxPlayers;

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

  const handleSpectate = (codeToWatch = null) => {
    const code = codeToWatch || roomCode;
    if (!name.trim() || !code.trim()) return;
    spectateRoom(code.trim(), name.trim());
  };

  const tabClass = (isActive) =>
    `flex-1 pb-2.5 short:pb-2 text-[14px] min-[360px]:text-[15px] leading-tight font-bold border-b-2 transition-colors cursor-pointer ${
      isActive ? 'border-chakra text-ink' : 'border-transparent text-ink-faint hover:text-ink-soft'
    }`;

  const boardOptions = [
    { value: 'standard', title: 'Aldea estándar', detail: '2 – 4 ninjas · 19 hexágonos' },
    { value: 'extended', title: 'Gran país', detail: '2 – 6 ninjas · 30 hexágonos' },
  ];

  return (
    <div className="night-surface relative h-dvh w-full overflow-y-auto lg:overflow-hidden phland:overflow-hidden">
      <div className="min-h-full lg:h-full phland:h-full w-full max-w-6xl mx-auto safe-x [--pad-x:1rem] min-[360px]:[--pad-x:1.25rem] sm:[--pad-x:2rem] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] short:pt-[max(0.75rem,env(safe-area-inset-top))] sm:py-10 lg:py-6 phland:pt-[max(0.75rem,env(safe-area-inset-top))] phland:pb-[max(0.75rem,env(safe-area-inset-bottom))] grid lg:grid-cols-[1.15fr_1fr] lg:grid-rows-[minmax(0,1fr)] phland:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] phland:grid-rows-[minmax(0,1fr)] gap-4 short:gap-3 sm:gap-7 lg:gap-12 phland:gap-6 items-center">
        {/* Title & chart */}
        <section className="flex flex-col items-center lg:items-start phland:items-start text-center lg:text-left phland:text-left lg:h-full lg:min-h-0 lg:justify-center phland:justify-center">
          <p className="flex items-center gap-2 text-[10px] min-[360px]:text-[11px] sm:text-xs font-bold uppercase tracking-[0.12em] min-[360px]:tracking-[0.16em] min-[420px]:tracking-[0.24em] phland:tracking-[0.14em] text-chakra-light/85">
            <BrandPlate className="w-8 h-5" />
            Partida multijugador en tiempo real
          </p>
          <div className="flex items-start gap-3 sm:gap-4 mt-3 short:mt-2 phland:mt-2">
            <h1 className="font-display leading-[0.85] text-paper-light drop-shadow-[0_3px_0_rgba(0,0,0,0.5)]">
              <span className="block text-[68px] short:text-[56px] tiny:text-[46px] sm:text-[96px] phland:text-[52px]">Catán</span>
              <span className="block text-[38px] short:text-[32px] tiny:text-[28px] sm:text-[52px] phland:text-[30px] text-chakra mt-1 sm:mt-0 lg:pl-1 phland:pl-1">Shinobi</span>
            </h1>
            <span
              className="hanko !rounded-[6px] mt-2 w-11 h-11 tiny:w-9 tiny:h-9 sm:w-14 sm:h-14 phland:w-10 phland:h-10 font-display text-[28px] tiny:text-[22px] sm:text-[36px] phland:text-[24px] leading-none -rotate-6 shrink-0"
              aria-hidden="true"
            >
              忍
            </span>
          </div>
          <p className="text-paper/75 text-[15px] short:text-[14px] sm:text-lg phland:text-[14px] mt-3 short:mt-2 squat:mt-1.5 phland:mt-2 max-w-md tiny:hidden">
            Comercia, construye y expande tu aldea oculta en el país de las hojas.
          </p>
          <IslandChart className="hidden lg:block w-full lg:max-w-[520px] lg:flex-1 lg:min-h-0 lg:h-auto lg:max-h-[520px] mt-6" />
        </section>

        {/* Registration scroll */}
        <ScrollPanel className="w-full max-w-md mx-auto lg:mx-0 phland:mx-0 phland:max-w-none animate-modal-pop lg:max-h-full lg:min-h-0 lg:flex lg:flex-col phland:max-h-full phland:min-h-0 phland:flex phland:flex-col" bodyClassName="px-4 min-[360px]:px-5 sm:px-8 pt-6 short:pt-4 tiny:pt-3 pb-7 short:pb-5 tiny:pb-4 phland:px-5 phland:pt-3.5 phland:pb-4 lg:min-h-0 lg:overflow-y-auto phland:min-h-0 phland:overflow-y-auto">
          <h2 className="font-display text-[24px] min-[360px]:text-[28px] short:text-[25px] phland:text-[24px] leading-tight text-ink">Registro de ninjas</h2>
          <p className="text-[14px] text-ink-soft mt-0.5 mb-5 short:mb-3 phland:mb-3 squat:hidden">Funda una nueva partida o únete a una existente.</p>

          {/* Tab switch */}
          <div className="flex gap-4 mb-6 short:mb-4 squat:mt-1.5 tiny:mb-3 phland:mb-3.5 border-b border-ink/15" role="tablist">
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

          <form onSubmit={tab === 'create' ? handleCreate : (e) => handleJoin(e)} className="space-y-5 short:space-y-3.5 tiny:space-y-3 phland:space-y-3">
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
                          className={`text-left px-3 max-[359px]:px-2 py-2.5 short:py-2 phland:py-1.5 rounded-[3px] border transition-colors cursor-pointer ${
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
                  className="btn btn-primary w-full py-3 phland:py-2.5 min-h-[44px] text-[15px]"
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

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={!connected || !name.trim() || !roomCode.trim()}
                    className="btn btn-primary flex-1 min-w-0 min-h-[44px] py-3 text-[15px]"
                  >
                    {connected ? 'Entrar a la sala' : 'Conectando…'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSpectate()}
                    disabled={!connected || !name.trim() || !roomCode.trim()}
                    className="btn btn-ghost min-h-[44px] px-3 py-3 text-[14px] shrink-0"
                    title="Ver la partida sin jugar (también si ya empezó)"
                  >
                    <EyeIcon className="w-4 h-4" />
                    Observar
                  </button>
                </div>

                {openRooms.length > 0 && (
                  <div className="pt-1">
                    <div className="label-caps mb-1">Salas públicas</div>
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
                              {r.phase !== 'lobby' ? ' · En curso' : r.playerCount >= r.maxPlayers ? ' · Llena' : ''}
                              {r.spectatorCount > 0 ? ` · ${r.spectatorCount} observando` : ''}
                            </span>
                          </div>
                          <span className="flex gap-1.5 shrink-0">
                            {canSit(r) && (
                              <button
                                type="button"
                                onClick={() => handleJoin(null, r.roomId)}
                                disabled={!name.trim()}
                                className="btn btn-ghost min-h-[38px] px-3 py-1 text-[13px]"
                              >
                                Unirse
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleSpectate(r.roomId)}
                              disabled={!name.trim()}
                              className="btn btn-ghost min-h-[38px] px-2.5 py-1 text-[13px]"
                              title="Ver la partida sin jugar"
                              aria-label={`Observar la sala ${r.roomId}`}
                            >
                              <EyeIcon className="w-4 h-4" />
                              <span className="max-[359px]:hidden">Observar</span>
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </form>

          <div className="mt-6 short:mt-3.5 tiny:mt-2.5 phland:mt-3 flex items-center gap-2 text-[12px] text-ink-faint">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-leaf' : 'bg-shu-light'}`} />
            {connected ? 'Conectado al servidor' : 'Sin conexión con el servidor'}
            <InstallAppButton className="ml-auto" />
          </div>
        </ScrollPanel>
      </div>
    </div>
  );
}
