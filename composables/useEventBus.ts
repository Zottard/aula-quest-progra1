// Bus de eventos mínimo para disparar efectos visuales (confetti, shake, modal)
// desde cualquier componente sin acoplarlos entre sí.
type Handler = (payload?: any) => void;

const listeners = new Map<string, Set<Handler>>();

function on(event: string, handler: Handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(handler);
}

function off(event: string, handler: Handler) {
  listeners.get(event)?.delete(handler);
}

function emit(event: string, payload?: any) {
  listeners.get(event)?.forEach((h) => h(payload));
}

export function useEventBus() {
  return { on, off, emit };
}
