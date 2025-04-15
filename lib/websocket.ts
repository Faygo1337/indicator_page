import { 
  NewSignalMessage, 
  UpdateSignalMessage, 
  WS_ENDPOINT, 
  CryptoCard,
  MarketData,
  HoldingsData,
  SocialLinks,
  Trade
} from './api/types';

/**
 * Класс для обработки WebSocket соединений
 * Предоставляет методы для подключения, отключения и обработки сообщений
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private newSignalCallbacks: ((data: NewSignalMessage) => void)[] = [];
  private updateSignalCallbacks: ((data: UpdateSignalMessage) => void)[] = [];
  private errorCallbacks: ((error: any) => void)[] = [];
  private accessToken: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 1000;
  private connected = false;

  constructor() {}

  /**
   * Инициализация и подключение WebSocket
   * @param accessToken JWT токен для аутентификации
   */
  connect(accessToken: string): void {
    if (this.connected) return;
    
    this.accessToken = accessToken;
    this.initWebSocket();
  }
  
  /**
   * Инициализация WebSocket соединения
   */
  private initWebSocket(): void {
    if (!this.accessToken) {
      this.notifyError(new Error('Нет токена доступа для WebSocket подключения'));
      return;
    }
    
    try {
      // Создаем WebSocket соединение
      this.ws = new WebSocket(WS_ENDPOINT);
      
      console.log(`Подключение к WebSocket: ${WS_ENDPOINT}`);
      
      // Настройка обработчиков событий
      this.setupEventHandlers();
      
    } catch (error) {
      this.notifyError(error);
    }
  }
  
  /**
   * Настройка обработчиков событий WebSocket
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;
    
    // Обработка открытия соединения
    this.ws.onopen = () => {
      console.log('WebSocket соединение установлено');
      this.connected = true;
      this.reconnectAttempts = 0;
      
      // Отправляем аутентификационное сообщение при подключении
      this.ws?.send(JSON.stringify({ type: 'auth', token: this.accessToken }));
    };
    
    // Обработка ошибок
    this.ws.onerror = (event) => {
      console.log('Ошибка WebSocket:', event);
      this.notifyError(event);
    };
    
    // Обработка закрытия соединения
    this.ws.onclose = (event) => {
      console.log(`WebSocket соединение закрыто: ${event.code} ${event.reason}`);
      this.connected = false;
      this.handleReconnect();
    };
    
    // Обработка входящих сообщений
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Получено сообщение WebSocket:', data);
        
        // Обработка сообщений в зависимости от типа
        if (data.type === 'new_signal' && data.payload) {
          console.log('Получен новый сигнал:', data.payload);
          this.processNewSignal(data.payload);
        } else if (data.type === 'update_signal' && data.payload) {
          console.log('Получено обновление сигнала:', data.payload);
          this.processUpdateSignal(data.payload);
        }
      } catch (error) {
        console.error('Ошибка обработки сообщения WebSocket:', error);
      }
    };
  }
  
  /**
   * Обработка нового сигнала
   * @param data Данные нового сигнала
   */
  private processNewSignal(data: NewSignalMessage): void {
    this.newSignalCallbacks.forEach(callback => {
      callback(data);
    });
  }
  
  /**
   * Обработка обновления сигнала
   * @param data Данные обновления сигнала
   */
  private processUpdateSignal(data: UpdateSignalMessage): void {
    this.updateSignalCallbacks.forEach(callback => {
      callback(data);
    });
  }
  
  /**
   * Уведомление о возникшей ошибке
   * @param error Ошибка
   */
  private notifyError(error: any): void {
    console.error('WebSocket ошибка:', error);
    this.errorCallbacks.forEach(callback => {
      callback(error);
    });
  }
  
  /**
   * Обработка переподключения
   */
  private handleReconnect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Попытка переподключения ${this.reconnectAttempts} из ${this.maxReconnectAttempts}`);
      
      // Устанавливаем таймер для повторного подключения
      setTimeout(() => {
        this.initWebSocket();
      }, this.reconnectTimeout * this.reconnectAttempts);
    } else {
      console.error('Превышено максимальное количество попыток переподключения');
      this.ws = null;
    }
  }
  
  /**
   * Отключение от WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.reconnectAttempts = 0;
  }
  
  /**
   * Подписка на получение новых сигналов
   * @param callback Функция обратного вызова для обработки новых сигналов
   */
  onNewSignal(callback: (data: NewSignalMessage) => void): void {
    this.newSignalCallbacks.push(callback);
  }
  
  /**
   * Подписка на получение обновлений сигналов
   * @param callback Функция обратного вызова для обработки обновлений сигналов
   */
  onUpdateSignal(callback: (data: UpdateSignalMessage) => void): void {
    this.updateSignalCallbacks.push(callback);
  }
  
  /**
   * Подписка на получение ошибок
   * @param callback Функция обратного вызова для обработки ошибок
   */
  onError(callback: (error: any) => void): void {
    this.errorCallbacks.push(callback);
  }
  
  /**
   * Проверка состояния подключения
   * @returns Состояние подключения
   */
  isConnected(): boolean {
    return this.connected;
  }
  
  /**
   * Конвертация сигнала в формат карточки для отображения
   * @param signal Данные сигнала
   * @returns Объект карточки для отображения
   */
  static convertSignalToCard(signal: NewSignalMessage): CryptoCard {
    // Создаем объект карточки на основе данных сигнала
    return {
      id: signal.token,
      name: signal.name,
      symbol: signal.symbol,
      image: signal.logo,
      marketCap: `$${(signal.market.price * signal.market.circulatingSupply).toFixed(2)}`,
      tokenAge: WebSocketClient.formatTimestamp(signal.tokenCreatedAt),
      top10: `${signal.holdings.top10.toFixed(2)}%`,
      devWalletHold: `${signal.holdings.devHolds.toFixed(2)}%`,
      first70BuyersHold: `${signal.holdings.first70.toFixed(2)}%`,
      insiders: `${signal.holdings.insidersHolds.toFixed(2)}%`,
      whales: signal.trades.map(trade => ({
        count: 1, // Просто счетчик для совместимости
        amount: `${trade.amtSol.toFixed(3)} SOL`
      })),
      noMint: true, // Заглушка
      blacklist: false, // Заглушка
      burnt: "100%", // Заглушка
      top10Percentage: `${signal.holdings.top10.toFixed(2)}%`,
      priceChange: "×1.0", // Заглушка для начального значения
      socialLinks: {
        telegram: signal.socials?.tg,
        twitter: signal.socials?.x,
        website: signal.socials?.web
      }
    };
  }
  
  /**
   * Форматирование временной метки в удобный для отображения формат
   * @param timestamp Временная метка
   * @returns Отформатированная строка времени
   */
  private static formatTimestamp(timestamp: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    
    if (diff < 60) {
      return `${diff}s`;
    } else if (diff < 3600) {
      return `${Math.floor(diff / 60)}m${diff % 60}s`;
    } else if (diff < 86400) {
      return `${Math.floor(diff / 3600)}h${Math.floor((diff % 3600) / 60)}m`;
    } else {
      return `${Math.floor(diff / 86400)}d${Math.floor((diff % 86400) / 3600)}h`;
    }
  }
}

// Создаем и экспортируем экземпляр WebSocket клиента
export const wsClient = new WebSocketClient();
