import { useEffect, useRef, useCallback } from 'react';
import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';

interface UseNestPresenceOptions {
  nestNaddr: string;
  isInNest: boolean;
  isHandRaised?: boolean;
}

/**
 * Hook to manage nest presence (kind 10312)
 * Automatically publishes presence events every 2 minutes when in a nest
 */
export function useNestPresence({ nestNaddr, isInNest, isHandRaised = false }: UseNestPresenceOptions) {
  const { user } = useCurrentUser();
  const { mutate: createEvent } = useNostrPublish();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const publishPresence = useCallback(() => {
    if (!user || !isInNest) return;

    const tags: string[][] = [
      ['a', nestNaddr, '', 'root']
    ];

    if (isHandRaised) {
      tags.push(['hand', '1']);
    }

    createEvent({
      kind: 10312,
      content: '',
      tags,
    });
  }, [user, isInNest, nestNaddr, isHandRaised, createEvent]);

  useEffect(() => {
    if (isInNest && user) {
      // Publish immediately when joining
      publishPresence();
      
      // Set up interval to publish every 2 minutes (120 seconds)
      intervalRef.current = setInterval(publishPresence, 120000);
    } else {
      // Clear interval when leaving nest
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isInNest, user, publishPresence]);

  // Update presence when hand raised status changes
  useEffect(() => {
    if (isInNest && user) {
      publishPresence();
    }
  }, [isHandRaised, isInNest, user, publishPresence]);
}