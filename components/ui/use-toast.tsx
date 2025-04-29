"use client"

import { createContext, useContext, useState, useCallback } from "react"

interface Toast {
  id: string
  title?: string
  description?: string
  status?: "info" | "success" | "warning" | "error"
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  toast: (toast: Omit<Toast, "id">) => void
  dismiss: (id: string) => void
  dismissAll: () => void
}

const ToastContext = createContext<ToastContextType>({
  toasts: [],
  toast: () => {},
  dismiss: () => {},
  dismissAll: () => {}
})

export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2, 11)
    const newToast = { ...toast, id }
    
    setToasts((prev) => [...prev, newToast])
    
    if (toast.duration !== 0) {
      setTimeout(() => {
        dismiss(id)
      }, toast.duration || 5000)
    }
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const dismissAll = useCallback(() => {
    setToasts([])
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss, dismissAll }}>
      {children}
      
      {/* Render toasts */}
      <div className="fixed bottom-0 right-0 z-50 flex flex-col gap-2 p-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="rounded-md border bg-background p-4 shadow-md"
            role="alert"
          >
            {toast.title && (
              <div className="mb-1 font-medium">{toast.title}</div>
            )}
            {toast.description && <div>{toast.description}</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
} 