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
  const backgroundColor = useMemo(() => {
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return `hsl(${hash % 360}, 70%, 40%)`;
  }, [text]);
  
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