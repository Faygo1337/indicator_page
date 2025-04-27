"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Logo from "../public/logo.jpg";
import BurgerMenu from "../public/burgerMenu.svg";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, decodeJWT, formatWalletAddress } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
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

interface HeaderProps {
  wallet: string | null;
  isConnecting: boolean;
  onConnectWallet: () => Promise<void>;
  onDisconnectWallet: () => void;
}

export function Header({
  wallet,
  onConnectWallet,
  onDisconnectWallet,
}: HeaderProps) {
  const [pageDialogOpen, setPageDialogOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [referralLink, setReferralLink] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [referralStats, setReferralStats] = useState({ refCount: 0, refEarnings: 0 });

  // Получаем JWT из localStorage при монтировании
  const [jwtPayload, setJwtPayload] = useState<JWTPayload | null>(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('whales_trace_token');
      return token ? decodeJWT(token) : null;
    }
    return null;
  });

  // Получаем реферальную статистику
  const fetchReferralStats = useCallback(async () => {
    if (!wallet) return;
    
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

      if (!response.ok) throw new Error('Failed to fetch referral stats');

      const data = await response.json();
      setReferralStats(data);
    } catch (error) {
      console.error('Error fetching referral stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    // Формируем реферальную ссылку на основе ID из JWT
    if (jwtPayload?.id) {
      const baseUrl = window.location.origin;
      setReferralLink(`${baseUrl}/?ref=${jwtPayload.id}`);
    }

    // Получаем реферальную статистику при открытии диалога
    if (pageDialogOpen) {
      fetchReferralStats();
    }

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [jwtPayload, pageDialogOpen, fetchReferralStats]);

  // Обновляем JWT payload при изменении токена
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
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Image
            src={Logo}
            alt="Logo"
            width={50}
            height={50}
            className="rounded-md"
            priority
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
                    <DropdownMenuItem onClick={() => wallet ? setPageDialogOpen(true) : onConnectWallet()}>
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
              onClick={() => wallet ? setPageDialogOpen(true) : onConnectWallet()}
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
                  className="bg-purple-900/20 border-purple-700/50 text-purple-400 hover:bg-purple-900/30 hover:text-purple-300"
                >
                  {formatWalletAddress(wallet)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onDisconnectWallet}>
                  Disconnect Wallet
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={onConnectWallet}
              className="bg-purple-700 hover:bg-purple-600 text-white"
            >
              Connect
            </Button>
          )}
        </div>
      </div>

      <Dialog open={pageDialogOpen} onOpenChange={setPageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Реферальная программа</DialogTitle>
            <DialogDescription className="text-sm text-gray-400">
              Поделитесь своей реферальной ссылкой с друзьями и получайте бонусы
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col space-y-4">
            {/* Статистика рефералов */}
            <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-400">Рефералов привлечено</div>
                  <div className="text-xl font-semibold text-purple-300">
                    {isLoading ? (
                      <div className="h-7 w-16 animate-pulse bg-purple-800/30 rounded" />
                    ) : (
                      referralStats.refCount
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Заработано</div>
                  <div className="text-xl font-semibold text-green-400">
                    {isLoading ? (
                      <div className="h-7 w-20 animate-pulse bg-purple-800/30 rounded" />
                    ) : (
                      `${referralStats.refEarnings} SOL`
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Реферальная ссылка */}
            <div className="grid w-full items-center gap-1.5">
              <label htmlFor="referral-link" className="text-sm text-gray-400">
                Ваша реферальная ссылка
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
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 h-7 text-xs transition-all duration-200",
                      isCopied 
                        ? "text-purple-300 bg-purple-900/40" 
                        : "text-purple-400 hover:text-purple-300 hover:bg-purple-900/30"
                    )}
                  >
                    {isCopied ? "Скопировано!" : "Копировать"}
                  </Button>
                </div>
              </div>

              {/* Инструкция */}
              <div className="mt-4 space-y-2">
                <h4 className="font-medium text-sm text-gray-300">Как это работает:</h4>
                <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                  <li>Поделитесь своей реферальной ссылкой с друзьями</li>
                  <li>Когда они подключат кошелек через вашу ссылку, вы будете зарегистрированы как реферер</li>
                  <li>За каждую успешную активацию подписки по вашей ссылке вы получаете бонус</li>
                </ul>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
