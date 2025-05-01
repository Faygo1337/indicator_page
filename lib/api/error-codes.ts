export enum ErrorCodes {
  // Auth errors
  AUTH_TOKEN_MISSING = 'ACCESS_TOKEN_MISSING',
  AUTH_TOKEN_INVALID = 'ACCESS_TOKEN_INVALID',
  AUTH_TOKEN_EXPIRED = 'ACCESS_TOKEN_EXPIRED',

  // API errors
  VERIFY_VALIDATION_ERROR = 'VERIFY_VALIDATION_ERROR',
  VERIFY_INVALID_PUBKEY = 'VERIFY_INVALID_PUBKEY',
  VERIFY_INVALID_SIGNATURE = 'VERIFY_INVALID_SIGNATURE',
  VERIFY_EXPIRED_TIMESTAMP = 'VERIFY_EXPIRED_TIMESTAMP',

  // Subscription errors
  SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED',

  // WebSocket errors  
  WS_CONNECTION_ERROR = 'WS_CONNECTION_ERROR',
  WS_AUTH_FAILED = 'WS_AUTH_FAILED',

  // Generic errors
  SERVER_ERROR = 'SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',

  //
  CONNECT_WALLET_ERROR = 'CONNECT_WALLET_FAILED'
}

export const ErrorMessages: Record<ErrorCode, string> = {
  AUTH_TOKEN_MISSING: 'Access token not provided',
  AUTH_TOKEN_INVALID: 'Invalid access token',
  AUTH_TOKEN_EXPIRED: 'Access token has expired',
  VERIFY_VALIDATION_ERROR: 'Invalid request data',
  VERIFY_INVALID_PUBKEY: 'Invalid public key',
  VERIFY_INVALID_SIGNATURE: 'Invalid signature',
  VERIFY_EXPIRED_TIMESTAMP: 'Signature timestamp has expired',
  SUBSCRIPTION_REQUIRED: 'Subscription required to access this feature',
  WS_CONNECTION_ERROR: 'WebSocket connection failed',
  WS_AUTH_FAILED: 'WebSocket authentication failed',
  SERVER_ERROR: 'Internal server error occurred',
  NETWORK_ERROR: 'Network error occurred',
  UNKNOWN_ERROR: 'An unknown error occurred',
  CONNECT_WALLET_ERROR: 'Error connecting the wallet. Please reload the page and try again.'
};

export type ErrorCode = keyof typeof ErrorCodes;
