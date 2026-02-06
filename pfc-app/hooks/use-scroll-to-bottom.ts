'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useScrollToBottom<T extends HTMLElement>() {
  const containerRef = useRef<T>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const atBottom = distanceFromBottom < 50;

    setIsAtBottom(atBottom);

    // If user scrolls up, disable auto-scroll
    // If user scrolls to bottom, re-enable auto-scroll
    setAutoScroll(atBottom);
  }, []);

  // Auto-scroll when new content arrives (if autoScroll is enabled)
  useEffect(() => {
    if (!autoScroll) return;

    const container = containerRef.current;
    if (!container) return;

    const observer = new MutationObserver(() => {
      if (autoScroll) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth',
        });
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [autoScroll]);

  // Attach scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return {
    containerRef,
    isAtBottom,
    scrollToBottom,
    autoScroll,
    setAutoScroll,
  };
}
