import { Keypair, PublicKey } from '@solana/web3.js';
import { encodeURL, createQR } from '@solana/pay';
import { createRef } from 'react';
import BigNumber from 'bignumber.js';
import * as QRCode from 'qrcode';

// Создаём пару ключей для reference
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
    // Проверка валидности адреса
    if (!destinationAddress || destinationAddress.trim() === '') {
      console.warn('Empty destination address');
      // Тестовый адрес для демонстрации
      destinationAddress = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';
    }
    
    // Преобразуем строку адреса в PublicKey
    const recipient = new PublicKey(destinationAddress);
    
    // Преобразуем SOL в BigNumber
    const amount = new BigNumber(amountSOL);
    
    // Создаём reference для отслеживания транзакции
    const reference = keypair.publicKey;
    
    // Опциональное примечание для транзакции
    const memo = 'WhalesTrace#Sub';

    // Создаём URL для оплаты
    const url = encodeURL({ 
      recipient, 
      amount, 
      reference, 
      label, 
      message, 
      memo 
    });
    
    // Выводим URL для отладки
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
    
    // Создаём QR-код с настройками для хорошей читаемости
    const qrCode = createQR(paymentLink, 512, 'white', 'black');
    
    // Создаём ref для дальнейшего использования в компонентах
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
    // Проверка валидности адреса
    if (!destinationAddress || destinationAddress.trim() === '') {
      console.error('Empty destination address for QR code generation');
      throw new Error('Invalid wallet address');
    }
    
    // Проверка валидности суммы
    if (isNaN(amountSOL) || amountSOL <= 0) {
      console.error('Invalid amount for QR code generation:', amountSOL);
      throw new Error('Invalid payment amount');
    }
    
    // Генерация ссылки для оплаты
    const paymentUrl = generateSolanaPayLink(destinationAddress, amountSOL);
    if (!paymentUrl) {
      console.error('Failed to generate payment URL');
      throw new Error('Failed to generate payment URL');
    }
    
    console.log('Generating QR code for URL:', paymentUrl);
    
    // Создаем QR код как data URL с улучшенными настройками
    const imageUrl = await QRCode.toDataURL(paymentUrl, {
      errorCorrectionLevel: 'H', // Высший уровень коррекции ошибок
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