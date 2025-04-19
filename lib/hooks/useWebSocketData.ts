'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CryptoCard, MarketData, UpdateSignalMessage } from '@/lib/api/types';
import { useRouter } from 'next/navigation';
import { webSocketClient } from '@/lib/api/api-general';
import { formatMarketCap, extractNumericValue } from '@/lib/utils';

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
  
  // Для отладки
  const updateCountRef = useRef(0);
  
  // Максимальное количество карточек
  const MAX_CARDS = 8;
  
  // Для хранения оригинальных данных о cards без интерполяции
  const originalCardsRef = useRef<ExtendedCryptoCard[]>([]);
  
  // Хранение текущих значений circulatingSupply и price для каждой карточки
  const cardsMetadataRef = useRef<Record<string, { 
    circulatingSupply?: number; 
    price?: number;
    priceTarget?: number;
    priceStart?: number;
    marketCapStart?: number;
    stepProgress?: number;
    animating?: boolean;
  }>>({});
  
  // Функция для обновления карточки - ключевой метод, который обновляет состояние
  const updateCard = useCallback((token: string, updates: Partial<CryptoCard>) => {
    updateCountRef.current++;
    console.log(`[useWebSocketData] Вызов updateCard для ${token}:`, updates, `(#${updateCountRef.current})`);
    
    setCards(prevCards => {
      const index = prevCards.findIndex(card => card.id === token);
      if (index === -1) {
        console.log(`[useWebSocketData] Карточка ${token} не найдена в массиве`);
        return prevCards;
      }
      
      const updatedCard = { 
        ...prevCards[index], 
        ...updates,
        _lastUpdated: Date.now(),
        _updateId: `update-${Date.now()}`
      };
      
      console.log(`[useWebSocketData] Обновляю карточку:`, updatedCard);
      
      // Создаем новый массив с обновленной карточкой
      const newCards = [...prevCards];
      newCards[index] = updatedCard;
      
      return newCards;
    });
    
    // Принудительно обновляем UI
    router.refresh();
  }, [router]);

  const handleNewSignal = useCallback((data: CryptoCard) => {
    console.log(`[useWebSocketData] Получен новый сигнал:`, data);
    
    setCards(prevCards => {
      const cardExists = prevCards.some(card => card.id === data.id);
      if (cardExists) {
        return prevCards.map(card => card.id === data.id ? { 
          ...card, 
          ...data,
          _lastUpdated: Date.now(),
          _updateId: `newSignal-${Date.now()}`
        } : card);
      } else {
        // Добавляем новую карточку в начало и ограничиваем общее количество до MAX_CARDS
        const newCard = {
          ...data,
          _receivedAt: Date.now(),
          _lastUpdated: Date.now(),
          _updateId: `newSignal-${Date.now()}`
        };
        const updatedCards = [newCard, ...prevCards];
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
      if (cardIndex === -1) {
        console.warn(`[WebSocket] Карточка с ID ${token} не найдена!`);
        return prevCards;
      }
      
      const timestamp = Date.now();
      
      // Создаем полностью новый массив карточек для гарантированного обновления реакт состояния
      return prevCards.map(card => {
        if (card.id === token) {
          return {
            ...card,
            ...updates,
            _lastUpdated: timestamp,
            _updateId: `update-${timestamp}`
          };
        }
        return card;
      });
    });
    
    // Вызываем refresh для обновления интерфейса
    router.refresh();
  }, [router]);

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
    console.log('[useWebSocketData] Инициализация WebSocket...');
    setStatus('connecting');
    
    // Регистрируем обработчики
    webSocketClient.onNewSignal(handleNewSignal);
    webSocketClient.onUpdateSignal(handleUpdateSignal);
    webSocketClient.onError(handleError);
    
    // Подключаемся
    webSocketClient.connect('')
      .then(() => {
        console.log('[useWebSocketData] Соединение WebSocket установлено');
        setStatus('connected');
      })
      .catch((err: Error) => {
        console.error('[WebSocket] Ошибка подключения:', err);
        setError(err?.message || 'Не удалось подключиться');
        setStatus('error');
      });
    
    return () => {
      console.log('[useWebSocketData] Очистка WebSocket...');
      webSocketClient.disconnect();
    };
  }, [handleNewSignal, handleUpdateSignal, handleError]);
  
  return [status, cards, error, { reconnect, disconnect }, updateCard];
} 