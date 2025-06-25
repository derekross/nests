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
import { useJoinNestSmart, useRestartNest, useDeleteNest, useApiDiagnostics } from '@/hooks/useNestsApi';
import { useIsMobile } from '@/hooks/useIsMobile';
import { genUserName } from '@/lib/genUserName';
import { 
  Mic, 
  MicOff, 
  Hand, 
  Users, 
  MessageCircle, 
  Send,
  User
} from 'lucide-react';
import { NoteContent } from '@/components/NoteContent';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NestHostSettings } from '@/components/NestHostSettings';
import { EditNestDialog } from '@/components/EditNestDialog';
import { LoginArea } from '@/components/auth/LoginArea';
import { ModerationPanel } from '@/components/ModerationPanel';
import { SpeakingControls } from '@/components/SpeakingControls';
import { SpeakingNotifications } from '@/components/SpeakingNotifications';

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

  const { mutateAsync: joinNestSmart } = useJoinNestSmart();
  const { mutateAsync: runDiagnostics, isPending: isDiagnosticsPending } = useApiDiagnostics();
  const { mutateAsync: restartNest, isPending: isRestarting } = useRestartNest();
  const { mutateAsync: deleteNest, isPending: isDeleting } = useDeleteNest();
  const isMobile = useIsMobile();

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
      console.log('Attempting to join nest:', {
        roomId,
        liveKitUrl,
        nestNaddr,
        user: user ? 'logged in' : 'guest',
        nestStatus: currentStatus,
        nestCreatedAt: nest?.created_at,
        timeSinceCreated: nest ? Math.floor(Date.now() / 1000) - nest.created_at : 'unknown'
      });
      
      // Use smart join that tries authenticated first, then falls back to guest
      const response = await joinNestSmart(roomId);
      const token = response.token;
      
      console.log('Smart join response:', { 
        joinType: response.joinType,
        tokenType: typeof token, 
        hasToken: !!token,
        debugInfo: response.debugInfo
      });

      console.log('Connecting with join token:', {
        serverUrl: liveKitUrl,
        tokenType: typeof token,
        hasToken: !!token,
        joinMethod: response.joinType
      });

      await connect({
        serverUrl: liveKitUrl,
        token,
      });
      
      // Show a toast if user was joined as guest when they expected authenticated access
      if (user && response.joinType === 'guest') {
        toast({
          title: "Joined as Guest",
          description: "You were connected as a guest. Some features may be limited.",
          duration: 5000,
        });
      }
    } catch (err) {
      console.error('Failed to join nest:', err);
      console.error('Nest details:', {
        roomId,
        liveKitUrl,
        nestNaddr,
        nestTags: nest?.tags,
        nestStatus: currentStatus,
        nestCreatedAt: nest?.created_at,
        timeSinceCreated: nest ? Math.floor(Date.now() / 1000) - nest.created_at : 'unknown'
      });
      
      // Set user-friendly error message
      if (err instanceof Error) {
        if (err.message.includes('Not Found') || err.message.includes('404') || err.message.includes('no longer active')) {
          // Check if this is a timing issue - nest was just created
          const timeSinceCreated = nest ? Math.floor(Date.now() / 1000) - nest.created_at : 0;
          if (timeSinceCreated < 30) {
            setJoinError('The nest is still starting up. Please wait a moment and try again.');
          } else {
            setJoinError('This nest is no longer available. The audio session may have timed out or been closed.');
          }
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

  const handleRunDiagnostics = async () => {
    if (!roomId) return;
    
    try {
      console.log('🔧 Starting comprehensive diagnostics...');
      const diagnostics = await runDiagnostics(roomId);
      
      console.log('🔧 Diagnostics completed:', diagnostics);
      
      // Show detailed results in toast
      const { summary } = diagnostics;
      const status = summary.allPassed ? 'success' : 'warning';
      
      toast({
        title: `Diagnostics Complete (${summary.passedChecks}/${summary.totalChecks})`,
        description: `Room exists: ${summary.roomExists ? '✅' : '❌'} | Guest access: ${summary.guestAccessWorks ? '✅' : '❌'}`,
        variant: status === 'warning' ? 'destructive' : 'default',
        duration: 10000,
      });
      
      // If room exists but join is failing, suggest specific actions
      if (summary.roomExists && !summary.guestAccessWorks) {
        toast({
          title: "Room Found But Access Failed",
          description: "The room exists in the API but access is failing. This suggests an API/LiveKit sync issue.",
          variant: "destructive",
          duration: 15000,
        });
      }
      
    } catch (error) {
      console.error('🔧 Diagnostics failed:', error);
      toast({
        title: "Diagnostics Failed",
        description: "Check console for detailed error information.",
        variant: "destructive",
        duration: 5000,
      });
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
      {/* Speaking Notifications */}
      <SpeakingNotifications nestNaddr={nestNaddr} />
      
      {/* Header */}
      <div className="border-b bg-gradient-purple-soft p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-bold text-gradient-purple truncate">{roomName}</h1>
            {summary && (
              <p className="text-sm text-muted-foreground line-clamp-2 sm:line-clamp-1">{summary}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!isMobile && <ThemeToggle />}
            <Badge 
              variant={isConnected ? "default" : "secondary"}
              className={`text-xs ${isConnected ? "bg-green-500 hover:bg-green-600" : ""}`}
            >
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
            {isHost && (
              <>
                <ModerationPanel
                  nestNaddr={nestNaddr}
                  isHost={!!isHost}
                  participants={participants}
                />
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
              </>
            )}
            <Button variant="outline" onClick={handleLeaveNest} size={isMobile ? "sm" : "default"}>
              {isMobile ? 'Leave' : 'Leave Nest'}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile: Vertical layout, Desktop: Horizontal layout */}
      <div className={`flex-1 ${isMobile ? 'flex flex-col' : 'flex'}`}>
        {/* Voice Chat Section */}
        <div className={`${isMobile ? 'flex-1' : 'flex-1'} flex flex-col`}>
          {/* Connection status */}
          {!isConnected && (
            <div className="p-3 sm:p-4 bg-muted/50">
              <div className="text-center">
                {(error || joinError) && (
                  <div className="mb-4">
                    {/* Guest access denied - encourage sign in */}
                    {!user && joinError?.includes('Not Found') && (
                      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center justify-center mb-3">
                          <User className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                          Sign in to join this nest
                        </h3>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                          This nest requires you to be signed in to participate in the audio conversation. 
                          Sign in with your Nostr account to join the discussion.
                        </p>
                        <div className="space-y-3">
                          <LoginArea className="max-w-60 mx-auto" />
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            Don't have a Nostr account? The login dialog will help you get started.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {/* Other errors */}
                    {(user || !joinError?.includes('Not Found')) && (
                      <div className="text-red-600 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                        <p className="font-medium mb-1">Connection Error</p>
                        <p className="text-sm">{joinError || error}</p>
                        {joinError?.includes('no longer available') && !isMobile && (
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
                              <p className="text-xs">Nest Status: {currentStatus}</p>
                              <p className="text-xs">Created: {nest ? new Date(nest.created_at * 1000).toLocaleString() : 'Unknown'}</p>
                              <p className="text-xs">Age: {nest ? Math.floor((Date.now() / 1000) - nest.created_at) : 'Unknown'}s</p>
                              <div className="mt-2">
                                <Button
                                  onClick={handleRunDiagnostics}
                                  disabled={isDiagnosticsPending || !roomId}
                                  variant="outline"
                                  size="sm"
                                  className="text-xs"
                                >
                                  {isDiagnosticsPending ? 'Running...' : 'Run API Diagnostics'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-3">
                  {/* Show different button text based on user status */}
                  <Button 
                    onClick={handleJoinNest}
                    disabled={isConnecting || !liveKitUrl}
                    size={isMobile ? "default" : "lg"}
                    className="bg-gradient-purple hover:opacity-90 glow-purple w-full sm:w-auto"
                  >
                    {isConnecting ? 'Connecting...' : 'Join Audio'}
                  </Button>
                  
                  {/* Show sign-in encouragement for guests */}
                  {!user && !joinError && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-2">
                        For the best experience, sign in:
                      </p>
                      <LoginArea className="max-w-48 mx-auto" />
                    </div>
                  )}
                  
                  {joinError && (
                    <div className={`flex gap-2 ${isMobile ? 'flex-col' : 'flex-row'}`}>
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
                      {!isHost && (joinError.includes('no longer available') || joinError.includes('timeout') || joinError.includes('still starting up')) && (
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
                        onClick={handleRunDiagnostics}
                        disabled={isDiagnosticsPending || !roomId}
                        variant="outline"
                        size="sm"
                        className="bg-yellow-50 hover:bg-yellow-100 text-yellow-800 border-yellow-300"
                      >
                        {isDiagnosticsPending ? 'Diagnosing...' : 'Diagnose Issue'}
                      </Button>
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
                {roomId && !isMobile && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Room ID: {roomId}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Participants */}
          <div className="flex-1 p-3 sm:p-4 overflow-y-auto">
            <div className="mb-4">
              <h3 className="text-base sm:text-lg font-semibold mb-2 flex items-center gap-2">
                <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                Participants ({participants.length})
              </h3>
              <div className={`grid gap-3 sm:gap-4 ${isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
                {participants.map((participant) => (
                  <ParticipantCard 
                    key={participant.sid}
                    participant={participant}
                    isHandRaised={raisedHands.has(participant.sid)}
                    isMobile={isMobile}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Controls */}
          {isConnected && (
            <div className="border-t p-3 sm:p-4 bg-background">
              <div className="flex items-center justify-center gap-3 sm:gap-4">
                <SpeakingControls
                  nestNaddr={nestNaddr}
                  isHost={!!isHost}
                  isMicrophoneEnabled={isMicrophoneEnabled}
                  onToggleMicrophone={toggleMicrophone}
                  onRestartSession={handleRestartNest}
                />
                
                <Button
                  variant={isHandRaised ? "default" : "outline"}
                  size={isMobile ? "default" : "lg"}
                  onClick={toggleRaisedHand}
                  className={`rounded-full ${isMobile ? 'w-10 h-10' : 'w-12 h-12'} ${isHandRaised ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : ''}`}
                >
                  <Hand className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>

                <Button
                  variant={showChat ? "default" : "outline"}
                  size={isMobile ? "default" : "lg"}
                  onClick={() => setShowChat(!showChat)}
                  className={`rounded-full ${isMobile ? 'w-10 h-10' : 'w-12 h-12'} ${showChat ? 'bg-primary' : 'hover:bg-primary/10'}`}
                >
                  <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Chat Section */}
        {showChat && (
          <div className={`${isMobile ? 'h-80 border-t' : 'w-80 border-l'} flex flex-col bg-background`}>
            <div className="p-3 sm:p-4 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm sm:text-base">Chat</h3>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs text-muted-foreground">Live</span>
                  {isMobile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowChat(false)}
                      className="ml-2 h-6 w-6 p-0"
                    >
                      ×
                    </Button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <div 
                ref={chatScrollRef}
                className="h-full overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4"
              >
                {chatMessages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-6 sm:py-8">
                    <MessageCircle className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs sm:text-sm">No messages yet</p>
                    <p className="text-xs">Start the conversation!</p>
                  </div>
                ) : (
                  chatMessages.map((message) => (
                    <ChatMessage key={message.id} message={message} isMobile={isMobile} />
                  ))
                )}
              </div>
            </div>

            {user ? (
              <div className="p-3 sm:p-4 border-t bg-muted/30">
                <div className="flex gap-2">
                  <Input
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    className="flex-1 text-sm"
                  />
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!chatMessage.trim()}
                    size="sm"
                    className="px-3"
                  >
                    <Send className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-3 sm:p-4 border-t bg-muted/30">
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-sm">Sign in to join the chat</span>
                  </div>
                  <LoginArea className="max-w-48 mx-auto" />
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

function ParticipantCard({ participant, isHandRaised, isMobile }: { 
  participant: {
    identity?: string;
    sid: string;
    isSpeaking?: boolean;
    getTrackPublication?: (source: string) => { isMuted?: boolean } | undefined;
  }; 
  isHandRaised: boolean;
  isMobile?: boolean;
}) {
  // Extract pubkey from participant identity (if available)
  const pubkey = participant.identity || participant.sid;
  const author = useAuthor(pubkey);
  const displayName = author.data?.metadata?.name || genUserName(pubkey);
  const avatar = author.data?.metadata?.picture;

  const isSpeaking = participant.isSpeaking;
  const isMuted = participant.getTrackPublication?.('microphone')?.isMuted ?? true;

  return (
    <Card className={`${isMobile ? 'p-2' : 'p-3'} transition-all duration-200 ${isHandRaised ? 'ring-2 ring-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' : 'hover:shadow-md hover:shadow-primary/10'}`}>
      <div className={`flex flex-col items-center text-center ${isMobile ? 'space-y-1' : 'space-y-2'}`}>
        <div className="relative">
          <Avatar className={`${isMobile ? 'h-8 w-8' : 'h-12 w-12'} ring-2 ring-primary/20`}>
            <AvatarImage src={avatar} />
            <AvatarFallback className="bg-gradient-purple text-white text-xs">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isSpeaking && (
            <div className={`absolute -bottom-1 -right-1 ${isMobile ? 'w-3 h-3' : 'w-4 h-4'} bg-green-500 rounded-full border-2 border-white animate-pulse`} />
          )}
          {isHandRaised && (
            <div className="absolute -top-1 -right-1 animate-bounce">
              <Hand className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} text-yellow-500`} />
            </div>
          )}
        </div>
        <div className="min-w-0 w-full">
          <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium truncate`}>{displayName}</p>
          <div className="flex items-center justify-center gap-1 mt-1">
            {isMuted ? (
              <MicOff className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'} text-muted-foreground`} />
            ) : (
              <Mic className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'} text-green-600`} />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ChatMessage({ message, isMobile }: { message: NostrEvent; isMobile?: boolean }) {
  const author = useAuthor(message.pubkey);
  const displayName = author.data?.metadata?.name || genUserName(message.pubkey);
  const avatar = author.data?.metadata?.picture;

  return (
    <div className={`flex ${isMobile ? 'gap-2' : 'gap-3'}`}>
      <Avatar className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} flex-shrink-0`}>
        <AvatarImage src={avatar} />
        <AvatarFallback className="text-xs">
          {displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium truncate`}>{displayName}</span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {new Date(message.created_at * 1000).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        </div>
        <div className={`${isMobile ? 'text-xs' : 'text-sm'}`}>
          <NoteContent event={message} />
        </div>
      </div>
    </div>
  );
}