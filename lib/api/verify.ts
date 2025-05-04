'use client';
import {
  VerifyResponse,
  API_HOST,
} from './types';
import { decodeJWT, formatMarketCap } from "@/lib/utils";
import axios from 'axios';

interface AuthVerifyResponse {
  success: boolean;
  status: boolean;
  token: string;
  message?: string;
}

class VerifyInstance {
  private static instance: VerifyInstance;
  private constructor() { }
  static getInstance(): VerifyInstance {
    if (!VerifyInstance.instance) {
      VerifyInstance.instance = new VerifyInstance();
    }
    return VerifyInstance.instance;
  }

  async verifyWallet(
    signature: string,
    wallet: string,
    timestamp?: number,
    referralId?: string
  ): Promise<VerifyResponse> {

    try {
      const refNumber = referralId ? parseInt(referralId, 10) : 0;

      const dataPost = {
        timestamp: timestamp || Date.now(),
        ref: refNumber,
        signature: signature,
        wallet: wallet
      };

      const response = await axios.post(`${API_HOST}/api/verify`, dataPost, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      });

      const apiResponse = response.data;

      if ('token' in apiResponse) {
        const authResponse = apiResponse as AuthVerifyResponse;

        return {
          token: authResponse.token || '',
          payload: authResponse.token ? decodeJWT(authResponse.token) : null,
        };
      } else {
        return {
          token: apiResponse.token || '',
          payload: null,
        };
      }
    } catch (error) {
      throw error;
    }
  }
}

export const apiGeneral = VerifyInstance.getInstance();
export const webSocketClient = apiGeneral;
export async function verifyWallet(
  signature: string,
  wallet: string,
  timestamp?: number,
  referralId?: string
): Promise<VerifyResponse> {
  return apiGeneral.verifyWallet(signature, wallet, timestamp, referralId);
}
