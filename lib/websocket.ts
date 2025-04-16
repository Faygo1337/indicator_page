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
 * Класс для обработки нативных WebSocket соединений
 * Предоставляет методы для подключения, отключения и обработки сообщений
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private newSignalCallbacks: ((data: CryptoCard) => void)[] = [];
  private updateSignalCallbacks: ((token: string, updates: Partial<CryptoCard>) => void)[] = [];
  private errorCallbacks: ((error: any) => void)[] = [];
  private accessToken: string | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 2000;
  private mockMode = false;
  private connectionTimeoutId: NodeJS.Timeout | null = null;
  private pingIntervalId: NodeJS.Timeout | null = null;
  private hasSubscription = false;

  constructor() {
    console.log('WebSocketClient инициализирован');
  }

  /**
   * Инициализация и подключение к WebSocket
   * @param token JWT токен для аутентификации
   */
  async connect(token: string): Promise<void> {
    if (this.connected) {
      console.log("WebSocket уже подключен");
      return;
    }
    
    if (!token) {
      console.error("Отсутствует токен доступа для WebSocket");
      this.notifyError(new Error("Отсутствует токен доступа"));
      return;
    }

    console.log(`Начинаем подключение к WebSocket с токеном: ${token.substring(0, 15)}...`);
    this.accessToken = token;
    
    try {
      this.initWebSocket();
    } catch (error) {
      console.error("Ошибка подключения WebSocket:", error);
      this.notifyError(error);
    }
  }
  
  /**
   * Инициализация WebSocket соединения
   */
  private initWebSocket(): void {
    try {
      console.log(`Подключение к WebSocket: ${WS_ENDPOINT}`);
      
      // Создаем новый WebSocket объект
      this.ws = new WebSocket(WS_ENDPOINT);
      
      // Добавляем обработчики событий
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
        
      // Устанавливаем таймаут на подключение
        setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          console.warn("Таймаут подключения к WebSocket, закрываем соединение");
          if (this.ws.readyState === WebSocket.CONNECTING) {
            this.ws.close();
          }
          }
      }, 10000); // 10 секунд максимум на подключение
    } catch (error) {
      console.error("Ошибка создания WebSocket:", error);
      this.notifyError(error);
    }
  }
  
  /**
   * Обработчик открытия соединения
   */
  private handleOpen(): void {
    console.log("WebSocket соединение установлено успешно");
      this.connected = true;
      this.reconnectAttempts = 0;
      
    // Отправляем авторизационный заголовок
      this.sendAuthMessage();
    
    // Запускаем пинг для поддержания соединения
    this.startPing();
  }
  
  /**
   * Отправка сообщения авторизации
   */
  private sendAuthMessage(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket не подключен. Невозможно отправить авторизацию.");
      return;
    }

    // Проверяем наличие токена
    if (!this.accessToken) {
      console.error("Отсутствует токен доступа для авторизации WebSocket");
      return;
    }
    
    try {
      // Отправляем авторизационный заголовок в формате JSON
      const authMessage = JSON.stringify({
        type: 'auth',
        token: this.accessToken
      });
      
      console.log("Отправка авторизационного сообщения:", authMessage.substring(0, 50) + "...");
      this.ws.send(authMessage);
      
      // Отправляем пинг для инициации данных
      this.sendPing();
    } catch (error) {
      console.error("Ошибка отправки авторизации:", error);
      this.notifyError(error);
    }
  }
  
  /**
   * Отправка пинга для поддержания соединения
   */
  private sendPing(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket не подключен. Невозможно отправить ping.");
      return;
    }

    try {
      console.log("Отправка ping...");
      // Отправляем ping как JSON объект
      const pingMessage = JSON.stringify({ type: 'ping' });
      this.ws.send(pingMessage);
    } catch (error) {
      console.error("Ошибка отправки ping:", error);
    }
  }
  
  /**
   * Запуск периодической отправки ping
   */
  private startPing(): void {
    // Очищаем предыдущий интервал, если он был
    this.stopPing();
      
    // Запускаем новый интервал (каждые 30 секунд)
    this.pingIntervalId = setInterval(() => {
      this.sendPing();
    }, 30000); // 30 секунд
  }
  
  /**
   * Остановка периодической отправки ping
   */
  private stopPing(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }
  
  /**
   * Обработчик входящих сообщений
   */
  private handleMessage(event: MessageEvent): void {
    try {
      // Проверяем, не является ли сообщение просто строкой
      if (typeof event.data === 'string' && (event.data === 'ping' || event.data === 'pong')) {
        console.log(`Получен ответ: ${event.data}`);
        return;
      }
      
      let message: any;
      try {
        message = JSON.parse(event.data);
        console.log("Получено WebSocket сообщение:", message);
      } catch (parseError) {
        console.error("Не удалось распарсить сообщение WebSocket:", event.data);
        return;
      }
      
      // Обработка типов сообщений
      if (typeof message === 'object') {
        // Определяем тип сообщения по структуре или явному полю type
        if (message.type === 'signals.new' || (message.token && message.name && message.symbol)) {
          // Если это сообщение signals.new или имеет структуру нового сигнала
          const signalData = message.data || message;
          const cardData = WebSocketClient.convertSignalToCard(signalData);
          this.notifyNewSignal(cardData);
        } 
        else if (message.type === 'signals.update' || (message.token && (message.market || message.holdings))) {
          // Если это сообщение signals.update или имеет структуру обновления
          const updateData = message.data || message;
          const token = updateData.token;
          const updates = this.convertUpdateToCardUpdates(updateData);
          this.notifyUpdateSignal(token, updates);
        }
        else if (message.type === 'auth_success' || message.type === 'connected') {
          console.log("Авторизация успешна или соединение установлено:", message);
        }
        else if (message.type === 'error') {
          console.error("Ошибка от WebSocket сервера:", message.message || message);
          this.notifyError(new Error(message.message || "Неизвестная ошибка сервера"));
        }
      }
    } catch (error) {
      console.error("Ошибка обработки сообщения WebSocket:", error);
      this.notifyError(error);
    }
  }
  
  /**
   * Обработчик ошибок
   */
  private handleError(event: Event): void {
    console.error("Ошибка WebSocket:", event);
    
    // Проверяем состояние соединения
    if (this.ws) {
      console.log(`Состояние WebSocket при ошибке: ${this.ws.readyState}`);
    }
    
    this.notifyError(event);
  }
  
  /**
   * Обработчик закрытия соединения
   */
  private handleClose(event: CloseEvent): void {
    const codeMap: Record<number, string> = {
      1000: "Нормальное закрытие",
      1001: "Перезагрузка/уход",
      1002: "Ошибка протокола",
      1003: "Неприемлемые данные",
      1006: "Аномальное закрытие",
      1007: "Неверные данные",
      1008: "Нарушение политики",
      1009: "Сообщение слишком большое",
      1010: "Требуется расширение",
      1011: "Неожиданная ошибка",
      1012: "Перезагрузка сервиса",
      1013: "Попробуйте позже",
      1014: "Ошибка на прокси",
      1015: "Сбой TLS"
    };
    
    const codeDescription = codeMap[event.code] || "Неизвестный код";
    console.log(`WebSocket соединение закрыто: ${event.code} (${codeDescription}) ${event.reason}`);
    
    this.connected = false;
    this.stopPing();
    
    // Пытаемся переподключиться только при определенных кодах ошибок
    if (event.code === 1000) {
      console.log("Нормальное закрытие соединения, не переподключаемся");
    } else if (event.code === 1008) {
      console.error("Ошибка политики (обычно проблема с авторизацией), не переподключаемся");
    } else {
      console.log("Пытаемся переподключиться...");
      this.reconnect();
    }
  }
  
  /**
   * Попытка переподключения
   */
  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Превышено максимальное количество попыток переподключения");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectTimeout * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts} через ${delay}мс`);
    
    // Создаем новый таймер для переподключения
    setTimeout(() => {
      // Проверяем, не было ли успешного подключения между тем
      if (!this.connected && this.accessToken) {
        console.log("Выполняем переподключение...");
        // Очищаем текущий WebSocket объект
        if (this.ws) {
          this.ws.onopen = null;
          this.ws.onmessage = null;
          this.ws.onerror = null;
          this.ws.onclose = null;
          
          try {
            if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
              this.ws.close();
            }
          } catch (e) {
            console.warn("Ошибка при закрытии старого соединения:", e);
          }
          
          this.ws = null;
    }
    
        // Создаем новое соединение
        this.initWebSocket();
      }
    }, delay);
  }
  
  /**
   * Отключение от WebSocket
   */
  disconnect(): void {
    this.stopPing();
    
    if (this.ws) {
      try {
        this.ws.close();
      } catch (error) {
        console.error("Ошибка закрытия WebSocket:", error);
      }
      
      this.ws = null;
    }
    
    this.connected = false;
    this.accessToken = null;
    this.reconnectAttempts = 0;
    console.log("WebSocket отключен");
  }
  
  /**
   * Уведомление о новом сигнале
   */
  private notifyNewSignal(data: CryptoCard): void {
    for (const callback of this.newSignalCallbacks) {
      try {
      callback(data);
      } catch (error) {
        console.error("Ошибка в обработчике нового сигнала:", error);
      }
    }
  }
  
  /**
   * Уведомление об обновлении сигнала
   */
  private notifyUpdateSignal(token: string, updates: Partial<CryptoCard>): void {
    for (const callback of this.updateSignalCallbacks) {
      try {
      callback(token, updates);
      } catch (error) {
        console.error("Ошибка в обработчике обновления сигнала:", error);
      }
    }
  }
  
  /**
   * Уведомление об ошибке
   */
  private notifyError(error: any): void {
    for (const callback of this.errorCallbacks) {
      try {
      callback(error);
      } catch (err) {
        console.error("Ошибка в обработчике ошибок:", err);
      }
    }
  }
  
  /**
   * Регистрация обработчика новых сигналов
   */
  onNewSignal(callback: (data: CryptoCard) => void): void {
    this.newSignalCallbacks.push(callback);
  }
  
  /**
   * Регистрация обработчика обновлений сигналов
   */
  onUpdateSignal(callback: (token: string, updates: Partial<CryptoCard>) => void): void {
    this.updateSignalCallbacks.push(callback);
  }
  
  /**
   * Регистрация обработчика ошибок
   */
  onError(callback: (error: any) => void): void {
    this.errorCallbacks.push(callback);
  }
  
  /**
   * Проверка состояния подключения
   */
  isConnected(): boolean {
    return this.connected;
  }
  
  /**
   * Преобразование сигнала в формат карточки
   */
  static convertSignalToCard(signal: NewSignalMessage): CryptoCard {
    // Получаем дату создания токена в читаемом формате
    const tokenAge = signal.tokenCreatedAt ? 
      WebSocketClient.formatTimestamp(signal.tokenCreatedAt) : 
      "N/A";

    // Преобразование социальных ссылок
    const socialLinks: {
      telegram?: string;
      twitter?: string;
      website?: string;
    } = {};

    if (signal.socials) {
      if (signal.socials.tg) socialLinks.telegram = signal.socials.tg;
      if (signal.socials.x) socialLinks.twitter = signal.socials.x;
      if (signal.socials.web) socialLinks.website = signal.socials.web;
    }

    // Создаем объект карточки
    return {
      id: signal.token, // Используем токен как ID
      name: signal.name,
      symbol: signal.symbol,
      image: signal.logo,
      marketCap: signal.market.circulatingSupply ? 
        `$${(signal.market.circulatingSupply * signal.market.price).toFixed(2)}` : 
        "N/A",
      tokenAge,
      top10: signal.holdings.top10 ? `${signal.holdings.top10.toFixed(2)}%` : "N/A",
      devWalletHold: signal.holdings.devHolds ? `${signal.holdings.devHolds.toFixed(2)}%` : "0.00%",
      first70BuyersHold: signal.holdings.first70 ? `${signal.holdings.first70.toFixed(2)}%` : "N/A",
      insiders: signal.holdings.insidersHolds ? `${signal.holdings.insidersHolds.toFixed(2)}%` : "0.00%",
      whales: signal.trades ? 
        signal.trades.slice(0, 3).map(trade => ({
          count: 1, // В данном случае нет точной информации о количестве, можно использовать счетчик
          amount: `${trade.amtSol} SOL`
        })) : 
        [],
      noMint: true, // Предполагаем для данного примера
      blacklist: false, // Предполагаем для данного примера
      burnt: "N/A", // Информации нет в API
      top10Percentage: signal.holdings.top10 ? `${signal.holdings.top10.toFixed(2)}%` : "N/A",
      priceChange: "×1.0", // По умолчанию, т.к. нет данных об изменении цены
      socialLinks
    };
  }
  
  /**
   * Преобразование обновления в формат обновления карточки
   */
  private convertUpdateToCardUpdates(update: UpdateSignalMessage): Partial<CryptoCard> {
    const result: Partial<CryptoCard> = {};
    
    // Обновляем рыночные данные, если они есть
    if (update.market) {
      if (update.market.price !== undefined) {
        // Если есть цена, можно обновить marketCap
        if (update.market.circulatingSupply !== undefined) {
          result.marketCap = `$${(update.market.circulatingSupply * update.market.price).toFixed(2)}`;
    }
    
        // Можно добавить изменение цены, если есть предыдущая цена
        // Для примера просто ставим значение
        result.priceChange = "×1.1"; // Заглушка, в реальном приложении нужно вычислять
      }
    }

    // Обновляем холдинги, если они есть
    if (update.holdings) {
      if (update.holdings.top10 !== undefined) {
        result.top10 = `${update.holdings.top10.toFixed(2)}%`;
        result.top10Percentage = `${update.holdings.top10.toFixed(2)}%`;
      }
      
      if (update.holdings.devHolds !== undefined) {
        result.devWalletHold = `${update.holdings.devHolds.toFixed(2)}%`;
      }
      
      if (update.holdings.first70 !== undefined) {
        result.first70BuyersHold = `${update.holdings.first70.toFixed(2)}%`;
      }
      
      if (update.holdings.insidersHolds !== undefined) {
        result.insiders = `${update.holdings.insidersHolds.toFixed(2)}%`;
      }
    }
    
    // Обновляем сделки, если они есть
    if (update.trades && update.trades.length > 0) {
      result.whales = update.trades.slice(0, 3).map(trade => ({
        count: 1, // Аналогично, нет точной информации о количестве
        amount: `${trade.amtSol} SOL`
      }));
    }
    
    return result;
  }
  
  /**
   * Форматирование временной метки в читаемый формат
   */
  private static formatTimestamp(timestamp: number): string {
    const now = Date.now() / 1000; // Текущее время в секундах
    const diff = now - timestamp; // Разница в секундах
    
    if (diff < 60) {
      return `${Math.floor(diff)}с`;
    } else if (diff < 3600) {
      return `${Math.floor(diff / 60)}м`;
    } else if (diff < 86400) {
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      return `${hours}ч${minutes}м`;
    } else {
      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      return `${days}д${hours}ч`;
    }
  }
}

// Экспортируем единственный экземпляр для использования во всем приложении
export const webSocketClient = new WebSocketClient();


