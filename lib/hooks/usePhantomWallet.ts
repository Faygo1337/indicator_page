import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

// Типы для Phantom Wallet
interface PhantomWindow extends Window {
  phantom?: {
    solana?: {
      isPhantom: boolean;
      connect: () => Promise<{ publicKey: PublicKey }>;
      disconnect: () => Promise<void>;
      signMessage: (
        message: Uint8Array,
        encoding: string
      ) => Promise<{ signature: Uint8Array; publicKey: PublicKey }>;
      on: (event: string, callback: () => void) => void;
      off: (event: string, callback: () => void) => void;
    };
  };
}

// Типы для состояния хука
interface PhantomWalletState {
  wallet: string | null;
  publicKey: PublicKey | null;
  isConnecting: boolean;
  isMobileDevice: boolean;
  deepLink: string | null;
}

interface PhantomMobileWalletState extends PhantomWalletState {
  connect: () => Promise<{ publicKey: string; signature: string } | void>;
  disconnect: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  checkMobileDevice: () => boolean;
}

// Константы для ключей в localStorage
const STORAGE_KEYS = {
  WALLET: 'whales_trace_wallet',
  KEYPAIR: 'dapp_keypair',
};

export function usePhantomWallet(): PhantomMobileWalletState {
  const [state, setState] = useState<PhantomWalletState>({
    wallet: null,
    publicKey: null,
    isConnecting: false,
    isMobileDevice: false,
    deepLink: null,
  });

  // Загрузка начального состояния из localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedWallet = localStorage.getItem(STORAGE_KEYS.WALLET);
      if (savedWallet) {
        setState((prev) => ({
          ...prev,
          wallet: savedWallet,
          publicKey: new PublicKey(savedWallet),
        }));
      }
    }
  }, []);

  // Проверка наличия Phantom в браузере
  const getProvider = useCallback(() => {
    if ('phantom' in window) {
      const provider = (window as unknown as PhantomWindow).phantom?.solana;
      if (provider?.isPhantom) {
        return provider;
      }
    }
    window.open('https://phantom.app/', '_blank');
    return null;
  }, []);

  // Проверка мобильного устройства
  const checkMobileDevice = useCallback(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    setState((prev) => ({ ...prev, isMobileDevice: isMobile }));
    return isMobile;
  }, []);

  // Обновляем функцию createMobileDeepLink
  const createMobileDeepLink = useCallback(() => {
    // Создаем keypair
    const keypair = nacl.box.keyPair();
    
    // Сохраняем только то, что нужно
    localStorage.setItem('dapp_keypair', JSON.stringify({
      publicKey: bs58.encode(keypair.publicKey),
      secretKey: bs58.encode(keypair.secretKey)
    }));

    // Формируем параметры для deep link
    return `https://phantom.app/ul/v1/connect?${new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(keypair.publicKey),
      redirect_url: window.location.href,
      app_url: window.location.origin,
      cluster: 'mainnet-beta'
    }).toString()}`;
  }, []);

  // Подключение к кошельку
  const connect = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isConnecting: true }));

      if (state.isMobileDevice) {
        // Генерируем только публичный ключ для мобильной версии
        const keypair = nacl.box.keyPair();
        const encodedPublicKey = bs58.encode(keypair.publicKey);
        
        // Сохраняем только публичный ключ
        localStorage.setItem('dapp_public_key', encodedPublicKey);

        // Формируем deep link
        const params = new URLSearchParams({
          dapp_encryption_public_key: encodedPublicKey,
          redirect_url: window.location.href,
          app_url: window.location.origin,
          cluster: 'mainnet-beta'
        });

        window.location.href = `https://phantom.app/ul/v1/connect?${params.toString()}`;
        return;
      }

      const provider = getProvider();
      if (!provider) {
        throw new Error('Phantom wallet not installed');
      }

      // Подключаемся к кошельку
      const resp = await provider.connect();
      const walletAddress = resp.publicKey.toString();

      try {
        // Формируем сообщение для подписи
        const message = new TextEncoder().encode(`Signing in to Trace with wallet: ${walletAddress} TS: ${Date.now()}`);

        // Подписываем сообщение
        const signedMessage = await provider.signMessage(message, 'utf8');
        const signature = bs58.encode(signedMessage.signature);

        setState((prev) => ({
          ...prev,
          publicKey: resp.publicKey,
          wallet: walletAddress,
          isConnecting: false,
        }));

        localStorage.setItem(STORAGE_KEYS.WALLET, walletAddress);

        return {
          publicKey: walletAddress,
          signature,
        };
      } catch (error) {
        console.error('Error signing message:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error connecting to Phantom wallet:', error);
      setState((prev) => ({ ...prev, isConnecting: false }));
      throw error;
    }
  }, [getProvider, state.isMobileDevice]);

  // Сброс состояния кошелька
  const resetWalletState = useCallback(() => {
    setState((prev) => ({
      ...prev,
      publicKey: null,
      wallet: null,
      isConnecting: false,
    }));
    localStorage.removeItem(STORAGE_KEYS.WALLET);
  }, []);

  // Отключение от кошелька
  const disconnect = useCallback(async () => {
    try {
      const provider = getProvider();
      if (provider) {
        await provider.disconnect();
      }
      resetWalletState();
    } catch (error) {
      console.error('Error disconnecting from Phantom wallet:', error);
      resetWalletState();
    }
  }, [getProvider, resetWalletState]);

  // Подписание сообщения
  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      try {
        const provider = getProvider();
        if (!provider) throw new Error('Phantom wallet not installed');
        if (!state.publicKey) throw new Error('Wallet not connected');

        const encodedMessage = new TextEncoder().encode(message);
        const signedMessage = await provider.signMessage(encodedMessage, "utf8");
        return bs58.encode(signedMessage.signature);
      } catch (error) {
        console.error('Error signing message:', error);
        throw error;
      }
    },
    [getProvider, state.publicKey]
  );

  // Обработка возврата от Phantom
  const handleReturnFromPhantom = useCallback(async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const phantomKey = params.get('phantom_encryption_public_key');
      const data = params.get('data');
      const nonce = params.get('nonce');

      if (!phantomKey || !data || !nonce) {
        console.log('Missing required parameters');
        return null;
      }

      // Получаем сохраненный keypair
      const savedData = localStorage.getItem('dapp_keypair');
      if (!savedData) {
        console.log('No saved keypair found');
        return null;
      }

      const { secretKey, pendingConnection } = JSON.parse(savedData);
      if (!pendingConnection) {
        console.log('No pending connection');
        return null;
      }

      // Расшифровываем данные
      try {
        const sharedSecret = nacl.box.before(
          bs58.decode(phantomKey),
          bs58.decode(secretKey)
        );

        const decryptedData = nacl.box.open.after(
          bs58.decode(data),
          bs58.decode(nonce),
          sharedSecret
        );

        if (!decryptedData) {
          throw new Error('Failed to decrypt data');
        }

        const decoded = JSON.parse(new TextDecoder().decode(decryptedData));
        const walletPublicKey = decoded.public_key;

        // Обновляем состояние
        setState(prev => ({
          ...prev,
          wallet: walletPublicKey,
          publicKey: new PublicKey(walletPublicKey),
          isConnecting: false
        }));

        // Сохраняем подключение
        localStorage.setItem(STORAGE_KEYS.WALLET, walletPublicKey);
        localStorage.removeItem('dapp_keypair'); // Очищаем временные данные

        // Очищаем URL
        window.history.replaceState({}, '', window.location.pathname);

        return {
          publicKey: walletPublicKey,
          signature: 'mobile_signature'
        };

      } catch (error) {
        console.error('Decryption error:', error);
        throw error;
      }
    } catch (error) {
      console.error('Return processing error:', error);
      setState(prev => ({ ...prev, isConnecting: false }));
      throw error;
    }
  }, []);

  // Эффект для обработки возврата от Phantom
  useEffect(() => {
    if (window.location.search.includes('phantom_encryption_public_key')) {
      console.log('Detected Phantom redirect, processing...');
      handleReturnFromPhantom().catch((error) => {
        console.error('Failed to handle Phantom redirect:', error);
      });
    }
  }, [handleReturnFromPhantom]);

  // Подписка на события Phantom
  useEffect(() => {
    const provider = getProvider();
    if (provider) {
      const handleAccountChange = () => {
        console.log('Account changed in Phantom wallet');
        resetWalletState();
      };

      const handleDisconnect = () => {
        console.log('Phantom wallet disconnected');
        resetWalletState();
      };

      provider.on('accountChanged', handleAccountChange);
      provider.on('disconnect', handleDisconnect);

      return () => {
        provider.off('accountChanged', handleAccountChange);
        provider.off('disconnect', handleDisconnect);
      };
    }
  }, [getProvider, resetWalletState]);

  // Инициализация проверки устройства
  useEffect(() => {
    checkMobileDevice();
  }, [checkMobileDevice]);

  return {
    ...state,
    connect,
    disconnect,
    signMessage,
    checkMobileDevice,
  };
}