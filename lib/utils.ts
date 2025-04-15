import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { jwtDecode } from "jwt-decode"
import type { JWTPayload } from "./api/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatWalletAddress(address: string): string {
  if (!address) return ""
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

export function decodeJWT(token: string): JWTPayload | null {
  try {
    return jwtDecode<JWTPayload>(token)
  } catch (error) {
    console.error("Failed to decode JWT:", error)
    return null
  }
}

export function isSubscriptionValid(payload: JWTPayload | null): boolean {
  if (!payload || !payload.subExpAt) return false

  const expireDate = new Date(payload.subExpAt)
  const now = new Date()

  return expireDate > now
}

/**
 * Логирует декодированный JWT токен в консоль с форматированием
 * @param token - JWT токен в формате строки
 * @returns Декодированный объект JWT токена или null, если декодирование не удалось
 */
export function logDecodedJWT(token: string): JWTPayload | null {
  const decoded = decodeJWT(token)
  
  if (decoded) {
    console.group('Decode JWT:')
    console.log('ID:', decoded.id)
    console.log('linkedWallet:', decoded.linkedWallet)
    console.log('topupWallet:', decoded.topupWallet)
    console.log('subExpAt:', new Date(decoded.subExpAt).toLocaleString())
    console.log('createdAt:', new Date(decoded.createdAt).toLocaleString())
    console.log('decoded.exp * 1000:', new Date(decoded.exp * 1000).toLocaleString())
    console.log('decoded.iat * 1000:', new Date(decoded.iat * 1000).toLocaleString())
    console.groupEnd()
  } else {
    console.error('Не удалось декодировать JWT токен')
  }
  
  return decoded
}
