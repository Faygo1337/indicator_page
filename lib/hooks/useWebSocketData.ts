'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CryptoCard } from '@/lib/api/types';
import { useRouter } from 'next/navigation';
import { webSocketClient } from '@/lib/api/api-general';

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

type WebSocketControls = {
  reconnect: () => void;
  disconnect: () => void;
};

// Добавляем тип для функций обновления
export function useWebSocketData(url: string): [
  WebSocketStatus, 
  CryptoCard[], 
  string | null, 
  WebSocketControls,
  (token: string, updates: Partial<CryptoCard>) => void // Новая функция для обновления
] {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [cards, setCards] = useState<CryptoCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  // Функция для обновления карточки
  const updateCard = useCallback((token: string, updates: Partial<CryptoCard>) => {
    setCards(prevCards => {
      return prevCards.map(card => {
        if (card.id === token) {
          // Обновляем только определенные поля
          return { ...card, ...updates };
        }
        return card;
      });
    });
  }, []);

  // Обработчик для новых карточек
  const handleNewSignal = useCallback((data: CryptoCard) => {
    setCards(prevCards => {
      // Проверяем, есть ли уже такая карточка
      const cardExists = prevCards.some(card => card.id === data.id);
      if (cardExists) {
        // Если карточка существует, обновляем её
        return prevCards.map(card => card.id === data.id ? { ...card, ...data } : card);
      } else {
        // Если новая, добавляем в начало массива
        return [data, ...prevCards];
      }
    });
    
    // Обновляем страницу для получения новых данных
    router.refresh();
  }, [router]);

  // Обработчик для обновлений карточек
  const handleUpdateSignal = useCallback((token: string, updates: Partial<CryptoCard>) => {
    console.log(`[WebSocket] Получено обновление для ${token}:`, updates);
    
    // Используем функциональное обновление, чтобы гарантировать актуальность данных
    setCards(prevCards => {
      // Находим карточку по токену
      const cardIndex = prevCards.findIndex(card => card.id === token);
      if (cardIndex === -1) return prevCards;
      
      // Создаем копию массива и обновляем нужную карточку
      const newCards = [...prevCards];
      
      // Для оптимизации производительности: 
      // если карточка уже имеет все те же значения, что и в обновлении, не меняем её
      const currentCard = prevCards[cardIndex];
      let hasRealChanges = false;
      
      // Глубокое сравнение только значимых полей
      if (updates.marketCap && updates.marketCap !== currentCard.marketCap) hasRealChanges = true;
      if (updates.top10 && updates.top10 !== currentCard.top10) hasRealChanges = true;
      if (updates.devWalletHold && updates.devWalletHold !== currentCard.devWalletHold) hasRealChanges = true;
      if (updates.first70BuyersHold && updates.first70BuyersHold !== currentCard.first70BuyersHold) hasRealChanges = true;
      if (updates.insiders && updates.insiders !== currentCard.insiders) hasRealChanges = true;
      if (updates.priceChange && updates.priceChange !== currentCard.priceChange) hasRealChanges = true;
      
      // Метаданные для отслеживания обновлений
      const updatedCard = {
        ...currentCard,
        ...updates,
        _lastUpdated: Date.now(),
        _updateId: `update-${Date.now()}`
      };
      
      // Обновляем карточку только если есть реальные изменения 
      if (hasRealChanges) {
        newCards[cardIndex] = updatedCard;
        return newCards;
      }
      
      return prevCards;
    });
  }, []);

  // Обработчик ошибок
  const handleError = useCallback((error: any) => {
    console.error('[WebSocket] Ошибка:', error);
    setError(error?.message || 'Ошибка соединения с WebSocket');
    setStatus('error');
  }, []);

  // Функция для переподключения
  const reconnect = useCallback(() => {
    if (status === 'connecting') return;
    
    setStatus('connecting');
    setError(null);
    
    // Используем глобальный экземпляр webSocketClient
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

  // Функция для отключения
  const disconnect = useCallback(() => {
    webSocketClient.disconnect();
    setStatus('disconnected');
  }, []);

  // Эффект для инициализации WebSocket
  useEffect(() => {
    // Устанавливаем начальный статус
    setStatus('connecting');
    
    // Подписываемся на события WebSocket
    webSocketClient.onNewSignal(handleNewSignal);
    webSocketClient.onUpdateSignal(handleUpdateSignal);
    webSocketClient.onError(handleError);
    
    // Подключаемся к WebSocket
    webSocketClient.connect('')
      .then(() => {
        setStatus('connected');
      })
      .catch((err: Error) => {
        console.error('[WebSocket] Ошибка подключения:', err);
        setError(err?.message || 'Не удалось подключиться');
        setStatus('error');
      });
    
    // Отписываемся при размонтировании
    return () => {
      webSocketClient.disconnect();
    };
  }, [handleNewSignal, handleUpdateSignal, handleError]);
  
  return [status, cards, error, { reconnect, disconnect }, updateCard];
} 