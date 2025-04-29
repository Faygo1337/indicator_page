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

  async verifyWallet(
    signature: string,
    wallet: string,
    timestamp?: number,
    referralId?: string
  ): Promise<VerifyResponse> {

    try {
      const refNumber = referralId ? parseInt(referralId, 10) : 0;

      const dataPost = {
        timestamp: timestamp || Date.now(),
        ref: refNumber,
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
      const url = API_ENDPOINTS.payment;
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
      });
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

  private connecting = false;
  private connectionEstablished = false;

  async connect(token: string): Promise<void> {
    if (this.connected && this.accessToken === token && this.connectionEstablished) {
      return;
    }

    if (this.connecting) {
      return;
    }

    if (!token) {

      this.notifyError(new Error("No access token"));
      return;
    }

    this.disconnect();

    this.accessToken = token;
    this.connecting = true;
    this.connectionEstablished = false;

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      this.initWebSocket();
    } catch (error) {
      this.notifyError(error);
      this.connecting = false;
    }
  }

  private connectionTimeoutId: number | null = null;
  private messageReceivedFlag = false;
  private attemptingReconnect = false;

  private initWebSocket(): void {
    if (this.attemptingReconnect) {
      return;
    }

    this.attemptingReconnect = true;

    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;

        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close(1000, "Закрытие перед новым подключением");
        }

        setTimeout(() => {
          this.ws = null;
          this.initWebSocketInternal();
        }, 1000);

        return;
      } catch {
        this.ws = null;
      }
    }

    this.initWebSocketInternal();
  }


  private initWebSocketInternal(): void {
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }

    try {
      if (typeof WebSocket === 'undefined') {
        this.notifyError(new Error("WebSocket API not supported"));
        this.attemptingReconnect = false;
        return;
      }


      this.messageReceivedFlag = false;

      this.ws = new WebSocket(WS_ENDPOINT);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);

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

  private handleOpen(): void {

    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }
    this.connected = true;
    this.connecting = false;
    this.attemptingReconnect = false;
    this.reconnectAttempts = 0;
    this.sendAuthMessage();
    this.connectionEstablished = true;
  }


  private sendAuthMessage(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    if (!this.accessToken) {
      return;
    }

    try {
      this.ws.send(JSON.stringify({ authToken: this.accessToken }));
      this.connectionEstablished = true;
    } catch (error) {
      this.notifyError(error);
    }
  }

  public onRawUpdateSignal(callback: (token: string, raw: UpdateSignalMessage) => void): void {
    this.rawUpdateCallbacks.push(callback);
  }


  private handleMessage(event: MessageEvent): void {
    try {
      let message: unknown;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }


      if (!message || typeof message !== 'object') {
        return;
      }

      const msgObj = message as Record<string, unknown>;

      if ('type' in msgObj && msgObj.type === 'update' && 'token' in msgObj && typeof msgObj.token === 'string') {
        const token = msgObj.token;
        this.rawUpdateCallbacks.forEach(cb => cb(token, msgObj as unknown as UpdateSignalMessage));
      } else if ('type' in msgObj && msgObj.type === 'new') {
        this.newSignalCallbacks.forEach(cb => cb(msgObj as unknown as CryptoCard));
      }
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
    this.notifyError(new Error("Error connected to WebSocket"));
    this.attemptingReconnect = false;
  }


  private handleClose(event: CloseEvent): void {
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

  disconnect(): void {
    this.connecting = false;
    this.connectionEstablished = false;

    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }

    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;

        const currentState = this.ws.readyState;

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

  private notifyUpdateSignal(token: string, updates: Partial<CryptoCard>): void {
    for (const callback of this.updateSignalCallbacks) {
      try {
        callback(token, updates);
      } catch {
        return;
      }
    }
  }


  private notifyError(error: unknown): void {
    for (const callback of this.errorCallbacks) {
      try {
        callback(error);
      } catch {
        return;
      }
    }
  }

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

  private circulatingSupplyMap: Map<string, number> = new Map();

  private previousMarketCaps: Map<string, number> = new Map();

  public convertToCardUpdates(update: UpdateSignalMessage): Partial<CryptoCard> {
    const result: Partial<CryptoCard> = {};


    if (update.market) {
      const price = update.market.price;
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


  public processWebSocketMessage(message: string): {
    type: 'new' | 'update' | 'unknown';
    data: Record<string, unknown> | null;
    cardUpdates?: Partial<CryptoCard>;
    error?: string;
  } {
    try {
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

      if (!parsedMessage || typeof parsedMessage !== 'object') {
        return {
          type: 'unknown',
          data: null,
          error: 'Message is not an object'
        };
      }

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

export const processWebSocketMessage = (messageData: string) =>
  ApiGeneralService.getInstance().processWebSocketMessage(messageData);