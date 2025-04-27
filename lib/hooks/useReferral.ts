'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'whales_trace_has_referral';

export function useReferral() {
  const [hasReferral, setHasReferral] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const ref = urlParams.get('ref');

      if (ref) {
        localStorage.setItem(STORAGE_KEY, 'true');
        setHasReferral(true);
      }
    }
  }, []);

  return hasReferral;
}