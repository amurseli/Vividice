/* Flags acumuladas durante la partida (siempre strings; los booleanos se
   guardan como "true"/"false" y se comparan por string). */
export type Flags = Record<string, string>;

/* Condición. Dos formas:
   - objeto legacy { flag: valor, ... } → todas deben coincidir (AND).
   - cláusula { op, terms } → AND/OR sobre una lista de términos flag=valor. */
export type Cond = Record<string, string>;
export type Term = { flag: string; value: string };
export type Clause = { op: 'and' | 'or'; terms: Term[] };
export type AnyCond = Cond | Clause;

/* Texto que cambia según una flag. Si no hay caso para el valor actual,
   cae a `default` (o vacío). */
export type TextVariants = {
  on: string;
  cases: Record<string, string>;
  default?: string;
};
export type Text = string | TextVariants;

export type Option = {
  label: string;
  /* Si tiene `next`, la opción bifurca a ese nodo (comportamiento clásico).
     Si no, setea `set` y converge al `next` del step (elección con flag). */
  next?: string | null;
  set?: Record<string, string>;
  /* La opción sólo se muestra cuando matchea (opciones condicionales).
     Objeto legacy {flag:valor} (AND) o cláusula {op, terms} (AND/OR). */
  when?: AnyCond;
};

/* `next` puede ser un id fijo o una lista de reglas: la primera que matchea
   gana; una regla sin `when` es el fallback. */
export type NextRule = { when?: AnyCond; go: string | null };
export type Next = string | null | NextRule[];

/* Campo de texto libre: el jugador escribe y se guarda en una flag. */
export type InputSpec = { flag: string; max?: number; min?: number; placeholder?: string };

export type Step = {
  text: Text;
  next?: Next;
  options?: Option[];
  /* Flags que se setean al entrar al step. */
  set?: Record<string, string>;
  /* Si está, el step pide texto libre (continúa a `next` al confirmar). */
  input?: InputSpec;
  /* Música: al entrar a este step se cambia (con crossfade) al tema indicado.
     Es un id que resuelve a /music/<id>.mp3. Los steps sin este campo no tocan
     la música (sigue sonando la actual). Un valor "none"/"stop" la corta. */
  music?: string;
};

/* ¿El valor de `music` significa "cortar la música"? */
export function isMusicStop(music: string): boolean {
  return music === '' || music === 'none' || music === 'stop';
}

/* URL del tema a partir de su id (encodeado por si tiene espacios/símbolos). */
export function musicSrc(id: string): string {
  return `/music/${encodeURIComponent(id)}.mp3`;
}

export type Script = { start: string; steps: Record<string, Step> };

/* Formas de salida que un step puede tener. */
export type StepKind = 'next' | 'choice' | 'end' | 'input';

export function hasNext(next: Next | undefined): boolean {
  if (next == null) return false;
  if (Array.isArray(next)) return next.length > 0;
  return next !== '';
}

export function stepKind(step: Step): StepKind {
  if (step.input) return 'input';
  if (Array.isArray(step.options)) return 'choice';
  /* 'continuar' si existe la clave next (destino vacío = aún sin definir);
     'fin' sólo si no existe. */
  return 'next' in step ? 'next' : 'end';
}

/* ¿La condición se cumple con las flags actuales? Sin condición = siempre.
   Soporta el objeto legacy (AND) y la cláusula { op, terms } (AND/OR). */
export function matches(cond: AnyCond | undefined, flags: Flags): boolean {
  if (!cond) return true;
  const c = cond as Clause;
  if (Array.isArray(c.terms)) {
    const terms = c.terms.filter((t) => t && t.flag);
    if (!terms.length) return false; // condición incompleta: no matchea
    const test = (t: Term) => String(flags[t.flag] ?? '') === String(t.value);
    return c.op === 'or' ? terms.some(test) : terms.every(test);
  }
  const entries = Object.entries(cond as Cond);
  if (!entries.length) return true;
  return entries.every(([k, v]) => String(flags[k] ?? '') === String(v));
}

/* Reemplaza tokens {flag} por el valor actual de la flag. Un token cuya flag
   no existe se deja tal cual (no rompe llaves usadas como texto). */
export function interpolate(text: string, flags: Flags): string {
  return text.replace(/\{(\w+)\}/g, (m, name) => (name in flags ? flags[name] : m));
}

