"use client";
import Image from "next/image";
import { useEffect, useState, useCallback } from "react";
import { Connection } from '@solana/web3.js';
import { Loader2 } from "lucide-react";
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
// import { Label } from "@/components/ui/label"

// Создаем кастомный DialogContent без кнопки закрытия
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
        {/* Кнопка закрытия удалена */}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: string;
  onCheckPayment: () => Promise<void>;
}

export function PaymentModal({
  open,
  onOpenChange,
  walletAddress,
  onCheckPayment,
}: PaymentModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'checking' | 'confirming'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transactionDetails, setTransactionDetails] = useState<any>(null);
  const { provider: wallet, connect } = usePhantomWallet();

  // Функция для открытия транзакции в Solscan
  const openInSolscan = useCallback((signature: string) => {
    const url = `https://solscan.io/tx/${signature}?cluster=devnet`;
    window.open(url, '_blank');
  }, []);

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

      const connection = new Connection('https://api.devnet.solana.com');
      const amountSOL = 0.1;

      console.log('Инициализация отправки транзакции...');
      const signature = await sendPaymentTransaction(
        connection,
        wallet,
        walletAddress,
        amountSOL
      );
      console.log('Транзакция отправлена, сигнатура:', signature);

      // Получаем и показываем детали транзакции
      try {
        const details = await getTransactionDetails(connection, signature);
        setTransactionDetails(details);
        console.log('Детали транзакции:', details);
      } catch (error) {
        console.error('Ошибка при получении деталей транзакции:', error);
      }

      setStatus('checking');
      let isConfirmed = false;
      const checkTxInterval = setInterval(async () => {
        try {
          console.log('Проверка статуса транзакции...');
          isConfirmed = await checkTransactionStatus(connection, signature);
          
          if (isConfirmed) {
            console.log('Транзакция подтверждена!');
            clearInterval(checkTxInterval);
            
            // Обновляем детали транзакции после подтверждения
            try {
              const updatedDetails = await getTransactionDetails(connection, signature);
              setTransactionDetails(updatedDetails);
              console.log('Обновленные детали транзакции:', updatedDetails);
            } catch (error) {
              console.error('Ошибка при обновлении деталей транзакции:', error);
            }
            
            setStatus('confirming');
            const checkPaymentInterval = setInterval(async () => {
              try {
                await onCheckPayment();
                clearInterval(checkPaymentInterval);
                setIsProcessing(false);
                onOpenChange(false);
                window.location.reload();
              } catch (error) {
                console.error('Ошибка при проверке статуса оплаты:', error);
                setError('Ошибка проверки статуса оплаты');
                setIsProcessing(false);
                clearInterval(checkPaymentInterval);
              }
            }, 5000);
          }
        } catch (error) {
          console.error('Ошибка при проверке статуса транзакции:', error);
        }
      }, 2000);

    } catch (error) {
      console.error('Ошибка оплаты:', error);
      setError(error instanceof Error ? error.message : 'Ошибка оплаты');
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent 
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Please topup wallet</DialogTitle>
          <DialogDescription>
            Send 0.1 SOL to the address below to activate your subscription
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center space-y-4 py-4">
          <div className="grid w-full items-center gap-1.5">
            <label htmlFor="wallet-address">Wallet address</label>
            <div className="flex w-full items-center space-x-2">
              <Input
                id="wallet-address"
                value={walletAddress}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(walletAddress);
                }}
              >
                Copy
              </Button>
            </div>
          </div>

          <div className="flex flex-col w-full gap-2">
            <Button
              onClick={handlePayment}
              disabled={isProcessing}
              className={cn(
                "transition-all duration-200",
                isProcessing ? "animate-pulse" : ""
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {status === 'sending' && "Отправка транзакции..."}
                  {status === 'checking' && "Проверка транзакции..."}
                  {status === 'confirming' && "Подтверждение оплаты..."}
                </>
              ) : (
                'Pay 0.1 SOL'
              )}
            </Button>

            {error && (
              <div className="text-sm text-red-500 text-center">
                {error}
              </div>
            )}

            {transactionDetails && (
              <div className="mt-4 p-4 bg-gray-900/50 rounded-lg text-sm space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Transaction Details:</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openInSolscan(transactionDetails.signature)}
                    className="text-xs text-purple-400 hover:text-purple-300"
                  >
                    View on Solscan →
                  </Button>
                </div>

                {/* Основная информация */}
                <div className="space-y-1">
                  <p className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className={cn(
                      "font-medium",
                      transactionDetails.status === 'success' ? 'text-green-500' : 'text-red-500'
                    )}>
                      {transactionDetails.status}
                    </span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-gray-400">Type:</span>
                    <span className="font-mono">{transactionDetails.type}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-gray-400">Fee:</span>
                    <span>{(transactionDetails.fee / 1e9).toFixed(6)} SOL</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-gray-400">Confirmations:</span>
                    <span>{transactionDetails.confirmations}</span>
                  </p>
                </div>

                {/* Изменения балансов */}
                <div className="border-t border-gray-800 pt-2 mt-2">
                  <p className="font-medium mb-2">Balance Changes:</p>
                  <div className="space-y-2">
                    {transactionDetails.balanceChanges?.map((change: any, index: number) => (
                      <div key={index} className="text-xs space-y-1">
                        <div className="flex justify-between items-center">
                          <span className={cn(
                            "font-mono",
                            change.accountType === 'sender' ? 'text-red-400' :
                            change.accountType === 'recipient' ? 'text-green-400' :
                            'text-gray-400'
                          )}>
                            {change.accountType}:
                          </span>
                          <span className="font-mono">{change.account.slice(0, 4)}...{change.account.slice(-4)}</span>
                        </div>
                        <div className="flex justify-end">
                          <span className={cn(
                            "font-mono",
                            change.changeSol < 0 ? 'text-red-500' : 'text-green-500'
                          )}>
                            {change.changeSol > 0 ? '+' : ''}{change.changeSol.toFixed(6)} SOL
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timestamp */}
                {transactionDetails.timestamp && (
                  <div className="text-xs text-gray-500 text-right mt-2">
                    {new Date(transactionDetails.timestamp).toLocaleString()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
