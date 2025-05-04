import { useState, useCallback, useEffect, useRef } from 'react';
import { generateUpdateId } from '../utils';

export function useForceUpdate(): [string, () => void] {
  const [updateId, setUpdateId] = useState(generateUpdateId());


  const forceUpdate = useCallback(() => {
    setUpdateId(generateUpdateId());
  }, []);

  return [updateId, forceUpdate];
}

export function useDebounce<T extends (...args: void[]) => void>(
  fn: T,
  delay = 300
): T {
  const timeoutRef = useRef<number | null>(null);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        fnRef.current(...args);
        timeoutRef.current = null;
      }, delay);
    },
    [delay]
  ) as T;
}

export function useTrackedData<T>(data: T | null): [T & { _updateId: string } | null, () => void] {
  const [trackId, setTrackId] = useState<string>(generateUpdateId());
  const dataRef = useRef<{ data: T | null, trackId: string }>({
    data,
    trackId
  });

  const forceUpdate = useCallback(() => {
    setTrackId(generateUpdateId());
  }, []);

  if (!data) {
    return [null, forceUpdate];
  }
  const trackedData = { ...data, _updateId: trackId } as T & { _updateId: string };
  dataRef.current = { data, trackId };
  return [trackedData, forceUpdate];
} 