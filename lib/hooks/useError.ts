import { useContext } from 'react';
import { ToastContext } from '@/components/toast';
import { ErrorCodes, ErrorMessages, type ErrorCode } from '@/lib/api/error-codes';
import { AxiosError } from 'axios';

interface ApiErrorResponse {
  success: boolean;
  error?: string;
}

export function useError() {
  const { addToast } = useContext(ToastContext);

  const handleError = (error: unknown, context?: string) => {
    let message: string;
    let code: ErrorCode;

    if (error instanceof AxiosError) {
      const data = error.response?.data as ApiErrorResponse;

      // Handle specific error status codes
      switch (error.response?.status) {
        case 401:
          if (data?.error?.includes('token')) {
            code = 'AUTH_TOKEN_INVALID';
            // Clear auth state on token errors
            localStorage.removeItem('whales_trace_token');
            localStorage.removeItem('whales_trace_jwt');
          } else {
            code = ErrorCodes.VERIFY_INVALID_SIGNATURE;
          }
          break;

        case 400:
          if (data?.error?.includes('public_key')) {
            code = ErrorCodes.VERIFY_INVALID_PUBKEY;
          } else if (data?.error?.includes('signature')) {
            code = ErrorCodes.VERIFY_INVALID_SIGNATURE;
          } else if (data?.error?.includes('expired')) {
            code = ErrorCodes.VERIFY_EXPIRED_TIMESTAMP;
          } else {
            code = ErrorCodes.VERIFY_VALIDATION_ERROR;
          }
          break;

        case 403:
          code = ErrorCodes.SUBSCRIPTION_REQUIRED;
          break;

        case 500:
          code = ErrorCodes.SERVER_ERROR;
          break;

        default:
          code = ErrorCodes.NETWORK_ERROR;
      }
    } else if (error instanceof Error) {
      code = ErrorCodes.UNKNOWN_ERROR;
    } else if (typeof error === 'string' && error in ErrorCodes) {
      code = error as ErrorCode;
    } else {
      code = ErrorCodes.UNKNOWN_ERROR;
    }

    message = ErrorMessages[code];

    addToast({
      type: "error",
      title: context || 'Error',
      description: message
    });

    // Log error for debugging
    console.error('[Error Handler]', { code, message, context, error });

    return code;
  };

  return { handleError };
}