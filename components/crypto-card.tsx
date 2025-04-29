"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import {
  Copy,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  MessageCircle,
  Check,
  BarChart3,
  X,
} from "lucide-react";
import GMGNLogo from "@/public/gmgnLogo.png";
import bloomLogo from "@/public/bloomLogo.jpg";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CryptoCard as CryptoCardType } from "@/lib/api/types";
import { useTrackedData } from "@/lib/hooks/useForceUpdate";

import { useWebSocket } from "@/lib/context/WebSocketContext";
import {
  formatNumber,
  extractNumericValue,
  parseTokenAge as parseAgeUtil,
} from "@/lib/utils";

import InsidersIcon from "@/public/insiders-icon.svg";
import MarketCapIcon from "@/public/marketcap-icon.svg";
import TokenAgeIcon from "@/public/tokenage-icon.svg";
import First70Icon from "@/public/first70-icon.svg";
import DevWalletIcon from "@/public/devwallet-icon.svg";
import Top10Icon from "@/public/top10-icon.svg";
import { motion } from "framer-motion";
import { AnimatedHoverCard } from "./ui/animated-hover-card";
interface ExtendedCryptoCard extends CryptoCardType {
  _receivedAt?: number;
  _lastUpdated?: number;
  _updateId?: string;
}

interface CryptoCardProps {
  data?: ExtendedCryptoCard;
  loading?: boolean;
  animate?: boolean;
}

const ANIMATION_DURATION = 1000; 

const convertMarketCapToValue = (marketCap: string): number => {
  if (!marketCap || marketCap === 'N/A') return 0;
  
  const cleanStr = marketCap.trim();
  const numStr = cleanStr.replace(/[^\d.KMBkmb]/g, '');
  
  const value = parseFloat(numStr);
  const suffix = cleanStr.slice(-1).toUpperCase();

  if (isNaN(value)) return 0;

  const multipliers: { [key: string]: number } = {
    'K': 1_000,
    'M': 1_000_000,
    'B': 1_000_000_000
  };

  return value * (multipliers[suffix] || 1);
};

