/**
 * Global store for passing MediaStream between pages
 * without stopping and re-acquiring it.
 */
let _stream: MediaStream | null = null;

export function stashStream(stream: MediaStream) {
  _stream = stream;
}

export function takeStream(): MediaStream | null {
  const s = _stream;
  _stream = null;
  return s;
}