/* ── Texto enriquecido (efectos inline) ──────────────────────────────────
   Sintaxis:
     {{600}}                 pausa de 600ms en el tipeo (alias: {{beat}}, {{pause}})
     [[wave accent]]X[[/]]   X con onda y color; tokens = efectos + un color
     \n                      salto de línea (también vale un salto real)
   Colores: nombres de paleta o hex (#rrggbb). */
const RICH_COLORS: Record<string, string> = {
  accent: 'var(--color-accent)',
  cyan: 'var(--color-accent-2)',
  muted: 'var(--color-text-muted)',
  text: 'var(--color-text)',
};
const PAUSE_ALIASES: Record<string, number> = { beat: 400, pause: 900 };

function richColor(tok: string): string | null {
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(tok)) return tok;
  return RICH_COLORS[tok] ?? null;
}

export type RichChar = { ch: string; wave: boolean; color: string | null };
/* `chars`: caracteres visibles con su estilo. `pauses[n]`: ms a esperar
   después de revelar n caracteres. */
export type Rich = { chars: RichChar[]; pauses: Record<number, number> };

export function parseRich(raw: string): Rich {
  const chars: RichChar[] = [];
  const pauses: Record<number, number> = {};
  let wave = false;
  let color: string | null = null;
  let i = 0;
  while (i < raw.length) {
    if (raw.startsWith('[[/]]', i)) { wave = false; color = null; i += 5; continue; }
    if (raw.startsWith('[[', i)) {
      const end = raw.indexOf(']]', i + 2);
      if (end !== -1) {
        for (const t of raw.slice(i + 2, end).trim().split(/\s+/)) {
          if (t === 'wave') wave = true;
          else { const c = richColor(t); if (c) color = c; }
        }
        i = end + 2;
        continue;
      }
    }
    if (raw.startsWith('{{', i)) {
      const end = raw.indexOf('}}', i + 2);
      if (end !== -1) {
        const body = raw.slice(i + 2, end).trim();
        const ms = PAUSE_ALIASES[body] ?? parseInt(body, 10);
        if (ms > 0) pauses[chars.length] = (pauses[chars.length] ?? 0) + ms;
        i = end + 2;
        continue;
      }
    }
    /* Salto de línea: el `\n` literal que se escribe en el texto. (Un salto
       real ya entra como '\n' por el caso de abajo.) Se marca como char '\n'
       y el render lo convierte en <br>. */
    if (raw.startsWith('\\n', i)) {
      chars.push({ ch: '\n', wave, color });
      i += 2;
      continue;
    }
    chars.push({ ch: raw[i], wave, color });
    i += 1;
  }
  return { chars, pauses };
}

/* Resuelve el texto efectivo del step según las flags (variante + interpolación). */
export function resolveText(text: Text | undefined, flags: Flags): string {
  let out = '';
  if (text) {
    if (typeof text === 'string') out = text;
    else {
      const val = flags[text.on];
      out = val != null && text.cases[val] != null ? text.cases[val] : text.default ?? '';
    }
  }
  return interpolate(out, flags);
}

/* Opciones visibles para las flags actuales. */
export function visibleOptions(step: Step, flags: Flags): Option[] {
  return (step.options ?? []).filter((o) => matches(o.when, flags));
}

/* Destino efectivo de un `next` (id fijo o reglas condicionales). */
export function resolveNext(next: Next | undefined, flags: Flags): string | null {
  if (next == null) return null;
  if (typeof next === 'string') return next || null;
  /* Las reglas con `when` se evalúan en orden (primera que se cumple gana). La
     regla sin `when` es el "por defecto" y se usa sólo si ninguna se cumple,
     sin importar en qué posición esté. */
  let fallback: string | null = null;
  let hasFallback = false;
  for (const rule of next) {
    if (rule.when == null) {
      if (!hasFallback) { fallback = rule.go ?? null; hasFallback = true; }
      continue;
    }
    if (matches(rule.when, flags)) return rule.go ?? null;
  }
  return fallback;
}

/* Genera un id de step no usado ("paso-N"). */
export function nextStepId(steps: Record<string, Step>): string {
  let n = Object.keys(steps).length + 1;
  let id = `paso-${n}`;
  while (steps[id]) {
    n += 1;
    id = `paso-${n}`;
  }
  return id;
}

/* Validación liviana: ¿esto parece un guion? (se usa al importar/parsear). */
export function looksLikeScript(value: unknown): value is Script {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as Script).start === 'string' &&
    !!(value as Script).steps &&
    typeof (value as Script).steps === 'object'
  );
}
