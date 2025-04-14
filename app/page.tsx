"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/header";
import { CryptoCard } from "@/components/crypto-card";
import { PaymentModal } from "@/components/payment-modal";
import { mockCryptoCards, createNewCard } from "@/lib/mock-data";
import { verifyWallet, checkPayment } from "@/lib/api/api";
import { isSubscriptionValid, formatWalletAddress, decodeJWT } from "@/lib/utils";
import { usePhantomWallet } from "@/lib/hooks/usePhantomWallet";
import type { CryptoCard as CryptoCardType, JWTPayload } from "@/lib/api/types";
import nacl from "tweetnacl";
import bs58 from "bs58";

// В начале файла добавим константы для ключей localStorage
const STORAGE_KEYS = {
  WALLET: "whales_trace_wallet",
  SUBSCRIPTION: "whales_trace_subscription",
  JWT_PAYLOAD: "whales_trace_jwt",
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

      const { publicKey, signature } = result;
      handleWalletConnection(publicKey, signature);
    } catch (error) {
      console.error("Ошибка подключения:", error);
      alert("Ошибка подключения кошелька. Попробуйте снова.");
      setRedirectPending(false);
    }
  };

  // Добавляем обработчик подключения кошелька
  const handleWalletConnection = async (
    publicKey: string,
    signature: string
  ) => {
    const verifyResponse = await verifyWallet(signature, publicKey);

    // Сохраняем данные в localStorage
    localStorage.setItem(STORAGE_KEYS.WALLET, publicKey);
    localStorage.setItem(
      STORAGE_KEYS.JWT_PAYLOAD,
      JSON.stringify(verifyResponse.payload)
    );

    setJwtPayload(verifyResponse.payload);

    const hasValidSubscription = isSubscriptionValid(verifyResponse.payload);
    if (hasValidSubscription) {
      localStorage.setItem(STORAGE_KEYS.SUBSCRIPTION, "true");
      setHasSubscription(true);
      setCryptoCards(mockCryptoCards);
      setIsLoading(false);
    } else {
      setIsPaymentModalOpen(true);
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
        const message = new TextEncoder().encode(`Signing in to Trace with wallet: ${publicKey} TS: ${Date.now()}`);
        

        // Создаем подпись в формате base58
        const signature = bs58.encode(message);

        // Сохраняем в localStorage и обновляем состояние
        localStorage.setItem(STORAGE_KEYS.WALLET, publicKey);
        localStorage.removeItem("dapp_public_key"); // Очищаем временные данные

        // Вызываем подключение с мобильной сигнатурой
        await handleWalletConnection(publicKey, signature);

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
    // Очищаем localStorage
    localStorage.removeItem(STORAGE_KEYS.WALLET);
    localStorage.removeItem(STORAGE_KEYS.JWT_PAYLOAD);
    localStorage.removeItem(STORAGE_KEYS.SUBSCRIPTION);

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
          setJwtPayload(decodedPayload);
        }
      }

      // Сохраняем статус подписки
      localStorage.setItem(STORAGE_KEYS.SUBSCRIPTION, "true");
      // Удаляем запись о модальном окне из localStorage
      localStorage.removeItem("payment_modal_open");
      setHasSubscription(true);

      setCryptoCards(mockCryptoCards);
      setIsLoading(false);

      alert("Test mode: Displaying card data regardless of payment status.");
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

    if (savedWallet && savedSubscription === "true" && savedJwtPayload) {
      try {
        const payload = JSON.parse(savedJwtPayload);
        setJwtPayload(payload);
        setHasSubscription(true);
        setCryptoCards(mockCryptoCards);
        setIsLoading(false);
      } catch (error) {
        console.error("Error restoring session:", error);
        // При ошибке чистим localStorage
        localStorage.removeItem(STORAGE_KEYS.WALLET);
        localStorage.removeItem(STORAGE_KEYS.JWT_PAYLOAD);
        localStorage.removeItem(STORAGE_KEYS.SUBSCRIPTION);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      setRedirectPending(false);
    };
  }, []);

  useEffect(() => {
    if (hasSubscription) {
      setCryptoCards(mockCryptoCards);
      setIsLoading(false);
    }
  }, [hasSubscription]);

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
