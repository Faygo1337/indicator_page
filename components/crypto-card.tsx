"use client";
import { useState } from "react";
import Image from "next/image";
import {
  Copy,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  Twitter,
  MessageCircle,
  Check,
  BarChart3,
} from "lucide-react";
import GMGNLogo from "@/public/gmgnLogo.png";
import bloomLogo from "@/public/bloomLogo.jpg";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CryptoCard as CryptoCardType } from "@/lib/types";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface CryptoCardProps {
  data?: CryptoCardType;
  loading?: boolean;
}

export function CryptoCard({ data, loading = false }: CryptoCardProps) {
  const [copied, setCopied] = useState(false);
  const mockContractAddress = "0xMockSmartContractAddress";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(mockContractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !data) {
    return (
      <Card className="overflow-hidden border-gray-800">
        <CardContent className="p-0">
          <div className="p-4 space-y-3">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-12 w-12 rounded-md" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-[80px]" />
                  <Skeleton className="h-3 w-[60px]" />
                </div>
              </div>
              <Skeleton className="h-7 w-7 rounded-full" />
            </div>

            {/* Overview skeleton */}
            <div className="space-y-1 mt-3">
              <Skeleton className="h-3 w-[80px]" />
              <div className="grid grid-cols-2 gap-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>

            {/* Actions row skeleton */}
            <div className="flex items-center justify-between mt-3">
              <Skeleton className="h-8 w-[80px]" />
              <div className="flex gap-1">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-7 w-7 rounded-full" />
              </div>
              <Skeleton className="h-7 w-[50px]" />
            </div>
          </div>
        </CardContent>
        <CardFooter className="grid grid-cols-2 p-0 mt-1">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardFooter>
      </Card>
    );
  }

  const isPriceUp = !data.priceChange.includes("-");

  return (
    <Card className="block overflow-hidden border-gray-800">
      <CardContent style={{ padding: "0.1rem .1rem 0" }}>
        <div className="p-4">
          {/* Header */}
          <div
            className="flex items-center"
            style={{ justifyContent: "space-between", marginBottom: "1rem" }}
          >
            <div className="flex items-center gap-2">
              <div className="h-12 w-12 rounded-md overflow-hidden">
                <Image
                  src={data.image || bloomLogo}
                  alt={data.name}
                  width={48}
                  height={48}
                  className="object-cover"
                />
              </div>
              <div>
                <h3 className="text-base font-semibold">{data.name}</h3>
                <p className="text-xs text-muted-foreground">{data.symbol}</p>
              </div>
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyToClipboard}
                    className="h-7 w-7"
                  >
                    {copied ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{copied ? "Copied!" : "Copy contract address"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Overview - в виде таблицы */}
          <div style={{ marginTop: ".6rem" }}>
            <h4 className="text-xs font-medium text-muted-foreground">
              Overview
            </h4>
            <div
              className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs"
              style={{
                border: "1px solid #2a2a2a",
                padding: "1rem",
                borderRadius: "0.5rem",
              }}
            >
              <div className="flex items-center">
                <span className="mr-1">💎</span>
                <span className="text-muted-foreground">Market Cap:</span>
              </div>
              <div className="text-right">{data.marketCap}</div>

              <div className="flex items-center">
                <span className="mr-1">⏳</span>
                <span className="text-muted-foreground">Token Age:</span>
              </div>
              <div className="text-right">{data.tokenAge}</div>

              <div className="flex items-center">
                <span className="mr-1">💡</span>
                <span className="text-muted-foreground">Top10:</span>
              </div>
              <div className="text-right">{data.top10}</div>

              <div className="flex items-center">
                <span className="mr-1">🧮</span>
                <span className="text-muted-foreground">Dev Wallet:</span>
              </div>
              <div className="text-right">{data.devWalletHold}</div>

              <div className="flex items-center">
                <span className="mr-1">🧠</span>
                <span className="text-muted-foreground">First 70 buyers:</span>
              </div>
              <div className="text-right">{data.first70BuyersHold}</div>

              <div className="flex items-center">
                <span className="mr-1">🐀</span>
                <span className="text-muted-foreground">Insiders:</span>
              </div>
              <div className="text-right">{data.insiders}</div>
            </div>
          </div>

          {/* Actions row - combined View whales, social media, and performance */}
          <div
            className="flex items-center justify-between"
            style={{ marginTop: "1.6rem" }}
          >
            <div className="flex items-center gap-3">
              <HoverCard openDelay={0} closeDelay={100}>
                <HoverCardTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2 flex items-center gap-1 hover:bg-secondary"
                  >
                    <BarChart3 className="h-3 w-3" />
                    View whales
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent
                  side="top"
                  align="start"
                  className="w-auto p-3 bg-gray-900 border-gray-800 text-gray-200"
                >
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold">💸 Whales:</h4>
                    {data.whales.map((whale, index) => (
                      <p key={index} className="text-xs whitespace-nowrap">
                        ├ {whale.count} {whale.amount}
                      </p>
                    ))}
                  </div>
                </HoverCardContent>
              </HoverCard>

              <div className="flex gap-1">
                {data.socialLinks.telegram && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    asChild
                  >
                    <a
                      href=""
                      // href={data.socialLinks.telegram}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="h-3 w-3" />
                      <span className="sr-only">Telegram</span>
                    </a>
                  </Button>
                )}

                {data.socialLinks.twitter && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    asChild
                  >
                    <a
                      href="https://x.com/whalestrace"
                      // href={data.socialLinks.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Twitter className="h-3 w-3" />
                      <span className="sr-only">Twitter</span>
                    </a>
                  </Button>
                )}

                {data.socialLinks.website && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    asChild
                  >
                    <a
                      href={data.socialLinks.website}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Globe className="h-3 w-3" />
                      <span className="sr-only">Website</span>
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <Badge
              variant="outline"
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium",
                isPriceUp
                  ? "text-green-500 border-green-500/20 bg-green-500/10"
                  : "text-red-500 border-red-500/20 bg-red-500/10"
              )}
            >
              {isPriceUp ? (
                <ArrowUpRight className="h-2 w-2" />
              ) : (
                <ArrowDownRight className="h-2 w-2" />
              )}
              <span>{data.priceChange}</span>
            </Badge>
          </div>
        </div>
      </CardContent>
      <CardFooter className="grid grid-cols-2 p-0 border-t border-gray-800 mt-1">
        <Button
          variant="ghost"
          className="rounded-none h-9 text-xs hover:bg-gray-800/50"
          asChild
        >
          <a
            href="https://t.me/BloomSolana_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2"
          >
            <span>Buy on Bloom</span>
            <Image
              src={bloomLogo}
              alt="bloomLogo"
              width={16}
              height={16}
              className="rounded-full"
            />
          </a>
        </Button>
        <Button
          variant="ghost"
          className="rounded-none h-9 text-xs border-l border-gray-800 hover:bg-gray-800/50"
          asChild
        >
          <a
            href="https://gmgn.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2"
          >
            <span>Buy on GmGn</span>
            <Image
              src={GMGNLogo}
              alt="GMGNLogo"
              width={40}
              height={40}
              className="rounded-full"
            />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
