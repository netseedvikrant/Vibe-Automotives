// AutoMFG — useActiveShift hook
// Returns the current active shift, re-evaluated every 30 seconds.

import { useState, useEffect } from 'react';
import { getActiveShift } from '../utils/shiftUtils';

export const useActiveShift = () => {
  const [activeShift, setActiveShift] = useState(getActiveShift());

  useEffect(() => {
    // Re-evaluate shift every 30 seconds to catch shift transitions
    const interval = setInterval(() => {
      setActiveShift(getActiveShift());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return activeShift;
};
