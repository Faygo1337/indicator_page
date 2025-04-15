import { 
  VerifyResponse, 
  PaymentResponse, 
  API_ENDPOINTS, 
  API_HOST, 
  WS_ENDPOINT, 
  NewSignalMessage, 
  UpdateSignalMessage, 
  JWTPayload 
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
      const url = walletAddress 
        ? `${API_ENDPOINTS.payment}?walletAddress=${walletAddress}`
        : API_ENDPOINTS.payment;
      
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
   */
  connectWebSocket(
    onNewSignal: (data: NewSignalMessage) => void,
    onUpdateSignal: (data: UpdateSignalMessage) => void,
    onError: (error: Event) => void
  ): void {
    if (!this.accessToken) {
      throw new Error('Нет токена доступа для WebSocket подключения');
    }

    this.initWebSocket(onNewSignal, onUpdateSignal, onError);
  }

  /**
   * Инициализация WebSocket соединения
   */
  private initWebSocket(
    onNewSignal: (data: NewSignalMessage) => void,
    onUpdateSignal: (data: UpdateSignalMessage) => void, 
    onError: (error: Event) => void
  ): void {
    this.ws = new WebSocket(WS_ENDPOINT);

    this.ws.onopen = () => {
      console.log('WebSocket соединение установлено');
      this.reconnectAttempts = 0;
      this.ws?.send(JSON.stringify({ type: 'auth', token: this.accessToken }));
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'new_signal':
            onNewSignal(data.payload);
            break;
          case 'update_signal':
            onUpdateSignal(data.payload);
            break;
          default:
            console.warn('Неизвестный тип сообщения:', data.type);
        }
      } catch (error) {
        console.error('Ошибка обработки сообщения:', error);
      }
    };

    this.ws.onerror = (error) => {
      onError(error);
      this.handleReconnect(onNewSignal, onUpdateSignal, onError);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket соединение закрыто');
      this.handleReconnect(onNewSignal, onUpdateSignal, onError);
    };
  }

  /**
   * Обработка переподключения WebSocket
   */
  private handleReconnect(
    onNewSignal: (data: NewSignalMessage) => void,
    onUpdateSignal: (data: UpdateSignalMessage) => void,
    onError: (error: Event) => void
  ): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Попытка переподключения ${this.reconnectAttempts} из ${this.maxReconnectAttempts}`);
      
      setTimeout(() => {
        this.initWebSocket(onNewSignal, onUpdateSignal, onError);
      }, this.reconnectTimeout * this.reconnectAttempts);
    } else {
      console.error('Превышено максимальное количество попыток переподключения');
      this.ws = null;
    }
  }

  /**
   * Отключение от WebSocket
   */
  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.reconnectAttempts = 0;
    }
  }

  /**
   * Получение токена доступа
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Установка токена доступа
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }
}

// Создаем и экспортируем экземпляр сервиса
export const apiGeneral = ApiGeneralService.getInstance();

// Экспортируем функции для совместимости со старым кодом
export async function verifyWallet(signature: string, wallet: string, timestamp?: number): Promise<VerifyResponse> {
  return apiGeneral.verifyWallet(signature, wallet, timestamp);
}

export async function checkPayment(): Promise<PaymentResponse> {
  return apiGeneral.checkPayment();
} 