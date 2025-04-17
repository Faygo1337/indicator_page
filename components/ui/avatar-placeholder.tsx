"use client";

import { useMemo } from "react";

interface AvatarPlaceholderProps {
  text: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function AvatarPlaceholder({ 
  text, 
  size = "md", 
  className = "" 
}: AvatarPlaceholderProps) {
  // Создаём стабильный цвет на основе текста
  const backgroundColor = useMemo(() => {
    // Простой хеш-код из текста
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    // Генерируем HSL цвет с постоянной яркостью и насыщенностью
    return `hsl(${hash % 360}, 70%, 40%)`;
  }, [text]);
  
  // Определяем размер на основе пропса
  const sizeClass = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-base",
    lg: "w-16 h-16 text-xl"
  }[size];
  
  return (
    <div 
      className={`rounded-md flex items-center justify-center font-bold text-white ${sizeClass} ${className}`}
      style={{ backgroundColor }}
    >
      {text ? text.charAt(0).toUpperCase() : '?'}
    </div>
  );
} 