export function CryptoCard({
  data,
  loading = false,
  animate = true,
}: CryptoCardProps) {
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [prevData, setPrevData] = useState<ExtendedCryptoCard | null>(null);
  const [animateFields, setAnimateFields] = useState<Record<string, boolean>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [marketCapClass, setMarketCapClass] = useState("");
  const [priceDirection, setPriceDirection] = useState<"increase" | "decrease" | "" >("");
  const [showTooltip, setShowTooltip] = useState(false);

  const lastMarketCapRef = useRef<string | undefined>(undefined);
  const renderCountRef = useRef(0);

  const [trackedData, forceUpdateImmediate] =
    useTrackedData<ExtendedCryptoCard>(data || null);

  const wsContextData = useWebSocket();
  const isConnected = wsContextData.status === "connected";

 
  const wsCardData = wsContextData.cards.find((card) => card.id === data?.id);
  
  const displayData = wsCardData ?? data;

  const twitterRaw = displayData?.socialLinks.twitter ?? '';
  const twitterHref = twitterRaw
    ? twitterRaw.startsWith('http')
      ? twitterRaw
      : `https://x.com/${twitterRaw}`
    : '';

  useEffect(() => {
    if (trackedData && (!prevData || prevData.id !== trackedData.id)) {
      setPrevData({ ...trackedData });
    }
  }, [trackedData, prevData]);

  useEffect(() => {
    renderCountRef.current++;
  }, []);

  useEffect(() => {
    if (
      wsCardData?.marketCap &&
      wsCardData.marketCap !== trackedData?.marketCap
    ) {
      const prevValue = extractNumericValue(trackedData?.marketCap || "0");
      const currValue = extractNumericValue(wsCardData.marketCap);

      if (currValue > prevValue) {
        setPriceDirection("increase");
        setMarketCapClass("market-cap-increase market-cap-realtime");
      } else if (currValue < prevValue) {
        setPriceDirection("decrease");
        setMarketCapClass("market-cap-decrease market-cap-realtime");
      }

      setTimeout(() => {
        setMarketCapClass("market-cap-realtime");
      }, 800);

      forceUpdateImmediate();
    }
  }, [wsCardData?.marketCap, trackedData?.marketCap, forceUpdateImmediate]);

  useEffect(() => {
    if (
      data?._updateId &&
      data._updateId.includes("update-marketcap") &&
      lastMarketCapRef.current !== data.marketCap
    ) {
      const prevValue = extractNumericValue(lastMarketCapRef.current || "0");
      const currValue = extractNumericValue(data.marketCap || "0");

      if (currValue > prevValue) {
        setPriceDirection("increase");
        setMarketCapClass("market-cap-pulse market-cap-realtime");
      } else if (currValue < prevValue) {
        setPriceDirection("decrease");
        setMarketCapClass("market-cap-pulse market-cap-realtime");
      }

      lastMarketCapRef.current = data.marketCap;
    }
  }, [data?._updateId, data?.marketCap]);

  useEffect(() => {
    if (!wsCardData || !trackedData) return;

    const fieldsToAnimate: Record<string, boolean> = {};
    let hasChanges = false;

    const checkField = (
      fieldName: keyof CryptoCardType,
      oldValue: unknown,
      newValue: unknown
    ) => {
      if (oldValue !== newValue) {
        fieldsToAnimate[fieldName] = true;
        hasChanges = true;
      }
    };

    checkField("marketCap", trackedData.marketCap, wsCardData.marketCap);
    checkField("priceChange", trackedData.priceChange, wsCardData.priceChange);
    checkField("top10", trackedData.top10, wsCardData.top10);
    checkField(
      "devWalletHold",
      trackedData.devWalletHold,
      wsCardData.devWalletHold
    );
    checkField(
      "first70BuyersHold",
      trackedData.first70BuyersHold,
      wsCardData.first70BuyersHold
    );
    checkField("insiders", trackedData.insiders, wsCardData.insiders);
    checkField("tokenAge", trackedData.tokenAge, wsCardData.tokenAge);

    if (
      JSON.stringify(trackedData.whales) !== JSON.stringify(wsCardData.whales)
    ) {
      fieldsToAnimate.whales = true;
      hasChanges = true;
    }

    if (hasChanges) {
      setIsUpdating(true);
      setAnimateFields(fieldsToAnimate);

      setTimeout(() => {
        setAnimateFields({});
        setIsUpdating(false);
      }, 1500);
    }
  }, [wsCardData, trackedData]);



  const lastUpdatedRef = useRef<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);


  useEffect(() => {
    if (
      !animate ||
      !trackedData ||
      !data ||
      typeof data._lastUpdated === "undefined"
    )
      return;

    if (lastUpdatedRef.current === data._lastUpdated || isAnimating) return;

    setIsAnimating(true);

    const timer = setTimeout(() => {
      setIsAnimating(false);
    }, ANIMATION_DURATION);

    return () => clearTimeout(timer);
  }, [animate, data, trackedData, isAnimating]);

  const copyToClipboard = () => {
    if (data?.id) {
      navigator.clipboard.writeText(data.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const getPriceChangeInfo = useMemo(() => {
    if (!data?.marketCap || !prevData?.marketCap) {
      return { isUp: true, multiplier: 1, diff: 0 };
    }

    const currentValue = convertMarketCapToValue(data.marketCap);
    const previousValue = convertMarketCapToValue(prevData.marketCap);

    if (currentValue === 0 || previousValue === 0) {
      return { isUp: true, multiplier: 1, diff: 0 };
    }

    const changeRatio = currentValue / previousValue;
    const isUp = changeRatio >= 1;
    const multiplier = changeRatio
    const diff = Math.abs(1 - changeRatio);

    return { isUp, multiplier, diff };
  }, [data?.marketCap, prevData?.marketCap]);

  const getUpdateStyle = (field: string) => {
    if (field === "marketCap" && marketCapClass) {
      return marketCapClass;
    }

    if (animateFields[field]) {
      return "bg-gradient-to-r from-emerald-600/10 via-emerald-600/30 to-emerald-600/10 bg-[length:200%_100%] animate-gradient rounded-md px-1";
    }

    return "";
  };

  const renderValueChange = (
    currentValue: string,
    field: string,
    isPercent = false
  ) => {
    const formatted =
      field === "marketCap"
        ? currentValue
        : formatNumber(currentValue, { isPercent });

    if (field === "marketCap") {
      const animClass = marketCapClass ? marketCapClass : "market-cap-realtime";
      const changeIcon =
        priceDirection === "increase" ? (
          <span className="text-green-400 text-xs">↑</span>
        ) : priceDirection === "decrease" ? (
          <span className="text-red-400 text-xs">↓</span>
        ) : null;

      return (
        <div
          className={`flex items-center justify-center gap-0.5 ${animClass}`}
        >
          {changeIcon}
          <span>{formatted}</span>
        </div>
      );
    }

    if (animateFields[field] && prevData) {
      const getFieldValue = (
        obj: Partial<CryptoCardType>,
        field: keyof CryptoCardType
      ): string => {
        return (obj[field] as string) ?? "0";
      };

      const prevValueRaw = getFieldValue(
        prevData ?? {},
        field as keyof CryptoCardType
      );

      const currentValueRaw = currentValue || "0";

      const prevNum = parseFloat(prevValueRaw.replace(/[^0-9.-]/g, ""));
      const currentNum = parseFloat(currentValueRaw.replace(/[^0-9.-]/g, ""));

      if (!isNaN(prevNum) && !isNaN(currentNum)) {
        const isIncreasing = currentNum > prevNum;
        const animClass = isIncreasing ? "value-increase" : "value-decrease";

        return (
          <div className={`flex items-center ${animClass}`}>
            <span className={isIncreasing ? "text-green-400" : "text-red-400"}>
              {isIncreasing ? "↑" : "↓"}
            </span>
            <span>{formatted}</span>
          </div>
        );
      }
    }

    return <div className={getUpdateStyle(field)}>{formatted}</div>;
  };

  const renderTokenAge = (tokenAge?: string) => {
    if (!tokenAge || tokenAge === "N/A") return <div>-</div>;

    const totalSec = parseAgeUtil(tokenAge);
    if (totalSec <= 0) return <div>-</div>;

    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    let disp = "";
    if (days > 0) {
      disp = `${days}d ${hours}h`;
    } else if (hours > 0) {
      disp = `${hours}h ${minutes}m`;
    } else {
      disp = `${minutes}m ${seconds}s`;
    }

    const colorClass = totalSec < 86400 ? "text-green-500" : "text-red-500";
    return (
      <div className={`${colorClass} ${getUpdateStyle("tokenAge")}`}>{disp}</div>
    );
  };


  useEffect(() => {
    if (data?._updateId) {
      setPrevData((prev) => (prev ? { ...prev } : null));

      const fieldsToAnimate: Record<string, boolean> = {};

      if (prevData) {
        if (data.marketCap !== prevData.marketCap) {
          fieldsToAnimate.marketCap = true;

          const prevValue = extractNumericValue(prevData.marketCap || "0");
          const currValue = extractNumericValue(data.marketCap || "0");

          if (currValue > prevValue) {
            setPriceDirection("increase");
            setMarketCapClass("market-cap-increase");
          } else if (currValue < prevValue) {
            setPriceDirection("decrease");
            setMarketCapClass("market-cap-decrease");
          }

          setTimeout(() => {
            setMarketCapClass("");
          }, 800);
        }

        if (data.top10 !== prevData.top10) fieldsToAnimate.top10 = true;
        if (data.devWalletHold !== prevData.devWalletHold)
          fieldsToAnimate.devWalletHold = true;
        if (data.first70BuyersHold !== prevData.first70BuyersHold)
          fieldsToAnimate.first70BuyersHold = true;
        if (data.insiders !== prevData.insiders)
          fieldsToAnimate.insiders = true;
      }

      if (Object.keys(fieldsToAnimate).length > 0) {
        setAnimateFields(fieldsToAnimate);

        setTimeout(() => {
          setAnimateFields({});
        }, 1500);
      }
    }
  }, [data?._updateId, data]);

  const renderPriceChangeBadge = () => {
    const { isUp, multiplier, diff } = getPriceChangeInfo;
    let intensityClass = "";

    if (diff > 0.4) {
      intensityClass = isUp
        ? "border-green-500/70 bg-green-500/30"
        : "border-red-500/70 bg-red-500/30";
    } else if (diff > 0.2) {
      intensityClass = isUp
        ? "border-green-500/40 bg-green-500/20"
        : "border-red-500/40 bg-red-500/20";
    }

    const colorClasses = isUp
      ? "text-green-500 border-green-500/20 bg-green-500/10"
      : "text-red-500 border-red-500/20 bg-red-500/10";

    return (
      <Badge
        variant="outline"
        className={cn(
          `flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium transition-colors duration-300 ease-in-out`,
          colorClasses,
          intensityClass,
          getUpdateStyle("priceChange")
        )}
      >
        {isUp ? (
          <ArrowUpRight className="h-2 w-2" />
        ) : (
          <ArrowDownRight className="h-2 w-2" />
        )}
        <span>×{multiplier.toFixed(2)}</span>
      </Badge>
    );
  };

  if (loading || !displayData) {
    return (
      <Card className="overflow-hidden border-gray-800">
        <CardContent className="p-0">
          <div className="p-4 space-y-3">
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

  return (
    <Card
      className={`block overflow-hidden border-gray-800 ${
        isUpdating ? "card-updating" : ""
      }`}
    >
      <CardContent style={{ padding: "0.1rem .1rem 0" }}>
        <div className="p-4">
          <div
            className="flex items-center"
            style={{ justifyContent: "space-between", marginBottom: "1rem" }}
          >
            <div className="flex items-center gap-2">
            
              <div className="h-12 w-12 rounded-md overflow-hidden bg-gray-800 flex items-center justify-center">
                {imageError || !displayData?.image ? (
                  <div className="text-xl font-bold text-gray-400">
                    {displayData?.symbol && displayData.symbol.charAt(0)}
                  </div>
                ) : (
                  <img
                    src={displayData.image}
                    alt={displayData.name}
                    width={48}
                    height={48}
                    className="object-cover w-full h-full"
                    onError={handleImageError}
                  />
                )}
               
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="uppercase font-semibold text-base truncate max-w-[180px]">
                    {displayData?.symbol}
                  </span>
                  {isConnected &&  (
                    <>
                    <motion.span
                    className="h-2 w-2 rounded-full bg-green-500 mr-1"
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  />
                    <div>
                      {data?.tokenAge && data?.tokenAge < "1" && ( 
                    <motion.div
                      className="flex items-center z-10 mt-1/2"
                      
                    >
                      
                      <motion.span
                        className="text-green-500 shadow-md text-[10px] font-kindergarten"
                        animate={{ opacity: [1, 0.2, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                      >
                        NEW!
                      </motion.span>
                    </motion.div>
                  
                  )}
                    </div></>
                    
                   
                  )}
                </div>

                <h3 className="text-xs text-muted-foreground">
                  {displayData?.name?.length > 10
                    ? displayData?.name?.slice(0, 10) + "..."
                    : displayData?.name}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                className="text-muted-foreground"
                style={{ fontSize: "0.55rem" }}
              >
                {displayData?.id
                  ? `${displayData.id.slice(0, 4)}..${displayData.id.slice(-6)}`
                  : ""}
              </div>

              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyToClipboard}
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  className="relative h-7 w-7 group"
                >
                  <div className="relative w-3 h-3">
                    <Copy className={cn(
                      "absolute -top-[1px] -left-[1px] w-3 h-3 transition-all duration-300",
                      copied ? "opacity-0 transform scale-90" : "opacity-100 scale-100"
                    )} />
                    <Check className={cn(
                      "absolute -top-[1px] -left-[1px] w-3 h-3 text-green-500 transition-all duration-300",
                      copied ? "opacity-100 scale-100" : "opacity-0 transform scale-90"
                    )} />
                  </div>
                </Button>
                {showTooltip && (
                  <div 
                    className={cn(
                      "absolute -top-7 left-1/3 transform -translate-x-1/2 px-2 py-1 text-xs rounded-md whitespace-nowrap z-50 transition-all duration-300",
                      "bg-popover border border-border shadow-md",
                      copied ? "bg-green-900/90 border-green-700" : "bg-gray-900/90 border-gray-700"
                    )}
                  >
                    <div className="relative">
                      <p className="text-white">{copied ? "Copied!" : "Copy"}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: ".6rem" }}>
            <div className="grid grid-cols-3 gap-x-2 gap-y-2 text-xs">
              <div
                className={`flex flex-col items-center p-2 rounded-lg border border-green-800/40 bg-gray-900/30 backdrop-blur-sm ${
                  animateFields.marketCapBlock ? "market-cap-highlight" : ""
                }`}
              >
                <div className="flex items-center text-center font-medium mb-1">
                  <Image src={MarketCapIcon} alt="Market Cap" width={12} height={12} className="mr-1" />
                  {renderValueChange(displayData?.marketCap || "", "marketCap")}
                </div>
                <div className="flex items-center text-gray-400 text-[10px]">
                  <span>Market Cap</span>
                </div>
              </div>

              <div className="flex flex-col items-center p-2 rounded-lg border border-green-800/40 bg-gray-900/30 backdrop-blur-sm">
                <div className="flex items-center text-center font-medium mb-1">
                  <Image src={TokenAgeIcon} alt="Token Age" width={11} height={11} className="mr-1" />
                  {renderTokenAge(displayData?.tokenAge)}
                </div>
                <div className="flex items-center text-gray-400 text-[10px]">
                  <span>Token Age</span>
                </div>
              </div>

              <div className="flex flex-col items-center p-2 rounded-lg border border-green-800/40 bg-gray-900/30 backdrop-blur-sm">
                <div className="text-center font-medium mb-1">
                  <div className="flex items-center">
                    <Image src={Top10Icon} alt="Top10" width={12} height={12} className="mr-1" />
                    {renderValueChange(displayData?.top10 || "", "top10", true)}
                  </div>
                </div>
                <div className="flex items-center text-gray-400 text-[10px]">
                  <span>Top10</span>
                </div>
              </div>

              <div className="flex flex-col items-center p-2 rounded-lg border border-green-800/40 bg-gray-900/30 backdrop-blur-sm">
                <div className="text-center font-medium mb-1">
                  <div className="flex items-center">
                    <Image src={DevWalletIcon} alt="Dev Wallet" width={12} height={12} className="mr-1" />
                    {renderValueChange(
                      displayData?.devWalletHold || "",
                      "devWalletHold",
                      true
                    )}
                  </div>
                </div>
                <div className="flex items-center text-gray-400 text-[10px]">
                  <span>Dev Wallet</span>
                </div>
              </div>

              <div className="flex flex-col items-center p-2 rounded-lg border border-green-800/40 bg-gray-900/30 backdrop-blur-sm">
                <div className="text-center font-medium mb-1">
                  <div className="flex items-center">
                    <Image src={First70Icon} alt="First 70" width={12} height={12} className="mr-1" />
                    {renderValueChange(
                      displayData?.first70BuyersHold || "",
                      "first70BuyersHold",
                      true
                    )}
                  </div>
                </div>
                <div className="flex items-center text-gray-400 text-[10px]">
                  <span>First 70</span>
                </div>
              </div>

              <div className="flex flex-col items-center p-2 rounded-lg border border-green-800/40 bg-gray-900/30 backdrop-blur-sm">
                <div className="flex  text-center font-medium mb-1">
                <Image src={InsidersIcon} alt="Insiders" width={14} height={14} className="mr-1" />
                  {renderValueChange(
                    displayData?.insiders || "",
                    "insiders",
                    true
                  )}
                </div>
                <div className="flex items-center text-gray-400 text-[10px]">
                  
                  <span>Insiders</span>
                </div>
              </div>
            </div>
          </div>

          <div
            className="flex items-center justify-between"
            style={{ marginTop: "1.6rem" }}
          >
            <div className="flex items-center gap-3">
              <AnimatedHoverCard
                trigger={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2 flex items-center gap-1 hover:bg-secondary"
                  >
                    <BarChart3 className="h-3 w-3" />
                    View trades
                  </Button>
                }
                className="w-auto p-2 bg-gradient-to-br from-[#1A1A1A] to-[#141414] border border-gray-700 rounded-md text-gray-200"
              >
                <motion.div 
                  className="space-y-0.5"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.05
                      }
                    }
                  }}
                >
                  {displayData?.whales &&
                    (() => {
                      const walletSums: { [key: string]: number } = {};

                      displayData.whales.forEach(
                        (whale: { count: string; amount: string }) => {
                          const amountStr = whale.amount.split(" ")[0];
                          const amount = parseFloat(amountStr);
                          const wallet = whale.count;
                          walletSums[wallet] = (walletSums[wallet] || 0) + amount;
                        }
                      );

                      return Object.entries(walletSums).map(
                        ([wallet, sum], index) => {
                          const formattedWallet =
                            wallet.length > 8
                              ? `${wallet.slice(0, 4)}..${wallet.slice(-4)}`
                              : wallet;

                          return (
                            <motion.div
                              key={index}
                              variants={{
                                hidden: { opacity: 0, x: -20 },
                                visible: { opacity: 1, x: 0 }
                              }}
                              className="text-xs whitespace-nowrap font-mono tracking-tight transition-colors duration-200 hover:bg-gray-800/50 hover:rounded-sm group"
                            >
                              <div className="flex items-center">
                                <motion.svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="10"
                                  height="10"
                                  fill="#6B7280"
                                  className="bi bi-chevron-right transition-colors duration-200 group-hover:fill-purple-400"
                                  viewBox="0 0 16 16"
                                  whileHover={{ scale: 1.2 }}
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"
                                  />
                                </motion.svg>
                                <motion.span 
                                  className="ml-1 text-gray-300"
                                  whileHover={{ x: 5 }}
                                  transition={{ type: "spring", stiffness: 300 }}
                                >
                                  {formattedWallet}:{" "}
                                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-purple-400">
                                    {sum.toFixed(2)}
                                  </span>{" "}
                                  SOL
                                </motion.span>
                              </div>
                            </motion.div>
                          );
                        }
                      );
                    })()}
                </motion.div>
              </AnimatedHoverCard>

              <div className="flex gap-1">
                {displayData?.socialLinks.telegram && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    asChild
                  >
                    <a
                      href={displayData.socialLinks.telegram}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="h-3 w-3" />
                      <span className="sr-only">Telegram</span>
                    </a>
                  </Button>
                )}

                {displayData?.socialLinks.twitter && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    asChild
                  >
                    <a
                      href={twitterHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Twitter</span>
                    </a>
                  </Button>
                )}

                {displayData?.socialLinks.website && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    asChild
                  >
                    <a
                      href={displayData.socialLinks.website}
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

            {renderPriceChangeBadge()}
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
            href={`https://t.me/BloomSolana_bot?start=ref_QYZ0RZC4KV_ca_${displayData?.id}`}
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
            href={`https://gmgn.ai/sol/token/${displayData?.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2"
          >
            <span>Open In</span>
            <Image
              src={GMGNLogo}
              alt="GMGNLogo"
              className="rounded-full w-10 h-3"
            />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}

