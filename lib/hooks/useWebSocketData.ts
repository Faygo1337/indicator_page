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

// Добавляем периодический интервал обновления данных
const UPDATE_INTERVAL_MS = 1000; // Каждую секунду обновляем данные

// Минимальный и максимальный процент изменения для живости данных
const MIN_CHANGE_PERCENT = -1.5; // -1.5%
const MAX_CHANGE_PERCENT = 2.0;  // +2.0%

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
  const lastUpdateTimeRef = useRef<Record<string, number>>({});
  
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
    baseMarketCap?: number; // Базовое значение для расчета флуктуаций
    lastChange?: 'up' | 'down' | null; // Последнее направление изменения
    consecutiveChanges?: number; // Счетчик последовательных изменений в одну сторону
  }>>({});
  
  // Функция для обновления карточки - ключевой метод, который обновляет состояние
  const updateCard = useCallback((token: string, updates: Partial<CryptoCard>) => {
    updateCountRef.current++;
    console.log(`[useWebSocketData] Вызов updateCard для ${token}:`, updates, `(#${updateCountRef.current})`);
    
    // Сохраняем время последнего обновления
    lastUpdateTimeRef.current[token] = Date.now();
    
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
        
        // Инициализируем метаданные для новой карточки с базовым marketCap
        if (newCard.marketCap) {
          const numericValue = parseFloat(newCard.marketCap.replace(/[^0-9.]/g, ''));
          cardsMetadataRef.current[newCard.id] = {
            baseMarketCap: numericValue,
            lastChange: null,
            consecutiveChanges: 0
          };
        }
        
        const updatedCards = [newCard, ...prevCards];
        // Если карточек стало больше MAX_CARDS, оставляем только первые MAX_CARDS
        return updatedCards.slice(0, MAX_CARDS);
      }
    });
    
    router.refresh();
  }, [router]);

  const handleUpdateSignal = useCallback((token: string, updates: Partial<CryptoCard>) => {
    console.log(`[WebSocket] Получено обновление для ${token}:`, updates);
    
    // Проверяем наличие карточки перед обновлением
    setCards(prevCards => {
      const cardIndex = prevCards.findIndex(card => card.id === token);
      if (cardIndex === -1) {
        console.warn(`[WebSocket] Карточка с ID ${token} не найдена!`);
        return prevCards;
      }
      
      const currentCard = { ...prevCards[cardIndex] };
      
      // Если обновляется marketCap, то сохраняем его базовое значение для будущих колебаний
      if (updates.marketCap) {
        const numericValue = parseFloat(updates.marketCap.replace(/[^0-9.]/g, ''));
        if (!isNaN(numericValue)) {
          cardsMetadataRef.current[token] = {
            ...(cardsMetadataRef.current[token] || {}),
            baseMarketCap: numericValue
          };
        }
      }
      
      // Применяем обновления напрямую
      const updatedCard = {
        ...currentCard,
        ...updates,
        _lastUpdated: Date.now(),
        _updateId: `update-${Date.now()}`
      };
      
      // Создаем новый массив с обновленной карточкой
      const newCards = [...prevCards];
      newCards[cardIndex] = updatedCard;
      
      console.log(`[WebSocket] Обновлена карточка:`, updatedCard);
      
      return newCards;
    });
    
    // Явно обновляем UI после изменения состояния
    router.refresh();
  }, [router]);

  // Функция для обновления marketCap каждую секунду
  useEffect(() => {
    if (status !== 'connected') return;
    
    // Создаем интервал для обновления marketCap всех карточек каждую секунду
    const realTimeUpdateInterval = setInterval(() => {
      if (cards.length === 0) return;
      
      // Обновляем все карточки
      cards.forEach(card => {
        const metadata = cardsMetadataRef.current[card.id];
        if (!metadata || !metadata.baseMarketCap) {
          // Если нет базового значения, создаем его
          if (card.marketCap) {
            const baseValue = parseFloat(card.marketCap.replace(/[^0-9.]/g, ''));
            cardsMetadataRef.current[card.id] = {
              ...(metadata || {}),
              baseMarketCap: baseValue,
              lastChange: null,
              consecutiveChanges: 0
            };
          }
          return;
        }
        
        // Определяем направление и величину изменения
        let changeDirection: 'up' | 'down';
        
        // Если было много последовательных изменений в одну сторону,
        // увеличиваем вероятность смены направления
        if (metadata.lastChange && metadata.consecutiveChanges && metadata.consecutiveChanges > 3) {
          const reverseChance = Math.min(0.5 + metadata.consecutiveChanges * 0.1, 0.9);
          changeDirection = Math.random() < reverseChance 
            ? (metadata.lastChange === 'up' ? 'down' : 'up')
            : metadata.lastChange;
        } else {
          // Обычное случайное определение направления с небольшим уклоном вверх (55% вверх)
          changeDirection = Math.random() < 0.55 ? 'up' : 'down';
        }
        
        // Обновляем метаданные о последовательности изменений
        if (metadata.lastChange === changeDirection) {
          cardsMetadataRef.current[card.id].consecutiveChanges = (metadata.consecutiveChanges || 0) + 1;
        } else {
          cardsMetadataRef.current[card.id].consecutiveChanges = 1;
        }
        cardsMetadataRef.current[card.id].lastChange = changeDirection;
        
        // Вычисляем процент изменения (более вероятны меньшие изменения)
        let changePercent: number;
        
        // Экспоненциальное распределение для более реалистичных изменений
        const randomBase = Math.random();
        const baseChange = randomBase * randomBase * 0.5; // Максимум 0.5%
        
        if (changeDirection === 'up') {
          changePercent = baseChange;
        } else {
          changePercent = -baseChange * 0.8; // Падения чуть меньше ростов
        }
        
        // Иногда (с вероятностью 5%) генерируем более существенные изменения
        if (Math.random() < 0.05) {
          changePercent = changeDirection === 'up' 
            ? Math.random() * (MAX_CHANGE_PERCENT - 0.5) + 0.5  // от 0.5% до MAX_CHANGE_PERCENT
            : Math.random() * (MIN_CHANGE_PERCENT + 0.3) - 0.3; // от -0.3% до MIN_CHANGE_PERCENT
        }
        
        // Применяем процент изменения к базовому значению
        const currentBaseValue = metadata.baseMarketCap;
        const newBaseValue = currentBaseValue * (1 + changePercent / 100);
        
        // Обновляем базовое значение
        cardsMetadataRef.current[card.id].baseMarketCap = newBaseValue;
        
        // Форматируем и обновляем marketCap
        const newMarketCap = formatMarketCap(newBaseValue);
        
        // Изменяем также priceChange для отображения динамики
        let priceChange = '×1.0';
        const currentPriceChange = card.priceChange;
        if (currentPriceChange) {
          // Извлекаем текущее числовое значение
          const currentMultiplier = parseFloat(currentPriceChange.replace('×', ''));
          if (!isNaN(currentMultiplier)) {
            // Корректируем соотношение цен в соответствии с изменением marketCap
            const newMultiplier = currentMultiplier * (1 + changePercent / 100);
            // Форматируем с двумя знаками после запятой
            priceChange = `×${newMultiplier.toFixed(2)}`;
          }
        }
        
        // Обновляем карточку
        updateCard(card.id, { 
          marketCap: newMarketCap,
          priceChange
        });
      });
      
    }, UPDATE_INTERVAL_MS);
    
    return () => {
      clearInterval(realTimeUpdateInterval);
    };
  }, [status, cards, updateCard]);

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