import { useNostr } from '@nostrify/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Hook to fetch all active nests (kind 30312)
 */
export function useNests() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nests'],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);
      const events = await nostr.query([{ 
        kinds: [30312], 
        limit: 50 
      }], { signal });
      
      // Filter for valid nests
      return events.filter(validateNest);
    },
  });
}

/**
 * Hook to fetch a specific nest by naddr
 */
export function useNest(naddr: string | undefined) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nest', naddr],
    queryFn: async (c) => {
      if (!naddr) return null;
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);
      
      // Decode naddr to get the filter parameters
      const { nip19 } = await import('nostr-tools');
      const decoded = nip19.decode(naddr);
      
      if (decoded.type !== 'naddr') {
        throw new Error('Invalid naddr');
      }
      
      const { kind, pubkey, identifier } = decoded.data;
      
      const events = await nostr.query([{
        kinds: [kind],
        authors: [pubkey],
        '#d': [identifier],
      }], { signal });
      
      const nest = events.find(validateNest);
      return nest || null;
    },
    enabled: !!naddr,
  });
}

/**
 * Hook to fetch nest chat messages (kind 1311) with live updates
 */
export function useNestChat(nestNaddr: string | undefined) {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const lastMessageTimeRef = useRef<number>(0);

  // Query with automatic refetching for live updates
  const query = useQuery({
    queryKey: ['nest-chat', nestNaddr],
    queryFn: async (c) => {
      if (!nestNaddr) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);
      const events = await nostr.query([{ 
        kinds: [1311], 
        '#a': [nestNaddr],
        limit: 100 
      }], { signal });
      
      // Update the last message time for incremental updates
      if (events.length > 0) {
        lastMessageTimeRef.current = Math.max(...events.map(e => e.created_at));
      }
      
      // Sort by created_at (oldest first for chat display)
      return events.sort((a, b) => a.created_at - b.created_at);
    },
    enabled: !!nestNaddr,
    refetchInterval: 2000, // Refetch every 2 seconds for live updates
    refetchIntervalInBackground: true, // Continue refetching when tab is not active
  });

  // Additional polling for very recent messages (last 30 seconds)
  useEffect(() => {
    if (!nestNaddr || !nostr) return;

    const pollForNewMessages = async () => {
      try {
        const thirtySecondsAgo = Math.floor(Date.now() / 1000) - 30;
        const since = Math.max(lastMessageTimeRef.current, thirtySecondsAgo);
        
        const signal = AbortSignal.timeout(1000);
        const newEvents = await nostr.query([{
          kinds: [1311],
          '#a': [nestNaddr],
          since: since
        }], { signal });

        if (newEvents.length > 0) {
          // Update the query cache with new messages
          queryClient.setQueryData(['nest-chat', nestNaddr], (oldData: NostrEvent[] | undefined) => {
            if (!oldData) return newEvents.sort((a, b) => a.created_at - b.created_at);
            
            // Merge new messages with existing ones, avoiding duplicates
            const existingIds = new Set(oldData.map(msg => msg.id));
            const uniqueNewEvents = newEvents.filter(event => !existingIds.has(event.id));
            
            if (uniqueNewEvents.length === 0) return oldData;
            
            // Add new messages and keep sorted by created_at
            const newData = [...oldData, ...uniqueNewEvents].sort((a, b) => a.created_at - b.created_at);
            
            // Update last message time
            lastMessageTimeRef.current = Math.max(...newData.map(e => e.created_at));
            
            // Keep only the last 100 messages to prevent memory issues
            return newData.slice(-100);
          });
        }
      } catch (error) {
        // Silently handle errors to avoid spamming console
        if (error instanceof Error && !error.message.includes('timeout')) {
          console.warn('Chat polling error:', error);
        }
      }
    };

    // Poll every 3 seconds for new messages
    const interval = setInterval(pollForNewMessages, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [nestNaddr, nostr, queryClient]);

  return query;
}

/**
 * Hook to fetch nest presence events (kind 10312)
 */
export function useNestPresence(nestNaddr: string | undefined) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nest-presence', nestNaddr],
    queryFn: async (c) => {
      if (!nestNaddr) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);
      const events = await nostr.query([{ 
        kinds: [10312], 
        '#a': [nestNaddr],
        limit: 200 
      }], { signal });
      
      // Filter events older than 5 minutes (300 seconds)
      const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
      return events.filter(event => event.created_at > fiveMinutesAgo);
    },
    enabled: !!nestNaddr,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Validates a nest event according to NIP-53
 */
function validateNest(event: NostrEvent): boolean {
  if (event.kind !== 30312) return false;

  // Check for required tags
  const d = event.tags.find(([name]) => name === 'd')?.[1];
  const room = event.tags.find(([name]) => name === 'room')?.[1];
  const status = event.tags.find(([name]) => name === 'status')?.[1];
  const service = event.tags.find(([name]) => name === 'service')?.[1];

  // All nests require 'd', 'room', 'status', and 'service' tags
  if (!d || !room || !status || !service) return false;

  // Status should be one of the valid values
  if (!['open', 'private', 'closed'].includes(status)) return false;

  // Must have at least one provider (p tag)
  const providers = event.tags.filter(([name]) => name === 'p');
  if (providers.length === 0) return false;

  return true;
}