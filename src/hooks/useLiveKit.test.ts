import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLiveKit } from './useLiveKit';

// Mock LiveKit client
const mockRoom = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
  localParticipant: {
    getTrackPublication: vi.fn(),
    setMicrophoneEnabled: vi.fn(),
    setMetadata: vi.fn(),
  },
  remoteParticipants: new Map(),
};

vi.mock('livekit-client', () => ({
  Room: vi.fn().mockImplementation(() => mockRoom),
  RoomEvent: {
    Connected: 'connected',
    Disconnected: 'disconnected',
    Reconnecting: 'reconnecting',
    Reconnected: 'reconnected',
    ConnectionQualityChanged: 'connectionQualityChanged',
    ParticipantConnected: 'participantConnected',
    ParticipantDisconnected: 'participantDisconnected',
    LocalTrackPublished: 'localTrackPublished',
    LocalTrackUnpublished: 'localTrackUnpublished',
    TrackMuted: 'trackMuted',
    TrackUnmuted: 'trackUnmuted',
    MediaDevicesError: 'mediaDevicesError',
    ParticipantMetadataChanged: 'participantMetadataChanged',
  },
  Track: {
    Source: {
      Microphone: 'microphone',
    },
  },
}));

describe('useLiveKit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoom.connect.mockResolvedValue(undefined);
    mockRoom.disconnect.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle multiple connection attempts gracefully', async () => {
    const { result } = renderHook(() => useLiveKit());

    const config1 = {
      serverUrl: 'ws://localhost:7880',
      token: 'token1',
    };

    const config2 = {
      serverUrl: 'ws://localhost:7880',
      token: 'token2',
    };

    // First connection
    await act(async () => {
      await result.current.connect(config1);
    });

    expect(mockRoom.connect).toHaveBeenCalledWith(config1.serverUrl, config1.token);

    // Simulate connected state
    act(() => {
      const connectedHandler = mockRoom.on.mock.calls.find(call => call[0] === 'connected')?.[1];
      if (connectedHandler) connectedHandler();
    });

    expect(result.current.isConnected).toBe(true);

    // Second connection attempt (should disconnect first)
    await act(async () => {
      await result.current.connect(config2);
    });

    expect(mockRoom.disconnect).toHaveBeenCalled();
    expect(mockRoom.connect).toHaveBeenCalledWith(config2.serverUrl, config2.token);
  });

  it('should handle connection while already connecting', async () => {
    const { result } = renderHook(() => useLiveKit());

    const config = {
      serverUrl: 'ws://localhost:7880',
      token: 'token1',
    };

    // Make connect hang to simulate slow connection
    let resolveConnect: (value?: unknown) => void;
    mockRoom.connect.mockImplementation(() => new Promise(resolve => {
      resolveConnect = resolve;
    }));

    // Start first connection
    act(() => {
      result.current.connect(config);
    });

    expect(result.current.isConnecting).toBe(true);

    // Try to connect again while first is still connecting
    await act(async () => {
      await result.current.connect(config);
    });

    // Second call should return immediately without doing anything
    expect(result.current.isConnecting).toBe(true);

    // Complete the first connection
    act(() => {
      resolveConnect();
    });
  });

  it('should clean up properly on disconnect', async () => {
    const { result } = renderHook(() => useLiveKit());

    const config = {
      serverUrl: 'ws://localhost:7880',
      token: 'token1',
    };

    // Connect
    await act(async () => {
      await result.current.connect(config);
    });

    // Simulate connected state
    act(() => {
      const connectedHandler = mockRoom.on.mock.calls.find(call => call[0] === 'connected')?.[1];
      if (connectedHandler) connectedHandler();
    });

    expect(result.current.isConnected).toBe(true);

    // Disconnect
    act(() => {
      result.current.disconnect();
    });

    expect(mockRoom.disconnect).toHaveBeenCalled();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.participants).toEqual([]);
    expect(result.current.isMicrophoneEnabled).toBe(false);
    expect(result.current.raisedHands.size).toBe(0);
    expect(result.current.isHandRaised).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should handle unexpected disconnection', async () => {
    const { result } = renderHook(() => useLiveKit());

    const config = {
      serverUrl: 'ws://localhost:7880',
      token: 'token1',
    };

    // Connect
    await act(async () => {
      await result.current.connect(config);
    });

    // Simulate connected state
    act(() => {
      const connectedHandler = mockRoom.on.mock.calls.find(call => call[0] === 'connected')?.[1];
      if (connectedHandler) connectedHandler();
    });

    expect(result.current.isConnected).toBe(true);

    // Simulate unexpected disconnection
    act(() => {
      const disconnectedHandler = mockRoom.on.mock.calls.find(call => call[0] === 'disconnected')?.[1];
      if (disconnectedHandler) disconnectedHandler('network error');
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBe('Connection lost. You may need to rejoin.');
  });
});