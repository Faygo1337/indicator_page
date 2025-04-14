import { API_ENDPOINTS, API_HOST, WS_ENDPOINT, JWTPayload, PaymentResponse, VerifyResponse, NewSignalMessage, UpdateSignalMessage } from './types';

class ApiService {
  private static instance: ApiService;
  private ws: WebSocket | null = null;
  private accessToken: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 1000;

  private constructor() {}

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  async verifyWallet(walletAddress: string, signature: string): Promise<VerifyResponse> {
    try {
      const response = await fetch(API_ENDPOINTS.verify, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ walletAddress, signature }),
      });

      if (!response.ok) {
        throw new Error('Ошибка верификации');
      }

      const data = await response.json();
      this.accessToken = data.token;
      return data;
    } catch (error) {
      console.error('Ошибка верификации:', error);
      throw error;
    }
  }

  async checkPayment(walletAddress: string): Promise<PaymentResponse> {
    try {
      const response = await fetch(`${API_ENDPOINTS.payment}?walletAddress=${walletAddress}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Ошибка проверки платежа');
      }

      const data = await response.json();
      if (data.success) {
        this.accessToken = data.accessToken;
      }
      return data;
    } catch (error) {
      console.error('Ошибка проверки платежа:', error);
      throw error;
    }
  }

  connectWebSocket(
    onNewSignal: (data: NewSignalMessage) => void,
    onUpdateSignal: (data: UpdateSignalMessage) => void,
    onError: (error: Event) => void
  ): void {
    if (!this.accessToken) {
      throw new Error('Нет токена доступа');
    }

    this.initWebSocket(onNewSignal, onUpdateSignal, onError);
  }

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

  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.reconnectAttempts = 0;
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }
}

export const apiService = ApiService.getInstance();