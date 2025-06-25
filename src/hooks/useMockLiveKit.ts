import { useState, useCallback } from 'react';

/**
 * Mock LiveKit hook for development/testing without a LiveKit server
 * Replace useLiveKit import with this for testing UI without backend
 */
export function useMockLiveKit() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<{
    sid: string;
    identity: string;
    isSpeaking: boolean;
    getTrackPublication: () => { isMuted: boolean };
  }[]>([]);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const [isHandRaised, setIsHandRaised] = useState(false);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    
    // Simulate connection delay
    setTimeout(() => {
      setIsConnected(true);
      setIsConnecting(false);
      
      // Add mock participants
      setParticipants([
        {
          sid: 'mock-user-1',
          identity: 'npub1mock1',
          isSpeaking: false,
          getTrackPublication: () => ({ isMuted: true }),
        },
        {
          sid: 'mock-user-2', 
          identity: 'npub1mock2',
          isSpeaking: true,
          getTrackPublication: () => ({ isMuted: false }),
        },
      ]);
    }, 1000);
  }, []);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setParticipants([]);
    setRaisedHands(new Set());
    setIsHandRaised(false);
  }, []);

  const toggleMicrophone = useCallback(async () => {
    setIsMicrophoneEnabled(!isMicrophoneEnabled);
  }, [isMicrophoneEnabled]);

  const toggleRaisedHand = useCallback(async () => {
    setIsHandRaised(!isHandRaised);
  }, [isHandRaised]);

  return {
    room: null,
    isConnected,
    isConnecting,
    error,
    participants,
    localParticipant: null,
    connect,
    disconnect,
    toggleMicrophone,
    isMicrophoneEnabled,
    raisedHands,
    toggleRaisedHand,
    isHandRaised,
  };
}