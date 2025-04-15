"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/header";
import { CryptoCard } from "@/components/crypto-card";
import { PaymentModal } from "@/components/payment-modal";
import { mockCryptoCards, createNewCard } from "@/lib/mock-data";
import { verifyWallet, checkPayment } from "@/lib/api/api-general";
import { isSubscriptionValid, formatWalletAddress, decodeJWT } from "@/lib/utils";
import { usePhantomWallet } from "@/lib/hooks/usePhantomWallet";
import { wsClient, WebSocketClient } from "@/lib/websocket";
import type { CryptoCard as CryptoCardType, JWTPayload, NewSignalMessage, UpdateSignalMessage } from "@/lib/api/types";
import nacl from "tweetnacl";
import bs58 from "bs58";

// В начале файла добавим константы для ключей localStorage
const STORAGE_KEYS = {
  WALLET: "whales_trace_wallet",
  SUBSCRIPTION: "whales_trace_subscription",
  JWT_PAYLOAD: "whales_trace_jwt",
  TOKEN: "whales_trace_token",
} as const;

export default function Home() {
  const { wallet, isConnecting, connect, disconnect, isMobileDevice } =
    usePhantomWallet();

  // Инициализируем состояния из localStorage
  const [jwtPayload, setJwtPayload] = useState<JWTPayload | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem(STORAGE_KEYS.JWT_PAYLOAD);
    return saved ? JSON.parse(saved) : null;
  });

  const [cryptoCards, setCryptoCards] = useState<CryptoCardType[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [hasSubscription, setHasSubscription] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEYS.SUBSCRIPTION) === "true";
  });

  const [redirectPending, setRedirectPending] = useState<boolean>(false);

  const MAX_CARDS = 16;

  // Обработчик нового сигнала
  const handleNewSignal = useCallback((signal: NewSignalMessage) => {
    // Конвертируем данные сигнала в формат карточки
    const newCard = WebSocketClient.convertSignalToCard(signal);
    
    // Обновляем список карточек
    setCryptoCards(prevCards => {
      // Находим, существует ли уже карточка с таким токеном
      const existingCardIndex = prevCards.findIndex(card => card.id === signal.token);
      
      if (existingCardIndex >= 0) {
        // Если карточка уже есть, заменяем её
        const updatedCards = [...prevCards];
        updatedCards[existingCardIndex] = newCard;
        return updatedCards;
      } else {
        // Если новая карточка, добавляем в начало и ограничиваем количество
        const updatedCards = [newCard, ...prevCards];
        return updatedCards.slice(0, MAX_CARDS);
      }
    });
  }, []);

  // Обработчик обновления сигнала
  const handleUpdateSignal = useCallback((update: UpdateSignalMessage) => {
    setCryptoCards(prevCards => {
      // Находим карточку для обновления
      const cardIndex = prevCards.findIndex(card => card.id === update.token);
      
      if (cardIndex < 0) return prevCards; // Карточка не найдена
      
      // Создаем копию карточки для обновления
      const updatedCard = { ...prevCards[cardIndex] };
      
      // Обновляем рыночные данные, если они предоставлены
      if (update.market) {
        if (update.market.price !== undefined) {
          // Обновляем marketCap, используя текущие данные о circulatingSupply
          updatedCard.marketCap = `$${(update.market.price * 
            (update.market.circulatingSupply || parseFloat(updatedCard.marketCap.replace('$', '')))).toFixed(2)}`;
        }
      }
      
      // Обновляем данные о холдингах, если они предоставлены
      if (update.holdings) {
        if (update.holdings.top10 !== undefined) {
          updatedCard.top10 = `${update.holdings.top10.toFixed(2)}%`;
          updatedCard.top10Percentage = `${update.holdings.top10.toFixed(2)}%`;
        }
        if (update.holdings.devHolds !== undefined) {
          updatedCard.devWalletHold = `${update.holdings.devHolds.toFixed(2)}%`;
        }
        if (update.holdings.insidersHolds !== undefined) {
          updatedCard.insiders = `${update.holdings.insidersHolds.toFixed(2)}%`;
        }
        if (update.holdings.first70 !== undefined) {
          updatedCard.first70BuyersHold = `${update.holdings.first70.toFixed(2)}%`;
        }
      }
      
      // Обновляем информацию о торгах, если она предоставлена
      if (update.trades && update.trades.length > 0) {
        updatedCard.whales = update.trades.map(trade => ({
          count: 1,
          amount: `${trade.amtSol.toFixed(3)} SOL`
        }));
        
        // Обновляем индикатор изменения цены (пример)
        updatedCard.priceChange = "×1.2"; // В реальном коде здесь должна быть логика расчета
      }
      
      // Создаем новый массив карточек с обновленной карточкой
      const newCards = [...prevCards];
      newCards[cardIndex] = updatedCard;
      return newCards;
    });
  }, []);

  // Обработчик ошибок WebSocket
  const handleWebSocketError = useCallback((error: any) => {
    console.log('WebSocket ошибка:', error);
    
    // Показываем мок-данные в случае ошибки подключения WebSocket
    if (cryptoCards.length === 0 && hasSubscription) {
      console.log('Загружаем резервные мок-данные из-за ошибки WebSocket');
      setCryptoCards(mockCryptoCards);
      setIsLoading(false);
    }
  }, [cryptoCards.length, hasSubscription]);

  // Эффект для подключения к WebSocket при наличии подписки
  useEffect(() => {
    if (hasSubscription && jwtPayload) {
      // Получаем токен из localStorage
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      
      if (token) {
        // Регистрируем обработчики
        wsClient.onNewSignal(handleNewSignal);
        wsClient.onUpdateSignal(handleUpdateSignal);
        wsClient.onError(handleWebSocketError);
        
        // Подключаемся к WebSocket
        wsClient.connect(token);
        
        // Устанавливаем карточки в состояние загрузки
        setIsLoading(true);
        
        // Устанавливаем таймер для фаллбэка на мок-данные в случае проблем с WebSocket
        const fallbackTimer = setTimeout(() => {
          if (cryptoCards.length === 0) {
            console.log('Таймаут WebSocket - загружаем мок-данные');
            setCryptoCards(mockCryptoCards);
            setIsLoading(false);
          }
        }, 3000); // Сокращаем время ожидания до 3 секунд
        
        return () => {
          clearTimeout(fallbackTimer);
          wsClient.disconnect();
        };
      }
    }
    
    // Очищаем при размонтировании
    return () => {
      wsClient.disconnect();
    };
  }, [hasSubscription, jwtPayload, handleNewSignal, handleUpdateSignal, handleWebSocketError, cryptoCards.length]);

  const addNewCard = (newCardData: CryptoCardType) => {
    if (!hasSubscription) return;

    setCryptoCards((prevCards) => {
      const updatedCards = [newCardData, ...prevCards];
      if (updatedCards.length > MAX_CARDS) {
        return updatedCards.slice(0, MAX_CARDS);
      }
      return updatedCards;
    });
  };

  useEffect(() => {
    if (!localStorage.getItem("dapp_keypair")) {
      const keyPair = nacl.box.keyPair();
      localStorage.setItem(
        "dapp_keypair",
        JSON.stringify({
          publicKey: bs58.encode(keyPair.publicKey),
          secretKey: bs58.encode(keyPair.secretKey),
        })
      );
    }
  }, []);

  useEffect(() => {
    if (hasSubscription) {
      const interval = setInterval(() => {
        const newCard = createNewCard();
        addNewCard(newCard);
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [hasSubscription]);

  // Добавляем функцию создания deep link
  const createMobileDeepLink = () => {
    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(nacl.box.keyPair().publicKey),
      redirect_link: window.location.href,
      app_url: window.location.origin,
      cluster: "mainnet-beta",
    });
    return `https://phantom.app/ul/v1/connect?${params.toString()}`;
  };

  // Обновляем функцию connectWallet
  const connectWallet = async () => {
    try {
      if (isConnecting) return;

      if (isMobileDevice) {
        setRedirectPending(true);
        const deepLink = createMobileDeepLink();
        window.location.href = deepLink;
        return;
      }

      // Desktop flow
      const result = await connect();
      if (!result) return;

      const { publicKey, signature, timestamp } = result;
      handleWalletConnection(publicKey, signature, timestamp);
    } catch (error) {
      console.error("Ошибка подключения:", error);
      alert("Ошибка подключения кошелька. Попробуйте снова.");
      setRedirectPending(false);
    }
  };

  // Обновляем обработчик подключения кошелька
  const handleWalletConnection = async (
    publicKey: string,
    signature: string,
    timestamp?: number
  ) => {
    try {
      // Передаем timestamp в функцию верификации
      const verifyResponse = await verifyWallet(signature, publicKey, timestamp);

      if (!verifyResponse.token || !verifyResponse.payload) {
        console.error("Получен неполный ответ от сервера:", verifyResponse);
        alert("Ошибка аутентификации. Проверьте подключение и попробуйте снова.");
        return;
      }

      localStorage.setItem(STORAGE_KEYS.WALLET, publicKey);
      localStorage.setItem(STORAGE_KEYS.TOKEN, verifyResponse.token);
      localStorage.setItem(
        STORAGE_KEYS.JWT_PAYLOAD,
        JSON.stringify(verifyResponse.payload)
      );

      setJwtPayload(verifyResponse.payload);

      // Далее логика проверки подписки и подключения к WebSocket...
      const hasValidSubscription = true; // Здесь проверка подписки
      console.log("Статус подписки:", hasValidSubscription);

      if (hasValidSubscription) {
        localStorage.setItem(STORAGE_KEYS.SUBSCRIPTION, "true");
        setHasSubscription(true);
        setIsLoading(false);
        wsClient.connect(verifyResponse.token);
      } else {
        setIsPaymentModalOpen(true);
      }
    } catch (error) {
      console.error("Ошибка при обработке верификации кошелька:", error);
      alert("Ошибка при проверке подписи. Попробуйте снова.");
    }
  };

  // Обновляем функцию checkRedirectStatus
  const checkRedirectStatus = useCallback(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const phantomPublicKeyStr = urlParams.get("phantom_encryption_public_key");
    const dataStr = urlParams.get("data");
    const nonceStr = urlParams.get("nonce");

    if (phantomPublicKeyStr && dataStr && nonceStr) {
      try {
        // Получаем сохраненный публичный ключ
        const savedPublicKey = localStorage.getItem("dapp_public_key");
        if (!savedPublicKey) throw new Error("No public key found");

        // Создаем временный keypair для расшифровки
        const tempKeypair = nacl.box.keyPair();
        const sharedSecret = nacl.box.before(
          bs58.decode(phantomPublicKeyStr),
          tempKeypair.secretKey
        );

        const decryptedData = nacl.box.open.after(
          bs58.decode(dataStr),
          bs58.decode(nonceStr),
          sharedSecret
        );

        if (!decryptedData) throw new Error("Failed to decrypt data");

        const decoded = JSON.parse(new TextDecoder().decode(decryptedData));
        const publicKey = decoded.public_key;

        // Формируем сообщение для подписи
        const currentTimestamp = Date.now();
        const message = new TextEncoder().encode(`Signing in to Trace with wallet: ${publicKey} TS: ${currentTimestamp}`);
        
        // Для мобильного устройства используем специальный тег
        const signature = 'mobile_signature';

        // Сохраняем в localStorage и обновляем состояние
        localStorage.setItem(STORAGE_KEYS.WALLET, publicKey);
        localStorage.removeItem("dapp_public_key"); // Очищаем временные данные

        // Вызываем подключение с мобильной сигнатурой
        await handleWalletConnection(publicKey, signature, currentTimestamp);

        // Очищаем URL
        window.history.replaceState({}, "", window.location.pathname);
      } catch (error) {
        console.error("Error processing return data:", error);
        alert("Failed to connect wallet. Please try again.");
      } finally {
        setRedirectPending(false);
      }
    }
  }, [handleWalletConnection]);

  // Обновляем useEffect для проверки возврата
  useEffect(() => {
    if (redirectPending) {
      checkRedirectStatus();
    }
  }, [checkRedirectStatus, redirectPending]);

  // Модифицируем disconnectWallet
  const disconnectWallet = () => {
    disconnect();
    // Отключаем WebSocket
    wsClient.disconnect();
    
    // Очищаем localStorage
    localStorage.removeItem(STORAGE_KEYS.WALLET);
    localStorage.removeItem(STORAGE_KEYS.JWT_PAYLOAD);
    localStorage.removeItem(STORAGE_KEYS.SUBSCRIPTION);
    localStorage.removeItem(STORAGE_KEYS.TOKEN);

    setJwtPayload(null);
    setHasSubscription(false);
    setIsLoading(true);
    setCryptoCards([]);
  };

  // Модифицируем handleCheckPayment
  const handleCheckPayment = async () => {
    try {
      const response = await checkPayment();
      setIsPaymentModalOpen(false);

      // Декодируем JWT токен
      if (response.hasSubscription && response.accessToken) {
        const decodedPayload = decodeJWT(response.accessToken);
        if (decodedPayload) {
          // Сохраняем декодированный JWT в localStorage
          localStorage.setItem(STORAGE_KEYS.JWT_PAYLOAD, JSON.stringify(decodedPayload));
          localStorage.setItem(STORAGE_KEYS.TOKEN, response.accessToken);
          setJwtPayload(decodedPayload);
        }
      }

      // Сохраняем статус подписки
      localStorage.setItem(STORAGE_KEYS.SUBSCRIPTION, "true");
      // Удаляем запись о модальном окне из localStorage
      localStorage.removeItem("payment_modal_open");
      setHasSubscription(true);

      setIsLoading(false);
      
      // Подключаемся к WebSocket после оплаты
      if (response.accessToken) {
        wsClient.connect(response.accessToken);
      }
    } catch (error) {
      console.error("Error checking payment:", error);
      alert("Failed to check payment status. Please try again.");
    }
  };

  // Добавляем эффект для восстановления состояния при загрузке
  useEffect(() => {
    const savedWallet = localStorage.getItem(STORAGE_KEYS.WALLET);
    const savedSubscription = localStorage.getItem(STORAGE_KEYS.SUBSCRIPTION);
    const savedJwtPayload = localStorage.getItem(STORAGE_KEYS.JWT_PAYLOAD);
    const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);

    if (savedWallet && savedSubscription === "true" && savedJwtPayload && savedToken) {
      try {
        const payload = JSON.parse(savedJwtPayload);
        setJwtPayload(payload);
        setHasSubscription(true);
        setIsLoading(false);
        
        // Восстанавливаем WebSocket соединение
        wsClient.connect(savedToken);
      } catch (error) {
        console.error("Error restoring session:", error);
        // При ошибке чистим localStorage
        localStorage.removeItem(STORAGE_KEYS.WALLET);
        localStorage.removeItem(STORAGE_KEYS.JWT_PAYLOAD);
        localStorage.removeItem(STORAGE_KEYS.SUBSCRIPTION);
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      setRedirectPending(false);
    };
  }, []);

  // Обновляем useEffect для проверки возврата
  useEffect(() => {
    if (redirectPending) {
      checkRedirectStatus();
    }
  }, [checkRedirectStatus, redirectPending]);

  // Фаллбэк для мок-данных, если WebSocket не возвращает данные
  useEffect(() => {
    if (hasSubscription && isLoading && cryptoCards.length === 0) {
      // Если через 5 секунд после подключения данные не пришли, показываем мок-данные
      const fallbackTimer = setTimeout(() => {
        if (cryptoCards.length === 0) {
          console.log('Используем мок-данные в качестве запасного варианта');
          setCryptoCards(mockCryptoCards);
          setIsLoading(false);
        }
      }, 5000);
      
      return () => clearTimeout(fallbackTimer);
    }
  }, [hasSubscription, isLoading, cryptoCards.length]);

  const skeletonCards = Array(MAX_CARDS)
    .fill(0)
    .map((_, index) => <CryptoCard key={`skeleton-${index}`} loading={true} />);

  return (
    <div className="min-h-screen bg-background">
      <Header
        wallet={wallet}
        isConnecting={isConnecting}
        onConnectWallet={connectWallet}
        onDisconnectWallet={disconnectWallet}
      />

      <main className="container py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading || !hasSubscription
            ? skeletonCards
            : cryptoCards.map((card) => (
                <CryptoCard key={card.id} data={card} />
              ))}
        </div>
      </main>

      {jwtPayload && (
        <PaymentModal
          open={isPaymentModalOpen}
          onOpenChange={setIsPaymentModalOpen}
          walletAddress={jwtPayload.topupWallet}
          onCheckPayment={handleCheckPayment}
        />
      )}
    </div>
  );
}
