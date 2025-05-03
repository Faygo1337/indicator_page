import {
  PublicKey,
  Connection,
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export async function sendPaymentTransaction(
  connection: Connection,
  wallet: any,
  toWallet: string,
  amountSOL: number
): Promise<string> {
  try {
    if (!wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    const fromPublicKey = new PublicKey(wallet.publicKey.toString());
    const toPublicKey = new PublicKey(toWallet);
    const lamports = Math.round(amountSOL * 1e9);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromPublicKey,
        toPubkey: toPublicKey,
        lamports,
      }),
      new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from('subscription', 'utf-8'),
      })
    );

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPublicKey;

    const signedTransaction = await wallet.signTransaction(transaction);

    const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    // Подтверждение через WebSocket с fallback на polling
    try {
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Confirmation waiting timeout'));
        }, 60000);
        connection.onSignature(signature, (result) => {
          clearTimeout(timeoutId);
          if (result.err) {
            reject(new Error('Transaction failed'));
          } else {
            resolve();
          }
        }, 'confirmed');
      });
    } catch (wsError) {
      // fallback - polling
      let confirmed = false;
      const startTime = Date.now();
      while (!confirmed && (Date.now() - startTime < 60000)) {
        try {
          const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
          if (status.value && !status.value.err) {
            if (
              status.value.confirmationStatus === 'confirmed' ||
              status.value.confirmationStatus === 'finalized'
            ) {
              confirmed = true;
            } else {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } else {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (pollError) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      if (!confirmed) {
        throw new Error('Transaction confirmation timeout');
      }
    }

    return signature;
  } catch (error) {
    console.error('Error in sendPaymentTransaction:', error);
    return '';
  }
}


export async function checkTransactionStatus(
  connection: Connection,
  signature: string
): Promise<boolean> {
  try {
    const signatureStatus = await connection.getSignatureStatus(signature);

    if (signatureStatus.value?.err) {
      return false;
    }

    const isConfirmed = signatureStatus.value?.confirmationStatus === 'confirmed' ||
      signatureStatus.value?.confirmationStatus === 'finalized';

    return isConfirmed;
  } catch {

    return false;
  }
}


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

    const instructions = response.transaction.message.compiledInstructions;
    const accountKeys = response.transaction.message.getAccountKeys();
    const isSubscriptionTx = instructions.some(
      instruction => accountKeys?.get(instruction.programIdIndex)?.equals(MEMO_PROGRAM_ID) &&
        instruction.data &&
        Buffer.from(instruction.data).toString() === 'subscription'
    );

    const transactionDetails = {
      signature,
      solscanUrl: `https://solscan.io/tx/${signature}`,
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

  } catch {
    return null
  }
}
