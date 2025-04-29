import { PublicKey, Connection, Transaction, SystemProgram, TransactionInstruction } from '@solana/web3.js';

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
    const lamports = amountSOL * 1e9;

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

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPublicKey;

    const signedTransaction = await wallet.signTransaction(transaction);

    const signature = await connection.sendRawTransaction(signedTransaction.serialize());

    await connection.confirmTransaction(signature);

    return signature;
  } catch {
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

  } catch {
    return null
  }
}
