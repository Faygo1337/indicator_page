import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { useError } from '@/lib/hooks/useError';

// Типы для Phantom Wallet
interface PhantomWindow extends Window {
  phantom?: {
    solana?: {
      isPhantom: boolean;
      connect: () => Promise<{ publicKey: string; signature: string; timestamp: number } | void>;
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
  connect: () => Promise<{ publicKey: string; signature: string; timestamp: number } | void>;
  disconnect: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  checkMobileDevice: () => boolean;
  provider: NonNullable<PhantomWindow['phantom']>['solana'] | null;
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
  const { handleError } = useError();



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


  const getProvider = useCallback(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    if ('phantom' in window) {
      const provider = (window as unknown as PhantomWindow).phantom?.solana;
      if (provider?.isPhantom) {
        return provider;
      }
    }

    // Открываем страницу Phantom только если мы в браузере
    if (typeof window !== 'undefined') {
      window.open('https://phantom.app/', '_blank');
    }
    return null;
  }, []);

  const checkMobileDevice = useCallback(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    setState((prev) => ({ ...prev, isMobileDevice: isMobile }));
    return isMobile;
  }, []);

  // const createMobileDeepLink = useCallback(() => {
  //   const keypair = nacl.box.keyPair();

  //   localStorage.setItem('dapp_keypair', JSON.stringify({
  //     publicKey: bs58.encode(keypair.publicKey),
  //     secretKey: bs58.encode(keypair.secretKey)
  //   }));

  //   return `https://phantom.app/ul/v1/connect?${new URLSearchParams({
  //     dapp_encryption_public_key: bs58.encode(keypair.publicKey),
  //     redirect_url: window.location.href,
  //     app_url: window.location.origin,
  //     cluster: 'mainnet-beta'
  //   }).toString()}`;
  // }, []);

  const connect = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isConnecting: true }));

      if (state.isMobileDevice) {
        const keypair = nacl.box.keyPair();
        const encodedPublicKey = bs58.encode(keypair.publicKey);

        localStorage.setItem('dapp_public_key', encodedPublicKey);

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
        handleError(new Error('Phantom wallet not installed'));
        return;
      }

      const resp = await provider.connect();
      if (!resp) return;
      const walletAddress = resp.publicKey.toString();

      try {
        const timestamp = Date.now();
        const message = new TextEncoder().encode(`Signing in to Trace with wallet: ${walletAddress} TS: ${timestamp}`);
        const signedMessage = await provider.signMessage(message, 'utf8');
        const signature = bs58.encode(signedMessage.signature);

        setState((prev) => ({
          ...prev,
          publicKey: new PublicKey(resp.publicKey),
          wallet: walletAddress,
          isConnecting: false,
        }));

        localStorage.setItem(STORAGE_KEYS.WALLET, walletAddress);

        return {
          publicKey: walletAddress,
          signature,
          timestamp,
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

  const resetWalletState = useCallback(() => {
    setState((prev) => ({
      ...prev,
      publicKey: null,
      wallet: null,
      isConnecting: false,
    }));
    localStorage.removeItem(STORAGE_KEYS.WALLET);
  }, []);

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

  const handleReturnFromPhantom = useCallback(async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const phantomKey = params.get('phantom_encryption_public_key');
      const data = params.get('data');
      const nonce = params.get('nonce');

      if (!phantomKey || !data || !nonce) {
        return null;
      }

      const savedData = localStorage.getItem('dapp_keypair');
      if (!savedData) {
        return null;
      }

      const { secretKey, pendingConnection } = JSON.parse(savedData);
      if (!pendingConnection) {
        return null;
      }

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

        setState(prev => ({
          ...prev,
          wallet: walletPublicKey,
          publicKey: new PublicKey(walletPublicKey),
          isConnecting: false
        }));

        localStorage.setItem(STORAGE_KEYS.WALLET, walletPublicKey);
        localStorage.removeItem('dapp_keypair'); // Очищаем временные данные

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

  useEffect(() => {
    if (window.location.search.includes('phantom_encryption_public_key')) {
      handleReturnFromPhantom().catch((error) => {
        console.error('Failed to handle Phantom redirect:', error);
      });
    }
  }, [handleReturnFromPhantom]);

  useEffect(() => {
    const provider = getProvider();
    if (provider) {
      const handleAccountChange = () => {
        resetWalletState();
      };

      const handleDisconnect = () => {
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

  useEffect(() => {
    checkMobileDevice();
  }, [checkMobileDevice]);

  return {
    ...state,
    connect,
    disconnect,
    signMessage,
    checkMobileDevice,
    provider: getProvider(), // Добавляем provider в возвращаемые значения
  };
}