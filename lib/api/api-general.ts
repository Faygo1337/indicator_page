import { 
  VerifyResponse, 
  PaymentResponse, 
  API_ENDPOINTS, 
  API_HOST, 
  WS_ENDPOINT, 
  NewSignalMessage, 
  UpdateSignalMessage, 
  JWTPayload,
  CryptoCard 
} from './types';
import { decodeJWT, logDecodedJWT } from "@/lib/utils";
import axios from 'axios';

// Интерфейсы для API ответов
interface VerifyApiResponse {
  success: boolean;
  status: boolean;
  token: string;
  message?: string;
}

interface AuthVerifyResponse {
  status: boolean;
  success: boolean;
  token: string;
}

/**
 * Класс для работы с API
 */
class ApiGeneralService {
  private static instance: ApiGeneralService;
  private ws: WebSocket | null = null;
  private accessToken: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 1000;
  private connected = false;
  
  // Новые поля для обработки WebSocket
  private newSignalCallbacks: ((data: CryptoCard) => void)[] = [];
  private updateSignalCallbacks: ((token: string, updates: Partial<CryptoCard>) => void)[] = [];
  private errorCallbacks: ((error: any) => void)[] = [];

  private constructor() {}

  static getInstance(): ApiGeneralService {
    if (!ApiGeneralService.instance) {
      ApiGeneralService.instance = new ApiGeneralService();
    }
    return ApiGeneralService.instance;
  }

  /**
   * Верификация кошелька
   * @param signature подпись сообщения
   * @param wallet адрес кошелька
   * @param timestamp временная метка для синхронизации запроса
   * @returns информация о верификации
   */
  async verifyWallet(signature: string, wallet: string, timestamp?: number): Promise<VerifyResponse> {
    console.log("Верификация кошелька:", wallet, "с подписью:", signature, "timestamp:", timestamp);

    try {
      // Специальная обработка для мобильной подписи
      if (signature === 'mobile_signature') {
        console.log('Обнаружена мобильная подпись, используем тестовые данные');
        const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NDQyOTcxNTMsImV4cCI6MTc0NDM4MzcyMywiaWF0IjoxNzQ0Mjk3MzIzLCJpZCI6MywibGlua2VkV2FsbGV0IjoiMnl6RUQzS2FXTDY1WUJxMlVTd0dIV2JkUE5QM2JxNlRRN1JBaUhic2JaQ2ciLCJzdWJFeHBBdCI6MCwidG9wdXBXYWxsZXQiOiIzekU4cUE4eFN1Nk5QbzR5V0trN3dWYXdWc3Nlb3hZS3VvTld1VlZLc1lxbiJ9.HeH-csxMUSyqV_6b_2HW5hfH1UAxFYTuTQ4_0z9E2Yw";
        this.accessToken = token;
        
        return {
          token,
          payload: {
            id: 3,
            linkedWallet: wallet,
            topupWallet: "3zE8qA8xSu6NPo4yWKk7wVawVsseoxYKuoNWuVVKsYqn",
            subExpAt: 0,
            createdAt: 1744297153,
            exp: 1744383723,
            iat: 1744297323,
          },
        };
      }

      // Для разработки: переключатель между реальным API и моком
      const useMockAPI = false; // Установите в false для использования реального API
      
      let data: VerifyApiResponse;
      
      if (useMockAPI) {
        // Симуляция API вызова
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        // Мок-ответ с тестовыми данными
        data = {
          success: true,
          status: true,
          token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NDQyOTcxNTMsImV4cCI6MTc0NDM4MzcyMywiaWF0IjoxNzQ0Mjk3MzIzLCJpZCI6MywibGlua2VkV2FsbGV0IjoiMnl6RUQzS2FXTDY1WUJxMlVTd0dIV2JkUE5QM2JxNlRRN1JBaUhic2JaQ2ciLCJzdWJFeHBBdCI6MCwidG9wdXBXYWxsZXQiOiIzekU4cUE4eFN1Nk5QbzR5V0trN3dWYXdWc3Nlb3hZS3VvTld1VlZLc1lxbiJ9.HeH-csxMUSyqV_6b_2HW5hfH1UAxFYTuTQ4_0z9E2Yw",
        };
      } else {
        try {
          // Подготавливаем данные для запроса
          const dataPost = {
            timestamp: timestamp || Date.now(),
            ref: 1,
            signature: signature,
            wallet: wallet
          };
          
          // Выполняем POST запрос с axios
          console.log('Отправка запроса:', dataPost);
          
          const response = await axios.post(`${API_HOST}/api/verify`, dataPost, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            }
          });
          
          // Проверяем статус ответа
          console.log('Получен ответ с статусом:', response.status);
          
          // Получаем данные из response.data
          const apiResponse = response.data;
          console.log('Данные ответа:', apiResponse);
          
          // Проверяем структуру ответа
          if ('token' in apiResponse) {
            const authResponse = apiResponse as AuthVerifyResponse;
            
            // Приводим к стандартному формату
            data = {
              success: authResponse.success,
              status: authResponse.status,
              token: authResponse.token || '',
            };
            
            console.log('Получен ответ от API с токеном');
          } else {
            console.warn('Получен ответ в нестандартном формате:', apiResponse);
            data = apiResponse as VerifyApiResponse;
          }
        } catch (apiError) {
          if (axios.isAxiosError(apiError)) {
            console.error('Ошибка Axios:', apiError.message);
            console.error('Статус ошибки:', apiError.response?.status);
            console.error('Данные ошибки:', apiError.response?.data);
            
            if (apiError.response?.status === 401) {
              console.error('Ошибка аутентификации 401 Unauthorized. Проверьте правильность данных запроса или доступность сервера.');
            }
            
            if (apiError.code === 'ERR_NETWORK') {
              console.error('Ошибка сети. Проверьте доступность сервера.');
            }
            
            if (apiError.code === 'ECONNABORTED') {
              console.error('Таймаут соединения. Сервер не отвечает.');
            }
          } else {
            console.error('Неизвестная ошибка при запросе:', apiError);
          }
          
          throw apiError;
        }
      }
      
