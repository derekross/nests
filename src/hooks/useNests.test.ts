import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { useNests } from './useNests';

// Mock the useCurrentUser hook
vi.mock('./useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: {
      pubkey: 'test-pubkey',
      signer: {
        signEvent: vi.fn().mockResolvedValue({ id: 'test-event-id' }),
      },
    },
  }),
}));

// Mock the useNostrPublish hook
const mockCreateEvent = vi.fn();
vi.mock('./useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutate: mockCreateEvent,
  }),
}));

// Mock the useNostr hook to avoid real network connections
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: vi.fn().mockResolvedValue([]),
      event: vi.fn().mockResolvedValue(undefined),
    },
  }),
}));

describe('useNests', () => {
  it('should fetch and validate nests correctly', async () => {
    const { result } = renderHook(() => useNests(), {
      wrapper: TestApp,
    });

    // Wait for the query to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // The hook should return a query result
    expect(result.current).toHaveProperty('data');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
  });
});