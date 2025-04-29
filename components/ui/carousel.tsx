"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface CarouselApi {
  canScrollPrev: boolean
  canScrollNext: boolean
  scrollPrev: () => void
  scrollNext: () => void
  setApi: (api: unknown) => void
}

const CarouselContext = createContext<CarouselApi>({
  canScrollPrev: false,
  canScrollNext: false,
  scrollPrev: () => {},
  scrollNext: () => {},
  setApi: () => {},
})

export const useCarousel = () => useContext(CarouselContext)

interface CarouselProps extends React.HTMLAttributes<HTMLDivElement> {
  opts?: any
  orientation?: "horizontal" | "vertical"
  setApi?: (api: any) => void
}

export function Carousel({
  opts,
  orientation = "horizontal",
  setApi,
  className,
  children,
  ...props
}: CarouselProps) {
  const [carouselRef, setCarouselRef] = useState<HTMLDivElement | null>(null)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const scrollPrev = () => {
    if (carouselRef) {
      const scrollAmount = carouselRef.clientWidth
      carouselRef.scrollLeft -= scrollAmount
    }
  }

  const scrollNext = () => {
    if (carouselRef) {
      const scrollAmount = carouselRef.clientWidth
      carouselRef.scrollLeft += scrollAmount
    }
  }

  useEffect(() => {
    if (!carouselRef) return
    
    const checkScroll = () => {
      if (!carouselRef) return
      
      const { scrollLeft, scrollWidth, clientWidth } = carouselRef
      setCanScrollPrev(scrollLeft > 0)
      setCanScrollNext(scrollLeft < scrollWidth - clientWidth)
    }
    
    checkScroll()
    carouselRef.addEventListener("scroll", checkScroll)
    
    return () => {
      carouselRef.removeEventListener("scroll", checkScroll)
    }
  }, [carouselRef])

  return (
    <CarouselContext.Provider
      value={{
        canScrollPrev,
        canScrollNext,
        scrollPrev,
        scrollNext,
        setApi: setApi || (() => {}),
      }}
    >
      <div
        ref={setCarouselRef}
        className={cn(
          "relative overflow-hidden",
          orientation === "horizontal" ? "overflow-x-auto" : "overflow-y-auto",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  )
}

interface CarouselContentProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
}

export function CarouselContent({
  orientation = "horizontal",
  className,
  ...props
}: CarouselContentProps) {
  return (
    <div
      className={cn(
        "flex",
        orientation === "horizontal" ? "flex-row" : "flex-col",
        className
      )}
      {...props}
    />
  )
}

interface CarouselItemProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
}

export function CarouselItem({
  orientation = "horizontal",
  className,
  ...props
}: CarouselItemProps) {
  return (
    <div
      className={cn(
        "min-w-0 shrink-0 grow-0 basis-full",
        orientation === "horizontal" ? "pl-4 first:pl-0" : "pt-4 first:pt-0",
        className
      )}
      {...props}
    />
  )
}

export function CarouselPrevious({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { canScrollPrev, scrollPrev } = useCarousel()
  
  return (
    <button
      className={cn(
        "absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white disabled:opacity-50",
        className
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
    </button>
  )
}

export function CarouselNext({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { canScrollNext, scrollNext } = useCarousel()
  
  return (
    <button
      className={cn(
        "absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white disabled:opacity-50",
        className
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  )
} 