      // Проверяем наличие токена
      if (!data.token) {
        console.error('API вернул пустой токен');
        throw new Error('Получен пустой токен аутентификации');
      }
      
      // Сохраняем токен для будущих запросов
      this.accessToken = data.token;
      
      // Обработка успешного ответа
      if (data.status === true) {
        const decodedPayload = logDecodedJWT(data.token);
        
        return {
          token: data.token,
          payload: decodedPayload,
        };
      }
      
      // Для случая, когда статус не true - возвращаем тестовые данные
      console.warn('API вернул status: false, используем тестовые данные');
      
      return {
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyXzEyMyIsImNvbm5lY3RlZFdhbGxldCI6IndhbGxldF8xMjMiLCJ0b3B1cFdhbGxldCI6InRvcHVwX3dhbGxldF8xMjMiLCJzdWJzY3JpcHRpb25FeHBpcmVBdCI6bnVsbCwianRUb2tlbiI6ImFjY2Vzc190b2tlbl8xMjMifQ.8yUBiUs9cqUEEtX9vYlVnuHgJZGZlR3d-OsLhAJqQlA",
        payload: {
          id: 1,
          linkedWallet: wallet,
          topupWallet: "ADgHfNqhY61Pcy3nHmsRDpczMkJ5DnTnZozKcGsM6wZh",
          subExpAt: 123,
          createdAt: 123,
          exp: 123,
          iat: 123,
        },
      };
    } catch (error) {
      console.error("Ошибка при верификации кошелька:", error);
      
      return {
        token: "",
        payload: null,
      };
    }
  }

  /**
   * Проверка статуса платежа
   * @param walletAddress адрес кошелька для проверки
   * @returns информация о платеже
   */
  async checkPayment(walletAddress: string = ""): Promise<PaymentResponse> {
    try {
      console.log("Проверка статуса платежа для:", walletAddress);
      
      // Для тестирования используем моковые данные
      const useMockAPI = false;
      
      if (useMockAPI) {
        // Симуляция задержки API
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        const mockResponse = {
          accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NDQyOTcxNTMsImV4cCI6MTc0NDM4MzcyMywiaWF0IjoxNzQ0Mjk3MzIzLCJpZCI6MywibGlua2VkV2FsbGV0IjoiMnl6RUQzS2FXTDY1WUJxMlVTd0dIV2JkUE5QM2JxNlRRN1JBaUhic2JaQ2ciLCJzdWJFeHBBdCI6MCwidG9wdXBXYWxsZXQiOiIzekU4cUE4eFN1Nk5QbzR5V0trN3dWYXdWc3Nlb3hZS3VvTld1VlZLc1lxbiJ9.HeH-csxMUSyqV_6b_2HW5hfH1UAxFYTuTQ4_0z9E2Yw",
          expireAt: "2025-05-10 22:02:50.761638 +0300 +03",
          hasSubscription: true,
          success: true
        };
        
        // Сохраняем токен для будущих запросов
        if (mockResponse.success) {
          this.accessToken = mockResponse.accessToken;
        }
        
        return mockResponse;
      }
      
      // Реальная реализация запроса к API
      const url = API_ENDPOINTS.payment;
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      // Получаем данные из response.data
      const data = response.data;
      
      if (data.success && data.accessToken) {
        this.accessToken = data.accessToken;
      }
      
      return data;
    } catch (error) {
      console.error('Ошибка проверки платежа:', error);
      throw error;
    }
  }

  /**
   * Подключение к WebSocket для получения данных в реальном времени
   * @param token JWT токен для аутентификации
   */
  private connecting = false;

  async connect(token: string): Promise<void> {
    if (this.connected || this.connecting) {
      console.log("WebSocket уже подключен или в процессе подключения");
      return;
    }
  
    if (!token) {
      console.error("Отсутствует токен доступа для WebSocket");
      this.notifyError(new Error("Отсутствует токен доступа"));
      return;
    }
  
    this.accessToken = token;
    this.connecting = true;
  
    try {
      this.initWebSocket();
    } catch (error) {
      console.error("Ошибка подключения WebSocket:", error);
      this.notifyError(error);
      this.connecting = false;
    }
  }

  /**
   * Инициализация WebSocket соединения
   */
  private connectionTimeoutId: number | null = null;

  private initWebSocket(): void {
    console.log(`Подключение к WebSocket: ${WS_ENDPOINT}`);
  
    this.ws = new WebSocket(WS_ENDPOINT);
  
    this.ws.onopen = this.handleOpen.bind(this);
    this.ws.onmessage = this.handleMessage.bind(this);
    this.ws.onerror = this.handleError.bind(this);
    this.ws.onclose = this.handleClose.bind(this);
  
    this.connectionTimeoutId = window.setTimeout(() => {
      if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
        console.warn("Таймаут подключения к WebSocket, закрываем соединение");
        this.ws.close(4000, "Connection timeout");
      }
    }, 10000); // 10 секунд
  }
  
  
  /**
   * Обработчик открытия соединения
   */
  private handleOpen(): void {
    console.log("WebSocket соединение установлено успешно");
    
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }
  
    this.connected = true;
    this.connecting = false;
    this.reconnectAttempts = 0;
  
    this.sendAuthMessage();
  }
  
  
  /**
   * Отправка сообщения авторизации
   */
  private sendAuthMessage(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket не подключен. Невозможно отправить авторизацию.");
      return;
    }
  
    if (!this.accessToken) {
      console.error("Отсутствует токен доступа для авторизации WebSocket");
      return;
    }
  
    try {
      const authMessage = JSON.stringify({ authToken: this.accessToken });
      console.log("Отправка авторизационного сообщения:", authMessage.substring(0, 50) + "...");
      this.ws.send(authMessage);
    } catch (error) {
      console.error("Ошибка отправки авторизации:", error);
      this.notifyError(error);
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
          const cardData = this.convertSignalToCard(signalData);
          this.notifyNewSignal(cardData);
        } 
        else if (message.type === 'signals.update' || (message.token && (message.market || message.holdings))) {
          // Если это сообщение signals.update или имеет структуру обновления
          const updateData = message.data || message;
          const token = updateData.token;
          const updates = this.convertToCardUpdates(updateData);
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
      console.log(`URL соединения: ${WS_ENDPOINT}`);
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
    this.connecting = false;
  
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }
  
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
    const delay = this.reconnectTimeout * this.reconnectAttempts;
  
    console.log(`Переподключение через ${delay} мс (попытка ${this.reconnectAttempts})`);
  
    setTimeout(() => {
      if (!this.connected && !this.connecting && this.accessToken) {
        this.initWebSocket();
      }
    }, delay);
  }
  

  /**
   * Отключение от WebSocket
   */
  disconnect(): void {
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
  private convertSignalToCard(signal: NewSignalMessage): CryptoCard {
    const tokenAge = signal.tokenCreatedAt ? 
      this.formatTimestamp(signal.tokenCreatedAt) : 
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
      id: signal.token,
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
          count: 1,
          amount: `${trade.amtSol} SOL`
        })) : 
        [],
      noMint: true,
      blacklist: false,
      burnt: "N/A",
      top10Percentage: signal.holdings.top10 ? `${signal.holdings.top10.toFixed(2)}%` : "N/A",
      priceChange: "×1.0",
      socialLinks
    };
  }

  /**
   * Преобразование обновления в формат обновления карточки
   */
  private convertToCardUpdates(update: UpdateSignalMessage): Partial<CryptoCard> {
    const result: Partial<CryptoCard> = {};
    
    // Обновляем рыночные данные, если они есть
    if (update.market) {
      if (update.market.price !== undefined) {
        // Если есть цена, можно обновить marketCap
        if (update.market.circulatingSupply !== undefined) {
          result.marketCap = `$${(update.market.circulatingSupply * update.market.price).toFixed(2)}`;
        }
    
        // Можно добавить изменение цены, если есть предыдущая цена
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
        count: 1,
        amount: `${trade.amtSol} SOL`
      }));
    }
    
    return result;
  }
  
  /**
   * Форматирование временной метки в читаемый формат
   */
  private formatTimestamp(timestamp: number): string {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    
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

// Создаем и экспортируем экземпляр сервиса
export const apiGeneral = ApiGeneralService.getInstance();

// Экспортируем для совместимости
export const webSocketClient = apiGeneral;

// Экспортируем функции для совместимости со старым кодом
export async function verifyWallet(signature: string, wallet: string, timestamp?: number): Promise<VerifyResponse> {
  return apiGeneral.verifyWallet(signature, wallet, timestamp);
}

export async function checkPayment(): Promise<PaymentResponse> {
  return apiGeneral.checkPayment();
} 