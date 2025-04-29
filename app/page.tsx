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
  const referralCode = useReferral();
  const { handleError } = useError();

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
      await handleWalletConnection(publicKey, signature, timestamp);
    } catch {
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
          handleError("CONNECT_WALLET_FAILED");
          return;
        }

        localStorage.setItem(STORAGE_KEYS.WALLET, publicKey);
        localStorage.setItem(STORAGE_KEYS.TOKEN, verifyResponse.token);

        const payload = decodeJWT(verifyResponse.token);
        if (payload) {
          localStorage.setItem(STORAGE_KEYS.JWT_PAYLOAD, JSON.stringify(payload));
          setJwtPayload(payload);
          localStorage.setItem('whales_trace_jwt', JSON.stringify(payload));
        } else {
          return
        }

        const isSubscriptionValid = await checkAndConnectWebSocket();

        if (!isSubscriptionValid) {
          setIsPaymentModalOpen(true);
        }

        localStorage.removeItem('whales_trace_referral_id');
      } catch (error) {
        handleError(error, 'Wallet connection failed');
        setIsPaymentModalOpen(false);
      }
    },
    [handleError, checkAndConnectWebSocket, referralCode]
  );

  // Функция проверки статуса подписки
  const checkSubscriptionStatus = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch('https://whales.trace.foundation/api/payment', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': "application/json",
        }
      });

      const responseText = await response.text();

      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
      
        return false;
      }

      if (!response.ok) {
        return false;
      }

      if (data?.hasSubscription === undefined) {
        return false;
      }

      if (data.accessToken) {
        localStorage.setItem(STORAGE_KEYS.TOKEN, data.accessToken);
      }

      return data.hasSubscription === true;
    } catch (error) {
      handleError(error, 'Subscription check failed');
      return false;
    }
  };

  // Добавляем useEffect для отслеживания состояния кошелька и модальных окон
  useEffect(() => {
    if (!wallet) {
      setIsPaymentModalOpen(false);
    } else {
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
  }, [wallet]);

  // Обновляем функцию отключения кошелька
  const disconnectWallet = () => {
     disconnect();

    // Очищаем localStorage
    localStorage.removeItem(STORAGE_KEYS.WALLET);
    localStorage.removeItem(STORAGE_KEYS.JWT_PAYLOAD);
    localStorage.removeItem(STORAGE_KEYS.SUBSCRIPTION);
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem('whales_trace_referral');

    // Сбрасываем состояния
    setJwtPayload(null);
    setHasSubscription(false);
    setIsLoading(true);
  };

  const handleCheckPayment = async () => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      if (!token) {
        return;
      }

      const isValid = await checkAndConnectWebSocket();

      if (isValid) {
        const decodedPayload = decodeJWT(token);
        if (decodedPayload) {
          localStorage.setItem(STORAGE_KEYS.JWT_PAYLOAD, JSON.stringify(decodedPayload));
          setJwtPayload(decodedPayload);
        }
      }
    } catch (error) {
      handleError(error, 'Payment verification failed');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ConnectWalletModal
        open={!wallet}
        onConnectAction={connectWallet}
      />

      <Header
        wallet={wallet}
        isConnecting={isConnecting}
        onConnectWalletAction={connectWallet}
        onDisconnectWalletAction={disconnectWallet}
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

      {jwtPayload && wallet && (
        <PaymentModal
          open={isPaymentModalOpen && !hasSubscription}
          onOpenChangeAction={setIsPaymentModalOpen}
          walletAddress={jwtPayload.topupWallet}
          onCheckPaymentAction={handleCheckPayment}
        />
      )}
    </div>
  );
}