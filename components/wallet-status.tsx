"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import { formatWalletAddress } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WalletStatusProps {
  wallet: string | null;
  isConnecting: boolean;
  onConnectAction: () => Promise<void>;
  onDisconnectAction: () => void;
}

export function WalletStatus({
  wallet,
  isConnecting,
  onConnectAction,
  onDisconnectAction,
}: WalletStatusProps) {
  const [isPending, setIsPending] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnecting && isPending) {
      setIsPending(false);
    }
  }, [isConnecting, isPending]);

  const handleConnect = useCallback(async () => {
    if (isPending) return;
    
    try {
      setIsPending(true);
      setHasError(false);
      setErrorMessage(null);
      
      await onConnectAction();
    } catch (error) {
      setHasError(true);
      setErrorMessage(error instanceof Error ? error.message : "failed to connect");
      
      setTimeout(() => {
        setHasError(false);
        setErrorMessage(null);
      }, 5000);
    } finally {
      setIsPending(false);
    }
  }, [isPending, onConnectAction]);

  if (wallet) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="bg-purple-900/20 border-purple-700/50 text-purple-400 hover:bg-purple-900/30 hover:text-purple-300"
          >
            {formatWalletAddress(wallet)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onDisconnectAction}>
            Disconnect Wallet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (hasError) {
    return (
      <Button
        variant="destructive"
        onClick={handleConnect}
        className="bg-red-900/70 hover:bg-red-900/90 text-white flex items-center gap-2"
        title={errorMessage || "Error connecting wallet"}
      >
        <AlertCircle className="h-4 w-4" />
        <span>Retry Connection</span>
      </Button>
    );
  }

  return (
    <Button
      onClick={handleConnect}
      disabled={isPending}
      className="bg-purple-700 hover:bg-purple-600 text-white"
    >
      {isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : (
        "Connect Wallet"
      )}
    </Button>
  );
} 