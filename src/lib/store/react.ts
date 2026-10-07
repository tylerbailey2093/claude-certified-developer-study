// React binding: re-renders when the key changes on this page or in another tab.
import { useSyncExternalStore } from 'react';
import { snapshot, subscribe } from './storage';
import { DEFAULTS, type StoreShape } from './schema';

export function useStore<K extends keyof StoreShape>(key: K): StoreShape[K] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot(key, DEFAULTS[key]),
    () => DEFAULTS[key]
  );
}

/** True after hydration. Use to avoid rendering localStorage-derived UI on the server pass. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}
