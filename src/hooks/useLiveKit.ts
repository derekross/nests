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
    
    console.log('LiveKit connecting with config:', {
      serverUrl: config.serverUrl,
      hasToken: !!config.token,
      tokenLength: config.token?.length
    });
    
    setIsConnecting(true);
    setError(null);
    
    try {
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        // Add audio-specific options
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      
      // Enhanced event listeners with debugging
      newRoom.on(RoomEvent.Connected, () => {
        console.log('LiveKit room connected successfully');
        setIsConnected(true);
        setIsConnecting(false);
      });
      
      newRoom.on(RoomEvent.Disconnected, (reason) => {
        console.log('LiveKit room disconnected:', reason);
        setIsConnected(false);
        setParticipants([]);
        setRaisedHands(new Set());
        setIsHandRaised(false);
      });
      
      newRoom.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
        console.log('Connection quality changed:', quality, participant?.identity);
      });
      
      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log('Participant connected:', participant.identity);
        setParticipants(prev => [...prev, participant]);
      });
      
      newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        console.log('Participant disconnected:', participant.identity);
        setParticipants(prev => prev.filter(p => p.sid !== participant.sid));
        setRaisedHands(prev => {
          const newSet = new Set(prev);
          newSet.delete(participant.sid);
          return newSet;
        });
      });
      
      newRoom.on(RoomEvent.LocalTrackPublished, (track) => {
        console.log('Local track published:', track.source, 'muted:', track.isMuted);
        if (track.source === Track.Source.Microphone) {
          setIsMicrophoneEnabled(!track.isMuted);
        }
      });
      
      newRoom.on(RoomEvent.LocalTrackUnpublished, (track) => {
        console.log('Local track unpublished:', track.source);
        if (track.source === Track.Source.Microphone) {
          setIsMicrophoneEnabled(false);
        }
      });
      
      newRoom.on(RoomEvent.TrackMuted, (track, participant) => {
        console.log('Track muted:', track.source, participant?.identity);
      });
      
      newRoom.on(RoomEvent.TrackUnmuted, (track, participant) => {
        console.log('Track unmuted:', track.source, participant?.identity);
      });
      
      // Handle audio device errors
      newRoom.on(RoomEvent.MediaDevicesError, (error) => {
        console.error('Media devices error:', error);
        setError(`Audio device error: ${error.message}`);
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
      console.log('Attempting to connect to LiveKit room...');
      await newRoom.connect(config.serverUrl, config.token);
      console.log('LiveKit room connection established');
      
      setRoom(newRoom);
      
      // Update participants list
      const allParticipants = [newRoom.localParticipant, ...Array.from(newRoom.remoteParticipants.values())];
      setParticipants(allParticipants);
      
      console.log('Initial participants:', allParticipants.length);
      
    } catch (err) {
      console.error('LiveKit connection failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to room');
      setIsConnecting(false);
    }
  }, [isConnecting, isConnected]);

  const disconnect = useCallback(() => {
    if (room) {
      console.log('Disconnecting from LiveKit room');
      room.disconnect();
      setRoom(null);
      setIsConnected(false);
      setParticipants([]);
      setIsMicrophoneEnabled(false);
      setRaisedHands(new Set());
      setIsHandRaised(false);
      setError(null);
    }
  }, [room]);

  const toggleMicrophone = useCallback(async () => {
    if (!room?.localParticipant) {
      console.warn('Cannot toggle microphone: no local participant');
      return;
    }
    
    try {
      const micTrack = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      
      console.log('Toggling microphone:', {
        hasMicTrack: !!micTrack,
        currentlyMuted: micTrack?.isMuted,
        currentState: isMicrophoneEnabled
      });
      
      if (micTrack) {
        const newMutedState = !micTrack.isMuted;
        await room.localParticipant.setMicrophoneEnabled(!newMutedState);
        setIsMicrophoneEnabled(!newMutedState);
        console.log('Microphone toggled to:', !newMutedState);
      } else {
        // Enable microphone for the first time
        console.log('Enabling microphone for the first time');
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsMicrophoneEnabled(true);
      }
    } catch (error) {
      console.error('Failed to toggle microphone:', error);
      setError(`Microphone error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [room, isMicrophoneEnabled]);

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