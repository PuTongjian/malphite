import { useSyncExternalStore } from "react";
import type { LiveData } from "./live-data";

export function useLiveData<T>(liveData: LiveData<T>) {
  return useSyncExternalStore(
    (listener) => liveData.subscribe(listener),
    () => liveData.value,
    () => liveData.value,
  );
}
