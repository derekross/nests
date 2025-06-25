import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
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
 * Hook to fetch nest chat messages (kind 1311)
 */
export function useNestChat(nestNaddr: string | undefined) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nest-chat', nestNaddr],
    queryFn: async (c) => {
      if (!nestNaddr) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);
      const events = await nostr.query([{ 
        kinds: [1311], 
        '#a': [nestNaddr],
        limit: 100 
      }], { signal });
      
      // Sort by created_at (newest first)
      return events.sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!nestNaddr,
  });
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