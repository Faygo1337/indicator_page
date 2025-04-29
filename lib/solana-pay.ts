import { PublicKey, Connection, Transaction, SystemProgram, TransactionInstruction } from '@solana/web3.js';
// import { encodeURL, createQR } from '@solana/pay';
// import { createRef } from 'react';
// import BigNumber from 'bignumber.js';
// import * as QRCode from 'qrcode';

// const keypair = Keypair.generate();
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

// Функция для создания и отправки транзакции
export async function sendPaymentTransaction(
  connection: Connection,
  wallet: any,
  toWallet: string,
  amountSOL: number
): Promise<string> {
  try {
    // console.log('Начало отправки транзакции:');
    // console.log('- От:', wallet?.publicKey?.toString());
    // console.log('- Кому:', toWallet);
    // console.log('- Сумма:', amountSOL, 'SOL');

    if (!wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    const fromPublicKey = new PublicKey(wallet.publicKey.toString());
    const toPublicKey = new PublicKey(toWallet);
    const lamports = amountSOL * 1e9;

    // Создаем транзакцию с transfer и memo инструкциями
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromPublicKey,
        toPubkey: toPublicKey,
        lamports,
      }),
      // Добавляем MEMO инструкцию
      new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from('subscription', 'utf-8'),
      })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPublicKey;

    const signedTransaction = await wallet.signTransaction(transaction);

    const signature = await connection.sendRawTransaction(signedTransaction.serialize());

    await connection.confirmTransaction(signature);

    return signature;
  } catch (error) {
    console.error('Ошибка отправки транзакции:', error);
    throw error;
  }
}

// Обновляем функцию проверки статуса транзакции
export async function checkTransactionStatus(
  connection: Connection,
  signature: string
): Promise<boolean> {
  try {
    const signatureStatus = await connection.getSignatureStatus(signature);

    if (signatureStatus.value?.err) {
      console.error('Ошибка в транзакции:', signatureStatus.value.err);
      return false;
    }

    const isConfirmed = signatureStatus.value?.confirmationStatus === 'confirmed' ||
      signatureStatus.value?.confirmationStatus === 'finalized';

    return isConfirmed;
  } catch (error) {
    console.error('Error checked status transaction:', error);
    return false;
  }
}

/**
 * Получает подробную информацию о транзакции
 * @param connection - Соединение с Solana
 * @param signature - Сигнатура транзакции
 * @returns Подробная информация о транзакции
 */
export async function getTransactionDetails(
  connection: Connection,
  signature: string
) {
  try {

    const response = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed'
    });

    if (!response) {
      throw new Error('Транзакция не найдена');
    }

    // Анализируем инструкции для определения типа транзакции
    const instructions = response.transaction.message.compiledInstructions;
    const accountKeys = response.transaction.message.getAccountKeys();
    const isSubscriptionTx = instructions.some(
      instruction => accountKeys?.get(instruction.programIdIndex)?.equals(MEMO_PROGRAM_ID) &&
        instruction.data &&
        Buffer.from(instruction.data).toString() === 'subscription'
    );

    // Формируем детальный отчет о транзакции
    const transactionDetails = {
      signature,
      solscanUrl: `https://solscan.io/tx/${signature}?cluster=devnet`,
      timestamp: response.blockTime ? new Date(response.blockTime * 1000).toISOString() : null,
      status: response.meta?.err ? 'error' : 'success',
      slot: response.slot,
      fee: response.meta?.fee || 0,
      type: isSubscriptionTx ? 'subscription' : 'transfer',
      confirmations: 'confirmed',
      instructions: response.transaction.message.compiledInstructions.map(instruction => ({
        programId: accountKeys.get(instruction.programIdIndex)?.toString(),
        data: instruction.data ? Buffer.from(instruction.data).toString() : null,
        accounts: instruction.accountKeyIndexes.map(index =>
          accountKeys.get(index)?.toString()
        )
      })),
      balanceChanges: response.meta?.preBalances?.map((pre, index) => {
        const post = response.meta?.postBalances?.[index] || 0;
        const account = response.transaction.message.getAccountKeys().get(index)?.toString() || '';
        return {
          account,
          accountType: index === 0 ? 'sender' : index === 1 ? 'recipient' : 'other',
          preSol: pre / 1e9,
          postSol: post / 1e9,
          changeSol: (post - pre) / 1e9
        };
      })
    };

    return transactionDetails;

  } catch (error) {
    console.error('[Transaction] Ошибка при получении деталей транзакции:', error);
    throw error;
  }
}

