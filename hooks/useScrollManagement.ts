import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import type { FlatList } from 'react-native';

export function useScrollManagement(flatListRef: React.RefObject<FlatList | null>) {
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = useCallback(
    (delay = 50) => {
      // Clear any existing scroll timer
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
      scrollTimerRef.current = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
        scrollTimerRef.current = null;
      }, delay) as unknown as NodeJS.Timeout;
    },
    [flatListRef]
  );

  // Cleanup scroll timer on unmount
  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = null;
      }
    };
  }, []);

  return { scrollToBottom };
}
