// Bitácora de operaciones guardadas SIN CONEXIÓN en este dispositivo.
//
// Cuando no hay internet, Firestore guarda la operación en el equipo y la
// envía al reconectar. Si el servidor la rechaza (licencia vencida, cajero
// desactivado, un turno que ya no existe...), Firestore la descarta: la venta
// desaparece y antes solo quedaba un mensaje en la consola.
//
// Esta bitácora anota cada operación sin conexión ANTES de enviarla:
//  - si el servidor la acepta, se borra;
//  - si la rechaza, queda marcada como "rechazada" con todos sus datos, para
//    avisar al usuario y poder reintentarla o al menos no perderla.
// También cubre el caso en que la página se cerró antes de recibir la
// respuesta: al reconectar se comprueba en el servidor si el documento quedó
// guardado.
//
// Se guarda en localStorage con una clave por empresa (no se mezcla entre
// empresas que usen el mismo equipo). Este módulo no usa Firebase para poder
// probarlo sin conexión.

export type JournalKind =
  | 'venta'
  | 'devolucion'
  | 'compra'
  | 'transferencia'
  | 'ajuste'
  | 'gasto'
  | 'abono_cliente'
  | 'pago_proveedor';

export interface JournalCheck {
  // Ruta dentro de la empresa, por ejemplo "sales/sale_123".
  collection: string;
  docId: string;
  // 'exists': la operación quedó guardada si el documento existe.
  // 'missing': la operación (un borrado) quedó guardada si NO existe.
  expect: 'exists' | 'missing';
}

export interface JournalEntry {
  id: string;
  kind: JournalKind;
  title: string;        // "Venta Q35.00 · Norte"
  detail: string;       // productos, cliente, etc.
  amount?: number;
  branch?: string;
  createdAt: string;    // ISO
  status: 'pending' | 'rejected';
  reason?: string;      // motivo del rechazo, en palabras del sistema
  rejectedAt?: string;
  check?: JournalCheck; // sin check: solo se detecta el rechazo con la página abierta
  retry?: any;          // datos para reintentar (solo ventas y devoluciones)
}

export const JOURNAL_BASE_KEY = 'yaa_pos_offline_journal';
export const JOURNAL_EVENT = 'yaa_pos_offline_journal_updated';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const MAX_ENTRIES = 500;

function defaultStore(): KeyValueStore | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function readJournal(key: string, store: KeyValueStore | null = defaultStore()): JournalEntry[] {
  if (!store) return [];
  try {
    const raw = store.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(e => e && typeof e.id === 'string') : [];
  } catch {
    return [];
  }
}

function writeJournal(key: string, list: JournalEntry[], store: KeyValueStore | null): void {
  if (!store) return;
  // Nunca se recortan las rechazadas: son operaciones que el usuario debe ver.
  let trimmed = list;
  if (list.length > MAX_ENTRIES) {
    const rejected = list.filter(e => e.status === 'rejected');
    const pending = list.filter(e => e.status !== 'rejected');
    trimmed = [...rejected, ...pending.slice(-Math.max(0, MAX_ENTRIES - rejected.length))];
  }
  try {
    store.setItem(key, JSON.stringify(trimmed));
  } catch (err) {
    console.error('[Yaa POS] No se pudo guardar la bitácora de operaciones sin conexión:', err);
  }
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(JOURNAL_EVENT));
  } catch {}
}

export function addPending(
  key: string,
  entry: Omit<JournalEntry, 'status' | 'createdAt'> & { createdAt?: string },
  store: KeyValueStore | null = defaultStore(),
): void {
  const list = readJournal(key, store).filter(e => e.id !== entry.id);
  list.push({ ...entry, createdAt: entry.createdAt || new Date().toISOString(), status: 'pending' });
  writeJournal(key, list, store);
}

// El servidor aceptó la operación: se quita de la bitácora (si no estaba
// marcada como rechazada por otra vía).
export function markSynced(key: string, id: string, store: KeyValueStore | null = defaultStore()): void {
  const list = readJournal(key, store);
  const next = list.filter(e => !(e.id === id && e.status === 'pending'));
  if (next.length !== list.length) writeJournal(key, next, store);
}

export function markRejected(key: string, id: string, reason: string, store: KeyValueStore | null = defaultStore()): void {
  const list = readJournal(key, store);
  let changed = false;
  const next = list.map(e => {
    if (e.id !== id || e.status === 'rejected') return e;
    changed = true;
    return { ...e, status: 'rejected' as const, reason: reason.slice(0, 500), rejectedAt: new Date().toISOString() };
  });
  if (changed) writeJournal(key, next, store);
}

// Quita una operación de la bitácora (el usuario la descartó o se reintentó con éxito).
export function removeEntry(key: string, id: string, store: KeyValueStore | null = defaultStore()): void {
  const list = readJournal(key, store);
  const next = list.filter(e => e.id !== id);
  if (next.length !== list.length) writeJournal(key, next, store);
}

export function rejectedEntries(key: string, store: KeyValueStore | null = defaultStore()): JournalEntry[] {
  return readJournal(key, store).filter(e => e.status === 'rejected');
}

// Explica el error de Firestore en palabras del negocio.
export function describeRejection(err: any): string {
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || err || '');
  if (code.includes('permission-denied') || /permission/i.test(msg)) {
    return 'El servidor no lo permitió: la licencia puede estar vencida, la cuenta o el cajero desactivados, o no tiene permiso para esa sucursal.';
  }
  if (code.includes('not-found') || /not.?found|no entity/i.test(msg)) {
    return 'Un registro relacionado ya no existe en el servidor (por ejemplo, el turno de caja fue cerrado o borrado).';
  }
  if (code.includes('invalid-argument') || code.includes('failed-precondition')) {
    return 'El servidor rechazó los datos de la operación.';
  }
  return `El servidor rechazó la operación${msg ? `: ${msg.slice(0, 200)}` : '.'}`;
}
