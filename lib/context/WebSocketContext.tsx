'use client';

import React, { createContext, useContext, ReactNode, useRef, useEffect, useMemo } from 'react';
import { useWebSocketData } from '@/lib/hooks/useWebSocketData';
import { CryptoCard as CryptoCardType } from '@/lib/api/types';
import { useDispatch } from 'react-redux';
import { addCard as addCardAction, updateCard as updateCardAction } from '@/lib/store/cardsSlice';
import { webSocketClient } from '@/lib/api/api-general';

export const dynamic = 'force-dynamic';

interface WebSocketContextType {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  cards: CryptoCardType[];
  error: string | null;
  reconnect: () => void;
  disconnect: () => void;
  updateCard: (token: string, updates: Partial<CryptoCardType>) => void; 
}


const WebSocketContext = createContext<WebSocketContextType>({
  status: 'disconnected',
  cards: [],
  error: null,
  reconnect: () => {},
  disconnect: () => {},
  updateCard: () => {}, 
});


export const useWebSocket = () => useContext(WebSocketContext);


interface WebSocketProviderProps {
  children: ReactNode;
  url?: string;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ 
  children,
  url = 'wss://whales.trace.foundation/api/stream' 
}) => {
  console.log('[WebSocketContext] Инициализация провайдера');
  
  const dispatch = useDispatch();

  const [status, cards, error, { reconnect, disconnect }, updateCard] = useWebSocketData(url);
  

  const contextValue = useMemo(() => ({
    status,
    cards,
    error,
    reconnect,
    disconnect,
    updateCard,
  }), [status, cards, error, reconnect, disconnect, updateCard]);
  
  
  const prevCardsCountRef = useRef(cards.length);
  useEffect(() => {
    const currentCount = cards.length;
    if (currentCount !== prevCardsCountRef.current) {
      console.log(`[WebSocketContext] Обновление числа карточек: ${prevCardsCountRef.current} -> ${currentCount}`);
      prevCardsCountRef.current = currentCount;
    }
  }, [cards.length]);

  useEffect(() => {
    webSocketClient.onNewSignal((data) => {
      dispatch(addCardAction(data));
    });

    webSocketClient.onUpdateSignal((token, updates) => {
      dispatch(updateCardAction({ token, updates }));
    });
  }, [dispatch]);
  
  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};
