"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { CryptoCard as CryptoCardType } from "@/lib/api/types";
import { CryptoCard } from "@/components/crypto-card";
import { motion, AnimatePresence } from "framer-motion";
import { formatMarketCap } from "@/lib/utils";

interface ExtendedCryptoCard extends CryptoCardType {
  id: string;
  _receivedAt: number;
  _lastUpdated: number;
  tokenCreatedAt?: number;
  _circulatingSupply?: number;
  _lastPrice?: number;
  [key: string]: unknown;
}

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

  const checkJwtToken = useCallback(() => {
    const token = localStorage.getItem("whales_trace_token");
    if (!token) {
      return null;
    }
    return token;
  }, []);

  const connectWebSocket = useCallback(() => {
    const jwtToken = checkJwtToken();
    if (!jwtToken) {
      return;
    }

    const ws = new WebSocket("wss://whales.trace.foundation/api/stream");
    webSocketRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ authToken: jwtToken }));
      setCards([]);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (
          !data ||
          !data.token ||
          data.token === "system" ||
          data.token === "ping" ||
          data.token === "info"
        ) {
          return;
        }

        if (typeof data.token !== "string" || data.token.trim() === "") {
          return;
        }

        processMessage(data);
      } catch {
        return;
      }
    };

    return () => {
      if (webSocketRef.current) {
        webSocketRef.current.close();
      }
    };
  }, [checkJwtToken]);

  const disconnectWebSocket = useCallback(() => {
    if (webSocketRef.current) {
      webSocketRef.current.close();
      webSocketRef.current = null;
      setCards([]);
    }
  }, []);

  useEffect(() => {
    if (!wallet || !hasSubscription) {
      disconnectWebSocket();
      return;
    }

    const jwtToken = checkJwtToken();
    if (!jwtToken) {
      return;
    }
    connectWebSocket();

    return () => {
      disconnectWebSocket();
    };
  }, [wallet, hasSubscription, connectWebSocket, disconnectWebSocket, checkJwtToken]);

  const sortCardsByAge = (
    cardsToSort: ExtendedCryptoCard[]
  ): ExtendedCryptoCard[] => {
    return [...cardsToSort].sort((a, b) => {
      const aTimestamp = a.tokenCreatedAt || 0;
      const bTimestamp = b.tokenCreatedAt || 0;

      return bTimestamp - aTimestamp;
    });
  };

  useEffect(() => {
    const updateTokenAges = () => {
      setCards((prevCards) => {
        const needsUpdate = prevCards.some((card) => card.tokenCreatedAt);
        if (!needsUpdate) return prevCards;
        const updatedCards = prevCards.map((card) => {
          if (card.tokenCreatedAt) {
            return {
              ...card,
              tokenAge: formatTokenAge(card.tokenCreatedAt),
            };
          }
          return card;
        });

        return sortCardsByAge(updatedCards);
      });
    };

    timerRef.current = setInterval(updateTokenAges, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  function safeString(value: unknown, defaultValue: string): string {
    if (value === null || value === undefined) {
      return defaultValue;
    }

    if (typeof value === 'string') {
      return value.trim() || defaultValue;
    }

    const stringValue = String(value).trim();
    return stringValue || defaultValue;
  }

  const createNewCard = (message: WebsocketMessage): ExtendedCryptoCard => {
    const tokenId = safeString(message.token, "unknown");
    const name = safeString(message.name, "Unknown Token");
    const symbol = safeString(message.symbol, "???").toUpperCase();
    const image = safeString(
      message.logo || message.imageUrl || message.image,
      ""
    );

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

    if (message.tokenCreatedAt) {
      const timestamp = Number(message.tokenCreatedAt);
      if (!isNaN(timestamp)) {
        newCard.tokenCreatedAt = timestamp;
        newCard.tokenAge = formatTokenAge(timestamp);
      }
    }

    if (message.market && typeof message.market === "object") {
      if (message.market.price !== undefined) {
        const price = parseFloat(String(message.market.price));
        if (!isNaN(price)) {
          newCard._lastPrice = price;
          newCard.price = price;
        }
      }

      if (message.market.circulatingSupply !== undefined) {
        const supply = parseFloat(String(message.market.circulatingSupply));
        if (!isNaN(supply)) {
          newCard._circulatingSupply = supply;
          newCard.circulatingSupply = supply;
        }
      }

      if (newCard._lastPrice && newCard._circulatingSupply) {
        const marketCap = newCard._lastPrice * newCard._circulatingSupply;
        if (!isNaN(marketCap) && marketCap > 0) {
          newCard.marketCap = formatMarketCap(marketCap);
        }
      }

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

    if (message.holdings && typeof message.holdings === "object") {
      const holdings = message.holdings;

      const formatPercentage = (
        value: number | string | undefined | null
      ): string => {
        if (value === undefined || value === null) return "0%";

        const numValue = typeof value === "string" ? parseFloat(value) : value;
        if (isNaN(numValue)) return "0%";

        if (Math.abs(numValue) < 0.01 && numValue !== 0) {
          if (Math.abs(numValue) < 0.0001) {
            return "~0%";
          }
          return numValue.toFixed(4) + "%";
        }

        return numValue.toFixed(2) + "%";
      };

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

    if (
      message.trades &&
      Array.isArray(message.trades) &&
      message.trades.length > 0
    ) {
      const sortedTrades = [...message.trades].sort((a, b) => {
        const amountA = parseFloat(String(a.amountSol || a.amount || 0));
        const amountB = parseFloat(String(b.amountSol || b.amount || 0));
        return isNaN(amountB) ? -1 : isNaN(amountA) ? 1 : amountB - amountA;
      });

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

    
    const tlTg = safeString(message.telegram, "");
    const tlTw = safeString(message.twitter, "");
    const tlWeb = safeString(message.website, "");
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
    newCard.telegram = telegram;
    newCard.twitter = twitter;
    newCard.website = website;

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

    return newCard;
  };

  const processMessage = (message: WebsocketMessage) => {
    const tokenId = message.token;

    if (!tokenId || tokenId.trim() === "") {
      return;
    }

    if (message.holdings && typeof message.holdings === "object") {
      const convertScientificNotation = (obj: Record<string, unknown>) => {
        Object.keys(obj).forEach((key) => {
          const value = obj[key];
          if (
            typeof value === "number" ||
            (typeof value === "string" && value.includes("e"))
          ) {
            const numValue =
              typeof value === "string" ? parseFloat(value) : value;
            if (!isNaN(numValue)) {
              obj[key] = numValue;
            }
          }
        });
        return obj;
      };

      message.holdings = convertScientificNotation(message.holdings);
    }

    setCards((prevCards) => {
      try {
        const existingIndex = prevCards.findIndex(
          (card) => card.id === tokenId
        );

        if (existingIndex >= 0 && prevCards[existingIndex]) {
          const updatedCards = structuredClone(prevCards);
          const existingCard = updatedCards[existingIndex];

          if (!existingCard) {
            return prevCards;
          }

          Object.entries(message).forEach(([key, value]) => {
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
            else if (key !== "token" && value !== undefined && value !== null) {
              if (typeof value === "string") {
                if (value.trim() !== "") {
                  (updatedCards[existingIndex] as Record<string, unknown>)[
                    key
                  ] = value;
                }
              }
              else if (typeof value === "object") {
                if (Array.isArray(value)) {
                  if (value.length > 0) {
                    (updatedCards[existingIndex] as Record<string, unknown>)[
                      key
                    ] = value;
                  }
                } else if (value !== null && Object.keys(value).length > 0) {
                  const currentValue =
                    (updatedCards[existingIndex] as Record<string, unknown>)[
                      key
                    ] || {};

                  const mergedObject = {
                    ...(currentValue as Record<string, unknown>),
                  };

                  Object.entries(value as Record<string, unknown>).forEach(
                    ([subKey, subValue]) => {
                      if (subValue !== undefined && subValue !== null) {
                        if (typeof subValue === "string") {
                          if (subValue.trim() !== "") {
                            (mergedObject as Record<string, unknown>)[subKey] =
                              subValue;
                          }
                        } else {
                          (mergedObject as Record<string, unknown>)[subKey] =
                            subValue;
                        }
                      }
                    }
                  );

                  (updatedCards[existingIndex] as Record<string, unknown>)[
                    key
                  ] = mergedObject;

                  if (key === "market" && typeof value === "object") {
                    const existingMarket = (existingCard.market ||
                      {}) as Record<string, unknown>;
                    const newMarket = mergedObject as Record<string, unknown>;

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
                        newMarket[field] = existingMarket[field];
                      }
                    });
                  }
                }
                else {
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
          });

          updatedCards[existingIndex]._lastUpdated = Date.now();

          if (message.market && typeof message.market === "object") {
            if (message.market.price !== undefined) {
              const price = parseFloat(String(message.market.price));
              if (!isNaN(price)) {
                updatedCards[existingIndex]._lastPrice = price;
                updatedCards[existingIndex].price = price;
              }
            }

            if (message.market.circulatingSupply !== undefined) {
              const supply = parseFloat(
                String(message.market.circulatingSupply)
              );
              if (!isNaN(supply)) {
                updatedCards[existingIndex]._circulatingSupply = supply;
              }
            }

            if (
              updatedCards[existingIndex]._lastPrice &&
              updatedCards[existingIndex]._circulatingSupply
            ) {
              const marketCap =
                updatedCards[existingIndex]._lastPrice *
                updatedCards[existingIndex]._circulatingSupply;
              if (!isNaN(marketCap) && marketCap > 0) {
                (
                  updatedCards[existingIndex] as unknown as {
                    marketCap: string;
                  }
                ).marketCap = formatMarketCap(marketCap);
              }
            }
          }

          if (message.holdings && typeof message.holdings === "object") {
            const holdings = message.holdings;
            const formatPercentage = (
              value: number | string | undefined | null
            ): string => {
              if (value === undefined || value === null) return "0%";

              const numValue =
                typeof value === "string" ? parseFloat(value) : value;
              if (isNaN(numValue)) return "0%";

              if (Math.abs(numValue) < 0.01 && numValue !== 0) {
                if (Math.abs(numValue) < 0.0001) {
                  return "~0%";
                }
                return numValue.toFixed(4) + "%";
              }

              return numValue.toFixed(2) + "%";
            };

            if (holdings.top10 !== undefined) {
              const top10Value =
                typeof holdings.top10 === "object" && holdings.top10 !== null
                  ? JSON.stringify(holdings.top10)
                  : holdings.top10;
              (
                updatedCards[existingIndex] as unknown as { top10: string }
              ).top10 = formatPercentage(top10Value as string | number);
            }

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
          }

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

          Object.entries(requiredDefaults).forEach(([key, defaultValue]) => {
            if (updatedCard[key] === undefined || updatedCard[key] === null) {
              updatedCard[key] = defaultValue;
            }
          });

          const validCards = updatedCards.filter(
            (card: ExtendedCryptoCard) => !!card.id
          );
          return sortCardsByAge(validCards).slice(0, MAX_CARDS);
        }

        const newCard = createNewCard(message);

        return sortCardsByAge([...prevCards, newCard]).slice(0, MAX_CARDS);
      } catch {

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
      <AnimatePresence>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {cards.map((card) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5 }}
            >
              <CryptoCard data={card} />
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
