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

/**
 * Форматирует числовое значение с процентом
 * @param value - числовое значение
 * @param decimals - количество десятичных знаков
 * @returns отформатированная строка с процентом
 */
export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Форматирует денежное значение с символом $
 * @param value - числовое значение
 * @param decimals - количество десятичных знаков
 * @returns отформатированная строка с $
 */
export function formatCurrency(value: number, decimals = 5): string {
  return `$${value.toFixed(decimals)}`;
}

/**
 * Извлекает числовое значение из строки
 * @param value - строка, содержащая число
 * @param defaultValue - значение по умолчанию, если число не удалось извлечь
 * @returns числовое значение
 */
export function extractNumber(value: string, defaultValue = 0): number {
  if (!value) return defaultValue;
  
  // Извлекаем все цифры и точку
  const matches = value.match(/[-+]?([0-9]*\.[0-9]+|[0-9]+)/);
  if (matches && matches[0]) {
    return parseFloat(matches[0]);
  }
  
  return defaultValue;
}

/**
 * Сравнивает два значения с учетом допустимой погрешности
 * @param value1 - первое значение
 * @param value2 - второе значение
 * @param epsilon - допустимая погрешность
 * @returns true, если значения равны с учетом погрешности
 */
export function isApproximatelyEqual(value1: number, value2: number, epsilon = 0.00001): boolean {
  return Math.abs(value1 - value2) < epsilon;
}

/**
 * Создает уникальный идентификатор для отслеживания обновлений
 * @returns строка с уникальным идентификатором
 */
export function generateUpdateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Задержка выполнения на указанное количество миллисекунд
 * @param ms - количество миллисекунд
 * @returns Promise, который разрешится через указанное время
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Извлекает числовое значение из строки с форматированием
 * Например, "$1,234.56" -> 1234.56
 */
export function extractNumericValue(formattedValue?: string): number {
  if (!formattedValue) return 0;
  
  // Используем регулярное выражение для извлечения числа
  // Работает с форматами "$1,234.56", "1,234.56%", "×1.2" и т.д.
  const matches = formattedValue.replace(/[^0-9.-]/g, '').match(/[-+]?([0-9]*\.[0-9]+|[0-9]+)/);
  if (!matches || !matches[0]) return 0;
  
  return parseFloat(matches[0]);
}

/**
 * Форматирует число с разделителями групп разрядов
 */
export function formatNumber(value: number | string, options: {
  isPercent?: boolean;
  decimals?: number;
  prefix?: string;
} = {}): string {
  const { isPercent = false, decimals = isPercent ? 2 : 5, prefix = isPercent ? '' : '$' } = options;
  
  // Преобразуем входное значение в число
  const numValue = typeof value === 'string' ? extractNumericValue(value) : value;
  
  if (isNaN(numValue)) return typeof value === 'string' ? value : '0';
  
  // Форматируем с разделителями тысяч
  const formatter = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  
  const formattedValue = formatter.format(numValue);
  
  // Добавляем символы
  return `${prefix}${formattedValue}${isPercent ? '%' : ''}`;
}
