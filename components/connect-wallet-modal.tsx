import Image from 'next/image';
import React from 'react';
import PhantomIcon from '@/public/phantom-icon.svg';

interface ConnectWalletModalProps {
  open: boolean;
  onConnectAction: () => void;
}

export const ConnectWalletModal: React.FC<ConnectWalletModalProps> = ({ open, onConnectAction }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">

      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" />
      <div className="relative bg-background p-6 rounded-lg shadow-lg w-full max-w-lg">
        <h3 className="mb-4 text-lg font-semibold text-white">Connect a wallet on Solana to continue</h3>
        <button
          onClick={onConnectAction}
          className="w-full flex items-center justify-center px-4 py-2 bg-purple-600  text-white rounded-md"
        >
          <div className="flex items-center gap-2">
            <Image src={PhantomIcon} alt="Phantom image" width={30} height={30} priority />
            Phantom
          </div>
        </button>
      </div>
    </div>
  );
}; 