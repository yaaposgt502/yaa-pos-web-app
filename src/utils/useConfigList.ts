// A list stored in the company's configuration in Firestore (shared by every
// device and isolated per company). Replaces lists that older versions kept
// only in localStorage, without any company separation.
//
// Isolation guarantee for the old data:
// - A list saved under THIS company's key (`<key>__<uid>`) belongs to it and
//   is imported automatically.
// - A list under the old SHARED key (`<key>`) may have been written by any
//   company that used this browser, so it is never shown nor imported on its
//   own: the owner sees its content and confirms. If they decline, it is left
//   untouched (it may belong to another company) and not offered again to
//   this company. Operators are never asked.
import { useEffect, useRef, useState } from 'react';
import * as api from '../api';
import type { AppConfig } from '../types';

type ListField = 'combos' | 'services' | 'promos' | 'laboratories';

const FIELD_LABEL: Record<ListField, string> = {
  combos: 'combos',
  services: 'servicios',
  promos: 'promociones',
  laboratories: 'laboratorios',
};

function parseList<T>(raw: string | null): T[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function itemLabel(item: any): string {
  if (typeof item === 'string') return item;
  return String(item?.name || item?.code || item?.id || '—');
}

export function useConfigList<T>(
  config: AppConfig,
  field: ListField,
  legacyKey: string,
  defaults: T[] = [],
  options: { canImport?: boolean } = {}
): [T[], (next: T[]) => void] {
  const configValue = (config as any)[field] as T[] | undefined;
  const ownKey = api.tenantStorageKey(legacyKey);
  const [list, setList] = useState<T[]>(() =>
    Array.isArray(configValue) ? configValue : parseList<T>(localStorage.getItem(ownKey)) ?? defaults
  );
  const lastSynced = useRef<string>(JSON.stringify(list));

  // Server → screen: another device (or tab) changed the list.
  useEffect(() => {
    if (!Array.isArray(configValue)) return;
    const json = JSON.stringify(configValue);
    if (json !== lastSynced.current) {
      lastSynced.current = json;
      setList(configValue);
    }
  }, [configValue]);

  // One-time import of what older versions saved in this browser.
  useEffect(() => {
    if (!options.canImport) return;
    const uid = api.getToken();
    if (!uid) return;
    let cancelled = false;
    (async () => {
      const own = parseList<T>(localStorage.getItem(ownKey));
      const declinedKey = `${legacyKey}__declined__${uid}`;
      const shared = localStorage.getItem(declinedKey) ? null : parseList<T>(localStorage.getItem(legacyKey));
      if (!own && !shared) return;

      const onServer = await api.getConfigListFromServer(field);
      if (cancelled || onServer === 'unknown' || Array.isArray(onServer)) return;

      if (own) {
        await api.importLegacyConfigList(field, own).catch(() => false);
        return;
      }
      if (!shared) return;
      const preview = shared.slice(0, 8).map(i => `• ${itemLabel(i)}`).join('\n');
      const more = shared.length > 8 ? `\n… y ${shared.length - 8} más` : '';
      const accept = window.confirm(
        `Este navegador conserva una lista de ${FIELD_LABEL[field]} (${shared.length}) creada con una versión anterior ` +
        `de Yaa POS, que no indica a qué empresa pertenece:\n\n${preview}${more}\n\n` +
        `¿Es de ESTA empresa? Acepte solo si la reconoce. Si cancela, la lista no se borra ni se vuelve a ofrecer a esta empresa.`
      );
      if (cancelled) return;
      if (!accept) {
        try { localStorage.setItem(declinedKey, '1'); } catch {}
        return;
      }
      const imported = await api.importLegacyConfigList(field, shared).catch(() => false);
      if (imported) {
        try {
          // The data now belongs to this company: keep a copy under its key and
          // remove the shared copy so no other company is offered it.
          localStorage.setItem(ownKey, JSON.stringify(shared));
          localStorage.removeItem(legacyKey);
        } catch {}
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.canImport]);

  const update = (next: T[]) => {
    setList(next);
    lastSynced.current = JSON.stringify(next);
    api.updateConfigFields({ [field]: next } as Partial<AppConfig>)
      .catch(err => console.error(`[Yaa POS] Error al guardar ${field}:`, err));
  };

  return [list, update];
}
