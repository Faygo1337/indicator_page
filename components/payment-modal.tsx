"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
// import { QrCode } from "lucide-react"
import { PublicKey } from "@solana/web3.js";
import { encodeURL } from "@solana/pay";
import BigNumber from "bignumber.js";
import * as QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  // DialogContent as BaseDialogContent,
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
  // onOpenChange,
  walletAddress,
  onCheckPayment,
}: PaymentModalProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [qrCode, setQrCode] = useState<string>("");

  const handleCheckPayment = async () => {
    setIsChecking(true);
    try {
      await onCheckPayment();
    } catch (error) {
      console.error("Ошибка при проверке платежа:", error);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    setIsChecking(true);
    setQrCode("");

    const generateQrCode = async () => {
      if (!walletAddress || walletAddress.trim() === "") {
        setQrCode("Не указан адрес кошелька");
        setIsChecking(false);
        return;
      }

      try {
        console.log("Generating QR code for wallet:", walletAddress);

        try {
          new PublicKey(walletAddress).toBase58();
        } catch (error) {
          console.error("Invalid wallet address:", error);
          throw new Error("Некорректный адрес кошелька");
        }

        const recipient = new PublicKey(walletAddress).toBase58();
        const amount = new BigNumber(0.5);
        const label = "WhalesTrace Subscription";
        const message = "Payment for subscription";
        const memo = "WhalesTrace#Sub";
        const url = encodeURL({
          recipient: new PublicKey(recipient),
          amount,
          label,
          message,
          memo,
        });

        const qrCode = await QRCode.toDataURL(url.toString(), {
          errorCorrectionLevel: "H",
          margin: 2,
          width: 512,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });

        setQrCode(qrCode);
      } catch (err) {
        console.error("Error generating QR code:", err);
        setQrCode(
          err instanceof Error ? err.message : "Не удалось создать QR-код"
        );
      } finally {
        setIsChecking(false);
      }
    };

    generateQrCode();
  }, [open, walletAddress]);

  return (
    <Dialog 
      open={open}>
      {/* Используем наш кастомный DialogContent без кнопки закрытия */}
      <DialogContent 
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Please topup wallet</DialogTitle>
          <DialogDescription>
            Send 0.5 SOL to the address below to activate your subscription
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center space-y-4 py-4">
          <div className="border border-border p-4 rounded-lg">
            {qrCode && (
              <Image
                src={qrCode}
                alt="Payment QR Code"
                width={220}
                height={220}
              />
            )}
          </div>
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
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={handleCheckPayment} disabled={isChecking}>
            {isChecking ? "Checking..." : "Check (Test Mode)"}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Clicking will display card data for testing
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
