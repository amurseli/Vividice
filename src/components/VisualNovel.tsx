import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Flags, Option, RichChar, Script, Step } from '../lib/narrative';
import {
  isMusicStop,
  musicSrc,
  parseRich,
  resolveNext,
  resolveText,
  visibleOptions,
} from '../lib/narrative';
import './VisualNovel.css';

/* Pausa inicial (ms) antes de que aparezca el primer texto: unos segundos
   de sólo fondo para ambientar. Sólo aplica al primer step. */
const START_DELAY = 3000;

/* Tiempo (ms) que el step queda ineskippeable después de que el texto
   terminó de aparecer: no se puede avanzar ni elegir hasta que pase. */
const READY_DELAY = 1000;

/* Al terminar la novela fundimos a negro durante este tiempo (ms) antes de
   redirigir, en vez de cortar de golpe. La música se desvanece a la par. */
const END_FADE = 5000;

/* Texto donde cada letra oscila en una onda senoidal lenta. `dur` cambia la
   velocidad y `phase` desfasa la onda (para desincronizar varias palabras).
   Reutilizable: opciones, el nombre y lo que venga. */
function WavyText({ text, dur = 3.2, phase = 0 }: { text: string; dur?: number; phase?: number }) {
  /* Se agrupa por palabras (cada una inline-block, sin corte interno) para que
     las letras onduladas nunca partan una palabra al medio; el corte de línea
     queda solo en los espacios. El desfase usa el índice absoluto de letra para
     que la onda siga siendo continua entre palabras. */
  const tokens = text.split(/(\s+)/);
  const nodes: ReactNode[] = [];
  let i = 0;
  tokens.forEach((tok, ti) => {
    if (tok === '') return;
    if (/^\s+$/.test(tok)) {
      nodes.push(<span key={`s${ti}`}>{' '}</span>);
      i += tok.length;
      return;
    }
    const start = i;
    const letters = tok.split('').map((ch, k) => (
      <span
        key={start + k}
        className="vn__owave"
        aria-hidden="true"
        style={{
          animationDuration: `${dur}s`,
          animationDelay: `${(phase + (start + k) * 0.09) * -1}s`,
        }}
      >
        {ch}
      </span>
    ));
    i += tok.length;
    nodes.push(
      <span className="vn__word" key={`w${ti}`}>
        {letters}
      </span>,
    );
  });
  return <>{nodes}</>;
}

/* Un caracter del texto narrativo: ondulado (inline-block, animado) o plano. */
function charSpan(c: RichChar, i: number): ReactNode {
  if (c.wave) {
    return (
      <span
        key={i}
        className="vn__owave"
        style={{
          color: c.color ?? undefined,
          animationDelay: `${i * -0.09}s`,
          animationDuration: '3.2s',
        }}
      >
        {c.ch}
      </span>
    );
  }
  return (
    <span key={i} className="vn__char" style={c.color ? { color: c.color } : undefined}>
      {c.ch}
    </span>
  );
}

/* Renderiza los caracteres agrupándolos en palabras que no se cortan. Las
   letras onduladas son inline-block (cajas atómicas) y sin esto el navegador
   partiría palabras en cualquier letra; agrupando, el corte queda solo en los
   espacios y los \n. */
function renderChars(chars: RichChar[]): ReactNode[] {
  const out: ReactNode[] = [];
  let word: ReactNode[] = [];
  let wordKey = 0;
  const flush = () => {
    if (word.length) {
      out.push(
        <span className="vn__word" key={`w${wordKey}`}>
          {word}
        </span>,
      );
      word = [];
    }
  };
  chars.forEach((c, i) => {
    if (c.ch === '\n') {
      flush();
      out.push(<br key={`b${i}`} />);
    } else if (c.ch === ' ') {
      flush();
      out.push(
        <span className="vn__char" key={`s${i}`}>
          {' '}
        </span>,
      );
    } else {
      if (word.length === 0) wordKey = i;
      word.push(charSpan(c, i));
    }
  });
  flush();
  return out;
}