/**
 * Генерирует ссылку Solana Pay для оплаты
 * @param destinationAddress - адрес получателя
 * @param amountSOL - количество SOL для отправки
 * @param label - метка транзакции
 * @param message - сообщение о транзакции
 * @returns URL для Solana Pay QR-кода
 */
// export function generateSolanaPayLink(
//   destinationAddress: string,
//   amountSOL: number,
//   label = 'WhalesTrace Subscription',
//   message = 'Payment for premium subscription'
// ): string {
//   try {
//     if (!destinationAddress || destinationAddress.trim() === '') {
//       console.warn('Empty destination address');
//       destinationAddress = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';
//     }

//     const recipient = new PublicKey(destinationAddress);

//     const amount = new BigNumber(amountSOL);

//     const reference = keypair.publicKey;

//     const memo = 'WhalesTrace#Sub';

//     const url = encodeURL({
//       recipient,
//       amount,
//       reference,
//       label,
//       message,
//       memo
//     });

//     console.log('Solana Pay URL:', url.toString());

//     return url.toString();
//   } catch (error) {
//     console.error('Error generating Solana Pay link:', error);
//     return '';
//   }
// }

// /**
//  * Создаёт QR-код для Solana Pay (оригинальный метод)
//  * @param destinationAddress - адрес получателя
//  * @param amountSOL - количество SOL для отправки
//  * @returns объект QR-кода или null в случае ошибки
//  */
// export function createSolanaPayQR(
//   destinationAddress: string,
//   amountSOL: number
// ) {
//   try {
//     const paymentLink = generateSolanaPayLink(destinationAddress, amountSOL);
//     if (!paymentLink) return null;

//     const qrCode = createQR(paymentLink, 512, 'white', 'black');

//     const qrRef = createRef<HTMLDivElement>();

//     return { qrCode, qrRef };
//   } catch (error) {
//     console.error('Error creating Solana Pay QR code:', error);
//     return null;
//   }
// }

// export async function createSolanaPayQRImage(
//   destinationAddress: string,
//   amountSOL: number
// ): Promise<{ imageUrl: string, paymentUrl: string }> {
//   try {
//     if (!destinationAddress || destinationAddress.trim() === '') {
//       console.error('Empty destination address for QR code generation');
//       throw new Error('Invalid wallet address');
//     }

//     if (isNaN(amountSOL) || amountSOL <= 0) {
//       console.error('Invalid amount for QR code generation:', amountSOL);
//       throw new Error('Invalid payment amount');
//     }

//     const paymentUrl = generateSolanaPayLink(destinationAddress, amountSOL);
//     if (!paymentUrl) {
//       console.error('Failed to generate payment URL');
//       throw new Error('Failed to generate payment URL');
//     }

//     console.log('Generating QR code for URL:', paymentUrl);

//     const imageUrl = await QRCode.toDataURL(paymentUrl, {
//       errorCorrectionLevel: 'H',
//       margin: 2,
//       width: 512,
//       color: {
//         dark: '#000000',
//         light: '#FFFFFF'
//       }
//     });

//     if (!imageUrl || !imageUrl.startsWith('data:')) {
//       console.error('Generated QR code image URL is invalid');
//       throw new Error('Failed to generate valid QR code image');
//     }

//     console.log('QR code generated successfully');
//     return { imageUrl, paymentUrl };
//   } catch (error) {
//     console.error('Error creating Solana Pay QR code image:', error);
//     throw error;
//   }
// }