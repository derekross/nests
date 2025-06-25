import { useState, useEffect, useCallback } from 'react';
import { Room, RoomEvent, RemoteParticipant, LocalParticipant, Track } from 'livekit-client';

interface LiveKitConfig {
  serverUrl: string;
  token: string;
}

interface UseLiveKitReturn {
  room: Room | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  participants: (RemoteParticipant | LocalParticipant)[];
  localParticipant: LocalParticipant | null;
  connect: (config: LiveKitConfig) => Promise<void>;
  disconnect: () => void;
  toggleMicrophone: () => Promise<void>;
  isMicrophoneEnabled: boolean;
  raisedHands: Set<string>;
  toggleRaisedHand: () => void;
  isHandRaised: boolean;
}

export function useLiveKit(): UseLiveKitReturn {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<(RemoteParticipant | LocalParticipant)[]>([]);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const [isHandRaised, setIsHandRaised] = useState(false);
  


  const connect = useCallback(async (config: LiveKitConfig) => {
    if (isConnecting || isConnected) return;
    
    setIsConnecting(true);
    setError(null);
    
    try {
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      
      // Set up event listeners
      newRoom.on(RoomEvent.Connected, () => {
        setIsConnected(true);
        setIsConnecting(false);
      });
      
      newRoom.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
        setParticipants([]);
        setRaisedHands(new Set());
        setIsHandRaised(false);
      });
      
      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        setParticipants(prev => [...prev, participant]);
      });
      
      newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        setParticipants(prev => prev.filter(p => p.sid !== participant.sid));
        setRaisedHands(prev => {
          const newSet = new Set(prev);
          newSet.delete(participant.sid);
          return newSet;
        });
      });
      
      newRoom.on(RoomEvent.LocalTrackPublished, (track) => {
        if (track.source === Track.Source.Microphone) {
          setIsMicrophoneEnabled(!track.isMuted);
        }
      });
      
      newRoom.on(RoomEvent.LocalTrackUnpublished, (track) => {
        if (track.source === Track.Source.Microphone) {
          setIsMicrophoneEnabled(false);
        }
      });
      
      // Handle metadata updates for raised hands
      newRoom.on(RoomEvent.ParticipantMetadataChanged, (metadata, participant) => {
        if (metadata) {
          try {
            const data = JSON.parse(metadata);
            setRaisedHands(prev => {
              const newSet = new Set(prev);
              if (data.handRaised) {
                newSet.add(participant.sid);
              } else {
                newSet.delete(participant.sid);
              }
              return newSet;
            });
          } catch {
            // Ignore invalid metadata
          }
        }
      });
      
      // Connect to the room
      await newRoom.connect(config.serverUrl, config.token);
      setRoom(newRoom);
      
      // Update participants list
      const allParticipants = [newRoom.localParticipant, ...Array.from(newRoom.remoteParticipants.values())];
      setParticipants(allParticipants);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to room');
      setIsConnecting(false);
    }
  }, [isConnecting, isConnected]);

  const disconnect = useCallback(() => {
    if (room) {
      room.disconnect();
      setRoom(null);
    }
  }, [room]);

  const toggleMicrophone = useCallback(async () => {
    if (!room?.localParticipant) return;
    
    const micTrack = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    
    if (micTrack) {
      await room.localParticipant.setMicrophoneEnabled(!micTrack.isMuted);
      setIsMicrophoneEnabled(!micTrack.isMuted);
    } else {
      // Enable microphone for the first time
      await room.localParticipant.setMicrophoneEnabled(true);
      setIsMicrophoneEnabled(true);
    }
  }, [room]);

  const toggleRaisedHand = useCallback(async () => {
    if (!room?.localParticipant) return;
    
    const newHandRaised = !isHandRaised;
    setIsHandRaised(newHandRaised);
    
    // Update participant metadata
    const metadata = JSON.stringify({ handRaised: newHandRaised });
    await room.localParticipant.setMetadata(metadata);
  }, [room, isHandRaised]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  return {
    room,
    isConnected,
    isConnecting,
    error,
    participants,
    localParticipant: room?.localParticipant || null,
    connect,
    disconnect,
    toggleMicrophone,
    isMicrophoneEnabled,
    raisedHands,
    toggleRaisedHand,
    isHandRaised,
  };
}