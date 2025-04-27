'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'whales_trace_referral_id';

export function useReferral(): number | undefined {
  const [referralId, setReferralId] = useState<number | undefined>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? parseInt(saved, 10) : undefined;
    }
    return undefined;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const ref = urlParams.get('ref');

      if (ref) {
        const numericRef = parseInt(ref, 10);
        if (!isNaN(numericRef)) {
          localStorage.setItem(STORAGE_KEY, numericRef.toString());
          setReferralId(numericRef);
        }
      }
    }
  }, []);

  return referralId;
}