'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CryptoCard, MarketData, UpdateSignalMessage } from '@/lib/api/types';
import { useRouter } from 'next/navigation';
import { webSocketClient } from '@/lib/api/api-general';
import { formatMarketCap } from '@/lib/utils';

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

type WebSocketControls = {
  reconnect: () => void;
  disconnect: () => void;
};

export type ExtendedCryptoCard = CryptoCard & {
  _lastUpdated?: number;
  _updateId?: string;
  _receivedAt?: number;
};

export function useWebSocketData(url: string): [
  WebSocketStatus, 
  ExtendedCryptoCard[], 
  string | null, 
  WebSocketControls,
  (token: string, updates: Partial<CryptoCard>) => void 
] {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [cards, setCards] = useState<ExtendedCryptoCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  // Максимальное количество карточек
  const MAX_CARDS = 8;
  
  // Функция для обновления карточки
  const updateCard = useCallback((token: string, updates: Partial<CryptoCard>) => {
    setCards(prevCards => {
      return prevCards.map(card => {
        if (card.id === token) {
          return { ...card, ...updates };
        }
        return card;
      });
    });
  }, []);

  const handleNewSignal = useCallback((data: CryptoCard) => {
    setCards(prevCards => {
      const cardExists = prevCards.some(card => card.id === data.id);
      if (cardExists) {
        return prevCards.map(card => card.id === data.id ? { ...card, ...data } : card);
      } else {
        // Добавляем новую карточку в начало и ограничиваем общее количество до MAX_CARDS
        const updatedCards = [data, ...prevCards];
        // Если карточек стало больше MAX_CARDS, оставляем только первые MAX_CARDS
        return updatedCards.slice(0, MAX_CARDS);
      }
    });
    
    router.refresh();
  }, [router]);

  const handleUpdateSignal = useCallback((token: string, updates: Partial<CryptoCard>) => {
    console.log(`[WebSocket] Получено обновление для ${token}:`, updates);
    
    setCards(prevCards => {
      const cardIndex = prevCards.findIndex(card => card.id === token);
      if (cardIndex === -1) return prevCards;
      
      const newCards = [...prevCards];
      const currentCard = { ...prevCards[cardIndex] };
      let hasRealChanges = false;
      
      // Проверяем обновление как UpdateSignalMessage, которое может содержать данные о рынке
      const updateData = updates as unknown as UpdateSignalMessage;
      
      // Если есть данные рынка с ценой и circulatingSupply, рассчитываем marketCap
      if (updateData.market?.price && currentCard.id) {
        // Используем существующий circulatingSupply или получаем из обновления
        const circulatingSupply = updateData.market.circulatingSupply;
        if (circulatingSupply) {
          const marketCapValue = updateData.market.price * circulatingSupply;
          updates.marketCap = formatMarketCap(marketCapValue);
          hasRealChanges = true;
        }
      }
      
      // Обновляем текущую карточку с новыми данными и вспомогательными полями
      const updatedCard = {
        ...currentCard,
        ...updates,
        _lastUpdated: Date.now(),
        _updateId: `update-${Date.now()}`
      };
      
      // Проверяем, реально ли что-то изменилось
      Object.entries(updates).forEach(([key, value]) => {
        if (currentCard[key as keyof typeof currentCard] !== value) {
          hasRealChanges = true;
        }
      });
      
      // Обновляем cards только если есть реальные изменения
      if (hasRealChanges) {
        newCards[cardIndex] = updatedCard;
        return newCards;
      }
      
      return prevCards;
    });
  }, []);

  const handleError = useCallback((error: any) => {
    console.error('[WebSocket] Ошибка:', error);
    setError(error?.message || 'Ошибка соединения с WebSocket');
    setStatus('error');
  }, []);

  const reconnect = useCallback(() => {
    if (status === 'connecting') return;
    
    setStatus('connecting');
    setError(null);
    
    webSocketClient.connect('')
      .then(() => {
        setStatus('connected');
      })
      .catch((err: Error) => {
        console.error('[WebSocket] Ошибка переподключения:', err);
        setError(err?.message || 'Не удалось переподключиться');
        setStatus('error');
      });
  }, [status]);

  const disconnect = useCallback(() => {
    webSocketClient.disconnect();
    setStatus('disconnected');
  }, []);

  useEffect(() => {
    setStatus('connecting');
    
    webSocketClient.onNewSignal(handleNewSignal);
    webSocketClient.onUpdateSignal(handleUpdateSignal);
    webSocketClient.onError(handleError);
    
    webSocketClient.connect('')
      .then(() => {
        setStatus('connected');
      })
      .catch((err: Error) => {
        console.error('[WebSocket] Ошибка подключения:', err);
        setError(err?.message || 'Не удалось подключиться');
        setStatus('error');
      });
    
    return () => {
      webSocketClient.disconnect();
    };
  }, [handleNewSignal, handleUpdateSignal, handleError]);
  
  return [status, cards, error, { reconnect, disconnect }, updateCard];
} 