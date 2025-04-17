import { useState, useEffect } from 'react';

/**
 * Хук для отслеживания времени последней активности
 * @returns [lastActivity, updateLastActivity] - строка с временем последней активности и функция для обновления
 */
export function useLastActivity(): [string | null, () => void] {
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  
  // Функция для обновления времени последней активности
  const updateLastActivity = () => {
    const now = new Date();
    // Форматируем время в читаемый формат
    const formattedTime = now.toLocaleTimeString();
    setLastActivity(formattedTime);
  };
  
  // При первом монтировании компонента устанавливаем время
  useEffect(() => {
    updateLastActivity();
  }, []);
  
  return [lastActivity, updateLastActivity];
} 