import { useState, useEffect, useRef, useCallback } from 'react';

// useFetch — runs `loader()` on mount and whenever `deps` change.
// Returns { data, error, loading, refetch }.
export function useFetch(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const aliveRef = useRef(true);

  const run = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await loaderRef.current();
      if (aliveRef.current) setState({ data, error: null, loading: false });
    } catch (err) {
      if (aliveRef.current) setState({ data: null, error: err, loading: false });
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, deps);

  useEffect(() => () => { aliveRef.current = false; }, []);

  return { ...state, refetch: run };
}

// usePolling — useFetch + an interval that re-runs the loader.
// Pauses while the tab is hidden (saves the Pi 5 server CPU when nobody's
// watching) and runs an immediate refetch on visibilitychange → visible.
export function usePolling(loader, intervalMs, deps = []) {
  const fetchState = useFetch(loader, deps);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') fetchState.refetch();
    };
    const timer = setInterval(tick, intervalMs);
    const onVis = () => { if (document.visibilityState === 'visible') fetchState.refetch(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return fetchState;
}
