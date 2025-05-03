"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import Logo from "../public/logo.jpg";
import BurgerMenu from "../public/burgerMenu.svg";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, decodeJWT, formatWalletAddress } from "@/lib/utils";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { JWTPayload } from "@/lib/api/types";
import { useError } from '@/lib/hooks/useError';
import { AnimatedDialog } from "./ui/animated-dialog";
import { motion } from "framer-motion";
interface HeaderProps {
  wallet: string | null;
  isConnecting: boolean;
  onConnectWalletAction: () => Promise<void>;
  onDisconnectWalletAction: () => void;
}

export function Header({
  wallet,
  onConnectWalletAction,
  onDisconnectWalletAction,
}: HeaderProps) {
  const [pageDialogOpen, setPageDialogOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [referralLink, setReferralLink] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [referralStats, setReferralStats] = useState({ refCount: 0, refEarnings: 0 });
  const { handleError } = useError();
  const [jwtPayload, setJwtPayload] = useState<JWTPayload | null>(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('whales_trace_token');
      return token ? decodeJWT(token) : null;
    }
    return null;
  });

  const [hasLoadedReferrals, setHasLoadedReferrals] = useState(false);

  const fetchReferralStats = useCallback(async () => {
    if (!wallet || hasLoadedReferrals) return;
    
    try {
      setIsLoading(true);
      const token = localStorage.getItem('whales_trace_token');
      if (!token) return;

      const response = await fetch('https://whales.trace.foundation/api/referral', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
         throw new Error('Failed to fetch referral stats');
      }

      const data = await response.json();
      setReferralStats(data);
      setHasLoadedReferrals(true);
    } catch (error) {
      handleError(error, 'Failed to fetch referral stats');
    } finally {
      setIsLoading(false);
    }
  }, [wallet, hasLoadedReferrals, handleError]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    if (jwtPayload?.id) {
      setReferralLink(`${window.location.origin}/?ref=${jwtPayload.id}`);
    }

    if (pageDialogOpen && !hasLoadedReferrals) {
      fetchReferralStats();
    }

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [jwtPayload, pageDialogOpen, fetchReferralStats, hasLoadedReferrals]);

  useEffect(() => {
    const handleStorageChange = () => {
      const token = localStorage.getItem('whales_trace_token');
      if (token) {
        const newPayload = decodeJWT(token);
        setJwtPayload(newPayload);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleCopyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Image
            src={Logo}
            alt="Logo"
            width={50}
            height={50}
            className="rounded-md"
            loading="eager"
          />
        </div>

        {isMobile ? (
          <div className="relative pl-8">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="lg:hidden flex items-center justify-center rounded-md border border-purple-700/50 bg-purple-900/20 text-purple-400 hover:bg-purple-900/30 hover:text-purple-300">
                  <Image
                    src={BurgerMenu}
                    alt="menu"
                    width={20}
                    height={20}
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuItem
                      className="bg-white bg-opacity-20 text-white cursor-default pointer-events-none"
                    >
                      Dashboard
                    </DropdownMenuItem>
                  </TooltipTrigger>
                  <TooltipContent>Dashboard</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuItem onClick={() => wallet ? setPageDialogOpen(true) : onConnectWalletAction()}>
                      Referral
                    </DropdownMenuItem>
                  </TooltipTrigger>
                  <TooltipContent>Referral</TooltipContent>
                </Tooltip>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="flex items-center lg:space-x-6">
            <Button
              variant="ghost"
              disabled
            >
              <span className="!bg-white !bg-opacity-[0.2] text-white pointer-events-none px-4 py-2 rounded-md">
                Dashboard
              </span>
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => wallet ? setPageDialogOpen(true) : onConnectWalletAction()}
            >
              Referral
            </Button>
          </div>
        )}

        <div>
          {wallet ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="bg-purple-900/20 border-purple-700/50 text-purple-400 hover:bg-purple-900/30 hover:text-purple-300 transition-all duration-200"
                >
                  {formatWalletAddress(wallet)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  variant="destructive"
                  onClick={onDisconnectWalletAction}
                  className="group"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 relative">
                      <X className="h-4 w-4 absolute transition-all duration-200 group-hover:scale-110" />
                    </div>
                    <span>Disconnect Wallet</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={onConnectWalletAction}
              className="bg-purple-700 hover:bg-purple-600 text-white transition-all duration-200"
            >
              Connect
            </Button>
          )}
        </div>
      </div>

      <AnimatedDialog open={pageDialogOpen} onOpenChangeAction={setPageDialogOpen}>
  <div className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle className="text-lg font-semibold">Referral system</DialogTitle>
      <DialogDescription className="text-sm text-gray-400 mb-4">
        Share your referral link with your friends and get bonuses!
      </DialogDescription>
    </DialogHeader>
    
    <div className="flex flex-col space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-400">Referrals attracted:</div>
            <div className="text-xl font-semibold text-purple-300">
              {isLoading ? (
                <div className="h-7 w-16 animate-pulse bg-purple-800/30 rounded" />
              ) : (
                referralStats.refCount
              )}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Earned:</div>
            <div className="text-xl font-semibold text-green-400">
              {isLoading ? (
                <div className="h-7 w-20 animate-pulse bg-purple-800/30 rounded" />
              ) : (
                `${referralStats.refEarnings} SOL`
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="grid w-full items-center gap-1.5"
      >
        <label htmlFor="referral-link" className="text-sm text-gray-400">
          Your referral link:
        </label>
        <div className="flex w-full items-center space-x-2">
          <div className="relative flex-1">
            <Input
              id="referral-link"
              value={referralLink}
              readOnly
              className="font-mono text-sm bg-purple-900/20 border-purple-700/30 text-purple-300 focus-visible:ring-purple-500 pr-[85px]"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyReferralLink}
              aria-label={isCopied ? "Link copied" : "Copy referral link"}
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
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="mt-4 space-y-2"
      >
        <h4 className="font-medium text-sm text-gray-300">How it works:</h4>
        <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
          <li>Share your referral link with your friends</li>
          <li>When they connect their wallet through your link, you will be registered as a referrer</li>
          <li>You will receive a bonus for successfully activating a subscription through your link</li>
        </ul>
      </motion.div>
    </div>
  </div>
</AnimatedDialog>
    </header>
  );
}
