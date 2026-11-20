import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RotateCw, Trash2, X } from 'lucide-react';
import * as api from '../api';
import { JOURNAL_EVENT } from '../utils/offlineJournal';
import type { JournalEntry } from '../utils/offlineJournal';
import { formatDisplayDateTime } from '../utils/dateHelper';

// Aviso visible cuando el servidor rechazó operaciones que se guardaron sin
// conexión en este dispositivo. Antes, esas ventas desaparecían sin avisar.
export default function RejectedOpsNotice({ isOnline }: { isOnline: boolean }) {
  const [items, setItems] = useState<JournalEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const refresh = useCallback(() => {
    setItems(api.getRejectedOperations());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(JOURNAL_EVENT, refresh);
    window.addEventListener('storage', refresh); // otras pestañas
    return () => {
      window.removeEventListener(JOURNAL_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  // Comprueba en el servidor las operaciones que quedaron sin respuesta
  // (página cerrada o recargada mientras se enviaban).
  useEffect(() => {
    if (!isOnline) return;
    const run = () => { api.reconcileOfflineJournal().catch(() => {}); };
    const first = setTimeout(run, 5000);
    const every = setInterval(run, 60000);
    return () => { clearTimeout(first); clearInterval(every); };
  }, [isOnline]);

  // Keep the window open after the last retry so its result can be read.
  if (items.length === 0 && !open) return null;

  const retry = async (entry: JournalEntry) => {
    setBusyId(entry.id);
    setMessage(null);
    try {
      const r = await api.retryRejectedSale(entry.id);
      setMessage(r.alreadyRegistered
        ? { type: 'ok', text: 'La venta ya estaba registrada en el servidor. Se quitó de la lista.' }
        : r.pendingSync
          ? { type: 'ok', text: 'Se perdió la conexión: la venta quedó guardada en el equipo y se enviará al reconectar.' }
          : { type: 'ok', text: 'Venta registrada correctamente en el servidor.' });
      refresh();
    } catch (err: any) {
      setMessage({ type: 'error', text: `No se pudo registrar: ${err?.message || err}` });
    } finally {
      setBusyId(null);
    }
  };

  const discard = (entry: JournalEntry) => {
    const ok = window.confirm(
      `¿Descartar "${entry.title}"?\n\n` +
      'Esta operación NO está en el servidor. Si la descarta, se borra también de este equipo y no se podrá recuperar. ' +
      'Anote los datos antes si los necesita.'
    );
    if (!ok) return;
    api.discardRejectedOperation(entry.id);
    refresh();
  };

  return (
    <>
      {items.length > 0 && <div
        role="alert"
        className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-800"
      >
        <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
        <div className="flex-1 text-sm">
          <p className="font-bold">
            {items.length === 1
              ? '1 operación guardada sin conexión NO se registró en el servidor.'
              : `${items.length} operaciones guardadas sin conexión NO se registraron en el servidor.`}
          </p>
          <p className="text-xs text-red-700">
            Sus datos se conservan en este equipo. Revíselas para reintentarlas o anotarlas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setMessage(null); setOpen(true); }}
          className="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 cursor-pointer"
        >
          Revisar
        </button>
      </div>}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-3" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-xl bg-white shadow-xl"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="Operaciones no registradas"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
              <h2 className="text-sm font-bold text-slate-800">Operaciones no registradas en el servidor</h2>
              <button type="button" onClick={() => setOpen(false)} className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>

            {message && (
              <div className={`mx-5 mt-4 rounded-lg px-3 py-2 text-xs font-medium ${message.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                {message.text}
              </div>
            )}

            {items.length === 0 && (
              <p className="px-5 py-4 text-sm text-slate-600">No quedan operaciones pendientes de revisar.</p>
            )}
            <ul className="divide-y divide-slate-100 px-5 py-2">
              {items.map(entry => (
                <li key={entry.id} className="py-3">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800">{entry.title}</p>
                      {entry.detail && <p className="text-xs text-slate-600 break-words">{entry.detail}</p>}
                      <p className="mt-1 text-[11px] text-slate-500">
                        Hecha: {formatDisplayDateTime(entry.createdAt)}
                        {entry.retry?.sale?.id ? ` · ID ${entry.retry.sale.id}` : ''}
                      </p>
                      {entry.reason && <p className="mt-1 text-xs text-red-700">{entry.reason}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {entry.retry?.sale && (
                        <button
                          type="button"
                          disabled={!!busyId || !isOnline}
                          onClick={() => retry(entry)}
                          title={isOnline ? 'Registrar de nuevo con el stock actual del servidor' : 'Necesita conexión'}
                          className="flex items-center gap-1 rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                        >
                          <RotateCw className={`w-3.5 h-3.5 ${busyId === entry.id ? 'animate-spin' : ''}`} />
                          Reintentar
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!!busyId}
                        onClick={() => discard(entry)}
                        className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Descartar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">
              Reintentar una venta la registra con el stock actual del servidor y nunca la duplica. Si el motivo fue la licencia o un cajero desactivado, primero resuelva eso con el administrador.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
