import { Keypair, PublicKey } from '@solana/web3.js';
import { encodeURL, createQR } from '@solana/pay';
import { createRef } from 'react';
import BigNumber from 'bignumber.js';
import * as QRCode from 'qrcode';

const keypair = Keypair.generate();

/**
 * Генерирует ссылку Solana Pay для оплаты
 * @param destinationAddress - адрес получателя
 * @param amountSOL - количество SOL для отправки
 * @param label - метка транзакции
 * @param message - сообщение о транзакции
 * @returns URL для Solana Pay QR-кода
 */
export function generateSolanaPayLink(
  destinationAddress: string, 
  amountSOL: number,
  label = 'WhalesTrace Subscription',
  message = 'Payment for premium subscription'
): string {
  try {
    if (!destinationAddress || destinationAddress.trim() === '') {
      console.warn('Empty destination address');
      destinationAddress = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';
    }
    
    const recipient = new PublicKey(destinationAddress);
    
    const amount = new BigNumber(amountSOL);
    
    const reference = keypair.publicKey;
    
    const memo = 'WhalesTrace#Sub';

    const url = encodeURL({ 
      recipient, 
      amount, 
      reference, 
      label, 
      message, 
      memo 
    });
    
    console.log('Solana Pay URL:', url.toString());
    
    return url.toString();
  } catch (error) {
    console.error('Error generating Solana Pay link:', error);
    return '';
  }
}

/**
 * Создаёт QR-код для Solana Pay (оригинальный метод)
 * @param destinationAddress - адрес получателя
 * @param amountSOL - количество SOL для отправки
 * @returns объект QR-кода или null в случае ошибки
 */
export function createSolanaPayQR(
  destinationAddress: string, 
  amountSOL: number
) {
  try {
    const paymentLink = generateSolanaPayLink(destinationAddress, amountSOL);
    if (!paymentLink) return null;
    
    const qrCode = createQR(paymentLink, 512, 'white', 'black');
    
    const qrRef = createRef<HTMLDivElement>();
    
    return { qrCode, qrRef };
  } catch (error) {
    console.error('Error creating Solana Pay QR code:', error);
    return null;
  }
}

export async function createSolanaPayQRImage(
  destinationAddress: string, 
  amountSOL: number
): Promise<{ imageUrl: string, paymentUrl: string }> {
  try {
    if (!destinationAddress || destinationAddress.trim() === '') {
      console.error('Empty destination address for QR code generation');
      throw new Error('Invalid wallet address');
    }
    
    if (isNaN(amountSOL) || amountSOL <= 0) {
      console.error('Invalid amount for QR code generation:', amountSOL);
      throw new Error('Invalid payment amount');
    }
    
    const paymentUrl = generateSolanaPayLink(destinationAddress, amountSOL);
    if (!paymentUrl) {
      console.error('Failed to generate payment URL');
      throw new Error('Failed to generate payment URL');
    }
    
    console.log('Generating QR code for URL:', paymentUrl);
    
    const imageUrl = await QRCode.toDataURL(paymentUrl, {
      errorCorrectionLevel: 'H', 
      margin: 2,
      width: 512,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    if (!imageUrl || !imageUrl.startsWith('data:')) {
      console.error('Generated QR code image URL is invalid');
      throw new Error('Failed to generate valid QR code image');
    }
    
    console.log('QR code generated successfully');
    return { imageUrl, paymentUrl };
  } catch (error) {
    console.error('Error creating Solana Pay QR code image:', error);
    throw error;
  }
} 