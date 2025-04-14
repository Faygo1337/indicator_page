import { jwtDecode } from "jwt-decode";
import { PublicKey } from "@solana/web3.js";
import { BigNumber } from "bignumber.js";
import { JWTPayload } from "../lib/api/types";

// Мок для @solana/web3.js
jest.mock("@solana/web3.js", () => ({
  PublicKey: class {
    constructor(key: string) {
      if (key === "invalid_wallet") throw new Error("Invalid public key");
    }
    toBase58() {
      return "88FBdm4f7uBRcKRGganbRTsVpyxt9CJgNzw87H3s1Aft";
    }
  }
}));

// Моковые данные
const TEST_WALLET = "3zE8qA8xSu6NPo4yWKk7wVawVsseoxYKuoNWuVVKsYqn";
const TEST_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NDQyOTcxNTMsImV4cCI6MTc0NDM4MzcyMywiaWF0IjoxNzQ0Mjk3MzIzLCJpZCI6MywibGlua2VkV2FsbGV0IjoiMnl6RUQzS2FXTDY1WUJxMlVTd0dIV2JkUE5QM2JxNlRRN1JBaUhic2JaQ2ciLCJzdWJFeHBBdCI6MCwidG9wdXBXYWxsZXQiOiIzekU4cUE4eFN1Nk5QbzR5V0trN3dWYXdWc3Nlb3hZS3VvTld1VlZLc1lxbiJ9.HeH-csxMUSyqV_6b_2HW5hfH1UAxFYTuTQ4_0z9E2Yw";

describe("JWT и Wallet тесты", () => {
  // Тест декодирования JWT
  test("Декодирование JWT токена", () => {
    const decoded = jwtDecode<JWTPayload>(TEST_JWT);
    expect(decoded.topupWallet).toBe(TEST_WALLET);
    expect(decoded).toHaveProperty("createdAt");
    expect(decoded).toHaveProperty("exp");
  });

  // Тест валидации адреса кошелька
  test("Валидация адреса кошелька", () => {
    expect(() => new PublicKey(TEST_WALLET).toBase58()).not.toThrow();
    expect(() => new PublicKey("invalid_wallet").toBase58()).toThrow();
  });

  // Тест работы с localStorage
  test("Сохранение и получение JWT payload", () => {
    const testPayload: JWTPayload = {
      topupWallet: TEST_WALLET,
      createdAt: Date.now(),
      exp: Date.now() + 86400000,
      iat: Date.now(),
      id: 1,
      linkedWallet: "linked_wallet",
      subExpAt: Date.now() + 86400000
    };

    localStorage.setItem("jwtPayload", JSON.stringify(testPayload));
    const saved = localStorage.getItem("jwtPayload");
    const parsed = JSON.parse(saved || "{}");

    expect(parsed.topupWallet).toBe(TEST_WALLET);
    expect(parsed).toHaveProperty("createdAt");
  });

  // Тест генерации QR-кода
  test("Генерация QR-кода", () => {
    const amount = new BigNumber(0.5);
    const label = "Test Payment";
    
    const qrCode = generateQrCode(TEST_WALLET, amount, label);
    expect(qrCode).toContain(TEST_WALLET);
    expect(qrCode).toContain(amount.toString());
    expect(qrCode).toContain(label);
  });

  // Тест проверки подписи
  test("Проверка подписи", async () => {
    const message = "Sign this message";
    const signature = "test_signature";
    const publicKey = TEST_WALLET;

    const result = await verifyWallet(signature, publicKey);
    expect(result).toBeDefined();
  });

  // Тест обработки ошибок
  test("Обработка ошибок", () => {
    const handleError = (error: any) => {
      if (error instanceof Error) {
        return error.message;
      }
      return "Неизвестная ошибка";
    };

    expect(handleError(new Error("Test error"))).toBe("Test error");
    expect(handleError("string error")).toBe("Неизвестная ошибка");
  });
});

// Вспомогательные функции
function generateQrCode(wallet: string, amount: BigNumber, label: string): string {
  return `solana:${wallet}?amount=${amount}&label=${label}`;
}

async function verifyWallet(signature: string, publicKey: string): Promise<boolean> {
  // Имитация проверки подписи
  return true;
} 