"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/header";
import { CryptoCard } from "@/components/crypto-card";
import { PaymentModal } from "@/components/payment-modal";
import { decodeJWT } from "@/lib/utils";
import { usePhantomWallet } from "@/lib/hooks/usePhantomWallet";
import { useReferral } from "@/lib/hooks/useReferral";
import type { JWTPayload } from "@/lib/api/types";
import { ConnectWalletModal } from '@/components/connect-wallet-modal';
import { verifyWallet } from "@/lib/api/api-general";
import { ConnectWebSocket } from "@/components/websocket";
import { useError } from '@/lib/hooks/useError';
// В начале файла добавим константы для ключей localStorage
const STORAGE_KEYS = {
  WALLET: "whales_trace_wallet",
  SUBSCRIPTION: "whales_trace_subscription",
  JWT_PAYLOAD: "whales_trace_jwt",
  TOKEN: "whales_trace_token",
} as const;

export default function Home() {
  const { wallet, isConnecting, connect, disconnect } = usePhantomWallet();
  const referralCode = useReferral(); // Добавляем использование хука реферальной системы
  const { handleError } = useError();
  // контролируем состояние модалки после монтирования, чтобы не было SSR-флика
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  useEffect(() => {
    const hasWallet = localStorage.getItem(STORAGE_KEYS.WALLET);
    setIsWalletModalOpen(!hasWallet);
  }, []);

  // Инициализируем состояния из localStorage
  const [jwtPayload, setJwtPayload] = useState<JWTPayload | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem(STORAGE_KEYS.JWT_PAYLOAD);
    return saved ? JSON.parse(saved) : null;
  });

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [hasSubscription, setHasSubscription] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEYS.SUBSCRIPTION) === "true";
  });

  const MAX_CARDS = 8;

  const skeletonCards = Array(MAX_CARDS)
    .fill(0)
    .map((_, index) => <CryptoCard key={`skeleton-${index}`} loading={true} />);

  const checkAndConnectWebSocket = useCallback(async () => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      if (!token) {
        setHasSubscription(false);
        setIsLoading(false);
        return false;
      }
      const isValid = await checkSubscriptionStatus(token);
      if (!isValid) {
        setHasSubscription(false);
        localStorage.removeItem(STORAGE_KEYS.SUBSCRIPTION);
        setIsLoading(false);
        return false;
      }
      setHasSubscription(true);
      localStorage.setItem(STORAGE_KEYS.SUBSCRIPTION, "true");
      setIsLoading(false);
      return true;
    } catch {
      setHasSubscription(false);
      setIsLoading(false);
      return false;
    }
  }, []);

  useEffect(() => {
    checkAndConnectWebSocket();
  }, [checkAndConnectWebSocket]);

  // Обновляем функцию connectWallet
  const connectWallet = async () => {
    try {
      if (isConnecting) return;

      // Desktop flow
      const result = await connect();
      if (!result) return;

      const { publicKey, signature, timestamp } = result;
      handleWalletConnection(publicKey, signature, timestamp);
    } catch (error) {
      // console.error("Ошибка подключения:", error);
      handleError("CONNECT_WALLET_FAILED");
    }
  };

  // Обновляем обработчик подключения кошелька
  const handleWalletConnection = useCallback(
    async (publicKey: string, signature: string, timestamp?: number) => {
      try {
        const verifyResponse = await verifyWallet(
          signature, 
          publicKey, 
          timestamp, 
          referralCode?.toString()
        );
  
        if (!verifyResponse.token) {
          console.error("Отсутствует токен в ответе сервера:", verifyResponse);
          alert("Ошибка аутентификации. Проверьте подключение и попробуйте снова.");
          return;
        }
  
        localStorage.setItem(STORAGE_KEYS.WALLET, publicKey);
        localStorage.setItem(STORAGE_KEYS.TOKEN, verifyResponse.token);
  
        const payload = decodeJWT(verifyResponse.token);
        if (payload) {
          localStorage.setItem(STORAGE_KEYS.JWT_PAYLOAD, JSON.stringify(payload));
          setJwtPayload(payload);
          // При успешном подключении обновляем JWT в localStorage для Header
          localStorage.setItem('whales_trace_jwt', JSON.stringify(payload));
        } else {
          console.error("Не удалось декодировать JWT токен");
        }
  
        const isSubscriptionValid = await checkAndConnectWebSocket();
  
        if (!isSubscriptionValid) {
          setIsPaymentModalOpen(true);
        }

        // Очищаем реферальный ID после успешного подключения
        localStorage.removeItem('whales_trace_referral_id');
      } catch (error) {
        console.error("Ошибка при обработке верификации кошелька:", error);
        alert("Ошибка при проверке подписи. Попробуйте снова.");
      }
    },
    [referralCode, checkAndConnectWebSocket]
  );

  // Функция проверки статуса подписки
  const checkSubscriptionStatus = async (token: string): Promise<boolean> => {
    try {
      console.log('[Payment Check] Отправка GET запроса для проверки подписки...');

      const response = await fetch('https://whales.trace.foundation/api/payment', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const responseText = await response.text();
      console.log('[Payment Check] Сырой ответ от сервера:', responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('[Payment Check] Разобранный ответ:', data);
      } catch (e) {
        console.error('[Payment Check] Ошибка парсинга ответа:', e);
        console.log('[Payment Check] Невалидный JSON ответ:', responseText);
        return false;
      }
      
      if (!response.ok) {
        console.warn('[Payment Check] Ошибка запроса:', data);
        return false;
      }

      if (data?.hasSubscription === undefined) {
        console.warn('[Payment Check] В ответе отсутствует поле hasSubscription:', data);
        return false;
      }

      // Проверяем наличие нового токена в ответе
      if (data.accessToken) {
        console.log('[Payment Check] Получен новый токен доступа');
        localStorage.setItem(STORAGE_KEYS.TOKEN, data.accessToken);
      }
      
      return data.hasSubscription === true;
    } catch (error) {
      console.error('[Payment Check] Ошибка при проверке статуса подписки:', error);
      return false;
    }
  };

  // Добавляем useEffect для отслеживания состояния кошелька и модальных окон
  useEffect(() => {
    if (!wallet) {
      // Если кошелек не подключен - показываем модалку подключения
      setIsWalletModalOpen(true);
      setIsPaymentModalOpen(false);
    } else {
      // Если кошелек подключен
      setIsWalletModalOpen(false);
      
      // Проверяем подписку только при подключенном кошельке
      const checkSubscription = async () => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) return;

        const isValid = await checkSubscriptionStatus(token);
        if (!isValid) {
          setIsPaymentModalOpen(true);
        }
      };

      checkSubscription();
    }
  }, [wallet]); // Зависимость от wallet для отслеживания изменений

  // Обновляем функцию отключения кошелька
  const disconnectWallet = () => {
    disconnect();
    
    // Очищаем localStorage
    localStorage.removeItem(STORAGE_KEYS.WALLET);
    localStorage.removeItem(STORAGE_KEYS.JWT_PAYLOAD);
    localStorage.removeItem(STORAGE_KEYS.SUBSCRIPTION);
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem('whales_trace_referral'); // Очищаем реферальный код

    // Сбрасываем состояния
    setJwtPayload(null);
    setHasSubscription(false);
    setIsLoading(true);
    
    // При отключении кошелька сразу показываем модалку подключения
    setIsWalletModalOpen(true);
  };

  const handleCheckPayment = async () => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      if (!token) {
        console.error("Токен не найден в localStorage");
        return;
      }
      
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
      }
    } catch (error) {
      console.error("Error checking payment:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Модальное окно подключения кошелька - показываем всегда когда нет кошелька */}
      <ConnectWalletModal
        open={!wallet}
        onConnect={connectWallet}
      />
      
      <Header
        wallet={wallet}
        isConnecting={isConnecting}
        onConnectWallet={connectWallet}
        onDisconnectWallet={disconnectWallet}
      />

      <main className="container py-8">
        {isLoading || !hasSubscription ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {skeletonCards}
          </div>
        ) : (
          <ConnectWebSocket 
            hasSubscription={hasSubscription} 
            wallet={wallet} 
          />
        )}
      </main>

      {/* Модальное окно оплаты - показываем только при подключенном кошельке и отсутствии подписки */}
      {jwtPayload && wallet && (
        <PaymentModal
          open={isPaymentModalOpen && !hasSubscription}
          onOpenChange={setIsPaymentModalOpen}
          walletAddress={jwtPayload.topupWallet}
          onCheckPayment={handleCheckPayment}
        />
      )}
    </div>
  );
}

