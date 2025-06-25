import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useNest, useNestChat } from '@/hooks/useNests';
import { useLiveKit } from '@/hooks/useLiveKit';
import { useNestPresence } from '@/hooks/useNestPresence';
import { useJoinNest, useJoinNestAsGuest } from '@/hooks/useNestsApi';
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
  
  const { user } = useCurrentUser();
  const { mutate: createEvent } = useNostrPublish();
  const { data: nest } = useNest(nestNaddr);
  const { data: chatMessages = [] } = useNestChat(nestNaddr);
  
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

  // Find LiveKit URL
  const liveKitUrl = streamingUrls.find(url => url.startsWith('wss+livekit://'))?.replace('wss+livekit://', 'wss://');

  const handleJoinNest = async () => {
    if (!roomId || !liveKitUrl) return;
    
    setIsConnecting(true);
    setJoinError(null);
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
      } else {
        const response = await joinNestAsGuest(roomId);
        token = response.token;
      }

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
        if (err.message.includes('Not Found') || err.message.includes('404')) {
          setJoinError('This nest is no longer available. It may have been closed or deleted.');
        } else if (err.message.includes('Unauthorized') || err.message.includes('401')) {
          setJoinError('You are not authorized to join this nest.');
        } else if (err.message.includes('Forbidden') || err.message.includes('403')) {
          setJoinError('This nest is private or you do not have permission to join.');
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

  const handleSendMessage = () => {
    if (!chatMessage.trim() || !user) return;

    createEvent({
      kind: 1311,
      content: chatMessage,
      tags: [
        ['a', nestNaddr, '', 'root']
      ],
    });

    setChatMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
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
                    <Button 
                      onClick={handleLeaveNest}
                      variant="outline"
                      size="sm"
                    >
                      Back to Nests
                    </Button>
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
              <h3 className="font-semibold">Chat</h3>
            </div>
            
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {chatMessages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
              </div>
            </ScrollArea>

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