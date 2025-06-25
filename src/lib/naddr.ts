import { nip19 } from 'nostr-tools';

/**
 * Validates and decodes a Nostr naddr address
 */
export function validateNaddr(naddr: string): { 
  isValid: boolean; 
  error?: string; 
  data?: nip19.AddressPointer;
} {
  try {
    if (!naddr || typeof naddr !== 'string') {
      return { isValid: false, error: 'Invalid naddr: not a string' };
    }

    if (!naddr.startsWith('naddr1')) {
      return { isValid: false, error: 'Invalid naddr: must start with naddr1' };
    }

    const decoded = nip19.decode(naddr);
    
    if (decoded.type !== 'naddr') {
      return { isValid: false, error: `Invalid naddr: decoded type is ${decoded.type}` };
    }

    const data = decoded.data as nip19.AddressPointer;
    
    if (!data.kind || !data.pubkey || !data.identifier) {
      return { 
        isValid: false, 
        error: `Invalid naddr: missing required fields (kind: ${!!data.kind}, pubkey: ${!!data.pubkey}, identifier: ${!!data.identifier})` 
      };
    }

    return { isValid: true, data };
  } catch (error) {
    return { 
      isValid: false, 
      error: `Failed to decode naddr: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Creates a Nostr filter from an naddr address
 */
export function naddrToFilter(naddr: string): { 
  filter?: { kinds: number[]; authors: string[]; '#d': string[] }; 
  error?: string; 
} {
  const validation = validateNaddr(naddr);
  
  if (!validation.isValid || !validation.data) {
    return { error: validation.error };
  }

  const { kind, pubkey, identifier } = validation.data;
  
  return {
    filter: {
      kinds: [kind],
      authors: [pubkey],
      '#d': [identifier],
    }
  };
}

/**
 * Creates an naddr from event data
 */
export function createNaddr(kind: number, pubkey: string, identifier: string, relays?: string[]): string {
  return nip19.naddrEncode({
    kind,
    pubkey,
    identifier,
    relays,
  });
}

/**
 * Debug information for an naddr
 */
export function debugNaddr(naddr: string): Record<string, unknown> {
  const validation = validateNaddr(naddr);
  
  return {
    naddr,
    isValid: validation.isValid,
    error: validation.error,
    data: validation.data,
    filter: validation.isValid ? naddrToFilter(naddr).filter : null,
  };
}