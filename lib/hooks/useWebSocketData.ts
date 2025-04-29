// FILE: useWebSocketData.ts

'use client';

import { useState, useEffect, useCallback } from 'react';
import { CryptoCard, UpdateSignalMessage } from '@/lib/api/types';
import { webSocketClient, convertToCardUpdates } from '@/lib/api/api-general';
import { getJwtFromStorage } from '@/lib/utils';

export type ExtendedCryptoCard = CryptoCard & {
  _lastUpdated?: number;
  _updateId?: string;
  _receivedAt?: number;
};

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
type WebSocketControls = {
  reconnect: () => void;
  disconnect: () => void;
};

export function useWebSocketData(): [
  WebSocketStatus,
  ExtendedCryptoCard[],
  string | null,
  WebSocketControls,
  (token: string, updates: Partial<CryptoCard>) => void
] {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [cards, setCards] = useState<ExtendedCryptoCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  const MAX_CARDS = 8;

  const applyCardUpdate = useCallback((token: string, updates: Partial<CryptoCard>) => {
    setCards(prevCards => {
      const index = prevCards.findIndex(card => card.id === token);
      const timestamp = Date.now();

      if (index === -1) {
        const newCard: ExtendedCryptoCard = {
          id: token,
          name: updates.name ?? '???',
          symbol: updates.symbol ?? '???',
          image: updates.image ?? '',
          marketCap: updates.marketCap ?? '$0',
          tokenAge: updates.tokenAge ?? '',
          top10: updates.top10 ?? '',
          devWalletHold: updates.devWalletHold ?? '',
          first70BuyersHold: updates.first70BuyersHold ?? '',
          insiders: updates.insiders ?? '',
          whales: updates.whales ?? [],
          noMint: updates.noMint ?? false,
          blacklist: updates.blacklist ?? false,
          burnt: updates.burnt ?? '0%',
          top10Percentage: updates.top10Percentage ?? '',
          priceChange: updates.priceChange ?? '',
          socialLinks: updates.socialLinks ?? {},
          _receivedAt: timestamp,
          _lastUpdated: timestamp,
          _updateId: `create-${timestamp}`,
        };
        return [newCard, ...prevCards].slice(0, MAX_CARDS);
      }

      const existingCard = prevCards[index];

      const updatedCard: ExtendedCryptoCard = {
        ...existingCard,
        ...updates,
        name: updates.name ?? existingCard.name ?? '???',
        symbol: updates.symbol ?? existingCard.symbol ?? '???',
        image: updates.image ?? existingCard.image ?? '',
        marketCap: updates.marketCap ?? existingCard.marketCap ?? '$0',
        tokenAge: updates.tokenAge ?? existingCard.tokenAge ?? '',
        top10: updates.top10 ?? existingCard.top10 ?? '',
        devWalletHold: updates.devWalletHold ?? existingCard.devWalletHold ?? '',
        first70BuyersHold: updates.first70BuyersHold ?? existingCard.first70BuyersHold ?? '',
        insiders: updates.insiders ?? existingCard.insiders ?? '',
        whales: updates.whales ?? existingCard.whales ?? [],
        noMint: updates.noMint ?? existingCard.noMint ?? false,
        blacklist: updates.blacklist ?? existingCard.blacklist ?? false,
        burnt: updates.burnt ?? existingCard.burnt ?? '0%',
        top10Percentage: updates.top10Percentage ?? existingCard.top10Percentage ?? '',
        priceChange: updates.priceChange ?? existingCard.priceChange ?? '',
        socialLinks: updates.socialLinks ?? existingCard.socialLinks ?? {},
        _lastUpdated: timestamp,
        _updateId: `update-${timestamp}`,
      };

      return [
        ...prevCards.slice(0, index),
        updatedCard,
        ...prevCards.slice(index + 1),
      ];
    });
  }, []);


  const handleError = useCallback((err: unknown) => {

    const message = err instanceof Error ? err.message : 'Error connected to WebSocket';
    setError(message);
    setStatus('error');
  }, []);

  const reconnect = useCallback(() => {
    const jwtToken = getJwtFromStorage();
    if (!jwtToken) {
      return;
    }

    if (status === 'connecting') return;
    setStatus('connecting');
    setError(null);

    webSocketClient
      .connect(jwtToken)
      .then(() => {
        setStatus('connected');
      })
      .catch((err: Error) => {
        setError(err.message || 'Not connected');
        setStatus('error');
      });
  }, [status]);

  const disconnect = useCallback(() => {
    webSocketClient.disconnect();
    setStatus('disconnected');
  }, []);

  useEffect(() => {
    const jwtToken = getJwtFromStorage();
    if (!jwtToken) {
      return;
    }

    setStatus('connecting');

    webSocketClient.onNewSignal((data: CryptoCard) => {
      if (!data?.id) {
        return;
      }

      applyCardUpdate(data.id, data);
    });

    webSocketClient.onError(handleError);

    webSocketClient.onRawUpdateSignal((token: string, rawUpdate: UpdateSignalMessage) => {
      const updates = convertToCardUpdates(rawUpdate);
      applyCardUpdate(token, updates);
    });

    webSocketClient
      .connect(jwtToken)
      .then(() => {
        setStatus('connected');
      })
      .catch((err: Error) => {
        setError(err.message || 'Not connected');
        setStatus('error');
      });

    return () => {
      webSocketClient.disconnect();
    };
  }, [applyCardUpdate, handleError]);

  return [status, cards, error, { reconnect, disconnect }, applyCardUpdate];
}