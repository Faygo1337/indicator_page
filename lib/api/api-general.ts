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
          
          //  POST 
          console.log('Отправка запроса:', dataPost);
          
          const response = await axios.post(`${API_HOST}/api/verify`, dataPost, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            }
          });
          
          //  статус 
          console.log('Получен ответ с статусом:', response.status);
          
         
          const apiResponse = response.data;
          console.log('Данные ответа:', apiResponse);
          

          if ('token' in apiResponse) {
            const authResponse = apiResponse as AuthVerifyResponse;
            

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
      

      if (!data.token) {
        console.error('API вернул пустой токен');
        throw new Error('Получен пустой токен аутентификации');
      }
      

      this.accessToken = data.token;
      

      if (data.status === true) {
        const decodedPayload = logDecodedJWT(data.token);
        
        return {
          token: data.token,
          payload: decodedPayload,
        };
      }
      
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
  private connectionEstablished = false;

  async connect(token: string): Promise<void> {
    // Если уже подключены с тем же токеном - не переподключаемся
    if (this.connected && this.accessToken === token && this.connectionEstablished) {
      console.log("WebSocket уже подключен с текущим токеном");
      return;
    }
    
    // Если уже идет процесс подключения - не запускаем новый
    if (this.connecting) {
      console.log("WebSocket уже в процессе подключения");
      return;
    }

    if (!token) {
      console.error("Отсутствует токен доступа для WebSocket");
      this.notifyError(new Error("Отсутствует токен доступа"));
      return;
    }

    // Если есть предыдущее соединение, закрываем его
    this.disconnect();
    
    // Устанавливаем флаги и токен
    this.accessToken = token;
    this.connecting = true;
    this.connectionEstablished = false;

    try {
      // Задержка перед повторным подключением (разрываем цикл)
      await new Promise(resolve => setTimeout(resolve, 500));
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
  private messageReceivedFlag = false;
  private attemptingReconnect = false;

  private initWebSocket(): void {
    // Защита от создания нескольких соединений одновременно
    if (this.attemptingReconnect) {
      console.log("Уже выполняется попытка подключения");
      return;
    }
    
    this.attemptingReconnect = true;
    
    // Сначала полностью очистим текущее соединение
    if (this.ws) {
      try {
        // Убираем все обработчики
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        
        // Закрываем соединение если оно открыто или в процессе открытия
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close(1000, "Закрытие перед новым подключением");
        }
        
        // Ждем немного после закрытия
        setTimeout(() => {
          this.ws = null;
          this.initWebSocketInternal();
        }, 1000);
        
        return;
      } catch (e) {
        console.warn("Ошибка при закрытии существующего соединения:", e);
        this.ws = null;
      }
    }
    
    // Основная логика инициализации
    this.initWebSocketInternal();
  }

  private initWebSocketInternal(): void {
    // Очистим таймаут если он был
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }
    
    try {
      // Проверка доступности WebSocket API
      if (typeof WebSocket === 'undefined') {
        console.error("WebSocket API не доступен в текущем окружении");
        this.notifyError(new Error("WebSocket API не доступен"));
        this.attemptingReconnect = false;
        return;
      }

      console.log(`Создание WebSocket соединения: ${WS_ENDPOINT}`);
      
      // Создаем новое соединение
      // Используем моки для разработки в случае ошибок
      if (process.env.NODE_ENV === 'development') {
        console.log('Режим разработки - готовы использовать мок-данные при необходимости');
      }
      
      this.messageReceivedFlag = false;
      
      // Создаем соединение с указанием протоколов
    this.ws = new WebSocket(WS_ENDPOINT);

      // Устанавливаем обработчики событий
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      
      // Устанавливаем таймаут на подключение
      this.connectionTimeoutId = window.setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          console.warn("Таймаут подключения к WebSocket, закрываем соединение");
          this.ws.close(4000, "Connection timeout");
          this.attemptingReconnect = false;
        }
      }, 15000);
    } catch (error) {
      console.error("Ошибка инициализации WebSocket:", error);
      this.connecting = false;
      this.notifyError(error);
      this.attemptingReconnect = false;
    }
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
    this.attemptingReconnect = false;
      this.reconnectAttempts = 0;
    
    // Отправляем авторизацию
    this.sendAuthMessage();
    
    // Устанавливаем флаг успешного соединения сразу после авторизации
    // Это предотвратит повторные попытки соединения
    this.connectionEstablished = true;
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
      // Используем правильный формат авторизации
      this.ws.send(JSON.stringify({ authToken: this.accessToken }));
      console.log("Отправлено сообщение авторизации");
      
      // Установим флаг успешного подключения после отправки

        this.connectionEstablished = true;

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
      // Отмечаем, что получили сообщение
      this.messageReceivedFlag = true;
      
      // Проверяем, не является ли сообщение просто строкой
      if (typeof event.data === 'string' && (event.data === 'ping' || event.data === 'pong')) {
        console.log(`Получен ответ: ${event.data}`);
        return;
      }
      
      // Парсим сообщение
      try {
        const message = JSON.parse(event.data);
        console.log("Получено WebSocket сообщение:", message);
        
        // Устанавливаем флаг успешной коммуникации
        this.connectionEstablished = true;
        
        // Если это первое сообщение, очищаем таймаут на проверку сообщений
        if (this.connectionTimeoutId) {
          clearTimeout(this.connectionTimeoutId);
          this.connectionTimeoutId = null;
        }
        
        // Обработка для первого типа сообщения
        if (message && message.token) {
          // Это полное сообщение с name и symbol (новый токен)
          if (message.name && message.symbol) {
            try {
              const cardData = this.convertSignalToCard(message);
              this.notifyNewSignal(cardData);
            } catch (conversionError) {
              console.error("Ошибка преобразования сигнала:", conversionError);
            }
          } 

          else if (message.market || message.holdings || message.trades) {
            try {
              const updates = this.convertToCardUpdates(message);
              this.notifyUpdateSignal(message.token, updates);
            } catch (updateError) {
              console.error("Ошибка обновления сигнала:", updateError);
            }
          }

          else {
            console.log("Получено сообщение только с token, игнорируем:", message.token);
          }
        }
      } catch (parseError) {
        console.error("Не удалось распарсить сообщение WebSocket:", event.data, parseError);
        return;
      }
    } catch (error) {
      console.error("Ошибка обработки сообщения WebSocket:", error);
      this.notifyError(error);
    }
  }
  

  private handleError(event: Event): void {
    console.error("Получена ошибка WebSocket");
    
    this.connectionEstablished = false;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Будем использовать мок-данные, так как получена ошибка WebSocket');
      this.notifyError(new Error("Ошибка соединения - используем мок-данные"));
    }
    
    this.attemptingReconnect = false;
  }


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
    console.log(`WebSocket соединение закрыто: ${event.code} (${codeDescription})`);
  
    this.connected = false;
    this.connecting = false;
    this.attemptingReconnect = false;
  
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }
  
    if (event.code === 1000 || event.code === 1008) {
      console.log("Не переподключаемся - закрытие было ожидаемым или из-за ошибки политики");
      return;
    }
    
    // В режиме разработки переходим на мок-данные
    if (process.env.NODE_ENV === 'development') {
      console.log('Переходим на мок-данные из-за закрытия соединения');
      this.notifyError(new Error("Соединение закрыто - используем мок-данные"));
      return;
    }
    

    this.reconnect();
  }
  
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
    this.connecting = false;
    this.connectionEstablished = false;
    
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }
    
    if (this.ws) {
      try {
        // Удаляем обработчики событий перед закрытием
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        
        // Проверяем текущее состояние
        const currentState = this.ws.readyState;
        
        // Закрываем соединение только если оно не закрыто и не в процессе закрытия
        if (currentState !== WebSocket.CLOSED && currentState !== WebSocket.CLOSING) {
          this.ws.close(1000, "Нормальное закрытие");
        }
      } catch (error) {
        console.error("Ошибка закрытия WebSocket:", error);
      }
      
      this.ws = null;
    }
    
    this.connected = false;
    this.accessToken = null;
      this.reconnectAttempts = 0;
    this.messageReceivedFlag = false;
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
  

  onUpdateSignal(callback: (token: string, updates: Partial<CryptoCard>) => void): void {
    this.updateSignalCallbacks.push(callback);
  }
  

  onError(callback: (error: any) => void): void {
    this.errorCallbacks.push(callback);
  }
  

  isConnected(): boolean {
    return this.connected;
  }


  private convertSignalToCard(signal: NewSignalMessage): CryptoCard {
    let imageUrl = signal.logo || '';
    if (imageUrl.includes('gmgn.ai/external-res')) {

      imageUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
    } else if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = `https://${imageUrl}`;
    }
    
    const marketCap = signal.market && signal.market.circulatingSupply && signal.market.price 
      ? `$${Math.round(signal.market.circulatingSupply * signal.market.price)}K`
      : "N/A";

    // Адаптивно получаем возраст токена
    const tokenAge = signal.tokenCreatedAt ? this.formatTimestamp(signal.tokenCreatedAt) : "N/A";

    // Социальные ссылки
    const socialLinks: { telegram?: string; twitter?: string; website?: string } = {};
    if (signal.socials) {
      if (signal.socials.tg) socialLinks.telegram = signal.socials.tg;
      if (signal.socials.x) socialLinks.twitter = signal.socials.x;
      if (signal.socials.web) socialLinks.website = signal.socials.web;
    }

    // Перевод пустых значений в нормальный формат
    const top10 = signal.holdings?.top10 !== undefined ? `${Math.round(signal.holdings.top10)}%` : "0%";
    const devWalletHold = signal.holdings?.devHolds !== undefined ? `${Math.round(signal.holdings.devHolds)}%` : "0%";
    const first70BuyersHold = signal.holdings?.first70 !== undefined ? `${Math.round(signal.holdings.first70)}%` : "0%";
    const insiders = signal.holdings?.insidersHolds !== undefined ? `${Math.round(signal.holdings.insidersHolds)}%` : "0%";

    // Преобразуем транзакции в формат китов, если они есть
    const whales = signal.trades && signal.trades.length > 0
      ? signal.trades.slice(0, 3).map(trade => {
          // Используем адрес кошелька для идентификации
          const signerAddress = trade.signer;
          // В поле count передаем адрес кошелька
          return {
            count: signerAddress, // Сам адрес будет обработан на клиенте
            amount: `${Math.round(trade.amountSol * 100) / 100} SOL`
          };
        })
      : [
          { count: "Addr1...Aabc", amount: "1.25 SOL" },
          { count: "Bbcd...Def2", amount: "0.85 SOL" },
          { count: "Cdef...Fgh3", amount: "0.55 SOL" }
        ];

    // Создаем объект карточки с готовыми данными
    return {
      id: signal.token,
      name: signal.name || "Неизвестно",
      symbol: signal.symbol || "???",
      image: imageUrl,
      marketCap,
      tokenAge,
      top10,
      devWalletHold,
      first70BuyersHold,
      insiders,
      whales,
      noMint: true,
      blacklist: false,
      burnt: "100%",
      top10Percentage: top10,
      priceChange: "×1.0", // Будет обновлено позже
      socialLinks
    };
  }


  private convertToCardUpdates(update: UpdateSignalMessage): Partial<CryptoCard> {
    const result: Partial<CryptoCard> = {};
    

    if (update.market) {
      if (update.market.price !== undefined) {
        // Если есть цена, можно обновить marketCap
        if (update.market.circulatingSupply !== undefined) {
          result.marketCap = `$${Math.round(update.market.circulatingSupply * update.market.price)}`;
        }
    

        result.priceChange = "×1.1"; // Заглушка, в реальном приложении нужно вычислять
      }
    }


    if (update.holdings) {
      if (update.holdings.top10 !== undefined) {
        result.top10 = `${Math.round(update.holdings.top10)}%`;
        result.top10Percentage = `${Math.round(update.holdings.top10)}%`;
      }
      
      if (update.holdings.devHolds !== undefined) {
        result.devWalletHold = `${Math.round(update.holdings.devHolds)}%`;
      }
      
      if (update.holdings.first70 !== undefined) {
        result.first70BuyersHold = `${Math.round(update.holdings.first70)}%`;
      }
      
      if (update.holdings.insidersHolds !== undefined) {
        result.insiders = `${Math.round(update.holdings.insidersHolds)}%`;
      }
    }
    
    // Обновляем сделки, если они есть
    if (update.trades && update.trades.length > 0) {
      result.whales = update.trades.slice(0, 3).map(trade => {
        // Используем адрес кошелька для идентификации
        const signerAddress = trade.signer;
        return {
          count: signerAddress,
          amount: `${Math.round(trade.amountSol * 100) / 100} SOL`
        };
      });
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
      return `${Math.floor(diff)}s`;
    } else if (diff < 3600) {
      return `${Math.floor(diff / 60)}m`;
    } else if (diff < 86400) {
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      return `${hours}h ${minutes}m`;
    } else {
      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      return `${days}d ${hours}h`;
    }
  }
}


export const apiGeneral = ApiGeneralService.getInstance();


export const webSocketClient = apiGeneral;


export async function verifyWallet(signature: string, wallet: string, timestamp?: number): Promise<VerifyResponse> {
  return apiGeneral.verifyWallet(signature, wallet, timestamp);
}

export async function checkPayment(): Promise<PaymentResponse> {
  return apiGeneral.checkPayment();
} 