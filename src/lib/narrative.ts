/* Flags acumuladas durante la partida (siempre strings; los booleanos se
   guardan como "true"/"false" y se comparan por string). */
export type Flags = Record<string, string>;

/* Condición: todas las claves deben coincidir con las flags actuales. */
export type Cond = Record<string, string>;

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
  /* La opción sólo se muestra cuando matchea (opciones condicionales). */
  when?: Cond;
};

/* `next` puede ser un id fijo o una lista de reglas: la primera que matchea
   gana; una regla sin `when` es el fallback. */
export type NextRule = { when?: Cond; go: string | null };
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
};

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

/* ¿La condición se cumple con las flags actuales? Sin condición = siempre. */
export function matches(cond: Cond | undefined, flags: Flags): boolean {
  if (!cond) return true;
  return Object.entries(cond).every(
    ([k, v]) => String(flags[k] ?? '') === String(v),
  );
}

/* Reemplaza tokens {flag} por el valor actual de la flag. Un token cuya flag
   no existe se deja tal cual (no rompe llaves usadas como texto). */
export function interpolate(text: string, flags: Flags): string {
  return text.replace(/\{(\w+)\}/g, (m, name) => (name in flags ? flags[name] : m));
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
  for (const rule of next) if (matches(rule.when, flags)) return rule.go ?? null;
  return null;
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
