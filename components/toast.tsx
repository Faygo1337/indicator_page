"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export interface Toast {
  id: string;
  title?: string;
  description: string;
  type: "success" | "error" | "warning" | "info";
  duration?: number;
}

interface ToastProps extends Toast {
  onRemoveAction: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({
  id,
  title,
  description,
  type,
  onRemoveAction,
}) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onRemoveAction(id);
    }, 5000);

    return () => clearTimeout(timer);
  }, [id, onRemoveAction]);

  const variants = {
    initial: { opacity: 0, y: 50, scale: 0.3 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, scale: 0.5, transition: { duration: 0.2 } },
  };

  const getToastStyles = () => {
    switch (type) {
      case "error":
        return "bg-red-950/90 border-red-900 text-red-200";
      case "success":
        return "bg-green-950/90 border-green-900 text-green-200";
      case "warning":
        return "bg-yellow-950/90 border-yellow-900 text-yellow-200";
      case "info":
        return "bg-blue-950/90 border-blue-900 text-blue-200";
      default:
        return "bg-gray-950/90 border-gray-900 text-gray-200";
    }
  };

  return (
    <motion.div
      layout
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={cn(
        "pointer-events-auto flex w-full max-w-md rounded-lg border p-4 shadow-lg",
        getToastStyles()
      )}
    >
      <div className="flex w-full items-start gap-4">
        <div className="flex-1">
          {title && (
            <h3 className="font-medium leading-none tracking-tight">{title}</h3>
          )}
          {description && (
            <div className="mt-1 text-sm opacity-90">{description}</div>
          )}
        </div>
        <button
          onClick={() => onRemoveAction(id)}
          className="opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
};

interface ToastProviderProps {
  children: React.ReactNode;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = React.createContext<ToastContextType>({
  addToast: () => {},
  removeToast: () => {},
});

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    setToasts((prev) => [
      ...prev,
      { ...toast, id: Math.random().toString(36).slice(2) },
    ]);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-0 right-0 z-50 flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[420px]">
        <AnimatePresence mode="sync">
          {toasts.map((toast) => (
            <Toast key={toast.id} {...toast} onRemoveAction={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};