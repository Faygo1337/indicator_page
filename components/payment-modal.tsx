import { useEffect, useState, useCallback } from "react";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePhantomWallet } from "@/lib/hooks/usePhantomWallet";
import { sendPaymentTransaction, getTransactionDetails } from "@/lib/solana-pay";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogPortal,
  DialogOverlay,
  DialogContent,
} from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const HELIUS_RPC = "https://mechelle-owgpb7-fast-mainnet.helius-rpc.com";
const FEE_RESERVE_SOL = 0.0001;
const STORAGE_KEYS = { WALLET: "whales_trace_wallet" };

function getPhantomProvider() {
  if (typeof window !== "undefined" && (window as any).solana?.isPhantom) {
    return (window as any).solana;
  }
  return null;
}

export function PaymentModal({
  open,
  onOpenChangeAction,
  walletAddress,
  onCheckPaymentAction,
}: {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  walletAddress: string;
  onCheckPaymentAction: () => Promise<void>;
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'checking' | 'confirming'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transactionDetails, setTransactionDetails] = useState<any>(null);
  const [isCopied, setIsCopied] = useState(false);
  const { publicKey, connect, disconnect } = usePhantomWallet();
  const [amountSOL, setAmountSOL] = useState<number>(0);
  const [hasEnough, setHasEnough] = useState<boolean | null>(null);

  const getCurrentWalletAddress = () =>
    publicKey?.toString() || localStorage.getItem(STORAGE_KEYS.WALLET) || "";

  // Проверка баланса и rent-exempt
  useEffect(() => {
    const checkEnough = async () => {
      const addr = getCurrentWalletAddress();
      if (!addr) {
        setHasEnough(null);
        return;
      }
      try {
        const connection = new Connection(HELIUS_RPC);
        const balanceLamports = await connection.getBalance(new PublicKey(addr));
        const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;
        const rentLamports = await connection.getMinimumBalanceForRentExemption(0);
        const rent = rentLamports / LAMPORTS_PER_SOL;
        const maxSendable = Math.max(0, balanceSOL - FEE_RESERVE_SOL - rent);
        setHasEnough(amountSOL <= maxSendable);
      } catch {
        setHasEnough(null);
      }
    };
    if (open) checkEnough();
  }, [publicKey, open, amountSOL]);

  const handlePayment = async () => {
    try {
      // Получаем provider напрямую из window
      const provider = getPhantomProvider();
      const addr = getCurrentWalletAddress();

      // Проверяем, что provider и publicKey есть (кошелек реально подключен)
      if (!provider || !provider.publicKey || !addr) {
        setError("Please connect your Phantom wallet first.");
        return;
      }
      if (hasEnough === false) {
        setError("Refill your wallet");
        return;
      }
      setIsProcessing(true);
      setStatus('sending');
      setError(null);
      setTransactionDetails(null);

      const connection = new Connection(HELIUS_RPC);

      const signature = await sendPaymentTransaction(
        connection,
        provider,
        walletAddress,
        amountSOL
      );

      if (!signature) {
        throw new Error('Failed to send transaction');
      }

      setStatus('checking');

      // Polling подтверждение
      let confirmed = false;
      const startTime = Date.now();
      while (!confirmed && (Date.now() - startTime < 60000)) {
        try {
          const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
          if (status.value && !status.value.err) {
            if (
              status.value.confirmationStatus === 'confirmed' ||
              status.value.confirmationStatus === 'finalized'
            ) {
              confirmed = true;
            } else {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } else {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      if (!confirmed) {
        throw new Error('Тайм-аут подтверждения транзакции');
      }

      setStatus('confirming');

      try {
        const details = await getTransactionDetails(connection, signature);
        setTransactionDetails(details);
      } catch {}

      let retryCount = 0;
      const maxRetries = 60;
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
        } catch {
          retryCount++;
          if (retryCount >= maxRetries) {
            clearInterval(checkPaymentInterval);
            setIsProcessing(false);
            setError('Subscription confirmation timeout. Contact support.');
          }
        }
      }, 5000);

    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : `Error sending the transaction. Check the wallet address and amount.`
      );
      setIsProcessing(false);
    }
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };
  
  const handleReconnect = async () => {
    try {
      await disconnect();
      await connect();
      // Ждем немного, чтобы Phantom успел обновить localStorage и стейт
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      setError('Failed to reconnect. Please try again.');
    }
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
      } catch {
        // Не блокируем UI при ошибке цены
      }
    };

    if (open) {
      fetchPrice();
    }
  }, [open]);

  return (
    <Dialog open={open} >
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
      style={{ userSelect: 'none' }}
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
              disabled={isProcessing || hasEnough === false}
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

            {hasEnough === false && (
              <div className="flex items-center justify-center gap-2 text-sm text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-700/30">
                <AlertCircle className="h-4 w-4" />
                <span>Refill your wallet</span>
              </div>
            )}

            {error && hasEnough !== false && (
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
                  onClick={() => window.open(`https://solscan.io/tx/${transactionDetails.signature}`, "_blank")}
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
