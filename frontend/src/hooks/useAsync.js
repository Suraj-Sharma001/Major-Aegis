import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../services/api';

// Loads data on mount (and whenever deps change). Returns { data, loading, error, reload }.
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const alive = useRef(true);

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      if (alive.current) setState({ data, loading: false, error: null });
    } catch (err) {
      if (alive.current) setState({ data: null, loading: false, error: errorMessage(err) });
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    run();
    return () => { alive.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: run };
}
