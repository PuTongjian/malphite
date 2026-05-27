import { useEffect, useState } from "react";
import type { LiveState } from "./live-state";

export function useLiveState<T>(state: LiveState<T>) {
  const [value, setValue] = useState(state.value);

  useEffect(() => {
    return state.subscribe(setValue);
  }, [state]);

  return value;
}
