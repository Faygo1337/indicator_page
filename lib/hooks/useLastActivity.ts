import { useState, useEffect } from 'react';

/**
 * Хук для отслеживания времени последней активности
 * @returns [lastActivity, updateLastActivity] - строка с временем последней активности и функция для обновления
 */
export function useLastActivity(): [string | null, () => void] {
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  
  const updateLastActivity = () => {
    const now = new Date();

    const formattedTime = now.toLocaleTimeString();
    setLastActivity(formattedTime);
  };
  

  useEffect(() => {
    updateLastActivity();
  }, []);
  
  return [lastActivity, updateLastActivity];
} 