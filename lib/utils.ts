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


// export function logDecodedJWT(token: string): JWTPayload | null {
//   const decoded = decodeJWT(token)

//   if (decoded) {
//     console.group('Decode JWT:')
//     console.log('ID:', decoded.id)
//     console.log('linkedWallet:', decoded.linkedWallet)
//     console.log('topupWallet:', decoded.topupWallet)
//     console.log('subExpAt:', new Date(decoded.subExpAt).toLocaleString())
//     console.log('createdAt:', new Date(decoded.createdAt).toLocaleString())
//     console.log('decoded.exp * 1000:', new Date(decoded.exp * 1000).toLocaleString())
//     console.log('decoded.iat * 1000:', new Date(decoded.iat * 1000).toLocaleString())
//     console.groupEnd()
//   } else {
//     console.error('Не удалось декодировать JWT токен')
//   }

//   return decoded
// }

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
 * Форматирует число с десятичным разделителем "." и без группировки
 */
export function formatNumber(
  value: number | string,
  options: { isPercent?: boolean; decimals?: number; prefix?: string } = {}
): string {
  const { isPercent = false, decimals = isPercent ? 2 : 5, prefix = isPercent ? '' : '$' } = options;
  const num = typeof value === 'string' ? extractNumericValue(value) : value;
  if (isNaN(num)) return typeof value === 'string' ? value : '0';
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: false,
  });
  const str = formatter.format(num);
  return `${prefix}${str}${isPercent ? '%' : ''}`;
}

/**
 * Форматирует marketCap:
 * - <1000 → целое ($999)
 * - ≥1K → с суффиксом K/M/B, две десятичные, точка
 */
export function formatMarketCap(value: number | string): string {
  const num = typeof value === 'string' ? extractNumericValue(value) : value;
  if (isNaN(num)) return typeof value === 'string' ? value : '$0';
  if (num < 1000) return `$${Math.round(num)}`;

  let suffix: 'K' | 'M' | 'B' = 'K';
  let divider = 1e3;
  if (num >= 1e9) {
    suffix = 'B'; divider = 1e9;
  } else if (num >= 1e6) {
    suffix = 'M'; divider = 1e6;
  }
  // два знака после точки
  let str = (num / divider).toFixed(2);
  // убрать лишние нули
  str = str.replace(/\.0+$/, '').replace(/(\.[1-9])0+$/, '$1');
  return `$${str}${suffix}`;
}

/**
 * Преобразует строку с возрастом токена в секунды
 * Поддерживаемые форматы: "10d", "5h 30m", "1d 12h", "new", "N/A", "24s" и т.д.
 * @param ageString строка с возрастом токена
 * @returns количество секунд или 0 для новых токенов
 */
export function parseTokenAge(ageString: string): number {
  if (!ageString) return 0;

  // Проверка на пустую строку или неподдерживаемые форматы
  if (!ageString || ageString.trim() === "" ||
    ageString.toLowerCase() === "new" ||
    ageString === "N/A") {
    return 0;
  }

  // Проверяем формат "×N" (множитель)
  if (ageString.includes('×')) {
    return 0; // Возвращаем 0, чтобы не влиять на сортировку
  }

  try {
    let totalSeconds = 0;

    // Регулярное выражение для захвата всех временных интервалов (цифра + единица измерения)
    const timePattern = /(\d+)\s*([dhms])/gi;
    let match;
    let foundMatch = false;

    // Поиск всех совпадений времени в строке
    while ((match = timePattern.exec(ageString)) !== null) {
      foundMatch = true;
      const value = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();

      if (!isNaN(value)) {
        switch (unit) {
          case 'd':
            totalSeconds += value * 86400; // дни в секунды
            break;
          case 'h':
            totalSeconds += value * 3600; // часы в секунды
            break;
          case 'm':
            totalSeconds += value * 60; // минуты в секунды
            break;
          case 's':
            totalSeconds += value; // секунды
            break;
        }
      }
    }

    // Если не нашли ни одного совпадения с форматом времени, пробуем интерпретировать как число
    if (!foundMatch) {
      // Пытаемся извлечь число из строки
      const numericMatch = ageString.match(/(\d+(\.\d+)?)/);
      if (numericMatch && numericMatch[1]) {
        const numValue = parseFloat(numericMatch[1]);
        if (!isNaN(numValue)) {
          // Предполагаем, что это число в днях
          totalSeconds = numValue * 86400;
        }
      } else {
        return 0;
      }
    }

    // Проверка на валидность результата
    if (totalSeconds < 0) {
      return 0;
    }

    return totalSeconds;
  } catch (error) {
    return 0;
  }
}

export const getJwtFromStorage = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('whales_trace_token');
};