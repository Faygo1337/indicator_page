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
import { formatNumber, extractNumericValue } from "@/lib/utils";

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
  
  // Используем хук для отслеживания изменений данных с правильным типом
  const [trackedData, forceUpdateImmediate] = useTrackedData<ExtendedCryptoCard>(data || null);
  
  // Получаем статус соединения и данные из WebSocket контекста
  const { status, cards, updateCard } = useWebSocket();
  const isConnected = status === 'connected';
  
  // Находим данные из WebSocket, соответствующие данной карточке
  const wsData = useMemo(() => {
    if (!data?.id || !cards || !cards.length) return null;
    return cards.find(card => card.id === data.id);
  }, [cards, data?.id]);
  
  // Отслеживаем предыдущие значения для анимации
  useEffect(() => {
    if (trackedData && (!prevData || prevData.id !== trackedData.id)) {
      setPrevData({...trackedData});
    }
  }, [trackedData, prevData]);
  
  // Для хранения предыдущего значения marketCap
  const [prevMarketCap, setPrevMarketCap] = useState<string | undefined>(undefined);
  
  // Отслеживаем изменения marketCap для вычисления соотношения
  useEffect(() => {
    if (trackedData?.marketCap && trackedData.marketCap !== prevMarketCap) {
      if (prevMarketCap) {
        // Рассчитываем коэффициент изменения
        const ratio = calculatePriceRatio(trackedData.marketCap, prevMarketCap);
        
        // Обновляем значение priceChange в формате ×N.N
        const priceChangeText = `×${ratio.toFixed(1)}`;
        
        // Обновляем поле через WebSocket API, если оно отличается
        if (trackedData.priceChange !== priceChangeText && updateCard) {
          updateCard(trackedData.id, { 
            priceChange: priceChangeText
          });
        }
      }
      
      // Сохраняем текущее значение для следующего сравнения
      setPrevMarketCap(trackedData.marketCap);
    }
  }, [trackedData?.marketCap, prevMarketCap, trackedData?.id, trackedData?.priceChange, updateCard]);
  
  // Обновляем данные, если пришли новые с WebSocket
  useEffect(() => {
    if (wsData && trackedData) {
      // Создаем объект для отслеживания изменившихся полей
      const fieldsToAnimate: Record<string, boolean> = {};
      let hasChanges = false;
      
      // Проверка изменений marketCap, нужно сохранить старое значение
      // для правильного расчета отношения цен
      if (wsData.marketCap !== trackedData.marketCap) {
        fieldsToAnimate.marketCap = true;
        fieldsToAnimate.priceChange = true; // Также будем анимировать priceChange
        hasChanges = true;
        
        // Сохраняем предыдущее значение для расчета отношения
        setPrevMarketCap(trackedData.marketCap);
      }
      
      // Проверка изменений в основных полях с более чувствительным порогом
      const checkField = (fieldName: keyof CryptoCardType, oldValue: any, newValue: any) => {
        if (oldValue !== newValue) {
          fieldsToAnimate[fieldName] = true;
          hasChanges = true;
          console.log(`[Card] Изменение ${String(fieldName)}: ${oldValue} -> ${newValue}`);
        }
      };
      
      // Проверяем все важные поля
      checkField('top10', trackedData.top10, wsData.top10);
      checkField('devWalletHold', trackedData.devWalletHold, wsData.devWalletHold);
      checkField('first70BuyersHold', trackedData.first70BuyersHold, wsData.first70BuyersHold);
      checkField('insiders', trackedData.insiders, wsData.insiders);

      // Если есть изменения, обновляем состояние и проигрываем анимацию
      if (hasChanges) {
        setIsUpdating(true);
        setPrevData({...trackedData}); // Сохраняем предыдущие значения
        setAnimateFields(fieldsToAnimate);
        
        // Обновляем с новыми данными немедленно
        const updatedData = {...trackedData, ...wsData, _lastUpdated: Date.now()};
        forceUpdateImmediate();
        
        // Удаляем анимацию через короткое время
        setTimeout(() => {
          setAnimateFields({});
          setIsUpdating(false);
        }, 1500);
      }
    }
  }, [wsData, trackedData, forceUpdateImmediate]);
  
  // Создаем дебаунсированную версию setAnimateFields
  const debouncedSetAnimate = useDebounce((fields: Record<string, boolean>) => {
    console.log('Применение анимации с задержкой:', Object.keys(fields));
    setAnimateFields(fields);
  }, 50);
  
  // Дебаунсированная версия forceUpdate
  const forceUpdate = useDebounce(forceUpdateImmediate, 100);
  
  // Изменяем тип для lastUpdatedRef с string на number
  const lastUpdatedRef = useRef<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastActivity] = useLastActivity();
  
  // Логирование обновлений с дебаунсингом
  const logUpdateRef = useRef<NodeJS.Timeout | null>(null);

  // Управление анимацией
  useEffect(() => {
    // Проверка на существование data и data._lastUpdated
    if (!animate || !trackedData || !data || typeof data._lastUpdated === 'undefined') return;
    
    // Проверяем, действительно ли произошло обновление
    if (lastUpdatedRef.current === data._lastUpdated || isAnimating) return;
    
    setIsAnimating(true);
    
    const timer = setTimeout(() => {
      setIsAnimating(false);
    }, ANIMATION_DURATION);
    
    return () => clearTimeout(timer);
  }, [animate, data, trackedData, isAnimating]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(data?.id || "0xMockSmartContractAddress");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  // Расширенная версия функции определения направления изменения цены
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
  
  // Стиль для анимации обновления
  const getUpdateStyle = (field: string) => {
    if (animateFields[field]) {
      return "bg-gradient-to-r from-emerald-600/10 via-emerald-600/30 to-emerald-600/10 bg-[length:200%_100%] animate-gradient rounded-md px-1";
    }
    return "";
  };

  // Код для отображения изменения значения с индикатором направления
  const renderValueChange = (
    currentValue: string, 
    field: string, 
    isPercent = false
  ) => {
    const formatted = formatNumber(currentValue, { isPercent });
    
    // Если поле анимируется, добавляем стрелки
    if (animateFields[field] && prevData) {
      const prevValueRaw = (prevData as any)[field] || '0';
      const currentValueRaw = currentValue || '0';
      
      const prevNum = parseFloat(prevValueRaw.replace(/[^0-9.-]/g, ''));
      const currentNum = parseFloat(currentValueRaw.replace(/[^0-9.-]/g, ''));
      
      if (!isNaN(prevNum) && !isNaN(currentNum)) {
        const isIncreasing = currentNum > prevNum;
        
        return (
          <div className={`flex items-center ${getUpdateStyle(field)}`}>
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

  // Объединяем данные из props и WebSocket
  const displayData = useMemo(() => {
    if (wsData) {
      // Если есть данные с WebSocket, используем их, но сохраняем метаданные
      return {
        ...trackedData,
        ...wsData,
        _receivedAt: trackedData?._receivedAt || Date.now(),
        _lastUpdated: Date.now(),
        _updateId: trackedData?._updateId
      };
    }
    return trackedData;
  }, [wsData, trackedData]);

  // Добавляем useEffect для локального обновления данных
  useEffect(() => {
    if (data?._updateId) {
      console.log(`[CryptoCard] Обновление карточки ${data.id}`);
    }
  }, [data]);

  // Рендеринг бейджа с изменением цены в более выразительном виде
  const renderPriceChangeBadge = () => {
    const { isUp, value, ratioValue } = getPriceChangeInfo;
    
    // Определяем классы в зависимости от направления изменения
    const colorClasses = isUp
      ? "text-green-500 border-green-500/20 bg-green-500/10"
      : "text-red-500 border-red-500/20 bg-red-500/10";
    
    // Определяем интенсивность изменения для более выразительного эффекта
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
      className={`block overflow-hidden border-gray-800 ${isUpdating ? 'ring-1 ring-green-500/40' : ''}`}
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
                <h3 className="text-base font-semibold">
                  {displayData?.name}
                  {isConnected && (
                    <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">{displayData?.symbol}</p>
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
              <div className="text-right">
                {renderValueChange(displayData?.marketCap || '', 'marketCap')}
              </div>

              <div className="flex items-center">
                <span className="mr-1">⏳</span>
                <span className="text-muted-foreground">Token Age:</span>
              </div>
              <div className="text-right">{displayData?.tokenAge}</div>

              <div className="flex items-center">
                <span className="mr-1">💡</span>
                <span className="text-muted-foreground">Top10:</span>
              </div>
              <div className="text-right">
                {renderValueChange(displayData?.top10 || '', 'top10', true)}
              </div>

              <div className="flex items-center">
                <span className="mr-1">🧮</span>
                <span className="text-muted-foreground">Dev Wallet:</span>
              </div>
              <div className="text-right">
                {renderValueChange(displayData?.devWalletHold || '', 'devWalletHold', true)}
              </div>

              <div className="flex items-center">
                <span className="mr-1">🧠</span>
                <span className="text-muted-foreground">First 70 buyers:</span>
              </div>
              <div className="text-right">
                {renderValueChange(displayData?.first70BuyersHold || '', 'first70BuyersHold', true)}
              </div>

              <div className="flex items-center">
                <span className="mr-1">🐀</span>
                <span className="text-muted-foreground">Insiders:</span>
              </div>
              <div className="text-right">
                {renderValueChange(displayData?.insiders || '', 'insiders', true)}
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
                    {displayData?.whales.map((whale, index) => (
                      <p key={index} className="text-xs whitespace-nowrap">
                        ├ {whale.count} {whale.amount}
                      </p>
                    ))}
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
                      href=""
                      // href={displayData.socialLinks.telegram}
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
                      <Twitter className="h-3 w-3" />
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
