"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/header";
import { CryptoCard } from "@/components/crypto-card";
import { PaymentModal } from "@/components/payment-modal";
import { mockCryptoCards, createNewCard } from "@/lib/mock-data";
import { verifyWallet, checkPayment, webSocketClient } from "@/lib/api/api-general";
import { isSubscriptionValid, formatWalletAddress, decodeJWT } from "@/lib/utils";
import { usePhantomWallet } from "@/lib/hooks/usePhantomWallet";
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

  // Создаем функцию для проверки подписки и подключения к WebSocket
  const checkAndConnectWebSocket = useCallback(async () => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      
      if (!token) {
        console.error('Отсутствует токен для подключения WebSocket');
        setHasSubscription(false);
        setIsLoading(false);
        return false;
      }
      
      // Проверяем статус подписки
      const isSubscriptionValid = await checkSubscriptionStatus(token);
      
      if (!isSubscriptionValid) {
        console.warn('Подписка недействительна, сбрасываем состояние');
        setHasSubscription(false);
        localStorage.removeItem(STORAGE_KEYS.SUBSCRIPTION);
        setIsLoading(false);
        return false;
      }
      
      console.log('Подписка действительна');
      
      // Устанавливаем статус подписки
      localStorage.setItem(STORAGE_KEYS.SUBSCRIPTION, "true");
      setHasSubscription(true);
      
      // WebSocket подключение будет осуществлено через useEffect
      // Не подключаем WebSocket здесь, чтобы избежать двойного подключения
      
      return true;
    } catch (error) {
      console.error("Ошибка при проверке подписки:", error);
      setHasSubscription(false);
      localStorage.removeItem(STORAGE_KEYS.SUBSCRIPTION);
      setIsLoading(false);
      return false;
    }
  }, []);

  // Эффект для подключения к WebSocket при наличии подписки
  useEffect(() => {
    if (hasSubscription && jwtPayload) {
      // Инициализируем WebSocket подключение
      const initWebSocket = async () => {
        // Проверяем, подключены ли мы уже
        if (webSocketClient.isConnected()) {
          console.log('WebSocket уже подключен, пропускаем инициализацию');
          // Если уже есть карточки, убираем состояние загрузки
          if (cryptoCards.length > 0) {
            setIsLoading(false);
          }
          return;
        }
        
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        
        if (!token) {
          console.error('Отсутствует токен для подключения WebSocket');
          setHasSubscription(false);
          setIsLoading(false);
          // Показываем мок-данные при ошибке токена
          setCryptoCards(mockCryptoCards);
          return;
        }
        
        console.log('Инициализация WebSocket с токеном');
        
        // Создаем адаптеры для преобразования типов
        const newSignalAdapter = (cardData: CryptoCardType) => {
          console.log('Получена новая карточка:', cardData.id);
          // Добавляем новую карточку в список
          setCryptoCards(prevCards => {
            // Проверяем, существует ли уже такая карточка
            const existingCardIndex = prevCards.findIndex(card => card.id === cardData.id);
            
            if (existingCardIndex >= 0) {
              // Обновляем существующую карточку
              const updatedCards = [...prevCards];
              updatedCards[existingCardIndex] = cardData;
              return updatedCards;
            } else {
              // Добавляем новую карточку в начало
              const updatedCards = [cardData, ...prevCards];
              // Ограничиваем количество карточек
              return updatedCards.slice(0, MAX_CARDS);
            }
          });
          
          // Убираем состояние загрузки после получения первых данных
          if (isLoading) {
            setIsLoading(false);
          }
        };
        
        const updateSignalAdapter = (token: string, updates: Partial<CryptoCardType>) => {
          console.log('Получено обновление для токена:', token);
          // Обновляем существующую карточку
          setCryptoCards(prevCards => {
            const cardIndex = prevCards.findIndex(card => card.id === token);
            if (cardIndex === -1) return prevCards;
            
            const updatedCards = [...prevCards];
            updatedCards[cardIndex] = { ...updatedCards[cardIndex], ...updates };
            return updatedCards;
          });
        };
        
        const errorHandler = (error: any) => {
          console.log('Ошибка WebSocket, загружаем мок-данные');
          
          // Если карточек нет, добавляем мок-данные
          if (cryptoCards.length === 0) {
            setCryptoCards(mockCryptoCards);
          }
          
          setIsLoading(false);
        };
        
        // Очищаем предыдущие обработчики перед регистрацией новых
        webSocketClient.disconnect();
        
        // Регистрируем обработчики событий
        webSocketClient.onNewSignal(newSignalAdapter);
        webSocketClient.onUpdateSignal(updateSignalAdapter);
        webSocketClient.onError(errorHandler);
        
        // Подключаемся к WebSocket
        webSocketClient.connect(token);
        
        // Устанавливаем состояние загрузки
        setIsLoading(true);
        
        // Устанавливаем таймаут для фаллбэка на мок-данные
        const fallbackTimer = setTimeout(() => {
          if (cryptoCards.length === 0) {
            console.log('Таймаут WebSocket - загружаем мок-данные');
            setCryptoCards(mockCryptoCards);
            setIsLoading(false);
          }
        }, 10000); // 10 секунд на получение данных
        
        return () => {
          clearTimeout(fallbackTimer);
        };
      };
      
      initWebSocket();
    } else if (!hasSubscription && isLoading) {
      // Если нет подписки, но показываем загрузку, загружаем мок-данные
      setCryptoCards(mockCryptoCards);
      setIsLoading(false);
    }
    
    // Очищаем при размонтировании
    return () => {
      // Не отключаем WebSocket при размонтировании, чтобы сохранить соединение
      // webSocketClient.disconnect();
    };
  }, [hasSubscription, jwtPayload, isLoading]);

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

      if (!verifyResponse.token) {
        console.error("Отсутствует токен в ответе сервера:", verifyResponse);
        alert("Ошибка аутентификации. Проверьте подключение и попробуйте снова.");
        return;
      }

      // Сохраняем токен в localStorage
      localStorage.setItem(STORAGE_KEYS.WALLET, publicKey);
      localStorage.setItem(STORAGE_KEYS.TOKEN, verifyResponse.token);
      
      // Получаем данные из JWT
      const payload = decodeJWT(verifyResponse.token);
      if (payload) {
        localStorage.setItem(STORAGE_KEYS.JWT_PAYLOAD, JSON.stringify(payload));
        setJwtPayload(payload);
      } else {
        console.error("Не удалось декодировать JWT токен");
      }
      
      // Проверяем подписку и подключаемся к WebSocket
      const isSubscriptionValid = await checkAndConnectWebSocket();
      
      if (!isSubscriptionValid) {
        // Если нет подписки, открываем модальное окно для оплаты
        setIsPaymentModalOpen(true);
      }
    } catch (error) {
      console.error("Ошибка при обработке верификации кошелька:", error);
      alert("Ошибка при проверке подписи. Попробуйте снова.");
    }
  };
  
  // Функция проверки статуса подписки
  const checkSubscriptionStatus = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch('https://whales.trace.foundation/api/payment', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.warn('Ошибка при проверке подписки, статус:', response.status);
        return false;
      }
      
      const data = await response.json();
      console.log('Статус подписки:', data);
      
      return data.hasSubscription === true;
    } catch (error) {
      console.error('Ошибка при проверке статуса подписки:', error);
      return false;
    }
  };

  // Добавляем эффект для восстановления состояния при загрузке
  useEffect(() => {
    const savedWallet = localStorage.getItem(STORAGE_KEYS.WALLET);
    const savedSubscription = localStorage.getItem(STORAGE_KEYS.SUBSCRIPTION);
    const savedJwtPayload = localStorage.getItem(STORAGE_KEYS.JWT_PAYLOAD);
    const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);

    if (savedWallet && savedSubscription === "true" && savedJwtPayload && savedToken) {
      const restoreSession = async () => {
        try {
          // Загружаем данные JWT
          const payload = JSON.parse(savedJwtPayload);
          setJwtPayload(payload);
          
          // Проверяем подписку и подключаемся к WebSocket
          const isValid = await checkAndConnectWebSocket();
          
          if (!isValid) {
            console.warn('Не удалось восстановить сессию, подписка недействительна');
          }
        } catch (error) {
          console.error("Error restoring session:", error);
          // При ошибке чистим localStorage
          localStorage.removeItem(STORAGE_KEYS.WALLET);
          localStorage.removeItem(STORAGE_KEYS.JWT_PAYLOAD);
          localStorage.removeItem(STORAGE_KEYS.SUBSCRIPTION);
          localStorage.removeItem(STORAGE_KEYS.TOKEN);
        }
      };
      
      restoreSession();
    }
  }, [checkAndConnectWebSocket]);

  useEffect(() => {
    return () => {
      setRedirectPending(false);
    };
  }, []);

  // Обновляем функцию checkRedirectStatus и перемещаем её выше перед использованием
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

  // Модифицируем disconnectWallet
  const disconnectWallet = () => {
    // Отключаем WebSocket
    webSocketClient.disconnect();
    
    // Отключаем кошелек
    disconnect();
    
    // Очищаем localStorage
    localStorage.removeItem(STORAGE_KEYS.WALLET);
    localStorage.removeItem(STORAGE_KEYS.JWT_PAYLOAD);
    localStorage.removeItem(STORAGE_KEYS.SUBSCRIPTION);
    localStorage.removeItem(STORAGE_KEYS.TOKEN);

    // Сбрасываем состояние
    setJwtPayload(null);
    setHasSubscription(false);
    setIsLoading(true);
    setCryptoCards([]);
  };

  const skeletonCards = Array(MAX_CARDS)
    .fill(0)
    .map((_, index) => <CryptoCard key={`skeleton-${index}`} loading={true} />);

  // Модифицируем handleCheckPayment
  const handleCheckPayment = async () => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      if (!token) {
        console.error("Токен не найден в localStorage");
        alert("Ошибка проверки платежа: токен не найден");
        return;
      }
      
      // Закрываем модальное окно оплаты
      setIsPaymentModalOpen(false);
      
      // Проверяем подписку и подключаемся к WebSocket
      const isValid = await checkAndConnectWebSocket();
      
      if (isValid) {
        console.log('Подписка успешно активирована');
        
        // Декодируем JWT токен для обновления данных
        const decodedPayload = decodeJWT(token);
        if (decodedPayload) {
          localStorage.setItem(STORAGE_KEYS.JWT_PAYLOAD, JSON.stringify(decodedPayload));
          setJwtPayload(decodedPayload);
        }
        
        // Удаляем запись о модальном окне из localStorage
        localStorage.removeItem("payment_modal_open");
      } else {
        // Пытаемся обновить токен через API
        try {
          // Получаем адрес кошелька
          const walletAddress = localStorage.getItem(STORAGE_KEYS.WALLET);
          if (!walletAddress) {
            throw new Error("Адрес кошелька не найден");
          }
          
          // Здесь должен быть код для повторной верификации кошелька
          // Это зависит от вашей реализации, но в качестве примера:
          const response = await fetch('https://whales.trace.foundation/auth/refresh', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ wallet: walletAddress })
          });
          
          if (response.ok) {
            const refreshData = await response.json();
            if (refreshData.token) {
              // Сохраняем новый токен
              localStorage.setItem(STORAGE_KEYS.TOKEN, refreshData.token);
              
              // Проверяем подписку и подключаемся к WebSocket с новым токеном
              const newValid = await checkAndConnectWebSocket();
              
              if (newValid) {
                return;
              }
            }
          }
          
          // Если обновление не удалось, показываем сообщение об ошибке
          alert("Подписка не найдена. Пожалуйста, оплатите подписку для продолжения.");
        } catch (refreshError) {
          console.error("Ошибка при обновлении токена:", refreshError);
          alert("Ошибка при обновлении токена. Пожалуйста, попробуйте снова или свяжитесь с поддержкой.");
        }
      }
    } catch (error) {
      console.error("Error checking payment:", error);
      alert("Failed to check payment status. Please try again.");
    }
  };

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
