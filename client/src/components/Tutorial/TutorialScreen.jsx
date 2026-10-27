// «Aprende a jugar»: a guided lesson in short steps. Text on the left (below
// on phones) and a small 3D scene that acts out each rule (lazy chunk: it
// only loads three.js when the tutorial is opened). Progress is remembered.

import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { BrandPlate } from '../Shared/Brand';
import { ArrowRightIcon, SwordsIcon } from '../Shared/Icons';
import { ScrollPanel } from '../Shared/ScrollPanel';
import { hasWebGL } from '../Board/boardViewMode';
import { STEPS } from './tutorialSteps';

const TutorialStage3D = lazy(() => import('./TutorialStage3D'));

const STORAGE_KEY = 'catan_tutorial_step';

function readStep() {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(n) && n >= 0 && n < STEPS.length ? n : 0;
  } catch {
    return 0;
  }
}

function storeStep(n) {
  try {
    localStorage.setItem(STORAGE_KEY, String(n));
  } catch {
    // storage blocked: progress just isn't remembered
  }
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    let mq;
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return undefined;
    }
    const on = (e) => setReduced(e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

/** A WebGL failure (lost context, old driver…) falls back to the paper card */
class StageBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function StageFallback({ index }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
      <span className="hanko !rounded-[8px] w-16 h-16 font-display text-[34px] leading-none -rotate-6" aria-hidden="true">
        {index + 1}
      </span>
      <p className="text-[13px] text-paper/75 max-w-[16rem]">Tu navegador no puede mostrar la escena 3D, pero puedes seguir la lección con el texto.</p>
    </div>
  );
}

function StageLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <span className="flex items-center gap-2 text-[13px] font-bold text-paper/80">
        <span className="w-2.5 h-2.5 rounded-full bg-chakra animate-turn-pulse" />
        Preparando la isla…
      </span>
    </div>
  );
}

