'use client';
import {
  VerifyResponse,
  PaymentResponse,
  API_ENDPOINTS,
  API_HOST,
  WS_ENDPOINT,
  NewSignalMessage,
  UpdateSignalMessage,
  CryptoCard,
  MarketData,
  HoldingsData,
  ReferralResponse
} from './types';
import { decodeJWT, formatMarketCap } from "@/lib/utils";
import axios from 'axios';



interface AuthVerifyResponse {
  success: boolean;
  status: boolean;
  token: string;
  message?: string;
}



class ApiGeneralService {
  private static instance: ApiGeneralService;
  private ws: WebSocket | null = null;
  private accessToken: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 1000;
  private connected = false;
  private rawUpdateCallbacks: ((token: string, raw: UpdateSignalMessage) => void)[] = [];
  // Новые поля для обработки WebSocket
  private newSignalCallbacks: ((data: CryptoCard) => void)[] = [];
  private updateSignalCallbacks: ((token: string, updates: Partial<CryptoCard>) => void)[] = [];
  private errorCallbacks: ((error: unknown) => void)[] = [];

  private constructor() { }

  static getInstance(): ApiGeneralService {
    if (!ApiGeneralService.instance) {
      ApiGeneralService.instance = new ApiGeneralService();
    }
    return ApiGeneralService.instance;
  }

