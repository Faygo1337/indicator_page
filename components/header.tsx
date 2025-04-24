"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Logo from "../public/logo.jpg";
import BurgerMenu from "../public/burgerMenu.svg";
import { Button } from "@/components/ui/button";
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
import { formatWalletAddress } from "@/lib/utils";

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

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    handleResize(); 
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

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
                    className=""
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
                    <DropdownMenuItem onClick={() => setPageDialogOpen(true)}>
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
            <Button variant="ghost" onClick={() => setPageDialogOpen(true)}>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Page Under Development</DialogTitle>
            <DialogDescription>
              This page is currently under development. Please check back later.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </header>
  );
}
