'use client';

import React, { createContext, useContext, ReactNode, useRef, useEffect, useMemo } from 'react';
import { useWebSocketData } from '@/lib/hooks/useWebSocketData';
import { CryptoCard as CryptoCardType } from '@/lib/api/types';

export const dynamic = 'force-dynamic';

// Обновляем типы для контекста
interface WebSocketContextType {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  cards: CryptoCardType[];
  error: string | null;
  reconnect: () => void;
  disconnect: () => void;
  updateCard: (token: string, updates: Partial<CryptoCardType>) => void; // Новая функция
}

// Создаем контекст с начальными значениями
const WebSocketContext = createContext<WebSocketContextType>({
  status: 'disconnected',
  cards: [],
  error: null,
  reconnect: () => {},
  disconnect: () => {},
  updateCard: () => {}, // Добавляем пустую функцию
});

// Хук для использования WebSocket контекста
export const useWebSocket = () => useContext(WebSocketContext);

// Провайдер для WebSocket
interface WebSocketProviderProps {
  children: ReactNode;
  url?: string;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ 
  children,
  url = 'wss://whales.trace.foundation/api/stream' 
}) => {
  console.log('[WebSocketContext] Инициализация провайдера');
  
  // Используем хук для получения данных
  const [status, cards, error, { reconnect, disconnect }, updateCard] = useWebSocketData(url);
  
  // Оптимизируем обновление с использованием useCallback и useMemo
  const contextValue = useMemo(() => ({
    status,
    cards,
    error,
    reconnect,
    disconnect,
    updateCard,
  }), [status, cards, error, reconnect, disconnect, updateCard]);
  
  // Логируем состояние при изменении, но используем для этого ref
  // чтобы не вызывать лишние ререндеры
  const prevCardsCountRef = useRef(cards.length);
  useEffect(() => {
    const currentCount = cards.length;
    if (currentCount !== prevCardsCountRef.current) {
      console.log(`[WebSocketContext] Обновление числа карточек: ${prevCardsCountRef.current} -> ${currentCount}`);
      prevCardsCountRef.current = currentCount;
    }
  }, [cards.length]);
  
  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};
