

export type Option = { label: string; next: string | null };
export type Step = { text: string; next?: string | null; options?: Option[] };
export type Script = { start: string; steps: Record<string, Step> };

/* Las tres formas de salida que un step puede tener. */
export type StepKind = 'next' | 'choice' | 'end';


export function stepKind(step: Step): StepKind {
  if (Array.isArray(step.options)) return 'choice';
  if (step.next !== undefined && step.next !== null) return 'next';
  return 'end';
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
