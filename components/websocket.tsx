"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { CryptoCard as CryptoCardType } from "@/lib/api/types";
import { CryptoCard } from "@/components/crypto-card";

import { formatMarketCap } from "@/lib/utils";

// Расширенный тип для карточек с дополнительными полями
interface ExtendedCryptoCard extends CryptoCardType {
  id: string;
  _receivedAt: number;
  _lastUpdated: number;
  tokenCreatedAt?: number; // Добавляем поле для хранения timestamp создания токена
  _circulatingSupply?: number;
  _lastPrice?: number;
  [key: string]: unknown; // Для других динамических полей
}

// Добавляем интерфейс для WebSocket сообщений
interface WebsocketMessage {
  token?: string;
  name?: string;
  symbol?: string;
  market?: Record<string, unknown>;
  holdings?: Record<string, unknown>;
  trades?: Array<{
    amountSol?: number | string;
    amount?: string;
    count?: string;
    signer?: string;
    timestamp?: number;
  }>;
  logo?: string;
  imageUrl?: string;
  image?: string;
  tokenAge?: string;
  socials?: Record<string, unknown>;
  [key: string]: unknown;
}

export function ConnectWebSocket({ hasSubscription, wallet }: { hasSubscription: boolean, wallet: string | null }) {
  const [cards, setCards] = useState<ExtendedCryptoCard[]>([]);
  const webSocketRef = useRef<WebSocket | null>(null);
  const MAX_CARDS = 8;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Функция проверки JWT токена
  const checkJwtToken = useCallback(() => {
    const token = localStorage.getItem("whales_trace_token");
    if (!token) {
      console.warn("[WebSocket] JWT токен отсутствует");
      return null;
    }
    return token;
  }, []);

  // Функция подключения к WebSocket
  const connectWebSocket = useCallback(() => {
    const jwtToken = checkJwtToken();
    if (!jwtToken) {
      console.warn("[WebSocket] Подключение невозможно - отсутствует JWT токен");
      return;
    }

    const ws = new WebSocket("wss://whales.trace.foundation/api/stream");
    webSocketRef.current = ws;

    ws.onopen = () => {
      console.log("[WebSocket] Соединение открыто");
      ws.send(JSON.stringify({ authToken: jwtToken }));
      console.log("[WebSocket] Отправлен токен:", jwtToken);
      setCards([]);
    };

    ws.onmessage = (event) => {
      try {
        console.log("Получено сообщение:", event.data);
        const data = JSON.parse(event.data);

        // Проверка на служебные сообщения
        if (
          !data ||
          !data.token ||
          data.token === "system" ||
          data.token === "ping" ||
          data.token === "info"
        ) {
          console.log("Служебное сообщение, пропускаем");
          return;
        }

        // Дополнительная проверка на валидные данные
        if (typeof data.token !== "string" || data.token.trim() === "") {
          console.warn("Пропускаем сообщение с невалидным токеном:", data);
          return;
        }

        // Обработка сообщения
        processMessage(data);
      } catch (err) {
        console.error("Ошибка обработки сообщения:", err);
      }
    };

    // ws.onerror = (err) => {
    //   console.error("WebSocket ошибка:", err);
    // };

    ws.onclose = () => {
      console.log("WebSocket соединение закрыто");
    };

    return () => {
      if (webSocketRef.current) {
        webSocketRef.current.close();
      }
    };
  }, [checkJwtToken]);

  // Функция отключения WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (webSocketRef.current) {
      console.log("[WebSocket] Закрытие соединения");
      webSocketRef.current.close();
      webSocketRef.current = null;
      setCards([]);
    }
  }, []);

  // Эффект для управления подключением/отключением WebSocket
  useEffect(() => {
    if (!wallet || !hasSubscription) {
      console.log("[WebSocket] Отключение - кошелек не подключен или нет подписки");
      disconnectWebSocket();
      return;
    }

    const jwtToken = checkJwtToken();
    if (!jwtToken) {
      console.warn("[WebSocket] Подключение невозможно - отсутствует JWT токен");
      return;
    }

    console.log("[WebSocket] Инициализация подключения");
    connectWebSocket();

    return () => {
      disconnectWebSocket();
    };
  }, [wallet, hasSubscription, connectWebSocket, disconnectWebSocket, checkJwtToken]);

  // Функция для сортировки карточек по времени создания
  const sortCardsByAge = (
    cardsToSort: ExtendedCryptoCard[]
  ): ExtendedCryptoCard[] => {
    return [...cardsToSort].sort((a, b) => {
      // Получаем timestamp создания для каждой карточки
      const aTimestamp = a.tokenCreatedAt || 0;
      const bTimestamp = b.tokenCreatedAt || 0;

      // Сортируем в порядке убывания (новые сверху)
      return bTimestamp - aTimestamp;
    });
  };

  // Обновление возраста токенов в реальном времени
  useEffect(() => {
    // Функция для обновления возраста всех токенов
    const updateTokenAges = () => {
      setCards((prevCards) => {
        // Проверяем, нужно ли обновлять что-то
        const needsUpdate = prevCards.some((card) => card.tokenCreatedAt);
        if (!needsUpdate) return prevCards;

        // Обновляем возраст для каждой карточки, имеющей timestamp создания
        const updatedCards = prevCards.map((card) => {
          if (card.tokenCreatedAt) {
            return {
              ...card,
              tokenAge: formatTokenAge(card.tokenCreatedAt),
            };
          }
          return card;
        });

        // Сортируем обновленные карточки
        return sortCardsByAge(updatedCards);
      });
    };

    // Запускаем интервал обновления (каждую секунду)
    timerRef.current = setInterval(updateTokenAges, 1000);

    // Очистка при размонтировании
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Добавляем taп обработки сообщений
  const isUpdateSignalMessage = (message: WebsocketMessage): boolean => {
    if (
      !message ||
      !message.token ||
      typeof message.token !== "string" ||
      message.token.trim() === ""
    ) {
      return false;
    }

    // Проверяем наличие хотя бы одного из полей обновления
    const hasMarketData =
      message.market &&
      typeof message.market === "object" &&
      Object.keys(message.market).length > 0;
    const hasHoldingsData =
      message.holdings &&
      typeof message.holdings === "object" &&
      Object.keys(message.holdings).length > 0;
    const hasTradesData =
      message.trades &&
      Array.isArray(message.trades) &&
      message.trades.length > 0;

    return hasMarketData || hasHoldingsData || hasTradesData || false;
  };

  function safeString(value: unknown, defaultValue: string): string {
    if (value === null || value === undefined) {
      return defaultValue;
    }
    
    if (typeof value === 'string') {
      return value.trim() || defaultValue;
    }
    
    // Handle non-string values by converting to string
    const stringValue = String(value).trim();
    return stringValue || defaultValue;
  }

  // Функция для создания новой карточки
  const createNewCard = (message: WebsocketMessage): ExtendedCryptoCard => {
    const tokenId = safeString(message.token, "unknown");
    const name = safeString(message.name, "Unknown Token");
    const symbol = safeString(message.symbol, "???").toUpperCase();
    const image = safeString(
      message.logo || message.imageUrl || message.image,
      ""
    );

    // Создаем базовую карточку со всеми необходимыми полями
    const newCard: ExtendedCryptoCard = {
      id: tokenId,
      name: name,
      symbol: symbol,
      tokenAge: "N/A",
      tokenCreatedAt: 0,
      price: 0,
      priceChange24h: 0,
      marketCap: "N/A",
      marketCapRank: 0,
      volume24h: 0,
      circulatingSupply: 0,
      totalSupply: 0,
      maxSupply: 0,
      daysSinceAllTimeHigh: 0,
      totalWallets: 0,
      holdersBuying24h: 0,
      holdersSelling24h: 0,
      holdersWithBalance: 0,
      holdersPercent: 0,
      holdersSentiment: 0,
      twitter: "",
      telegram: "",
      website: "",
      top10: "0%",
      devWalletHold: "0%",
      first70BuyersHold: "0%",
      insiders: "0%",
      whales: [],
      noMint: true,
      blacklist: false,
      burnt: "0%",
      top10Percentage: "0%",
      priceChange: "×1.0",
      image: image,
      socialLinks: {},
      isSelected: false,
      isPinned: false,
      dataTimestamp: Math.floor(Date.now() / 1000),
      lastUpdated: Math.floor(Date.now() / 1000),
      dexWallets: 0,
      trades: [],
      alerts: [],
      _receivedAt: Date.now(),
      _lastUpdated: Date.now(),
    };

    // Обрабатываем timestamp создания токена
    if (message.tokenCreatedAt) {
      const timestamp = Number(message.tokenCreatedAt);
      if (!isNaN(timestamp)) {
        newCard.tokenCreatedAt = timestamp;
        newCard.tokenAge = formatTokenAge(timestamp);
      }
    }

    // Обрабатываем market данные
    if (message.market && typeof message.market === "object") {
      // Извлекаем цену
      if (message.market.price !== undefined) {
        const price = parseFloat(String(message.market.price));
        if (!isNaN(price)) {
          newCard._lastPrice = price;
          newCard.price = price;
        }
      }

      // Извлекаем circulatingSupply
      if (message.market.circulatingSupply !== undefined) {
        const supply = parseFloat(String(message.market.circulatingSupply));
        if (!isNaN(supply)) {
          newCard._circulatingSupply = supply;
          newCard.circulatingSupply = supply;
        }
      }

      // Вычисляем marketCap если возможно
      if (newCard._lastPrice && newCard._circulatingSupply) {
        const marketCap = newCard._lastPrice * newCard._circulatingSupply;
        if (!isNaN(marketCap) && marketCap > 0) {
          newCard.marketCap = formatMarketCap(marketCap);
        }
      }

      // Обрабатываем другие market данные
      Object.entries(message.market).forEach(([key, value]) => {
        if (
          key !== "price" &&
          key !== "circulatingSupply" &&
          value !== undefined &&
          value !== null
        ) {
          (newCard as Record<string, unknown>)[key] = value;
        }
      });
    }

    // Обрабатываем данные holdings
    if (message.holdings && typeof message.holdings === "object") {
      const holdings = message.holdings;

      // Улучшенная функция для обработки процентов, включая научную нотацию
      const formatPercentage = (
        value: number | string | undefined | null
      ): string => {
        if (value === undefined || value === null) return "0%";

        // Парсим значение в число
        const numValue = typeof value === "string" ? parseFloat(value) : value;
        if (isNaN(numValue)) return "0%";

        // Проверка на очень маленькие значения (научная нотация)
        if (Math.abs(numValue) < 0.01 && numValue !== 0) {
          // Для очень маленьких чисел (например 1e-15) показываем "~0%"
          if (Math.abs(numValue) < 0.0001) {
            return "~0%";
          }
          // Для малых чисел используем больше десятичных знаков
          return numValue.toFixed(4) + "%";
        }

        return numValue.toFixed(2) + "%";
      };

      // Заполняем поля holdings
      if ("top10" in holdings && holdings.top10 !== undefined) {
        const top10Value =
          typeof holdings.top10 === "object" && holdings.top10 !== null
            ? JSON.stringify(holdings.top10)
            : holdings.top10;
        newCard.top10 = formatPercentage(top10Value as string | number);
      }

      if ("devHolds" in holdings && holdings.devHolds !== undefined) {
        const devHoldsValue =
          typeof holdings.devHolds === "object" && holdings.devHolds !== null
            ? JSON.stringify(holdings.devHolds)
            : holdings.devHolds;
        newCard.devWalletHold = formatPercentage(
          devHoldsValue as string | number
        );
      }

      if ("insidersHolds" in holdings && holdings.insidersHolds !== undefined) {
        const insidersValue =
          typeof holdings.insidersHolds === "object" &&
          holdings.insidersHolds !== null
            ? JSON.stringify(holdings.insidersHolds)
            : holdings.insidersHolds;
        newCard.insiders = formatPercentage(insidersValue as string | number);
      }

      if ("first70" in holdings && holdings.first70 !== undefined) {
        const first70Value =
          typeof holdings.first70 === "object" && holdings.first70 !== null
            ? JSON.stringify(holdings.first70)
            : holdings.first70;
        newCard.first70BuyersHold = formatPercentage(
          first70Value as string | number
        );
      }
    }

    // Обрабатываем trades данные (китовые транзакции)
    if (
      message.trades &&
      Array.isArray(message.trades) &&
      message.trades.length > 0
    ) {
      // Сортируем по размеру транзакции (от большего к меньшему)
      const sortedTrades = [...message.trades].sort((a, b) => {
        const amountA = parseFloat(String(a.amountSol || a.amount || 0));
        const amountB = parseFloat(String(b.amountSol || b.amount || 0));
        return isNaN(amountB) ? -1 : isNaN(amountA) ? 1 : amountB - amountA;
      });

      // Берем только первые 5 транзакций для отображения
      newCard.whales = sortedTrades.slice(0, 5).map((trade) => {
        const walletAddress = safeString(
          trade.signer || trade.count,
          "unknown"
        );
        const amount = safeString(trade.amountSol || trade.amount, "0");

        return {
          count: walletAddress,
          amount: `${amount} SOL`,
        };
      });
    }

    // Обрабатываем социальные ссылки (как top-level, так и вложенные в message.socials)
    // top-level fields
    const tlTg = safeString(message.telegram, "");
    const tlTw = safeString(message.twitter, "");
    const tlWeb = safeString(message.website, "");
    // nested socials if present
    let nsTg = "",
      nsTw = "",
      nsWeb = "";
    if (message.socials && typeof message.socials === "object") {
      const s = message.socials as Record<string, unknown>;
      nsTg = safeString(s.tg || s.telegram, "");
      nsTw = safeString(s.x || s.twitter, "");
      nsWeb = safeString(s.web || s.website, "");
    }
    const telegram = tlTg || nsTg;
    const twitter = tlTw || nsTw;
    const website = tlWeb || nsWeb;
    newCard.socialLinks = { telegram, twitter, website };
    // для совместимости сохраняем в верхние поля
    newCard.telegram = telegram;
    newCard.twitter = twitter;
    newCard.website = website;

    // Добавляем все остальные поля из сообщения
    Object.entries(message).forEach(([key, value]) => {
      if (
        ![
          "token",
          "name",
          "symbol",
          "image",
          "logo",
          "imageUrl",
          "market",
          "holdings",
          "trades",
          "socials",
        ].includes(key) &&
        value !== undefined &&
        value !== null
      ) {
        (newCard as Record<string, unknown>)[key] = value;
      }
    });

    console.log(`Создана новая карточка для ${tokenId}:`, newCard);
    return newCard;
  };

  // Функция обработки сообщений
  const processMessage = (message: WebsocketMessage) => {
    const tokenId = message.token;

    if (!tokenId || typeof tokenId !== "string" || tokenId.trim() === "") {
      console.warn("Сообщение без валидного ID токена", message);
      return;
    }

    console.log(`Обработка сообщения для токена: ${tokenId}`, message);

    // Проверяем, является ли сообщение сигналом обновления
    const isUpdate = isUpdateSignalMessage(message);
    console.log(`Сообщение для ${tokenId} является обновлением: ${isUpdate}`);

    // Проверяем и преобразуем значения в научной нотации для holdings
    if (message.holdings && typeof message.holdings === "object") {
      console.log(`Исходные значения holdings:`, message.holdings);

      // Преобразуем значения в scientific notation в нормальные числа
      const convertScientificNotation = (obj: Record<string, unknown>) => {
        Object.keys(obj).forEach((key) => {
          const value = obj[key];
          if (
            typeof value === "number" ||
            (typeof value === "string" && value.includes("e"))
          ) {
            // Преобразуем научную нотацию в число
            const numValue =
              typeof value === "string" ? parseFloat(value) : value;
            if (!isNaN(numValue)) {
              obj[key] = numValue;
              // Логируем если значение было в научной нотации
              if (String(value).includes("e")) {
                console.log(
                  `Преобразована научная нотация для ${key}: ${value} -> ${numValue}`
                );
              }
            }
          }
        });
        return obj;
      };

      message.holdings = convertScientificNotation(message.holdings);
      console.log(`Преобразованные значения holdings:`, message.holdings);
    }

    // Создаем или обновляем карточку
    setCards((prevCards) => {
      try {
        // Проверяем, существует ли уже карточка с таким ID
        const existingIndex = prevCards.findIndex(
          (card) => card.id === tokenId
        );

        // Если карточка существует - обновляем её
        if (existingIndex >= 0 && prevCards[existingIndex]) {
          console.log(`Обновляем существующую карточку: ${tokenId}`);

          // Глубокое копирование массива и существующей карточки для избежания мутаций
          const updatedCards = structuredClone(prevCards);
          const existingCard = updatedCards[existingIndex];

          if (!existingCard) {
            console.warn(`Карточка с индексом ${existingIndex} не найдена`);
            return prevCards;
          }

          // Обновляем только те поля, которые есть в сообщении и не null/undefined
          console.log(
            `Обновление полей для карточки ${tokenId}:`,
            Object.keys(message).filter((k) => k !== "token")
          );

          // Проверяем обновляемые поля
          const fieldsBeingUpdated = Object.keys(message).filter(
            (key) =>
              key !== "token" &&
              message[key] !== undefined &&
              message[key] !== null
          );

          console.log(`Поля для обновления: ${fieldsBeingUpdated.join(", ")}`);

          Object.entries(message).forEach(([key, value]) => {
            // Обработка timestamp создания токена
            if (key === "tokenCreatedAt" && value) {
              const timestamp = Number(value);
              if (!isNaN(timestamp)) {
                (
                  updatedCards[existingIndex] as Record<string, unknown>
                ).tokenCreatedAt = timestamp;
                (
                  updatedCards[existingIndex] as Record<string, string>
                ).tokenAge = formatTokenAge(timestamp);
              }
            }
            // Базовые поля карточки
            else if (key !== "token" && value !== undefined && value !== null) {
              // Для строковых полей не обновляем на пустые строки
              if (typeof value === "string") {
                if (value.trim() !== "") {
                  (updatedCards[existingIndex] as Record<string, unknown>)[
                    key
                  ] = value;
                } else if ((existingCard[key] as string)?.trim()) {
                  // Если новое значение пустое, а старое нет - сохраняем старое
                  console.log(
                    `Сохраняем существующее значение для ${key}: ${existingCard[key]}`
                  );
                }
              }
              // Для объектов и массивов проверяем, что они не пустые
              else if (typeof value === "object") {
                if (Array.isArray(value)) {
                  if (value.length > 0) {
                    (updatedCards[existingIndex] as Record<string, unknown>)[
                      key
                    ] = value;
                  } else if (
                    Array.isArray(existingCard[key]) &&
                    (existingCard[key] as unknown[]).length > 0
                  ) {
                    // Сохраняем существующий массив, если новый пустой
                    console.log(`Сохраняем существующий массив для ${key}`);
                  }
                } else if (value !== null && Object.keys(value).length > 0) {
                  // Для вложенных объектов выполняем глубокое слияние с приоритетом существующих значений
                  const currentValue =
                    (updatedCards[existingIndex] as Record<string, unknown>)[
                      key
                    ] || {};

                  const mergedObject = {
                    ...(currentValue as Record<string, unknown>),
                  };

                  // Добавляем только непустые значения из нового объекта
                  Object.entries(value as Record<string, unknown>).forEach(
                    ([subKey, subValue]) => {
                      if (subValue !== undefined && subValue !== null) {
                        if (typeof subValue === "string") {
                          // Для строк проверяем, что значение не пустое
                          if (subValue.trim() !== "") {
                            (mergedObject as Record<string, unknown>)[subKey] =
                              subValue;
                          }
                        } else {
                          // Для других типов данных просто копируем значение
                          (mergedObject as Record<string, unknown>)[subKey] =
                            subValue;
                        }
                      }
                    }
                  );

                  (updatedCards[existingIndex] as Record<string, unknown>)[
                    key
                  ] = mergedObject;

                  // Проверяем критичные поля в объектах и сохраняем существующие значения
                  if (key === "market" && typeof value === "object") {
                    const existingMarket = (existingCard.market ||
                      {}) as Record<string, unknown>;
                    const newMarket = mergedObject as Record<string, unknown>;

                    // Сохраняем важные поля, если они есть в существующих данных, но отсутствуют или пустые в новых
                    [
                      "price",
                      "circulatingSupply",
                      "volume",
                      "marketCap",
                    ].forEach((field) => {
                      if (
                        existingMarket[field] !== undefined &&
                        existingMarket[field] !== null &&
                        existingMarket[field] !== "" &&
                        (newMarket[field] === undefined ||
                          newMarket[field] === null ||
                          newMarket[field] === 0)
                      ) {
                        console.log(
                          `Сохраняем существующее значение для market.${field}: ${existingMarket[field]}`
                        );
                        newMarket[field] = existingMarket[field];
                      }
                    });
                  }
                }
                // Для остальных типов данных проверяем на пустые значения
                else {
                  // Для числовых полей сохраняем существующие значения, если новые равны 0
                  if (
                    typeof value === "number" &&
                    value === 0 &&
                    typeof existingCard[key] === "number" &&
                    (existingCard[key] as number) > 0
                  ) {
                    // Сохраняем существующее значение
                    console.log(
                      `Сохраняем существующее числовое значение для ${key}: ${existingCard[key]}`
                    );
                  } else {
                    // Для boolean значений используем nullish coalescing
                    if (
                      typeof existingCard[key] === "boolean" &&
                      typeof value !== "boolean"
                    ) {
                      (updatedCards[existingIndex] as Record<string, unknown>)[
                        key
                      ] = value ?? existingCard[key];
                    } else {
                      (updatedCards[existingIndex] as Record<string, unknown>)[
                        key
                      ] = value;
                    }
                  }
                }
              }
            }
          });

          // Обновляем timestamp последнего обновления
          updatedCards[existingIndex]._lastUpdated = Date.now();

          // Обрабатываем market данные отдельно
          if (message.market && typeof message.market === "object") {
            // Если есть цена, сохраняем её для вычислений
            if (message.market.price !== undefined) {
              const price = parseFloat(String(message.market.price));
              if (!isNaN(price)) {
                updatedCards[existingIndex]._lastPrice = price;
                updatedCards[existingIndex].price = price;
              }
            }

            // Если есть circulatingSupply, сохраняем его для вычислений
            if (message.market.circulatingSupply !== undefined) {
              const supply = parseFloat(
                String(message.market.circulatingSupply)
              );
              if (!isNaN(supply)) {
                updatedCards[existingIndex]._circulatingSupply = supply;
              }
            }

            // Вычисляем marketCap если возможно
            if (
              updatedCards[existingIndex]._lastPrice &&
              updatedCards[existingIndex]._circulatingSupply
            ) {
              const marketCap =
                updatedCards[existingIndex]._lastPrice *
                updatedCards[existingIndex]._circulatingSupply;
              if (!isNaN(marketCap) && marketCap > 0) {
                // Явное приведение к типу строки для marketCap
                (
                  updatedCards[existingIndex] as unknown as {
                    marketCap: string;
                  }
                ).marketCap = formatMarketCap(marketCap);
              }
            }
          }

          // Обрабатываем данные holdings отдельно
          if (message.holdings && typeof message.holdings === "object") {
            const holdings = message.holdings;
            // Улучшенная функция для обработки процентов, включая научную нотацию
            const formatPercentage = (
              value: number | string | undefined | null
            ): string => {
              if (value === undefined || value === null) return "0%";

              // Парсим значение в число
              const numValue =
                typeof value === "string" ? parseFloat(value) : value;
              if (isNaN(numValue)) return "0%";

              // Проверка на очень маленькие значения (научная нотация)
              if (Math.abs(numValue) < 0.01 && numValue !== 0) {
                // Для очень маленьких чисел (например 1e-15) показываем "~0%"
                if (Math.abs(numValue) < 0.0001) {
                  return "~0%";
                }
                // Для малых чисел используем больше десятичных знаков
                return numValue.toFixed(4) + "%";
              }

              return numValue.toFixed(2) + "%";
            };

            // Обрабатываем top10 holdings
            if (holdings.top10 !== undefined) {
              const top10Value =
                typeof holdings.top10 === "object" && holdings.top10 !== null
                  ? JSON.stringify(holdings.top10)
                  : holdings.top10;
              (
                updatedCards[existingIndex] as unknown as { top10: string }
              ).top10 = formatPercentage(top10Value as string | number);
            }

            // Обрабатываем devHolds (developer wallet holdings)
            if (holdings.devHolds !== undefined) {
              const devHoldsValue =
                typeof holdings.devHolds === "object" &&
                holdings.devHolds !== null
                  ? JSON.stringify(holdings.devHolds)
                  : holdings.devHolds;
              (
                updatedCards[existingIndex] as unknown as {
                  devWalletHold: string;
                }
              ).devWalletHold = formatPercentage(
                devHoldsValue as string | number
              );
            }

            // Обрабатываем insidersHolds
            if (holdings.insidersHolds !== undefined) {
              const insidersValue =
                typeof holdings.insidersHolds === "object" &&
                holdings.insidersHolds !== null
                  ? JSON.stringify(holdings.insidersHolds)
                  : holdings.insidersHolds;
              (
                updatedCards[existingIndex] as unknown as { insiders: string }
              ).insiders = formatPercentage(insidersValue as string | number);
            }

            // Обрабатываем first70 (first 70 buyers holdings)
            if (holdings.first70 !== undefined) {
              const first70Value =
                typeof holdings.first70 === "object" &&
                holdings.first70 !== null
                  ? JSON.stringify(holdings.first70)
                  : holdings.first70;
              (
                updatedCards[existingIndex] as unknown as {
                  first70BuyersHold: string;
                }
              ).first70BuyersHold = formatPercentage(
                first70Value as string | number
              );
            }

            console.log(`Обновлены данные holdings для ${tokenId}:`, {
              top10: (
                updatedCards[existingIndex] as unknown as { top10: string }
              ).top10,
              devWalletHold: (
                updatedCards[existingIndex] as unknown as {
                  devWalletHold: string;
                }
              ).devWalletHold,
              insiders: (
                updatedCards[existingIndex] as unknown as { insiders: string }
              ).insiders,
              first70BuyersHold: (
                updatedCards[existingIndex] as unknown as {
                  first70BuyersHold: string;
                }
              ).first70BuyersHold,
            });
          }

          // Проверяем, что все необходимые поля присутствуют в обновленной карточке
          const updatedCard = updatedCards[existingIndex];
          const requiredDefaults: Record<string, unknown> = {
            id: tokenId,
            name: "Unknown Token",
            symbol: "???",
            tokenAge: "N/A",
            tokenCreatedAt: 0,
            image: "",
            price: 0,
            priceChange24h: 0,
            marketCap: "N/A",
            marketCapRank: 0,
            volume24h: 0,
            circulatingSupply: 0,
            totalSupply: 0,
            maxSupply: 0,
            daysSinceAllTimeHigh: 0,
            totalWallets: 0,
            holdersBuying24h: 0,
            holdersSelling24h: 0,
            holdersWithBalance: 0,
            holdersPercent: 0,
            holdersSentiment: 0,
            twitter: "",
            telegram: "",
            website: "",
            top10: "0%",
            devWalletHold: "0%",
            first70BuyersHold: "0%",
            insiders: "0%",
            whales: [],
            noMint: true,
            blacklist: false,
            burnt: "0%",
            top10Percentage: "0%",
            priceChange: "×1.0",
            socialLinks: {},
            isSelected: false,
            isPinned: false,
            dataTimestamp: Math.floor(Date.now() / 1000),
            lastUpdated: Math.floor(Date.now() / 1000),
            dexWallets: 0,
            trades: [],
            alerts: [],
          };

          // Применяем дефолтные значения где необходимо
          Object.entries(requiredDefaults).forEach(([key, defaultValue]) => {
            if (updatedCard[key] === undefined || updatedCard[key] === null) {
              console.log(
                `Устанавливаем дефолтное значение для ${key}: ${defaultValue}`
              );
              updatedCard[key] = defaultValue;
            }
          });

          // Фильтруем карточки с некорректными данными перед сортировкой
          const validCards = updatedCards.filter(
            (card: ExtendedCryptoCard) => !!card.id
          );
          return sortCardsByAge(validCards).slice(0, MAX_CARDS);
        }

        // Если карточки не существует - создаем новую
        console.log(`Добавляем новую карточку: ${tokenId}`);

        // Создаем новую карточку с полными данными
        const newCard = createNewCard(message);

        // Добавляем новую карточку к списку и сортируем
        return sortCardsByAge([...prevCards, newCard]).slice(0, MAX_CARDS);
      } catch (error) {
        console.error("Ошибка при обновлении карточек:", error);
        return prevCards;
      }
    });
  };

  function formatTokenAge(timestamp: number): string {
    const now = Math.floor(Date.now() / 1000);
    const sec = now - timestamp;
    if (sec < 0) return "N/A";
    const d = Math.floor(sec / 86400),
      h = Math.floor((sec % 86400) / 3600),
      m = Math.floor((sec % 3600) / 60),
      s = sec % 60;
    return `${d ? d + "d " : ""}${h ? h + "h " : ""}${m ? m + "m " : ""}${s}s`;
  }
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <CryptoCard key={card.id} data={card} />
        ))}
      </div>
    </div>
  );
}