export default function TutorialScreen({ onBack, onPlay }) {
  const [index, setIndex] = useState(readStep);
  const [playKey, setPlayKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [webgl] = useState(hasWebGL);
  const reduced = usePrefersReducedMotion();
  const textRef = useRef(null);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;
  const Extra = step.extra;

  useEffect(() => {
    storeStep(index);
    // Long steps on small screens: start reading from the top
    textRef.current?.scrollTo?.({ top: 0 });
  }, [index]);

  const go = useCallback((n) => setIndex(Math.max(0, Math.min(STEPS.length - 1, n))), []);
  const leave = useCallback(() => onBack(), [onBack]);
  const play = useCallback(() => {
    storeStep(0);
    onPlay();
  }, [onPlay]);
  const onReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIndex((i) => Math.min(STEPS.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Escape') {
        leave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leave]);

  return (
    <div className="night-surface relative h-dvh w-full overflow-y-auto overflow-x-hidden lg:overflow-hidden phland:overflow-hidden">
      <div className="h-full min-h-[480px] phland:min-h-0 w-full max-w-6xl mx-auto safe-x [--pad-x:0.75rem] min-[360px]:[--pad-x:1rem] sm:[--pad-x:2rem] pt-[max(0.6rem,env(safe-area-inset-top))] pb-[max(1.1rem,env(safe-area-inset-bottom))] sm:pt-5 sm:pb-7 lg:pt-4 lg:pb-6 phland:pt-[max(0.4rem,env(safe-area-inset-top))] phland:pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col gap-3 sm:gap-4 phland:gap-1.5">
        <header className="flex items-center justify-between gap-3 shrink-0">
          <p className="flex items-center gap-2 min-w-0 text-[11px] sm:text-xs font-bold uppercase tracking-[0.14em] sm:tracking-[0.2em] text-chakra-light/85">
            <BrandPlate className="w-8 h-5 shrink-0" />
            <span className="truncate">Aprende a jugar Catán</span>
          </p>
          <button
            type="button"
            onClick={leave}
            className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-full text-[13px] font-bold text-paper-light border border-paper/30 bg-night-dark/40 hover:border-chakra-light hover:text-chakra-light cursor-pointer shrink-0"
            aria-label="Volver al menú"
          >
            <ArrowRightIcon className="w-4 h-4 rotate-180" />
            Menú
          </button>
        </header>

        <ScrollPanel
          className="w-full flex-1 min-h-0 flex flex-col animate-modal-pop"
          bodyClassName="flex flex-col flex-1 min-h-0 lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.18fr)] lg:grid-rows-[minmax(0,1fr)] phland:grid phland:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] phland:grid-rows-[minmax(0,1fr)] gap-3.5 lg:gap-7 phland:gap-3 px-3 min-[360px]:px-4 sm:px-6 lg:px-7 pt-3 sm:pt-4 lg:pt-6 pb-4 lg:pb-6 phland:px-2.5 phland:pt-2.5 phland:pb-2.5"
        >
          {/* 3D scene: on top on phones, right column on desktop, left on landscape phones */}
          <div className="relative order-first lg:order-last phland:order-first shrink-0 lg:shrink phland:shrink h-[clamp(170px,36svh,380px)] sm:h-[clamp(240px,42svh,440px)] lg:h-auto phland:h-auto lg:min-h-0 phland:min-h-0 rounded-[3px] overflow-hidden border border-ink/35 shadow-[inset_0_0_0_3px_rgba(246,239,223,0.6)] bg-[radial-gradient(ellipse_at_50%_40%,#2d5d77_0%,#1b3a50_55%,#0f1f2e_100%)]">
            {webgl ? (
              <StageBoundary fallback={<StageFallback index={index} />}>
                <div className="absolute inset-0">
                  <Suspense fallback={null}>
                    <TutorialStage3D stepId={step.id} playKey={playKey} reduced={reduced} onReady={onReady} />
                  </Suspense>
                </div>
                {!ready && <StageLoading />}
              </StageBoundary>
            ) : (
              <StageFallback index={index} />
            )}
            {webgl && ready && !reduced && (
              <button
                type="button"
                onClick={() => setPlayKey((k) => k + 1)}
                className="absolute right-2 bottom-2 min-h-[32px] px-2.5 rounded-full text-[12px] font-bold text-paper-light bg-night-dark/70 border border-paper/25 hover:border-chakra-light hover:text-chakra-light cursor-pointer"
              >
                Repetir
              </button>
            )}
            <span className="absolute left-2 top-2 label-caps !text-[10px] !text-paper/80 bg-night-dark/55 rounded-full px-2 py-0.5 pointer-events-none">
              Paso {index + 1} / {STEPS.length}
            </span>
          </div>

          {/* Lesson text */}
          <div className="flex flex-col flex-1 min-h-0">
            <div
              ref={textRef}
              aria-live="polite"
              className="flex-1 min-h-0 overflow-y-auto pr-2 -mr-2 phland:pr-1.5 phland:-mr-1.5 overscroll-contain"
            >
              <p className="label-caps flex items-center gap-2">
                <span className="hanko w-6 h-6 text-[12px] -rotate-6" aria-hidden="true">
                  {index + 1}
                </span>
                Lección {index + 1} de {STEPS.length}
              </p>
              <h2 className="font-display text-[25px] min-[360px]:text-[28px] lg:text-[32px] phland:text-[22px] leading-tight text-ink mt-1.5 phland:mt-1">
                {step.title}
              </h2>
              <hr className="brush-rule mt-2 mb-3 phland:mb-2" />
              <div className="space-y-2 text-[15px] phland:text-[14px] leading-relaxed text-ink-soft">
                {step.body.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
              {Extra && (
                <div className="mt-3">
                  <Extra />
                </div>
              )}
            </div>

            {/* Navigation */}
            <nav className="mt-3 phland:mt-2 pt-2.5 phland:pt-1.5 border-t border-ink/15 shrink-0" aria-label="Pasos del tutorial">
              <ol className="flex items-center justify-center flex-wrap">
                {STEPS.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => go(i)}
                      className="group w-[22px] max-[359px]:w-[19px] h-7 flex items-center justify-center cursor-pointer"
                      aria-label={`Paso ${i + 1}: ${s.title}`}
                      aria-current={i === index ? 'step' : undefined}
                    >
                      <span
                        className={`block rounded-full transition-all ${
                          i === index
                            ? 'w-3 h-3 bg-shu shadow-[0_0_0_2px_rgba(182,51,31,0.25)]'
                            : i < index
                              ? 'w-2 h-2 bg-ink/60 group-hover:bg-shu'
                              : 'w-2 h-2 bg-ink/20 group-hover:bg-ink/50'
                        }`}
                      />
                    </button>
                  </li>
                ))}
              </ol>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => go(index - 1)}
                  disabled={index === 0}
                  className="btn btn-ghost min-h-[44px] px-3.5 text-[14px]"
                >
                  <ArrowRightIcon className="w-4 h-4 rotate-180" />
                  Anterior
                </button>
                {!last && (
                  <button type="button" onClick={leave} className="ml-auto min-h-[44px] px-2 text-[13px] font-bold text-ink-faint hover:text-shu cursor-pointer">
                    Saltar
                  </button>
                )}
                {last ? (
                  <button type="button" onClick={play} className="btn btn-primary ml-auto min-h-[44px] px-4 text-[15px]">
                    <SwordsIcon className="w-4.5 h-4.5" />
                    ¡Jugar ahora!
                  </button>
                ) : (
                  <button type="button" onClick={() => go(index + 1)} className="btn btn-primary min-h-[44px] px-4 text-[15px]">
                    Siguiente
                    <ArrowRightIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </nav>
          </div>
        </ScrollPanel>
      </div>
    </div>
  );
}
