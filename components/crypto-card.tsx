"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  X,
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
import type { CryptoCard as CryptoCardType } from "@/lib/api/types";
import { useTrackedData, useDebounce } from "@/lib/hooks/useForceUpdate";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useLastActivity } from '@/lib/hooks/useLastActivity';
import { useWebSocket } from "@/lib/context/WebSocketContext";
import { formatNumber, extractNumericValue, formatMarketCap } from "@/lib/utils";

// Расширенный тип для поддержки метаданных обновления
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

const ANIMATION_DURATION = 1000; // 1 секунда для анимации

// Функция для расчета коэффициента изменения цены
const calculatePriceRatio = (currentMarketCap: string, previousMarketCap?: string): number => {
  if (!previousMarketCap) return 1;
  
  // Извлекаем числовые значения из строк с форматированием
  const currentValue = extractNumericValue(currentMarketCap);
  const previousValue = extractNumericValue(previousMarketCap);
  
  if (isNaN(currentValue) || isNaN(previousValue) || previousValue === 0) {
    return 1;
  }
  
  // Рассчитываем отношение
  return currentValue / previousValue;
};

export function CryptoCard({ data, loading = false, animate = true }: CryptoCardProps) {
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [prevData, setPrevData] = useState<ExtendedCryptoCard | null>(null);
  const [animateFields, setAnimateFields] = useState<Record<string, boolean>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [marketCapClass, setMarketCapClass] = useState('');
  const [priceDirection, setPriceDirection] = useState<'increase' | 'decrease' | ''>('');
  
  // Для отслеживания изменений для анимации
  const lastMarketCapRef = useRef<string | undefined>(undefined);
  const renderCountRef = useRef(0);
  
  // Используем хук для отслеживания изменений данных с правильным типом
  const [trackedData, forceUpdateImmediate] = useTrackedData<ExtendedCryptoCard>(data || null);
  
  // Получаем статус соединения и данные из WebSocket контекста
  const wsContextData = useWebSocket();
  const isConnected = wsContextData.status === 'connected';
  
  // Находим данные из контекста, соответствующие карточке
  const wsCardData = useMemo(() => {
    if (!data?.id) return null;
    return wsContextData.cards.find(card => card.id === data.id);
  }, [wsContextData.cards, data?.id]);
  
  // Отслеживаем предыдущие значения для анимации
  useEffect(() => {
    if (trackedData && (!prevData || prevData.id !== trackedData.id)) {
      setPrevData({...trackedData});
    }
  }, [trackedData, prevData]);
  
  // Для хранения предыдущего значения marketCap
  const [prevMarketCap, setPrevMarketCap] = useState<string | undefined>(undefined);
  
  // Добавляем пустой useEffect для renderCountRef
  useEffect(() => {
    renderCountRef.current++;
  }, []);
  
  // Добавляем восстановленную функциональность эффекта обработки изменений marketCap
  // Отслеживаем изменения marketCap для вычисления соотношения
  useEffect(() => {
    if (wsCardData?.marketCap && wsCardData.marketCap !== trackedData?.marketCap) {
      // Проверяем изменение значения для анимации
      const prevValue = extractNumericValue(trackedData?.marketCap || '0');
      const currValue = extractNumericValue(wsCardData.marketCap);
      
      if (currValue > prevValue) {
        setPriceDirection('increase');
        setMarketCapClass('market-cap-increase market-cap-realtime');
      } else if (currValue < prevValue) {
        setPriceDirection('decrease');
        setMarketCapClass('market-cap-decrease market-cap-realtime');
      }
      
      // Сбрасываем класс анимации через некоторое время
      setTimeout(() => {
        setMarketCapClass('market-cap-realtime');
      }, 800);
      
      // Рассчитываем коэффициент изменения
      const ratio = calculatePriceRatio(wsCardData.marketCap, trackedData?.marketCap);
      const priceChangeText = `×${ratio.toFixed(2)}`;
      
      // Принудительно обновляем карточку
      forceUpdateImmediate();
    }
  }, [wsCardData?.marketCap, trackedData?.marketCap, forceUpdateImmediate]);
  
  // Удаляем отладочную информацию из эффекта обновлений в реальном времени
  useEffect(() => {
    if (data?._updateId && data._updateId.includes('update-marketcap') && lastMarketCapRef.current !== data.marketCap) {
      // Для обновлений Market Cap из интервала анимации
      const prevValue = extractNumericValue(lastMarketCapRef.current || '0');
      const currValue = extractNumericValue(data.marketCap || '0');
      
      if (currValue > prevValue) {
        setPriceDirection('increase');
        setMarketCapClass('market-cap-pulse market-cap-realtime');
      } else if (currValue < prevValue) {
        setPriceDirection('decrease');
        setMarketCapClass('market-cap-pulse market-cap-realtime');
      }
      
      lastMarketCapRef.current = data.marketCap;
    }
  }, [data?._updateId, data?.marketCap]);
  
  // Обновляем данные, если пришли новые с WebSocket
  useEffect(() => {
    if (wsCardData && trackedData) {
      const fieldsToAnimate: Record<string, boolean> = {};
      let hasChanges = false;
      
      if (wsCardData.marketCap !== trackedData.marketCap) {
        fieldsToAnimate.marketCap = true;
        fieldsToAnimate.priceChange = true; 
        hasChanges = true;
        
        setPrevMarketCap(trackedData.marketCap);
      }
      
      const checkField = (fieldName: keyof CryptoCardType, oldValue: any, newValue: any) => {
        if (oldValue !== newValue) {
          fieldsToAnimate[fieldName] = true;
          hasChanges = true;
        }
      };
      
      checkField('top10', trackedData.top10, wsCardData.top10);
      checkField('devWalletHold', trackedData.devWalletHold, wsCardData.devWalletHold);
      checkField('first70BuyersHold', trackedData.first70BuyersHold, wsCardData.first70BuyersHold);
      checkField('insiders', trackedData.insiders, wsCardData.insiders);
      checkField('tokenAge', trackedData.tokenAge, wsCardData.tokenAge);
      
      if (JSON.stringify(trackedData.whales) !== JSON.stringify(wsCardData.whales)) {
        fieldsToAnimate.whales = true;
        hasChanges = true;
      }

      if (hasChanges) {
        setIsUpdating(true);
        setPrevData({...trackedData}); 
        setAnimateFields(fieldsToAnimate);
        
        const updatedData = {...trackedData, ...wsCardData, _lastUpdated: Date.now()};
        wsContextData.updateCard(trackedData.id, updatedData);
        
        // Добавляем анимацию подсветки всей карточки
        setTimeout(() => {
          setAnimateFields({});
          setIsUpdating(false);
        }, 1500);
      }
    }
  }, [wsCardData, trackedData, forceUpdateImmediate]);
  
  const debouncedSetAnimate = useDebounce((fields: Record<string, boolean>) => {
    setAnimateFields(fields);
  }, 50);
  
  const forceUpdate = useDebounce(forceUpdateImmediate, 100);
  
  const lastUpdatedRef = useRef<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastActivity] = useLastActivity();
  
  const logUpdateRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!animate || !trackedData || !data || typeof data._lastUpdated === 'undefined') return;
    
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
    if (!trackedData?.priceChange) return { isUp: true, value: "1.0", ratioValue: 1 };
    
    // Извлекаем числовое значение из "×1.2"
    const value = trackedData.priceChange.replace('×', '');
    const numValue = parseFloat(value);
    const isUp = numValue >= 1.0;
    
    return {
      isUp,
      value,
      ratioValue: numValue
    };
  }, [trackedData?.priceChange]);
  
  const getUpdateStyle = (field: string) => {
    if (field === 'marketCap' && marketCapClass) {
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
    // Используем специальное форматирование для marketCap
    const formatted = field === 'marketCap' 
      ? formatMarketCap(currentValue)
      : formatNumber(currentValue, { isPercent });
    
    // Для marketCap добавляем более яркую и заметную анимацию
    if (field === 'marketCap') {
      const animClass = marketCapClass ? marketCapClass : 'market-cap-realtime';
      // Добавляем символ изменения
      const changeIcon = priceDirection === 'increase' 
        ? <span className="text-green-400 text-xs">↑</span> 
        : priceDirection === 'decrease' 
          ? <span className="text-red-400 text-xs">↓</span> 
          : null;
      
      return (
        <div className={`flex items-center justify-center gap-0.5 ${animClass}`}>
          {changeIcon}
          <span>{formatted}</span>
        </div>
      );
    }
    
    // Для остальных полей
    if (animateFields[field] && prevData) {
      const prevValueRaw = (prevData as any)[field] || '0';
      const currentValueRaw = currentValue || '0';
      
      const prevNum = parseFloat(prevValueRaw.replace(/[^0-9.-]/g, ''));
      const currentNum = parseFloat(currentValueRaw.replace(/[^0-9.-]/g, ''));
      
      if (!isNaN(prevNum) && !isNaN(currentNum)) {
        const isIncreasing = currentNum > prevNum;
        const animClass = isIncreasing ? 'value-increase' : 'value-decrease';
        
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
    if (!tokenAge || tokenAge === "N/A") {
      return <div>-</div>;
    }
    
    // Поддержка формата с буквой 'd' на конце (например, 10d)
    if (/^\d+d$/.test(tokenAge)) {
      return <div className={getUpdateStyle('tokenAge')}>{tokenAge}</div>;
    }
    
    // Поддержка формата чисел без буквы (например, 10)
    if (/^\d+$/.test(tokenAge)) {
      return <div className={getUpdateStyle('tokenAge')}>{tokenAge}d</div>;
    }
    
    // Поддержка формата 'Nh Mm' (часы и минуты)
    if (/^\d+h \d+m$/.test(tokenAge)) {
      return <div className={getUpdateStyle('tokenAge')}>{tokenAge}</div>;
    }
    
    // Поддержка формата 'Nd Nh' (дни и часы)
    if (/^\d+d \d+h$/.test(tokenAge)) {
      return <div className={getUpdateStyle('tokenAge')}>{tokenAge}</div>;
    }
    
    return <div className={getUpdateStyle('tokenAge')}>{tokenAge}</div>;
  };

  // Используем cardData вместо data для отображения
  const displayData = data;

  useEffect(() => {
    if (data?._updateId) {
      // Сохраняем предыдущие данные для сравнения
      setPrevData(prev => prev ? {...prev} : null);
      
      // Анализируем, какие поля изменились для анимации
      const fieldsToAnimate: Record<string, boolean> = {};
      
      if (prevData) {
        // Проверяем изменение marketCap
        if (data.marketCap !== prevData.marketCap) {
          fieldsToAnimate.marketCap = true;
          
          // Определяем направление изменения для анимации
          const prevValue = extractNumericValue(prevData.marketCap || '0');
          const currValue = extractNumericValue(data.marketCap || '0');
          
          if (currValue > prevValue) {
            setPriceDirection('increase');
            setMarketCapClass('market-cap-increase');
          } else if (currValue < prevValue) {
            setPriceDirection('decrease');
            setMarketCapClass('market-cap-decrease');
          }
          
          // Сбрасываем класс анимации через некоторое время
          setTimeout(() => {
            setMarketCapClass('');
          }, 800);
        }
        
        // Проверяем другие поля
        if (data.top10 !== prevData.top10) fieldsToAnimate.top10 = true;
        if (data.devWalletHold !== prevData.devWalletHold) fieldsToAnimate.devWalletHold = true;
        if (data.first70BuyersHold !== prevData.first70BuyersHold) fieldsToAnimate.first70BuyersHold = true;
        if (data.insiders !== prevData.insiders) fieldsToAnimate.insiders = true;
      }
      
      // Устанавливаем анимации для измененных полей
      if (Object.keys(fieldsToAnimate).length > 0) {
        setAnimateFields(fieldsToAnimate);
        
        // Сбрасываем анимацию через определенное время
        setTimeout(() => {
          setAnimateFields({});
        }, 1500);
      }
    }
  }, [data?._updateId, data]);

  const renderPriceChangeBadge = () => {
    const { isUp, value, ratioValue } = getPriceChangeInfo;
    
    const colorClasses = isUp
      ? "text-green-500 border-green-500/20 bg-green-500/10"
      : "text-red-500 border-red-500/20 bg-red-500/10";
    
    const intensityClass = Math.abs(ratioValue - 1) > 0.2 
      ? (isUp ? "border-green-500/40 bg-green-500/20" : "border-red-500/40 bg-red-500/20")
      : "";
    
    return (
      <Badge
        variant="outline"
        className={cn(
          `flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium`,
          colorClasses,
          intensityClass,
          getUpdateStyle('priceChange')
        )}
      >
        {isUp ? (
          <ArrowUpRight className="h-2 w-2" />
        ) : (
          <ArrowDownRight className="h-2 w-2" />
        )}
        <span>×{value}</span>
      </Badge>
    );
  };

  if (loading || !displayData) {
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

  return (
    <Card 
      className={`block overflow-hidden border-gray-800 ${isUpdating ? 'card-updating' : ''}`}
    >
      <CardContent style={{ padding: "0.1rem .1rem 0" }}>
        <div className="p-4">
          {/* Header */}
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
                <p className="text-base font-semibold truncate max-w-[180px]">
                  {displayData?.symbol}
                  {isConnected && (
                    <span className="ml-2 mb-0.5 inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                  )}
                </p>
                <h3 className="text-xs text-muted-foreground">{displayData?.name?.length > 10 ? displayData?.name?.slice(0, 10) + '...' : displayData?.name}</h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-muted-foreground" style={{ fontSize: "0.55rem" }}>
                {displayData?.id ? `${displayData.id.slice(0,4)}..${displayData.id.slice(-6)}` : ''}
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
          </div>

          {/* Overview - в виде таблицы */}
          <div style={{ marginTop: ".6rem" }}>
            
            <div className="grid grid-cols-3 gap-x-2 gap-y-2 text-xs">
              <div className={`flex flex-col items-center p-2 rounded-lg border border-green-800/40 bg-gray-900/30 backdrop-blur-sm ${
                animateFields.marketCapBlock ? 'market-cap-highlight' : ''
              }`}>
                <div className="text-center font-medium mb-1">
                  {renderValueChange(displayData?.marketCap || '', 'marketCap')}
                </div>
                <div className="flex items-center text-gray-400 text-[10px]">
                  <span className="mr-1 text-amber-500">💎</span>
                  <span>Market Cap</span>
                </div>
              </div>

              <div className="flex flex-col items-center p-2 rounded-lg border border-green-800/40 bg-gray-900/30 backdrop-blur-sm">
                <div className="text-center font-medium mb-1">
                  {renderTokenAge(displayData?.tokenAge)}
                </div>
                <div className="flex items-center text-gray-400 text-[10px]">
                  <span className="mr-1 text-amber-500">⏳</span>
                  <span>Token Age</span>
                </div>
              </div>

              <div className="flex flex-col items-center p-2 rounded-lg border border-green-800/40 bg-gray-900/30 backdrop-blur-sm">
                <div className="text-center font-medium mb-1">
                  {renderValueChange(displayData?.top10 || '', 'top10', true)}
                </div>
                <div className="flex items-center text-gray-400 text-[10px]">
                  <span className="mr-1 text-amber-500">💡</span>
                  <span>Top10</span>
                </div>
              </div>

              <div className="flex flex-col items-center p-2 rounded-lg border border-green-800/40 bg-gray-900/30 backdrop-blur-sm">
                <div className="text-center font-medium mb-1">
                  {renderValueChange(displayData?.devWalletHold || '', 'devWalletHold', true)}
                </div>
                <div className="flex items-center text-gray-400 text-[10px]">
                  <span className="mr-1 text-amber-500">🧮</span>
                  <span>Dev Wallet</span>
                </div>
              </div>

              <div className="flex flex-col items-center p-2 rounded-lg border border-green-800/40 bg-gray-900/30 backdrop-blur-sm">
                <div className="text-center font-medium mb-1">
                  {renderValueChange(displayData?.first70BuyersHold || '', 'first70BuyersHold', true)}
                </div>
                <div className="flex items-center text-gray-400 text-[10px]">
                  <span className="mr-1 text-amber-500">🧠</span>
                  <span>First 70</span>
                </div>
              </div>

              <div className="flex flex-col items-center p-2 rounded-lg border border-green-800/40 bg-gray-900/30 backdrop-blur-sm">
                <div className="text-center font-medium mb-1">
                  {renderValueChange(displayData?.insiders || '', 'insiders', true)}
                </div>
                <div className="flex items-center text-gray-400 text-[10px]">
                  <span className="mr-1 text-amber-500">🐀</span>
                  <span>Insiders</span>
                </div>
              </div>
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
                    View trades
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent
                  side="top"
                  align="start"
                  className="w-auto p-3 bg-gray-900 border-gray-800 text-gray-200"
                >
                  <div className="space-y-1">
                    {/* <h4 className="text-xs font-semibold">💰 Последние покупки:</h4> */}
                    {displayData?.whales && (() => {
                      // Группировка и суммирование трейдов по кошельку
                      const walletSums: {[key: string]: number} = {};
                      
                      displayData.whales.forEach(whale => {
                        // Извлекаем адрес из строки суммы (предполагается формат "количество SOL")
                        const amountStr = whale.amount.split(' ')[0];
                        const amount = parseFloat(amountStr);
                        
                        // Используем адрес кошелька
                        const wallet = typeof whale.count === 'string' ? whale.count : whale.count.toString();
                        
                        // Суммируем транзакции одного кошелька
                        if (walletSums[wallet]) {
                          walletSums[wallet] += amount;
                        } else {
                          walletSums[wallet] = amount;
                        }
                      });
                      
                      // Преобразуем суммы обратно в массив для отображения
                      return Object.entries(walletSums).map(([wallet, sum], index) => {
                        // Форматируем адрес кошелька (первые 4 + .. + последние 4)
                        const formattedWallet = wallet.length > 8 
                          ? `${wallet.substring(0, 4)}..${wallet.substring(wallet.length - 4)}`
                          : wallet;
                        
                        return (
                          <p key={index} className="text-xs whitespace-nowrap">
                            <span className="text-amber-400">➤</span> {formattedWallet}: {sum.toFixed(2)} SOL
                          </p>
                        );
                      });
                    })()}
                  </div>
                </HoverCardContent>
              </HoverCard>

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
                      href="https://x.com/whalestrace"
                      // href={displayData.socialLinks.twitter}
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
