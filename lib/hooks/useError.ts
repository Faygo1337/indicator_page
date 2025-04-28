import { useContext } from 'react';
import { ToastContext } from '@/components/toast';

interface ErrorMap {
  [key: string]: {
    title: string;
    description: string;
    type: "error" | "warning" | "info";
  };
}

// Карта соответствия кодов ошибок и их описаний
const errorMessages: ErrorMap = {
  // Ошибки аутентификации
  "AUTH_INVALID_SIGNATURE": {
    title: "Signature error",
    description: "Invalid message signature. Try reconnecting the wallet",
    type: "error"
  },
  "AUTH_WALLET_DISCONNECTED": {
    title: "Wallet disconnected",
    description: "Please connect your wallet to continue",
    type: "warning"
  },
  "AUTH_SESSION_EXPIRED": {
    title: "Session expired",
    description: "Your session has expired. Please log in again",
    type: "warning"
  },

  // Ошибки подписки
  "SUBSCRIPTION_EXPIRED": {
    title: "Subscription expired",
    description: "Your subscription has expired. Please renew your subscription to continue",
    type: "warning"
  },
  "SUBSCRIPTION_PAYMENT_FAILED": {
    title: "Payment error",
    description: "Failed to process payment. Please try again later",
    type: "error"
  },

  // Ошибки WebSocket
  "WS_CONNECTION_FAILED": {
    title: "Connection error",
    description: "Failed to establish a connection to the server. Check the Internet connection",
    type: "error"
  },
  "WS_CONNECTION_CLOSED": {
    title: "Connection terminated",
    description: "The connection to the server has been terminated. Trying to reconnect....",
    type: "warning"
  },

  // Общие ошибки
  "NETWORK_ERROR": {
    title: "Network error",
    description: "Failed to connect to the server. Check the Internet connection",
    type: "error"
  },
  "SERVER_ERROR": {
    title: "Server error",
    description: "There was an error on the server. Try again later",
    type: "error"
  },
  "UNKNOWN_ERROR": {
    title: "Unknown error",
    description: "An unknown error has occurred. Try again later",
    type: "error"
  },
  "CONNECT_WALLET_FAILED": {
    title: "Connection error",
    description: "Failed to connect to the wallet. Please try again.",
    type: "error"
  }
};

export function useError() {
  const { addToast } = useContext(ToastContext);

  const handleError = (error: unknown) => {
    // Если ошибка уже в нужном формате
    if (typeof error === 'string' && error in errorMessages) {
      const errorInfo = errorMessages[error];
      addToast({
        title: errorInfo.title,
        description: errorInfo.description,
        type: errorInfo.type
      });
      return;
    }

    // Если ошибка от API
    if (error && typeof error === 'object' && 'code' in error) {
      const errorCode = (error as { code: string }).code;
      if (errorCode in errorMessages) {
        const errorInfo = errorMessages[errorCode];
        addToast({
          title: errorInfo.title,
          description: errorInfo.description,
          type: errorInfo.type
        });
        return;
      }
    }

    // Если это объект Error
    if (error instanceof Error) {
      addToast({
        title: "Ошибка",
        description: error.message,
        type: "error"
      });
      return;
    }

    // Для всех остальных случаев
    addToast({
      title: "Неизвестная ошибка",
      description: "Произошла неизвестная ошибка. Попробуйте позже",
      type: "error"
    });
  };

  return { handleError };
}