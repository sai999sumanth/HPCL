import { useCallback, useRef, useState } from "react";

/**
 * Tracks overlapping async work (e.g. ag-grid infinite datasource fetches).
 * `isLoading` stays true until every `begin()` has been paired with `end()`.
 */
export function useInFlightLoading() {
  const [isLoading, setIsLoading] = useState(false);
  const inFlightRef = useRef(0);

  const begin = useCallback(() => {
    inFlightRef.current += 1;
    setIsLoading(true);
  }, []);

  const end = useCallback(() => {
    inFlightRef.current = Math.max(0, inFlightRef.current - 1);
    if (inFlightRef.current === 0) {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, begin, end };
}
