export interface CryptoCard {
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
    count: number
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
}

export interface JWTPayload {
  userId: string
  connectedWallet: string
  topupWallet: string
  subscriptionExpireAt: string | null
  jwtToken: string
}

export interface VerifyResponse {
  token: string
  payload: JWTPayload
}

export interface PaymentResponse {
  status: boolean
}
