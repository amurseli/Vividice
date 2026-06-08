import { useEffect, useRef, useState } from 'react';
import type { Script, Step } from '../lib/narrative';
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
};

export default function VisualNovel({
  script,
  skipHref,
  typeSpeed = 32,
}: Props) {
  const [currentId, setCurrentId] = useState(script.start);
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);
  /* ready=true recién READY_DELAY después de done: hasta entonces el step
     es ineskippeable (no avanza, no muestra opciones ni flecha). */
  const [ready, setReady] = useState(false);
  /* Sólo el primer step espera START_DELAY; los siguientes arrancan ya. */
  const firstRun = useRef(true);

  const step: Step | undefined = script.steps[currentId];
  const text = step?.text ?? '';
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

  const goTo = (next: string | null | undefined) => {
    if (!next || !script.steps[next]) {
      /* Sin destino válido = fin de la novela. */
      window.location.href = skipHref;
      return;
    }
    setCurrentId(next);
  };
  const handleAdvance = () => {
    if (!ready) return;
    if (step?.options?.length) return;
    goTo(step?.next);
  };

  if (!step) {
    /* Step inexistente (guion mal referenciado): salimos al destino. */
    if (typeof window !== 'undefined') window.location.href = skipHref;
    return null;
  }

  const hasOptions = Boolean(step.options?.length);

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

        {ready && hasOptions && (
          <ul className="vn__options">
            {step.options!.map((opt, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="vn__option"
                  onClick={(e) => {
                    e.stopPropagation();
                    goTo(opt.next);
                  }}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        )}

        {ready && !hasOptions && (
          <p className="vn__hint" aria-hidden="true">
            ↓
          </p>
        )}
      </div>
    </section>
  );
}
