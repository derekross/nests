import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { Input } from '@/components/ui/input';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { useNest, useNestChat } from '@/hooks/useNests';
import { useLiveKit } from '@/hooks/useLiveKit';
import { useNestPresence } from '@/hooks/useNestPresence';
import { useJoinNest, useJoinNestAsGuest, useRestartNest, useDeleteNest } from '@/hooks/useNestsApi';
import { genUserName } from '@/lib/genUserName';
import { 
  Mic, 
  MicOff, 
  Hand, 
  Users, 
  MessageCircle, 
  Send
} from 'lucide-react';
import { NoteContent } from '@/components/NoteContent';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NestHostSettings } from '@/components/NestHostSettings';
import { EditNestDialog } from '@/components/EditNestDialog';

import type { NostrEvent } from '@nostrify/nostrify';

interface NestRoomProps {
  nestNaddr: string;
  onLeave: () => void;
}

export function NestRoom({ nestNaddr, onLeave }: NestRoomProps) {
  const [chatMessage, setChatMessage] = useState('');
  const [showChat, setShowChat] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  const { user } = useCurrentUser();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: nest } = useNest(nestNaddr);
  const { data: chatMessages = [] } = useNestChat(nestNaddr);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatScrollRef.current) {
      const scrollElement = chatScrollRef.current;
      const isScrolledToBottom = scrollElement.scrollHeight - scrollElement.clientHeight <= scrollElement.scrollTop + 1;
      
      // Only auto-scroll if user is already at the bottom (don't interrupt reading)
      if (isScrolledToBottom || chatMessages.length === 1) {
        setTimeout(() => {
          scrollElement.scrollTo({
            top: scrollElement.scrollHeight,
            behavior: 'smooth'
          });
        }, 100);
      }
    }
  }, [chatMessages]);
  
  const {
    isConnected,
    error,
    participants,
    connect,
    disconnect,
    toggleMicrophone,
    isMicrophoneEnabled,
    raisedHands,
    toggleRaisedHand,
    isHandRaised,
  } = useLiveKit();

  const { mutateAsync: joinNest } = useJoinNest();
  const { mutateAsync: joinNestAsGuest } = useJoinNestAsGuest();
  const { mutateAsync: restartNest, isPending: isRestarting } = useRestartNest();
  const { mutateAsync: deleteNest, isPending: isDeleting } = useDeleteNest();

  // Manage presence
  useNestPresence({
    nestNaddr,
    isInNest: isConnected,
    isHandRaised,
  });

  // Extract nest data
  const roomName = nest?.tags.find(([name]) => name === 'room')?.[1] || 'Nest';
  const summary = nest?.tags.find(([name]) => name === 'summary')?.[1];
  const streamingUrls = nest?.tags.filter(([name]) => name === 'streaming').map(([, url]) => url) || [];
  const roomId = nest?.tags.find(([name]) => name === 'd')?.[1];
  const currentStatus = nest?.tags.find(([name]) => name === 'status')?.[1] || 'closed';
  
  // Check if current user is the host
  const isHost = user && nest && nest.pubkey === user.pubkey;

  // Find LiveKit URL and convert for local development
  const rawLiveKitUrl = streamingUrls.find(url => url.startsWith('wss+livekit://'));
  const liveKitUrl = rawLiveKitUrl 
    ? rawLiveKitUrl
        .replace('wss+livekit://', 'ws://') // Use ws:// for local dev
        .replace('livekit:7880', 'localhost:7880') // Use localhost instead of container name
    : undefined;
  
  console.log('LiveKit URL conversion:', {
    raw: rawLiveKitUrl,
    converted: liveKitUrl,
    isDev: process.env.NODE_ENV !== 'production'
  });

  const handleJoinNest = async () => {
    if (!roomId || !liveKitUrl) return;
    
    setIsConnecting(true);
    setJoinError(null);
    
    // Check microphone permissions before connecting
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone permission granted');
      stream.getTracks().forEach(track => track.stop()); // Clean up test stream
    } catch (permError) {
      console.warn('Microphone permission denied or not available:', permError);
      setJoinError('Microphone access is required for audio. Please allow microphone permissions and try again.');
      setIsConnecting(false);
      return;
    }
    
    try {
      let token: string;
      
      console.log('Attempting to join nest:', {
        roomId,
        liveKitUrl,
        nestNaddr,
        user: user ? 'logged in' : 'guest'
      });
      
      if (user) {
        const response = await joinNest(roomId);
        token = response.token;
        console.log('Join nest response:', { tokenType: typeof token, token });
      } else {
        const response = await joinNestAsGuest(roomId);
        token = response.token;
        console.log('Join nest as guest response:', { tokenType: typeof token, token });
      }

      console.log('Connecting with join token:', {
        serverUrl: liveKitUrl,
        tokenType: typeof token,
        hasToken: !!token
      });

      await connect({
        serverUrl: liveKitUrl,
        token,
      });
    } catch (err) {
      console.error('Failed to join nest:', err);
      console.error('Nest details:', {
        roomId,
        liveKitUrl,
        nestNaddr,
        nestTags: nest?.tags
      });
      
      // Set user-friendly error message
      if (err instanceof Error) {
        if (err.message.includes('Not Found') || err.message.includes('404') || err.message.includes('no longer active')) {
          setJoinError('This nest is no longer available. The audio session may have timed out or been closed.');
        } else if (err.message.includes('Unauthorized') || err.message.includes('401')) {
          setJoinError('You are not authorized to join this nest.');
        } else if (err.message.includes('Forbidden') || err.message.includes('403')) {
          setJoinError('This nest is private or you do not have permission to join.');
        } else if (err.message.includes('timeout') || err.message.includes('network')) {
          setJoinError('Connection timeout. Please check your internet connection and try again.');
        } else {
          setJoinError(`Failed to join nest: ${err.message}`);
        }
      } else {
        setJoinError('An unexpected error occurred while joining the nest.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLeaveNest = () => {
    disconnect();
    onLeave();
  };

  const handleRestartNest = async () => {
    if (!roomId || !isHost) return;
    
    setIsConnecting(true);
    setJoinError(null);
    
    // Disconnect from current session first
    if (isConnected) {
      disconnect();
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Check microphone permissions before restarting
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone permission granted for restart');
      stream.getTracks().forEach(track => track.stop()); // Clean up test stream
    } catch (permError) {
      console.warn('Microphone permission denied during restart:', permError);
      setJoinError('Microphone access is required for audio. Please allow microphone permissions and try again.');
      setIsConnecting(false);
      return;
    }
    
    try {
      console.log('Restarting nest:', { roomId, isHost });
      
      const response = await restartNest(roomId);
      
      console.log('Nest restart response:', response);
      
      // Wait a moment for the new room to be fully ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // After successful restart, automatically connect
      // Debug the token issue
      console.log('Raw restart response:', response);
      console.log('Token analysis:', {
        tokenExists: 'token' in response,
        tokenType: typeof response.token,
        tokenValue: response.token,
        tokenStringified: JSON.stringify(response.token),
        tokenKeys: response.token ? Object.keys(response.token) : 'N/A'
      });
      
      // Ensure token is a string (safeguard against API returning object)
      let token;
      if (typeof response.token === 'string' && response.token.length > 0) {
        token = response.token;
      } else if (response.token && typeof response.token === 'object') {
        // If it's an object, try to extract the JWT string
        const tokenObj = response.token as Record<string, unknown>;
        token = (tokenObj.jwt as string) || (tokenObj.token as string) || JSON.stringify(response.token);
      } else {
        throw new Error('Invalid token received from restart API');
      }
      
      console.log('Final token for connection:', {
        tokenType: typeof token,
        tokenLength: token.length,
        tokenPreview: token.substring(0, 50) + '...'
      });
      
      await connect({
        serverUrl: liveKitUrl!,
        token: token,
      });
      
      console.log('Nest restarted and connected successfully');
      
      toast({
        title: "Nest Restarted",
        description: "Your nest has been successfully restarted and you're now connected.",
        duration: 5000,
      });
    } catch (err) {
      console.error('Failed to restart nest:', err);
      
      if (err instanceof Error) {
        if (err.message.includes('Only the host')) {
          setJoinError('Only the nest host can restart the session.');
        } else if (err.message.includes('404') || err.message.includes('Not Found')) {
          setJoinError('Nest data not found. The nest may have been deleted.');
        } else {
          setJoinError(`Failed to restart nest: ${err.message}`);
        }
      } else {
        setJoinError('An unexpected error occurred while restarting the nest.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !user) return;

    try {
      await createEvent({
        kind: 1311,
        content: chatMessage,
        tags: [
          ['a', nestNaddr, '', 'root']
        ],
      });

      setChatMessage('');
      
      // Invalidate chat query to show new message immediately
      queryClient.invalidateQueries({ queryKey: ['nest-chat', nestNaddr] });
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: "Message Failed",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleUpdateStatus = async (status: 'open' | 'private' | 'closed') => {
    if (!nest || !user) return;

    try {
      // Update the nest event with new status
      const d = nest.tags.find(([name]) => name === 'd')?.[1];
      if (!d) throw new Error('Nest identifier not found');

      // Preserve all existing tags except status
      const existingTags = nest.tags.filter(([name]) => name !== 'status');
      const newTags = [...existingTags, ['status', status]];

      const updatedEvent = await createEvent({
        kind: 30312,
        content: nest.content,
        tags: newTags,
      });

      // Invalidate and refetch the nest query to show updated status
      queryClient.invalidateQueries({ queryKey: ['nest', nestNaddr] });
      queryClient.invalidateQueries({ queryKey: ['nests'] });

      // Update the cache directly with the new event
      queryClient.setQueryData(['nest', nestNaddr], updatedEvent);

      toast({
        title: "Status Updated",
        description: `Nest status changed to ${status}.`,
      });
    } catch (error) {
      console.error('Failed to update status:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update nest status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteNest = async () => {
    if (!roomId || !nest) return;

    try {
      // Delete from API first
      await deleteNest(roomId);

      // Then delete the Nostr event by publishing a deletion event (kind 5)
      setIsDeletingEvent(true);
      await createEvent({
        kind: 5,
        content: 'Nest deleted',
        tags: [
          ['e', nest.id],
          ['a', `30312:${nest.pubkey}:${nest.tags.find(([name]) => name === 'd')?.[1]}`]
        ],
      });

      // Invalidate queries to remove the nest from the UI
      queryClient.invalidateQueries({ queryKey: ['nest', nestNaddr] });
      queryClient.invalidateQueries({ queryKey: ['nests'] });

      toast({
        title: "Nest Deleted",
        description: "Your nest has been successfully deleted.",
      });

      // Leave the nest
      onLeave();
    } catch (error) {
      console.error('Failed to delete nest:', error);
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete nest. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingEvent(false);
    }
  };

  const handleEditNest = () => {
    setShowEditDialog(true);
  };

  const handleNestUpdated = () => {
    // Additional invalidation to ensure the room reflects changes immediately
    queryClient.invalidateQueries({ queryKey: ['nest', nestNaddr] });
    queryClient.invalidateQueries({ queryKey: ['nests'] });
  };



  if (!nest) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading nest...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b bg-gradient-purple-soft p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gradient-purple">{roomName}</h1>
            {summary && (
              <p className="text-muted-foreground">{summary}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Badge 
              variant={isConnected ? "default" : "secondary"}
              className={isConnected ? "bg-green-500 hover:bg-green-600" : ""}
            >
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
            {isHost && (
              <NestHostSettings
                currentStatus={currentStatus}
                isUpdatingStatus={false}
                isRestarting={isRestarting}
                isDeleting={isDeleting}
                isDeletingEvent={isDeletingEvent}
                isConnecting={isConnecting}
                onUpdateStatus={handleUpdateStatus}
                onRestart={handleRestartNest}
                onDelete={handleDeleteNest}
                onEdit={handleEditNest}
                roomName={roomName}
              />
            )}
            <Button variant="outline" onClick={handleLeaveNest}>
              Leave Nest
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Main content */}
        <div className="flex-1 flex flex-col">
          {/* Connection status */}
          {!isConnected && (
            <div className="p-4 bg-muted/50">
              <div className="text-center">
                {(error || joinError) && (
                  <div className="text-red-600 mb-4 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="font-medium mb-1">Connection Error</p>
                    <p className="text-sm">{joinError || error}</p>
                    {joinError?.includes('no longer available') && (
                      <div className="text-xs mt-2 text-red-500 space-y-1">
                        <p>This usually happens when:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1">
                          <li>The nest session has ended</li>
                          <li>The host hasn't started the audio server yet</li>
                          <li>There's a sync issue between Nostr and the audio service</li>
                        </ul>
                        <p className="mt-2">Try refreshing the page or contact the nest host.</p>
                        <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                          <p className="text-xs font-medium">Debug Info:</p>
                          <p className="text-xs">Room ID: {roomId}</p>
                          <p className="text-xs">API Base: {process.env.NODE_ENV === 'production' ? 'https://nostrnests.com/api/v1/nests' : 'http://localhost:5544/api/v1/nests'}</p>
                          <p className="text-xs">Nest found on Nostr: {nest ? 'Yes' : 'No'}</p>
                          <p className="text-xs">LiveKit URL: {liveKitUrl ? 'Found' : 'Missing'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-3">
                  <Button 
                    onClick={handleJoinNest}
                    disabled={isConnecting || !liveKitUrl}
                    size="lg"
                    className="bg-gradient-purple hover:opacity-90 glow-purple"
                  >
                    {isConnecting ? 'Connecting...' : 'Join Audio'}
                  </Button>
                  
                  {joinError && (
                    <div className="flex gap-2">
                      {isHost && (joinError.includes('no longer available') || joinError.includes('no longer active') || joinError.includes('timed out')) && (
                        <Button 
                          onClick={handleRestartNest}
                          disabled={isRestarting || isConnecting}
                          variant="default"
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {isRestarting ? 'Restarting...' : 'Restart Nest'}
                        </Button>
                      )}
                      {!isHost && (joinError.includes('no longer available') || joinError.includes('timeout')) && (
                        <Button 
                          onClick={handleJoinNest}
                          disabled={isConnecting}
                          variant="default"
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {isConnecting ? 'Retrying...' : 'Retry Connection'}
                        </Button>
                      )}
                      <Button 
                        onClick={handleLeaveNest}
                        variant="outline"
                        size="sm"
                      >
                        Back to Nests
                      </Button>
                    </div>
                  )}
                </div>
                {!liveKitUrl && (
                  <p className="text-sm text-muted-foreground mt-2">
                    No LiveKit URL found for this nest
                  </p>
                )}
                {roomId && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Room ID: {roomId}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Participants */}
          <div className="flex-1 p-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Participants ({participants.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {participants.map((participant) => (
                  <ParticipantCard 
                    key={participant.sid}
                    participant={participant}
                    isHandRaised={raisedHands.has(participant.sid)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Controls */}
          {isConnected && (
            <div className="border-t p-4">
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant={isMicrophoneEnabled ? "default" : "secondary"}
                  size="lg"
                  onClick={toggleMicrophone}
                  className={`rounded-full w-12 h-12 ${isMicrophoneEnabled ? 'bg-gradient-purple glow-purple' : ''}`}
                >
                  {isMicrophoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </Button>
                
                <Button
                  variant={isHandRaised ? "default" : "outline"}
                  size="lg"
                  onClick={toggleRaisedHand}
                  className={`rounded-full w-12 h-12 ${isHandRaised ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : ''}`}
                >
                  <Hand className="h-5 w-5" />
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setShowChat(!showChat)}
                  className="rounded-full w-12 h-12 hover:bg-primary/10"
                >
                  <MessageCircle className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Chat sidebar */}
        {showChat && (
          <div className="w-80 border-l flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Chat</h3>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs text-muted-foreground">Live</span>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <div 
                ref={chatScrollRef}
                className="h-full overflow-y-auto p-4 space-y-4"
              >
                {chatMessages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs">Start the conversation!</p>
                  </div>
                ) : (
                  chatMessages.map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))
                )}
              </div>
            </div>

            {user && (
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!chatMessage.trim()}
                    size="sm"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Nest Dialog */}
      {nest && (
        <EditNestDialog
          isOpen={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          nest={nest}
          onNestUpdated={handleNestUpdated}
        />
      )}
    </div>
  );
}

function ParticipantCard({ participant, isHandRaised }: { 
  participant: {
    identity?: string;
    sid: string;
    isSpeaking?: boolean;
    getTrackPublication?: (source: string) => { isMuted?: boolean } | undefined;
  }; 
  isHandRaised: boolean; 
}) {
  // Extract pubkey from participant identity (if available)
  const pubkey = participant.identity || participant.sid;
  const author = useAuthor(pubkey);
  const displayName = author.data?.metadata?.name || genUserName(pubkey);
  const avatar = author.data?.metadata?.picture;

  const isSpeaking = participant.isSpeaking;
  const isMuted = participant.getTrackPublication?.('microphone')?.isMuted ?? true;

  return (
    <Card className={`p-3 transition-all duration-200 ${isHandRaised ? 'ring-2 ring-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' : 'hover:shadow-md hover:shadow-primary/10'}`}>
      <div className="flex flex-col items-center text-center space-y-2">
        <div className="relative">
          <Avatar className="h-12 w-12 ring-2 ring-primary/20">
            <AvatarImage src={avatar} />
            <AvatarFallback className="bg-gradient-purple text-white">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isSpeaking && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
          )}
          {isHandRaised && (
            <div className="absolute -top-1 -right-1 animate-bounce">
              <Hand className="h-4 w-4 text-yellow-500" />
            </div>
          )}
        </div>
        <div className="min-w-0 w-full">
          <p className="text-sm font-medium truncate">{displayName}</p>
          <div className="flex items-center justify-center gap-1 mt-1">
            {isMuted ? (
              <MicOff className="h-3 w-3 text-muted-foreground" />
            ) : (
              <Mic className="h-3 w-3 text-green-600" />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ChatMessage({ message }: { message: NostrEvent }) {
  const author = useAuthor(message.pubkey);
  const displayName = author.data?.metadata?.name || genUserName(message.pubkey);
  const avatar = author.data?.metadata?.picture;

  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={avatar} />
        <AvatarFallback className="text-xs">
          {displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{displayName}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(message.created_at * 1000).toLocaleTimeString()}
          </span>
        </div>
        <div className="text-sm">
          <NoteContent event={message} />
        </div>
      </div>
    </div>
  );
}