  // /**
  //  * Верификация кошелька
  //  * @param signature подпись сообщения
  //  * @param wallet адрес кошелька
  //  * @param timestamp временная метка для синхронизации запроса
  //  * @param referralCode реферальный код
  //  * @returns информация о верификации
  //  */
  async verifyWallet(
    signature: string,
    wallet: string,
    timestamp?: number,
    referralId?: string
  ): Promise<VerifyResponse> {

    try {
      // Преобразуем referralId в число
      const refNumber = referralId ? parseInt(referralId, 10) : 0;

      // Подготавливаем данные для запроса
      const dataPost = {
        timestamp: timestamp || Date.now(),
        ref: refNumber, // Теперь отправляем как число
        signature: signature,
        wallet: wallet
      };

      const response = await axios.post(`${API_HOST}/api/verify`, dataPost, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      });


      const apiResponse = response.data;

      if ('token' in apiResponse) {
        const authResponse = apiResponse as AuthVerifyResponse;

        return {
          token: authResponse.token || '',
          payload: authResponse.token ? decodeJWT(authResponse.token) : null,
        };
      } else {
        return {
          token: apiResponse.token || '',
          payload: null,
        };
      }
    } catch (error) {
      this.handleWebSocketError(error);
      throw error;
    }
  }


  async checkPayment(): Promise<PaymentResponse> {
    try {

      // Реальная реализация запроса к API
      const url = API_ENDPOINTS.payment;



      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
      });


      // Получаем данные из response.data
      const data = response.data;

      if (data.success && data.accessToken) {
        this.accessToken = data.accessToken;
      }

      return data;
    } catch (error) {
      this.handleWebSocketError(error);
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
      return;
    }

    // Если уже идет процесс подключения - не запускаем новый
    if (this.connecting) {
      return;
    }

    if (!token) {

      this.notifyError(new Error("No access token"));
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
      } catch {
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
        this.notifyError(new Error("WebSocket API not supported"));
        this.attemptingReconnect = false;
        return;
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
          this.ws.close(4000, "Connection timeout");
          this.attemptingReconnect = false;
        }
      }, 15000);
    } catch (error) {
      this.connecting = false;
      this.notifyError(error);
      this.attemptingReconnect = false;
    }
  }

  /**
   * Обработчик открытия соединения
   */
  private handleOpen(): void {

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
      return;
    }

    if (!this.accessToken) {
      return;
    }

    try {
      // Используем правильный формат авторизации
      this.ws.send(JSON.stringify({ authToken: this.accessToken }));

      // Установим флаг успешного подключения после отправки
      this.connectionEstablished = true;
    } catch (error) {
      this.notifyError(error);
    }
  }

  public onRawUpdateSignal(callback: (token: string, raw: UpdateSignalMessage) => void): void {
    this.rawUpdateCallbacks.push(callback);
  }

  /**
   * Обработчик входящих сообщений
   */
  private handleMessage(event: MessageEvent): void {
    try {
      // Убеждаемся, что сообщение можно разобрать как JSON
      let message: unknown;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }


      // Проверяем, является ли сообщение объектом
      if (!message || typeof message !== 'object') {
        return;
      }

      const msgObj = message as Record<string, unknown>;

      // Проверяем есть ли у сообщения поле token и type
      if ('type' in msgObj && msgObj.type === 'update' && 'token' in msgObj && typeof msgObj.token === 'string') {
        const token = msgObj.token;
        this.rawUpdateCallbacks.forEach(cb => cb(token, msgObj as unknown as UpdateSignalMessage));
      } else if ('type' in msgObj && msgObj.type === 'new') {
        this.newSignalCallbacks.forEach(cb => cb(msgObj as unknown as CryptoCard));
      }
      // Проверяем специальный случай - сообщение с token и market, но без type
      else if ('token' in msgObj && typeof msgObj.token === 'string' && 'market' in msgObj) {
        const token = msgObj.token as string;

        const updateMessage: UpdateSignalMessage = {
          token: token,
          market: msgObj.market as Partial<MarketData>,
          holdings: msgObj.holdings as Partial<HoldingsData>
        };


        const cardUpdates = this.convertToCardUpdates(updateMessage);

        this.notifyUpdateSignal(token, cardUpdates);
      }

      this.messageReceivedFlag = true;
    } catch (err) {
      this.notifyError(err);
    }
  }


  private handleError(): void {

    this.connectionEstablished = false;

    // Просто передаем ошибку
    this.notifyError(new Error("Error connected to WebSocket"));

    this.attemptingReconnect = false;
  }


  private handleClose(event: CloseEvent): void {
    // const codeMap: Record<number, string> = {
    //   1000: "Нормальное закрытие",
    //   1001: "Перезагрузка/уход",
    //   1002: "Ошибка протокола",
    //   1003: "Неприемлемые данные",
    //   1006: "Аномальное закрытие",
    //   1007: "Неверные данные",
    //   1008: "Нарушение политики",
    //   1009: "Сообщение слишком большое",
    //   1010: "Требуется расширение",
    //   1011: "Неожиданная ошибка",
    //   1012: "Перезагрузка сервиса",
    //   1013: "Попробуйте позже",
    //   1014: "Ошибка на прокси",
    //   1015: "Сбой TLS"
    // };

    // const codeDescription = codeMap[event.code] || "Неизвестный код";

    this.connected = false;
    this.connecting = false;
    this.attemptingReconnect = false;

    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }

    if (event.code === 1000 || event.code === 1008) {
      return;
    }

    // Всегда пытаемся переподключиться
    this.reconnect();
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectTimeout * this.reconnectAttempts;


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
      } catch {
        return;
      }

      this.ws = null;
    }

    this.connected = false;
    this.accessToken = null;
    this.reconnectAttempts = 0;
    this.messageReceivedFlag = false;
  }

  /**
   * Уведомление о новом сигнале
   */
  // private notifyNewSignal(data: CryptoCard): void {
  //   for (const callback of this.newSignalCallbacks) {
  //     try {
  //       callback(data);
  //     } catch (error) {
  //       console.error("Ошибка в обработчике нового сигнала:", error);
  //     }
  //   }
  // }

  /**
   * Уведомление об обновлении сигнала
   */
  private notifyUpdateSignal(token: string, updates: Partial<CryptoCard>): void {
    for (const callback of this.updateSignalCallbacks) {
      try {
        callback(token, updates);
      } catch {
        return;
      }
    }
  }

  /**
   * Уведомление об ошибке
   */
  private notifyError(error: unknown): void {
    for (const callback of this.errorCallbacks) {
      try {
        callback(error);
      } catch {
        return;
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


  onError(callback: (error: unknown) => void): void {
    this.errorCallbacks.push(callback);
  }

  isConnected(): boolean {
    return this.connected;
  }
  // private formatTimestamp(timestamp: number): string {
  //   const date = new Date(timestamp * 1000); // предполагаем, что timestamp в секундах
  //   return date.toLocaleDateString(undefined, {
  //     year: "numeric",
  //     month: "short",
  //     day: "numeric",
  //   });
  // }

  // private previousPrices: Map<string, number> = new Map();

  // private convertSignalToCard(signal: NewSignalMessage): CryptoCard {
  //   let imageUrl = signal.logo || '';
  //   if (imageUrl.includes('gmgn.ai/external-res')) {

  //     imageUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
  //   } else if (imageUrl && !imageUrl.startsWith('http')) {
  //     imageUrl = `https://${imageUrl}`;
  //   }

  //   const marketCap = signal.market && signal.market.circulatingSupply && signal.market.price
  //     ? `$${Math.round(signal.market.circulatingSupply * signal.market.price)}K`
  //     : "N/A";

  //   // Адаптивно получаем возраст токена
  //   const tokenAge = signal.tokenCreatedAt ? this.formatTimestamp(signal.tokenCreatedAt) : "N/A";

  //   // Социальные ссылки
  //   const socialLinks: { telegram?: string; twitter?: string; website?: string } = {};
  //   if (signal.socials) {
  //     if (signal.socials.tg) socialLinks.telegram = signal.socials.tg;
  //     if (signal.socials.x) socialLinks.twitter = signal.socials.x;
  //     if (signal.socials.web) socialLinks.website = signal.socials.web;
  //   }

  //   // Перевод пустых значений в нормальный формат
  //   const top10 = signal.holdings?.top10 !== undefined ? `${Math.round(signal.holdings.top10)}%` : "0%";
  //   const devWalletHold = signal.holdings?.devHolds !== undefined ? `${Math.round(signal.holdings.devHolds)}%` : "0%";
  //   const first70BuyersHold = signal.holdings?.first70 !== undefined ? `${Math.round(signal.holdings.first70)}%` : "0%";
  //   const insiders = signal.holdings?.insidersHolds !== undefined ? `${Math.round(signal.holdings.insidersHolds)}%` : "0%";

  //   // Преобразуем транзакции в формат китов, только из реальных данных
  //   const whales = signal.trades && signal.trades.length > 0
  //     ? signal.trades.slice(0, 3).map(trade => ({
  //       count: Math.round(trade.amtSol * 10).toString(), // 👈 преобразуем в строку
  //       amount: `${Math
  //         .round(trade.amtSol * 100) / 100} SOL`
  //     }))
  //     : [];

  //   let priceChange = "×1.0"; // по умолчанию
  //   const tokenId = signal.token;

  //   // Сохраняем текущую цену
  //   if (signal.market?.price !== undefined) {
  //     const newPrice = signal.market.price;

  //     // Получаем предыдущую цену из кэша (если есть)
  //     const prevPrice = this.previousPrices.get(tokenId);

  //     // Вычисляем и сохраняем коэффициент изменения
  //     if (prevPrice && prevPrice > 0) {
  //       const ratio = newPrice / prevPrice;
  //       priceChange = `×${ratio.toFixed(2)}`;
  //     }

  //     // Обновляем предыдущую цену
  //     this.previousPrices.set(tokenId, newPrice);
  //   }

  //   // Создаем объект карточки с готовыми данными
  //   return {
  //     id: signal.token,
  //     name: signal.name || "Неизвестно",
  //     symbol: signal.symbol || "???",
  //     image: imageUrl,
  //     marketCap,
  //     tokenAge,
  //     top10,

  //     devWalletHold,
  //     first70BuyersHold,
  //     insiders,
  //     whales, // 👈 ВСТАВИЛИ СЮДА
  //     noMint: true,
  //     blacklist: false,
  //     burnt: "100%",
  //     top10Percentage: top10,
  //     priceChange,
  //     socialLinks,
  //   };


  // }

  // Дополнение к api-general.ts

  private circulatingSupplyMap: Map<string, number> = new Map();

  // Хранилище предыдущих marketCap (локально, без стейта)
  private previousMarketCaps: Map<string, number> = new Map();

  public convertToCardUpdates(update: UpdateSignalMessage): Partial<CryptoCard> {
    const result: Partial<CryptoCard> = {};


    if (update.market) {
      const price = update.market.price;

      // Получаем и сохраняем circulatingSupply один раз на токен
      const savedSupply = this.circulatingSupplyMap.get(update.token);

      if (update.market.circulatingSupply !== undefined && !savedSupply) {
        this.circulatingSupplyMap.set(update.token, update.market.circulatingSupply);
      }

      const supplyToUse = savedSupply ?? update.market.circulatingSupply;

      if (price !== undefined && supplyToUse !== undefined) {
        const newMarketCap = price * supplyToUse;
        result.marketCap = formatMarketCap(newMarketCap);

        const previousCap = this.previousMarketCaps.get(update.token);

        if (previousCap && previousCap > 0) {
          const ratio = newMarketCap / previousCap;
          result.priceChange = `×${ratio.toFixed(2)}`;
        } else {
          result.priceChange = `×1.00`;
        }

        // Сохраняем новый marketCap
        this.previousMarketCaps.set(update.token, newMarketCap);

      }
    }

    if (update.holdings) {
      if (update.holdings.top10 !== undefined) {
        const top10Str = `${update.holdings.top10.toFixed(2)}%`;
        result.top10 = top10Str;
        result.top10Percentage = top10Str;
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



    return result;
  }

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Публичный метод для получения информации о состоянии соединения
   */
  public getConnectionInfo(): {
    connected: boolean;
    connecting: boolean;
    reconnectAttempts: number;
    connectionEstablished: boolean;
  } {
    return {
      connected: this.connected,
      connecting: this.connecting,
      reconnectAttempts: this.reconnectAttempts,
      connectionEstablished: this.connectionEstablished
    };
  }

  /**
   * Публичный метод для обработки сообщений WebSocket
   * @param message - строка сообщения от WebSocket
   * @returns обработанное сообщение с данными или null при ошибке
   */
  public processWebSocketMessage(message: string): {
    type: 'new' | 'update' | 'unknown';
    data: Record<string, unknown> | null;
    cardUpdates?: Partial<CryptoCard>;
    error?: string;
  } {
    try {
      // Пытаемся разобрать JSON из строки
      let parsedMessage: Record<string, unknown>;
      try {
        parsedMessage = JSON.parse(message);
      } catch {
        return {
          type: 'unknown',
          data: null,
          error: 'Error parsing message'
        };
      }

      // Проверяем, является ли сообщение объектом
      if (!parsedMessage || typeof parsedMessage !== 'object') {
        return {
          type: 'unknown',
          data: null,
          error: 'Message is not an object'
        };
      }

      // Проверяем есть ли явное поле type
      if ('type' in parsedMessage) {
        const msgType = parsedMessage.type as string;

        if (msgType === 'update' && 'token' in parsedMessage) {
          const updateMsg = parsedMessage as unknown as UpdateSignalMessage;
          const cardUpdates = this.convertToCardUpdates(updateMsg);
          return {
            type: 'update',
            data: parsedMessage,
            cardUpdates
          };
        }

        if (msgType === 'new') {
          return { type: 'new', data: parsedMessage };
        }
      }

      return {
        type: 'unknown',
        data: parsedMessage,
        error: 'Unknown type of message'
      };

    } catch (err) {

      return {
        type: 'unknown',
        data: null,
        error: err instanceof Error ? err.message : 'Error processing message'
      };
    }
  }

  private handleWebSocketError(error: unknown): void {
    // Уведомляем всех подписчиков об ошибке
    for (const callback of this.errorCallbacks) {
      callback(error);
    }
  }

}

export const apiGeneral = ApiGeneralService.getInstance();


export const webSocketClient = apiGeneral;


export async function verifyWallet(
  signature: string,
  wallet: string,
  timestamp?: number,
  referralId?: string
): Promise<VerifyResponse> {
  return apiGeneral.verifyWallet(signature, wallet, timestamp, referralId);

}

export async function checkPayment(): Promise<PaymentResponse> {
  return apiGeneral.checkPayment();
}

export async function getReferralStats(): Promise<ReferralResponse> {
  try {
    const response = await axios.get(API_ENDPOINTS.referral, {
      headers: {
        'Authorization': `Bearer ${apiGeneral.getAccessToken()}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch {

    return { refCount: 0, refEarnings: 0 };
  }
}

export const convertToCardUpdates = (update: UpdateSignalMessage): Partial<CryptoCard> =>
  ApiGeneralService.getInstance().convertToCardUpdates(update);

export const getConnectionInfo = () => apiGeneral.getConnectionInfo();

/**
 * Обработчик WebSocket сообщений, который можно использовать во внешних компонентах
 * @param messageData Данные сообщения от WebSocket
 */
export const processWebSocketMessage = (messageData: string) =>
  ApiGeneralService.getInstance().processWebSocketMessage(messageData);