import { useState, useCallback, useEffect, useRef } from 'react';
import { generateUpdateId } from '../utils';

/**
 * Хук для принудительного обновления компонента
 * @returns [updateId, forceUpdate] - текущий идентификатор обновления и функция для принудительного обновления
 */
export function useForceUpdate(): [string, () => void] {
  const [updateId, setUpdateId] = useState(generateUpdateId());
  

  const forceUpdate = useCallback(() => {
    setUpdateId(generateUpdateId());
  }, []);
  
  return [updateId, forceUpdate];
}

/**
 * Создает дебаунсированную функцию, которая выполняется не чаще чем раз в delay миллисекунд
 * @param fn - функция для дебаунсинга
 * @param delay - задержка в миллисекундах
 * @returns дебаунсированная функция
 */
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

/**
 * Хук для отслеживания изменений в объекте данных
 * @param data - объект данных для отслеживания
 * @returns [trackedData, forceUpdate] - отслеживаемые данные с идентификатором обновления и функция принудительного обновления
 */
export function useTrackedData<T>(data: T | null): [T & { _updateId: string } | null, () => void] {
  const [trackId, setTrackId] = useState<string>(generateUpdateId());
  
  // Храним данные и идентификатор в ref, чтобы избежать лишних обновлений
  const dataRef = useRef<{ data: T | null, trackId: string }>({
    data,
    trackId
  });
  
  // Функция принудительного обновления
  const forceUpdate = useCallback(() => {
    setTrackId(generateUpdateId());
  }, []);
  
  // Если данных нет, возвращаем null
  if (!data) {
    return [null, forceUpdate];
  }
  
  const trackedData = { ...data, _updateId: trackId } as T & { _updateId: string };
  
  dataRef.current = { data, trackId };
  
  return [trackedData, forceUpdate];
} 