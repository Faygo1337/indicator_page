"use client";
import { useEffect, useState, useCallback } from "react";
import { Connection } from '@solana/web3.js';
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePhantomWallet } from "@/lib/hooks/usePhantomWallet";
import { sendPaymentTransaction, checkTransactionStatus, getTransactionDetails } from "@/lib/solana-pay";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

interface PaymentModalProps {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  walletAddress: string;
  onCheckPaymentAction: () => Promise<void>;
}

export function PaymentModal({
  open,
  onOpenChangeAction,
  walletAddress,
  onCheckPaymentAction,
}: PaymentModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'checking' | 'confirming'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transactionDetails, setTransactionDetails] = useState<any>(null);
  const [isCopied, setIsCopied] = useState(false);
  const { provider: wallet, connect, disconnect } = usePhantomWallet();
  const [amountSOL, setAmountSOL] = useState<number>(0);

  const openInSolscan = useCallback((signature: string) => {
    const url = `https://solscan.io/tx/${signature}`;
    window.open(url, '_blank');
  }, []);

  const handleReconnect = async () => {
    try {
      await disconnect(); 
      await connect(); 
    } catch (error) {
      console.error('Error reconnecting:', error);
      setError('Failed to reconnect. Please try again.');
    }
  };

  const handlePayment = async () => {
    try {
      if (!wallet) {
        await connect();
        return;
      }

      setIsProcessing(true);
      setStatus('sending');
      setError(null);
      setTransactionDetails(null);

      const connection = new Connection('https://api.mainnet-beta.solana.com', {
        wsEndpoint: 'wss://api.mainnet-beta.solana.com'
      });

      const signature = await sendPaymentTransaction(
        connection,
        wallet,
        walletAddress,
        amountSOL
      );

      console.log('Transaction signature:', signature);
      if (!signature) {
        throw new Error('Failed to send transaction');
      }

      setStatus('checking');

      try {
        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Confirmation waiting timeout'));
          }, 60000);
          connection.onSignature(signature, (result, context) => {
            clearTimeout(timeoutId);
            if (result.err) {
              reject(new Error('Transaction failed'));
            } else {
              resolve();
            }
          }, 'confirmed');
        });
      } catch (wsError) {
        console.error('Error WebSocket:', wsError);
        setError('WebSocket connection error. Switch to polling.');
        let confirmed = false;
        const startTime = Date.now();
        while (!confirmed && (Date.now() - startTime < 60000)) {
          try {
            const status = await connection.getSignatureStatus(signature);
            if (status.value && !status.value.err) {
              confirmed = true;
            } else {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (pollError) {
            console.error('Error polling:', pollError);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        if (!confirmed) {
          throw new Error('Тайм-аут подтверждения транзакции');
        }
      }

      setStatus('confirming');

      try {
        const details = await getTransactionDetails(connection, signature);
        setTransactionDetails(details);
      } catch (error) {
        console.error('Ошибка получения деталей транзакции:', error);
      }

      let retryCount = 0;
      const maxRetries = 60;
      let isSubscriptionActive = false;

      const checkPaymentInterval = setInterval(async () => {
        try {
          await onCheckPaymentAction();
          const token = localStorage.getItem('whales_trace_token');
          if (token) {
            const response = await fetch('https://whales.trace.foundation/api/payment', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            const data = await response.json();

            if (data.hasSubscription === true) {
              isSubscriptionActive = true;
              clearInterval(checkPaymentInterval);
              setIsProcessing(false);
              onOpenChangeAction(false);
              window.location.reload();
            }
          }
          retryCount++;

          if (retryCount >= maxRetries) {
            clearInterval(checkPaymentInterval);
            setIsProcessing(false);
            setError('Subscription confirmation timeout. Contact support.');
          }
        } catch (error) {
          console.error('Error checked signature:', error);
          retryCount++;

          if (retryCount >= maxRetries) {
            clearInterval(checkPaymentInterval);
            setIsProcessing(false);
            setError('Subscription confirmation timeout. Contact support.');
          }
        }
      }, 5000);

    } catch (error) {
      console.error('Ошибка в handlePayment:', error);
      setError(`Error sending the transaction. Check the wallet address and amount.`);
      setIsProcessing(false);
    }
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const token = localStorage.getItem('whales_trace_token');
        const response = await fetch('https://whales.trace.foundation/api/price', {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
          }
        });

        if (!response.ok) {
          throw new Error('Failed getting price');
        }

        const data = await response.json();
        if (!data.price) {
          throw new Error('Incorrect price format');
        }

        const amount = parseFloat(data.price);
        if (isNaN(amount)) {
          throw new Error('Incorrect price value');
        }

        setAmountSOL(amount);
      } catch (error) {
        console.error('Price retrieval error:', error);
      }
    };

    if (open) {
      fetchPrice();
    }
  }, [open]);

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        
        <DialogHeader>
          <div className="flex items-center justify-between">
          <DialogTitle className="text-lg font-semibold">Topup wallet</DialogTitle>
            <DialogTitle
              onClick={handleReconnect}
              className="text-sm text-purple-400 hover:text-purple-300 cursor-pointer"
            >
              Reconnect →
            </DialogTitle>
          </div>
          
            <DialogDescription className="text-sm text-gray-400">
              Send {amountSOL} SOL to activate your subscription
            </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center space-y-4 py-2">
          <div className="grid w-full items-center gap-1.5">
            <label htmlFor="wallet-address" className="text-sm text-gray-400">Wallet address</label>
            <div className="flex w-full items-center space-x-2">
              <div className="relative flex-1">
                <Input
                  id="wallet-address"
                  value={walletAddress}
                  readOnly
                  className="font-mono text-sm bg-purple-900/20 border-purple-700/30 text-purple-300 focus-visible:ring-purple-500 pr-[85px]"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyAddress}
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 h-7 text-xs transition-all duration-200",
                    isCopied
                      ? "text-purple-300 bg-purple-900/40"
                      : "text-purple-400 hover:text-purple-300 hover:bg-purple-900/30"
                  )}
                >
                  {isCopied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col w-full gap-4 mt-2">
            <Button
              onClick={handlePayment}
              disabled={isProcessing}
              className={cn(
                "relative w-full py-2 text-sm font-medium transition-all duration-200",
                isProcessing
                  ? "bg-purple-900/50 border border-purple-700/50"
                  : "bg-purple-600 hover:bg-purple-500 hover:scale-[1.02] transform"
              )}
            >
              {isProcessing ? (
                <div className="flex items-center gap-2 text-purple-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {status === 'sending' && "Processing transaction..."}
                    {status === 'checking' && "Confirming payment..."}
                    {status === 'confirming' && "Activating subscription..."}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span>Pay {amountSOL} SOL</span>
                </div>
              )}
            </Button>

            {error && (
              <div className="flex items-center justify-center gap-2 text-sm text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-700/30">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {transactionDetails && (
            <div className="mt-2 p-2 bg-purple-900/20 rounded-lg border border-purple-700/30">
              <div className="flex items-center justify-between gap-1">
                <Button
                  variant="ghost"
                  className="flex-1 font-mono text-[12px] text-purple-300/80 hover:text-purple-300 px-2 h-7"
                  onClick={() => {
                    navigator.clipboard.writeText(transactionDetails.signature);
                  }}
                >
                  Hash: {`${transactionDetails.signature.slice(0, 4)}...${transactionDetails.signature.slice(-4)}`}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openInSolscan(transactionDetails.signature)}
                  className="shrink-0 h-6 px-2 text-[11px] font-medium text-purple-400 hover:text-purple-300 hover:bg-purple-900/40"
                >
                  View on Solscan
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}