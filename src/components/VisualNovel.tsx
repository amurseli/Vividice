import { useEffect, useRef, useState } from 'react';
import type { Flags, Option, Script, Step } from '../lib/narrative';
import { resolveNext, resolveText, visibleOptions } from '../lib/narrative';
import './VisualNovel.css';

/* Pausa inicial (ms) antes de que aparezca el primer texto: unos segundos
   de sólo fondo para ambientar. Sólo aplica al primer step. */
const START_DELAY = 3000;

/* Tiempo (ms) que el step queda ineskippeable después de que el texto
   terminó de aparecer: no se puede avanzar ni elegir hasta que pase. */
const READY_DELAY = 1000;

type Props = {
  script: Script;
  /* Destino del skip y del final de la novela (ej: /lugares). */
  skipHref: string;
  /* Velocidad de tipeo en ms por caracter. */
  typeSpeed?: number;
  /* Access key de Web3Forms: si está, al terminar la intro se envían las flags
     (nombre + elecciones). Si no, no se recolecta nada. */
  collectKey?: string;
};

export default function VisualNovel({
  script,
  skipHref,
  typeSpeed = 32,
  collectKey,
}: Props) {
  const [currentId, setCurrentId] = useState(script.start);
  const [flags, setFlags] = useState<Flags>({});
  const [draft, setDraft] = useState('');
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);
  /* ready=true recién READY_DELAY después de done: hasta entonces el step
     es ineskippeable (no avanza, no muestra opciones ni flecha). */
  const [ready, setReady] = useState(false);
  /* Sólo el primer step espera START_DELAY; los siguientes arrancan ya. */
  const firstRun = useRef(true);
  /* La recolección se envía una sola vez por partida. */
  const sent = useRef(false);

  /* Al cambiar de step, reseteamos en el render (no en un efecto) para que el
     frame nuevo nunca herede el `ready` del step anterior: sin ese reset, un
     step con opciones las "flashea" un instante antes de tipear el texto. */
  const [renderedId, setRenderedId] = useState(currentId);
  if (renderedId !== currentId) {
    setRenderedId(currentId);
    setShown('');
    setDone(false);
    setReady(false);
    setDraft('');
  }

  const step: Step | undefined = script.steps[currentId];
  /* Flags efectivas en este step: incluyen ya las que el propio step setea al
     entrar (para que su texto variable las pueda usar sin un re-render). */
  const liveFlags: Flags = step?.set ? { ...flags, ...step.set } : flags;
  const text = resolveText(step?.text, liveFlags);
  const options: Option[] = step ? visibleOptions(step, liveFlags) : [];

  /* Aplica las flags de entrada del step y resetea el campo de texto. */
  useEffect(() => {
    setDraft('');
    if (step?.set) setFlags((f) => ({ ...f, ...step.set }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);
  useEffect(() => {
    setShown('');
    setDone(false);
    setReady(false);
    if (!text) {
      setDone(true);
      return;
    }
    const reduced = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reduced) {
      setShown(text);
      setDone(true);
      return;
    }

    const delay = firstRun.current ? START_DELAY : 0;
    firstRun.current = false;

    let interval = 0;
    const startTimer = window.setTimeout(() => {
      let i = 0;
      interval = window.setInterval(() => {
        i += 1;
        setShown(text.slice(0, i));
        if (i >= text.length) {
          window.clearInterval(interval);
          setDone(true);
        }
      }, typeSpeed);
    }, delay);

    return () => {
      window.clearTimeout(startTimer);
      window.clearInterval(interval);
    };
  }, [currentId, text, typeSpeed]);

  /* Una vez que el texto terminó (done), el step sigue ineskippeable hasta
     que pase READY_DELAY. */
  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => setReady(true), READY_DELAY);
    return () => window.clearTimeout(id);
  }, [done]);

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
      /* Sin destino válido = fin de la novela: recolectamos y salimos. */
      collect(withFlags);
      window.location.href = skipHref;
      return;
    }
    setCurrentId(next);
  };
  const handleAdvance = () => {
    if (!ready) return;
    if (options.length || step?.input) return;
    goTo(resolveNext(step?.next, liveFlags));
  };
  const choose = (opt: Option) => {
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
      onClick={handleAdvance}
      role="presentation"
    >
      <a
        className="vn__skip"
        href={skipHref}
        aria-label="Saltear introducción"
        onClick={(e) => e.stopPropagation()}
      >
        →
      </a>

      <div className="vn__panel">
        <p className="vn__text">
          {shown.split('').map((ch, i) => (
            <span key={i} className="vn__char">
              {ch}
            </span>
          ))}
        </p>

        <div className="vn__after">
          {ready && hasOptions && (
            <ul className="vn__options">
              {options.map((opt, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="vn__option"
                    onClick={(e) => {
                      e.stopPropagation();
                      choose(opt);
                    }}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {ready && input && (
            <form
              className="vn__input"
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                submitInput();
              }}
            >
              <input
                className="vn__field"
                type="text"
                autoFocus
                maxLength={max}
                value={draft}
                placeholder={input.placeholder ?? ''}
                onChange={(e) => setDraft(e.target.value)}
                aria-label="Tu respuesta"
              />
              <button
                type="submit"
                className="vn__option vn__submit"
                disabled={!draftOk}
              >
                →
              </button>
            </form>
          )}

          {ready && !hasOptions && !input && (
            <p className="vn__hint" aria-hidden="true">
              ↓
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