type Props = {
  script: Script;
  /* Destino del skip y del final de la novela (ej: /lugares). */
  skipHref: string;
  /* Velocidad de tipeo en ms por caracter. */
  typeSpeed?: number;
  /* Access key de Web3Forms: si está, al terminar la intro se envían las flags
     (nombre + elecciones). Si no, no se recolecta nada. */
  collectKey?: string;
  /* Volumen de la música (0–1) y duración del crossfade entre temas (ms). */
  musicVolume?: number;
  musicFade?: number;
  /* Si está, pide pantalla completa en el primer click (los navegadores no
     permiten forzarla sin un gesto del usuario). */
  fullscreen?: boolean;
};

export default function VisualNovel({
  script,
  skipHref,
  typeSpeed = 32,
  collectKey,
  musicVolume = 0.5,
  musicFade = 1800,
  fullscreen = true,
}: Props) {
  const [currentId, setCurrentId] = useState(script.start);
  const [flags, setFlags] = useState<Flags>({});
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(0);
  const [done, setDone] = useState(false);
  /* ready=true recién READY_DELAY después de done: hasta entonces el step
     es ineskippeable (no avanza, no muestra opciones ni flecha). */
  const [ready, setReady] = useState(false);
  /* Cuando la novela termina, fundimos a negro durante END_FADE antes de salir. */
  const [fading, setFading] = useState(false);
  /* Sólo el primer step espera START_DELAY; los siguientes arrancan ya. */
  const firstRun = useRef(true);
  /* La recolección se envía una sola vez por partida. */
  const sent = useRef(false);
  /* Input oculto que captura el tipeo del nombre. */
  const inputRef = useRef<HTMLInputElement>(null);
  /* Pantalla completa: se pide una sola vez, en el primer click. */
  const fsAsked = useRef(false);
  /* Tema musical activo (id que resuelve a /music/<id>.mp3, o null = silencio).
     Sólo cambia cuando un step trae el campo `music`. */
  const [track, setTrack] = useState<string | null>(null);
  /* Instancia Howl que suena ahora (para crossfadearla cuando cambie el tema). */
  const howlRef = useRef<unknown>(null);

  /* Al cambiar de step, reseteamos en el render (no en un efecto) para que el
     frame nuevo nunca herede el `ready` del step anterior: sin ese reset, un
     step con opciones las "flashea" un instante antes de tipear el texto. */
  const [renderedId, setRenderedId] = useState(currentId);
  if (renderedId !== currentId) {
    setRenderedId(currentId);
    setRevealed(0);
    setDone(false);
    setReady(false);
    setDraft('');
  }

  const step: Step | undefined = script.steps[currentId];
  /* Flags efectivas en este step: incluyen ya las que el propio step setea al
     entrar (para que su texto variable las pueda usar sin un re-render). */
  const liveFlags: Flags = step?.set ? { ...flags, ...step.set } : flags;
  const text = resolveText(step?.text, liveFlags);
  /* Texto parseado a caracteres con estilo + pausas (efectos inline). */
  const rich = useMemo(() => parseRich(text), [text]);
  const options: Option[] = step ? visibleOptions(step, liveFlags) : [];
  /* Con muchas opciones (6+), en vez de filas las orbitamos alrededor de la
     pregunta, girando lento. */
  const isOrbit = options.length >= 6;
  /* Las opciones se agrupan de a 2 por fila (3 → 2 arriba + 1 abajo). */
  const optionRows: Option[][] = [];
  for (let r = 0; r < options.length; r += 2) optionRows.push(options.slice(r, r + 2));

  /* Aplica las flags de entrada del step y resetea el campo de texto. */
  useEffect(() => {
    setDraft('');
    if (step?.set) setFlags((f) => ({ ...f, ...step.set }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);
  useEffect(() => {
    setRevealed(0);
    setDone(false);
    setReady(false);
    const total = rich.chars.length;
    if (total === 0) {
      setDone(true);
      return;
    }
    const reduced = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reduced) {
      setRevealed(total);
      setDone(true);
      return;
    }

    const delay = firstRun.current ? START_DELAY : 0;
    firstRun.current = false;

    /* Revela un caracter por tick; si hay una pausa registrada en esa
       posición, la suma antes del siguiente. */
    let n = 0;
    let timer = 0;
    const step = () => {
      n += 1;
      setRevealed(n);
      if (n >= total) {
        setDone(true);
        return;
      }
      timer = window.setTimeout(step, typeSpeed + (rich.pauses[n] ?? 0));
    };
    const startTimer = window.setTimeout(
      () => {
        timer = window.setTimeout(step, typeSpeed + (rich.pauses[0] ?? 0));
      },
      delay,
    );

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(timer);
    };
  }, [currentId, rich, typeSpeed]);

  /* Una vez que el texto terminó (done), el step sigue ineskippeable hasta
     que pase READY_DELAY. */
  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => setReady(true), READY_DELAY);
    return () => window.clearTimeout(id);
  }, [done]);

  /* Al entrar a un step con campo `music`, fijamos el tema deseado. Los steps
     sin el campo no lo tocan (sigue el actual). "none"/"stop"/"" = silencio. */
  useEffect(() => {
    const m = script.steps[currentId]?.music;
    if (m === undefined) return;
    setTrack(isMusicStop(m) ? null : m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  /* Reproductor: cuando cambia el tema deseado, crossfadeamos. Howler se
     importa dinámico (sólo en cliente) y reproduce en loop. */
  useEffect(() => {
    let cancelled = false;
    const fadeOutStop = (howl: any) => {
      if (!howl) return;
      try {
        howl.fade(howl.volume(), 0, musicFade);
        window.setTimeout(() => { try { howl.stop(); howl.unload(); } catch {} }, musicFade + 80);
      } catch {}
    };
    (async () => {
      const { Howl } = await import('howler');
      if (cancelled) return;
      const prev = howlRef.current as any;
      if (!track) {
        fadeOutStop(prev);
        howlRef.current = null;
        return;
      }
      const next = new Howl({ src: [musicSrc(track)], loop: true, volume: 0, html5: false });
      next.play();
      next.fade(0, musicVolume, musicFade);
      howlRef.current = next;
      fadeOutStop(prev);
    })();
    return () => { cancelled = true; };
  }, [track, musicVolume, musicFade]);

  /* Al desmontar, frenamos lo que esté sonando. */
  useEffect(() => {
    return () => {
      const howl = howlRef.current as any;
      try { howl?.stop(); howl?.unload(); } catch {}
    };
  }, []);

  /* Envía nombre + flags a Web3Forms al terminar (una vez, fire-and-forget con
     keepalive para que sobreviva a la navegación). */
  const collect = (finalFlags: Flags) => {
    if (sent.current || !collectKey) return;
    sent.current = true;
    if (Object.keys(finalFlags).length === 0) return;
    /* Resumen legible de todas las elecciones (además de cada flag por separado). */
    const resumen = Object.entries(finalFlags)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
    try {
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: collectKey,
          subject: `Vividice — ${finalFlags.nombre ?? 'jugador'}`,
          resumen,
          ...finalFlags,
        }),
      }).catch(() => {});
    } catch {
      /* nunca bloquea ni rompe la intro */
    }
  };

  const goTo = (next: string | null | undefined, withFlags: Flags = liveFlags) => {
    if (!next || !script.steps[next]) {
      /* Sin destino válido = fin de la novela: recolectamos, fundimos a negro
         (la música se desvanece a la par) y recién entonces redirigimos. */
      if (fading) return;
      setFading(true);
      collect(withFlags);
      const howl = howlRef.current as any;
      try { howl?.fade(howl.volume(), 0, END_FADE); } catch {}
      window.setTimeout(() => { window.location.href = skipHref; }, END_FADE);
      return;
    }
    setCurrentId(next);
  };
  const handleAdvance = () => {
    if (!ready) return;
    if (options.length || step?.input) return;
    goTo(resolveNext(step?.next, liveFlags));
  };
  /* Primer click: pide pantalla completa (única forma permitida — con gesto).
     Después delega en handleAdvance. */
  const enterFullscreenOnce = () => {
    if (!fullscreen || fsAsked.current) return;
    fsAsked.current = true;
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    }
  };
  const handleStageClick = () => {
    enterFullscreenOnce();
    handleAdvance();
  };
  const choose = (opt: Option) => {
    enterFullscreenOnce();
    /* Las flags de la opción deben estar disponibles para resolver el destino
       convergente, así que las calculamos antes de navegar. */
    const nf = opt.set ? { ...liveFlags, ...opt.set } : liveFlags;
    if (opt.set) setFlags(nf);
    /* Si la opción define `next` propio, bifurca (vacío = fin); si no, converge
       al `next` del step. */
    const dest = 'next' in opt ? opt.next || null : resolveNext(step?.next, nf);
    goTo(dest, nf);
  };

  const input = step?.input;
  const min = input?.min ?? 1;
  const max = input?.max ?? 20;
  const draftOk = draft.trim().length >= min && draft.length <= max;
  const submitInput = () => {
    if (!input || !draftOk) return;
    enterFullscreenOnce();
    const nf = { ...liveFlags, [input.flag]: draft.trim() };
    setFlags(nf);
    goTo(resolveNext(step?.next, nf), nf);
  };

  if (!step) {
    /* Step inexistente (guion mal referenciado): salimos al destino. */
    if (typeof window !== 'undefined') window.location.href = skipHref;
    return null;
  }

  const hasOptions = options.length > 0;

  return (
    <section
      className="vn"
      onClick={handleStageClick}
      role="presentation"
    >
      <div className="vn__panel">
        <p className={`vn__text${done && hasOptions ? ' vn__text--lift' : ''}`}>
          {renderChars(rich.chars.slice(0, revealed))}
        </p>

        <div className="vn__after">
          {ready && hasOptions && !isOrbit && (
            <div className="vn__options">
              {optionRows.map((row, r) => (
                <div className="vn__row" key={r} data-single={row.length === 1}>
                  {row.map((opt, c) => {
                    const i = r * 2 + c;
                    return (
                      <button
                        type="button"
                        key={c}
                        className="vn__option"
                        aria-label={opt.label}
                        onClick={(e) => {
                          e.stopPropagation();
                          choose(opt);
                        }}
                      >
                        <WavyText text={opt.label} dur={2.8 + i * 0.7} phase={i * 0.8} />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {ready && input && (
            <form
              className="vn__namefill"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.focus();
              }}
              onSubmit={(e) => {
                e.preventDefault();
                submitInput();
              }}
            >
              <span className="vn__nameview">
                {draft ? (
                  <WavyText text={draft} />
                ) : (
                  <span className="vn__nameph" aria-hidden="true">
                    {input.placeholder ?? '…'}
                  </span>
                )}
                <span className="vn__caret" aria-hidden="true" />
              </span>
              {/* Input real, oculto: captura el tipeo y el teclado en mobile. */}
              <input
                ref={inputRef}
                className="vn__nameinput"
                type="text"
                autoFocus
                maxLength={max}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label="Escribí tu nombre"
              />
            </form>
          )}

          {ready && !hasOptions && !input && (
            <p className="vn__hint" aria-hidden="true">
              ↓
            </p>
          )}
        </div>
      </div>

      {ready && hasOptions && isOrbit && (
        <ul className="vn__orbit" aria-label="Opciones">
          {options.map((opt, i) => (
            <li
              className="vn__orbiter"
              key={i}
              style={{ '--a': `${(360 / options.length) * i}deg` } as CSSProperties}
            >
              <button
                type="button"
                className="vn__option vn__option--orbit"
                aria-label={opt.label}
                onClick={(e) => {
                  e.stopPropagation();
                  choose(opt);
                }}
              >
                <WavyText text={opt.label} dur={3 + i * 0.4} phase={i * 0.5} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Velo de fin: se opaca lentamente hasta cubrir todo antes de redirigir. */}
      <div
        className={`vn__fade${fading ? ' vn__fade--on' : ''}`}
        style={{ transitionDuration: `${END_FADE}ms` }}
        aria-hidden="true"
      />
    </section>
  );
}
