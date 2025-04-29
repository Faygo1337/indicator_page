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

export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatCurrency(value: number, decimals = 5): string {
  return `$${value.toFixed(decimals)}`;
}

export function extractNumber(value: string, defaultValue = 0): number {
  if (!value) return defaultValue;

  const matches = value.match(/[-+]?([0-9]*\.[0-9]+|[0-9]+)/);
  if (matches && matches[0]) {
    return parseFloat(matches[0]);
  }

  return defaultValue;
}

export function isApproximatelyEqual(value1: number, value2: number, epsilon = 0.00001): boolean {
  return Math.abs(value1 - value2) < epsilon;
}

export function generateUpdateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function extractNumericValue(formattedValue?: string): number {
  if (!formattedValue) return 0;

  const matches = formattedValue.replace(/[^0-9.-]/g, '').match(/[-+]?([0-9]*\.[0-9]+|[0-9]+)/);
  if (!matches || !matches[0]) return 0;

  return parseFloat(matches[0]);
}

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
  let str = (num / divider).toFixed(2);
  str = str.replace(/\.0+$/, '').replace(/(\.[1-9])0+$/, '$1');
  return `$${str}${suffix}`;
}

export function parseTokenAge(ageString: string): number {
  if (!ageString) return 0;

  if (!ageString || ageString.trim() === "" ||
    ageString.toLowerCase() === "new" ||
    ageString === "N/A") {
    return 0;
  }

  if (ageString.includes('×')) {
    return 0;
  }

  try {
    let totalSeconds = 0;

    const timePattern = /(\d+)\s*([dhms])/gi;
    let match;
    let foundMatch = false;

    while ((match = timePattern.exec(ageString)) !== null) {
      foundMatch = true;
      const value = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();

      if (!isNaN(value)) {
        switch (unit) {
          case 'd':
            totalSeconds += value * 86400;
            break;
          case 'h':
            totalSeconds += value * 3600;
            break;
          case 'm':
            totalSeconds += value * 60;
            break;
          case 's':
            totalSeconds += value;
            break;
        }
      }
    }


    if (!foundMatch) {

      const numericMatch = ageString.match(/(\d+(\.\d+)?)/);
      if (numericMatch && numericMatch[1]) {
        const numValue = parseFloat(numericMatch[1]);
        if (!isNaN(numValue)) {
          totalSeconds = numValue * 86400;
        }
      } else {
        return 0;
      }
    }

    if (totalSeconds < 0) {
      return 0;
    }

    return totalSeconds;
  } catch {
    return 0;
  }
}

export const getJwtFromStorage = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('whales_trace_token');
};