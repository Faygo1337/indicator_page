/**
 * API Configuration and Documentation
 */

export const API_HOST = 'https://whales.trace.foundation';

/**
 * WebSocket Configuration
 * Format: wss://{hostUrl}/ws
 * Headers required:
 * - Authorization: Bearer {{accessToken}}
 */
export const WS_ENDPOINT = `wss://${API_HOST}/ws`;

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  verify: `${API_HOST}/api/verify`,
  payment: `${API_HOST}/payment`,
} as const;

/**
 * JWT Token Payload Interface
 */
export interface JWTPayload {
  createdAt: number;      // Время создания токена
  exp: number;           // Время истечения токена
  iat: number;          // Время выпуска токена
  id: number;           // ID пользователя
  linkedWallet: string; // Привязанный кошелек
  subExpAt: number;     // Время истечения подписки
  topupWallet: string;  // Кошелек для пополнения
}

/**
 * Payment Response Interface
 */
export interface PaymentResponse {
  accessToken: string;         // Токен доступа для сессии
  expireAt: string;           // Время истечения токена
  hasSubscription: boolean;    // Статус подписки
  success: boolean;           // Статус операции
}

/**
 * WebSocket Message Interfaces
 */

export interface MarketData {
  circulatingSupply: number; // Циркулирующее предложение
  price: number;            // Цена
}

export interface HoldingsData {
  top10: number;          // Топ 10 холдеров (%)
  devHolds: number;       // Холды разработчиков (%)
  insidersHolds: number;  // Инсайдерские холды (%)
  first70: number;        // Первые 70 холдеров (%)
}

export interface SocialLinks {
  x?: string;            // Twitter
  web?: string;          // Веб-сайт
  tg?: string;          // Telegram
}

export interface Trade {
  signer: string;     // Адрес подписавшего
  amtSol: number;    // Количество SOL
  timestamp: number;   // Временная метка
}

/**
 * New Signal Message Interface
 * Полное сообщение о новом токене
 */
export interface NewSignalMessage {
  token: string;           // Адрес токена
  name: string;           // Имя токена
  symbol: string;         // Символ токена
  logo: string;          // URL логотипа
  tokenCreatedAt: number; // Время создания токена
  createdAt: number;      // Время создания сигнала
  market: MarketData;
  holdings: HoldingsData;
  socials?: SocialLinks;
  trades: Trade[];
}

/**
 * Update Signal Message Interface
 * Частичное обновление данных токена
 */
export interface UpdateSignalMessage {
  token: string;          // Обязательное поле - идентификатор
  market?: Partial<MarketData>;
  holdings?: Partial<HoldingsData>;
  trades?: Trade[];
}

/**
 * API Request Examples
 */

export const API_EXAMPLES = {
  newSignal: {
    token: "AxSMXaM3KeQ3a6HDfGizJaRnzGqrDHJg3uyZbwZUpump",
    name: "Sarah",
    symbol: "SARAH",
    logo: "https://pump.mypinata.cloud/ipfs/QmT4aKNbU4RhW3yBVkG936exLgXDHVE54F9vft1fN3h4TX",
    tokenCreatedAt: 1744317279,
    market: {
      circulatingSupply: 999998593,
      price: 0.00022113577
    },
    holdings: {
      top10: 69.8007,
      devHolds: 0.4344512167151619,
      insidersHolds: 45.1484,
      first70: 0
    },
    socials: {
      web: "https://VTuber.fun"
    }
  }
} as const;

/**
 * Authentication Flow:
 * 1. Подключение кошелька:
 *    - Отправляется запрос на подписание сообщения
 *    - После подписания получаем JWT токен
 *    - JWT токен содержит информацию о пользователе и подписке
 * 
 * 2. При успешной оплате:
 *    - Получаем PaymentResponse с accessToken
 *    - Токен сохраняется на время сессии
 *    - Используется для всех последующих запросов
 *    - Проверяется hasSubscription для доступа к функционалу
 * 
 * 3. WebSocket соединение:
 *    - Устанавливается после успешной аутентификации
 *    - Использует JWT токен для авторизации
 */ 