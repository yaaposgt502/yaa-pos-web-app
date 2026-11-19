// Records of a date range for reports.
// The live listeners keep only the most recent records (api.LIVE_LIMITS).
// - If the company has fewer records than that limit, the live list already
//   has everything: no extra reads.
// - If the live list reaches back to the start of the range, it is enough.
// - Otherwise the range is read from Firestore page by page and merged with
//   the live list (which wins, because it is updated in real time).
import { useEffect, useMemo, useState } from 'react';
import * as api from '../api';
import { parseSafeDate } from './dateHelper';
import { liveCoversRange, toRangeIso } from './rangeMath';

export { liveCoversRange, toRangeIso };

type Rec = { id: string; date: string };

const CACHE_TTL_MS = 60_000;
const memo = new Map<string, { at: number; items: any[]; truncated: boolean; fromCache: boolean }>();

export interface RangeDataResult<T> {
  items: T[];
  loading: boolean;
  truncated: boolean;     // the range had more records than could be read
  fromCache: boolean;     // read offline from this device's cache (may be incomplete)
  usedServer: boolean;    // the live list was not enough and the range was queried
  error: string | null;
}

export function useRangeData<T extends Rec>(
  col: api.RangeCollection,
  live: T[],
  startDate: string,
  endDate: string
): RangeDataResult<T> {
  const { fromIso, toIso } = toRangeIso(startDate, endDate);
  const limitCount = api.LIVE_LIMITS[col];
  const covers = useMemo(
    () => liveCoversRange(live.map(x => x.date), limitCount, fromIso),
    [live, limitCount, fromIso]
  );
  const key = `${api.getToken() || ''}|${col}|${fromIso || ''}|${toIso || ''}`;
  const [state, setState] = useState<{ key: string; items: T[]; truncated: boolean; fromCache: boolean; loading: boolean; error: string | null }>(
    { key: '', items: [], truncated: false, fromCache: false, loading: false, error: null }
  );

  useEffect(() => {
    if (covers) return;
    const cached = memo.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      setState({ key, items: cached.items as T[], truncated: cached.truncated, fromCache: cached.fromCache, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState(prev => ({ ...prev, key, loading: true, error: null }));
    api.fetchCollectionInRange<T>(col, fromIso, toIso)
      .then(r => {
        memo.set(key, { at: Date.now(), ...r });
        if (!cancelled) setState({ key, items: r.items, truncated: r.truncated, fromCache: r.fromCache, loading: false, error: null });
      })
      .catch(err => {
        console.error(`[Yaa POS] No se pudo leer ${col} del período:`, err);
        if (!cancelled) setState({ key, items: [], truncated: false, fromCache: false, loading: false, error: 'No se pudieron cargar todos los registros del período.' });
      });
    return () => { cancelled = true; };
  }, [covers, key, col, fromIso, toIso]);

  const items = useMemo(() => {
    if (covers || state.key !== key) return live;
    const byId = new Map<string, T>();
    for (const x of state.items) byId.set(x.id, x);
    for (const x of live) byId.set(x.id, x);
    return [...byId.values()].sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());
  }, [covers, state, key, live]);

  return {
    items,
    loading: !covers && (state.key !== key || state.loading),
    truncated: !covers && state.truncated,
    fromCache: !covers && state.fromCache,
    usedServer: !covers,
    error: covers ? null : state.error,
  };
}
