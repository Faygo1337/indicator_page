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

/**
 * Форматирует значение Market Cap с суффиксами K, M, B
 * Например: $320.22K, $3.2M, $5.67B
 */
export function formatMarketCap(value: number | string): string {
  // Преобразуем входное значение в число
  const numValue = typeof value === 'string' ? extractNumericValue(value) : value;
  
  if (isNaN(numValue)) return typeof value === 'string' ? value : '$0';
  
  // Если значение меньше 1000, округляем до целого
  if (numValue < 1000) {
    return `$${Math.round(numValue)}`;
  }
  
  // Определяем суффикс и делитель
  let suffix = '';
  let divider = 1;
  
  if (numValue >= 1000000000) {
    suffix = 'B';
    divider = 1000000000;
  } else if (numValue >= 1000000) {
    suffix = 'M';
    divider = 1000000;
  } else {
    suffix = 'K';
    divider = 1000;
  }
  
  // Форматируем число с точкой в качестве разделителя десятичной части
  const formattedValue = (numValue / divider).toFixed(2);
  
  // Убираем лишние нули после запятой (например, 3.20M -> 3.2M)
  const cleanedValue = formattedValue.replace(/\.?0+$/, '');
  
  return `$${cleanedValue}${suffix}`;
}

/**
 * Преобразует строку возраста токена в количество секунд
 * Поддерживаемые форматы: "10d", "5h 30m", "2d 5h", "30s"
 * @param tokenAge строка с возрастом токена
 * @returns количество секунд или 0, если формат некорректен
 */
export function parseTokenAge(tokenAge?: string): number {
  if (!tokenAge || tokenAge === "N/A") return 0;
  
  // Количество секунд
  let seconds = 0;
  
  // Проверяем формат "10d" (только дни)
  const daysMatch = tokenAge.match(/^(\d+)d$/);
  if (daysMatch) {
    return parseInt(daysMatch[1]) * 86400; // 1 день = 86400 секунд
  }
  
  // Проверяем формат "10" (предполагаем, что это дни)
  const numericMatch = tokenAge.match(/^(\d+)$/);
  if (numericMatch) {
    return parseInt(numericMatch[1]) * 86400;
  }
  
  // Проверяем формат "5h 30m" (часы и минуты)
  const hoursMinutesMatch = tokenAge.match(/^(\d+)h\s+(\d+)m$/);
  if (hoursMinutesMatch) {
    const hours = parseInt(hoursMinutesMatch[1]);
    const minutes = parseInt(hoursMinutesMatch[2]);
    return hours * 3600 + minutes * 60;
  }
  
  // Проверяем формат "2d 5h" (дни и часы)
  const daysHoursMatch = tokenAge.match(/^(\d+)d\s+(\d+)h$/);
  if (daysHoursMatch) {
    const days = parseInt(daysHoursMatch[1]);
    const hours = parseInt(daysHoursMatch[2]);
    return days * 86400 + hours * 3600;
  }
  
  // Если другой формат - пытаемся извлечь все числа и единицы измерения
  const patterns = [
    { regex: /(\d+)d/, multiplier: 86400 }, // дни
    { regex: /(\d+)h/, multiplier: 3600 },  // часы
    { regex: /(\d+)m/, multiplier: 60 },    // минуты
    { regex: /(\d+)s/, multiplier: 1 }      // секунды
  ];
  
  patterns.forEach(pattern => {
    const match = tokenAge.match(pattern.regex);
    if (match) {
      seconds += parseInt(match[1]) * pattern.multiplier;
    }
  });
  
  return seconds;
}
