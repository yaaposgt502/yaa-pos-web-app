// A list stored in the company's configuration in Firestore (shared by every
// device and isolated per company). Replaces lists that older versions kept
// only in localStorage, without any company separation.
import { useEffect, useRef, useState } from 'react';
import * as api from '../api';
import type { AppConfig } from '../types';

type ListField = 'combos' | 'services' | 'promos' | 'laboratories';

function readLegacy<T>(legacyKey: string): T[] | null {
  try {
    const raw = localStorage.getItem(api.tenantStorageKey(legacyKey)) ?? localStorage.getItem(legacyKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

// After a successful import the shared (unscoped) key is moved under this
// company's key, so another company signing in on this browser cannot
// import it again.
function retireLegacy(legacyKey: string) {
  try {
    const raw = localStorage.getItem(legacyKey);
    if (raw !== null) {
      localStorage.setItem(api.tenantStorageKey(legacyKey), raw);
      localStorage.removeItem(legacyKey);
    }
  } catch {}
}

export function useConfigList<T>(
  config: AppConfig,
  field: ListField,
  legacyKey: string,
  defaults: T[] = []
): [T[], (next: T[]) => void] {
  const configValue = (config as any)[field] as T[] | undefined;
  const hasServerValue = Array.isArray(configValue);
  const [list, setList] = useState<T[]>(() => (hasServerValue ? configValue! : readLegacy<T>(legacyKey) ?? defaults));
  const lastSynced = useRef<string>(JSON.stringify(hasServerValue ? configValue : list));

  // Server → screen: another device (or tab) changed the list.
  useEffect(() => {
    if (!Array.isArray(configValue)) return;
    const json = JSON.stringify(configValue);
    if (json !== lastSynced.current) {
      lastSynced.current = json;
      setList(configValue);
    }
  }, [configValue]);

  // One-time import of what this browser had saved before.
  useEffect(() => {
    if (hasServerValue) return;
    const legacy = readLegacy<T>(legacyKey);
    if (!legacy) return;
    api.importLegacyConfigList(field, legacy)
      .then(imported => { if (imported) retireLegacy(legacyKey); })
      .catch(err => console.warn(`[Yaa POS] No se pudo importar ${field}:`, err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (next: T[]) => {
    setList(next);
    lastSynced.current = JSON.stringify(next);
    api.updateConfigFields({ [field]: next } as Partial<AppConfig>)
      .catch(err => console.error(`[Yaa POS] Error al guardar ${field}:`, err));
  };

  return [list, update];
}
