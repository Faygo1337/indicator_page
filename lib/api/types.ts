export type CryptoCard = {
  id: string
  name: string
  symbol: string
  image: string
  marketCap: string
  tokenAge: string
  top10: string
  devWalletHold: string
  first70BuyersHold: string
  insiders: string
  whales: {
    count: string
    amount: string
  }[]
  noMint: boolean
  blacklist: boolean
  burnt: string
  top10Percentage: string
  priceChange: string
  socialLinks: {
    telegram?: string
    twitter?: string
    website?: string
  }
  _lastUpdated?: number;
  _updateId?: string;
  _receivedAt?: number;
}


export const API_HOST = 'https://whales.trace.foundation';

export const WS_ENDPOINT = 'wss://whales.trace.foundation/api/stream';

export const API_ENDPOINTS = {
  verify: `${API_HOST}/api/verify`,
  payment: `${API_HOST}/api/payment`,
  referral: `${API_HOST}/api/referral`,
} as const;


export interface JWTPayload {
  id: number;           // ID пользователя
  createdAt: number;
  exp: number;
  iat: number;
  linkedWallet: string;
  subExpAt: number;
  topupWallet: string;
  referrerId?: number;  // ID реферера, если пользователь был приглашен
  referralCount: number; // Количество приглашенных рефералов
  referralEarnings: number; // Заработанные SOL с рефералов
}

export interface PaymentResponse {
  accessToken: string;
  expireAt: string;
  hasSubscription: boolean;
  success: boolean;
  referralBonus?: number;    // Добавляем поле для реферального бонуса
}


export interface MarketData {
  circulatingSupply: number;
  price: number;
}

export interface HoldingsData {
  top10: number;
  devHolds: number;
  insidersHolds: number;
  first70: number;
}

export interface SocialLinks {
  x?: string;
  web?: string;
  tg?: string;
}

export interface Trade {
  signer: string;
  amtSol: number;
  timestamp: number;
}


export interface NewSignalMessage {
  token: string;
  name: string;
  symbol: string;
  logo: string;
  tokenCreatedAt: number;
  createdAt: number;
  market: MarketData;
  holdings: HoldingsData;
  socials?: SocialLinks;
  trades: Trade[];
}

export interface UpdateSignalMessage {
  token: string;
  market?: Partial<MarketData>;
  holdings?: Partial<HoldingsData>;
  trades?: Trade[];

  priceChange?: string;
  tokenAge?: string;
  whales?: {
    count: string;
    amount: string;
  }[];
  socials?: {
    telegram?: string;
    twitter?: string;
    website?: string;
  };
  noMint?: boolean;
  blacklist?: boolean;
  burnt?: string;

}

export interface VerifyResponse {
  token: string;
  payload: JWTPayload | null;
}

export interface ReferralResponse {
  refCount: number;
  refEarnings: number;
}

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