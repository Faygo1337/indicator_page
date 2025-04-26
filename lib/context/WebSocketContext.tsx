'use client';

import React, { createContext, useContext, ReactNode, useRef, useEffect, useMemo } from 'react';
import { useWebSocketData } from '@/lib/hooks/useWebSocketData';
import { CryptoCard as CryptoCardType } from '@/lib/api/types';

export const dynamic = 'force-dynamic';

interface WebSocketContextType {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  cards: CryptoCardType[];
  error: string | null;
  reconnect: () => void;
  disconnect: () => void;
  updateCard: (token: string, updates: Partial<CryptoCardType>) => void; 
  forceRefresh: () => void;
}


const WebSocketContext = createContext<WebSocketContextType>({
  status: 'disconnected',
  cards: [],
  error: null,
  reconnect: () => {},
  disconnect: () => {},
  updateCard: () => {},
  forceRefresh: () => {},
});


export const useWebSocket = () => useContext(WebSocketContext);


interface WebSocketProviderProps {
  children: ReactNode;
  url?: string;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ 
  children,
  // url = 'wss://whales.trace.foundation/api/stream' 
}) => {
  // Проверяем, что мы в браузерном окружении
  if (typeof window === 'undefined') {
    return <>{children}</>;
  }

  console.log('[WebSocketContext] Инициализация провайдера');
  
  const updateCountRef = useRef(0);
  
  const [refreshCounter, setRefreshCounter] = React.useState(0);
  const forceRefresh = React.useCallback(() => {
    updateCountRef.current++;
    console.log(`[WebSocketContext] Принудительное обновление #${updateCountRef.current}`);
    setRefreshCounter(prev => prev + 1);
  }, []);

  const [status, cards, error, { reconnect, disconnect }, updateCard] = useWebSocketData();

  const contextValue = useMemo(() => ({
    status,
    cards,
    error,
    reconnect,
    disconnect,
    updateCard,
    forceRefresh,
  }), [status, cards, error, reconnect, disconnect, updateCard, forceRefresh]);
  
  
  const prevCardsCountRef = useRef(cards.length);
  useEffect(() => {
    const currentCount = cards.length;
    if (currentCount !== prevCardsCountRef.current) {
      console.log(`[WebSocketContext] Обновление числа карточек: ${prevCardsCountRef.current} -> ${currentCount}`);
      prevCardsCountRef.current = currentCount;
    }
  }, [cards.length]);
  
  useEffect(() => {
    console.log(`[WebSocketContext] Текущее состояние: ${status}, карточек: ${cards.length}`);
    
    if (cards.length > 0) {
      cards.forEach(card => {
        console.log(`[WebSocketContext] Карточка ${card.id}: marketCap=${card.marketCap}`);
      });
    }
  }, [cards, status, refreshCounter]);
  
  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};
