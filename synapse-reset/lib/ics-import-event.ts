import type { ParsedICSEvent } from "./ics-parser";

type ImportListener = (event: ParsedICSEvent) => void;

let _listener: ImportListener | null = null;
let _pending: ParsedICSEvent | null = null;

export function subscribeICSImport(listener: ImportListener): () => void {
  _listener = listener;
  if (_pending) {
    const pending = _pending;
    _pending = null;
    queueMicrotask(() => listener(pending));
  }
  return () => {
    if (_listener === listener) _listener = null;
  };
}

export function fireICSImport(event: ParsedICSEvent): void {
  if (_listener) {
    _listener(event);
  } else {
    _pending = event;
  }
}
