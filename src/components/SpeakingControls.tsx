import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSpeakingRequests } from '@/hooks/useSpeakingRequests';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { 
  Hand, 
  HandMetal, 
  Check, 
  X, 
  Clock,
  Mic,
  MicOff,
  UserCheck,
  UserMinus
} from 'lucide-react';

interface SpeakingControlsProps {
  nestNaddr: string;
  isHost: boolean;
  isMicrophoneEnabled: boolean;
  onToggleMicrophone: () => void;
  onRestartSession?: () => void;
}

export function SpeakingControls({ 
  nestNaddr, 
  isHost, 
  isMicrophoneEnabled, 
  onToggleMicrophone,
  onRestartSession 
}: SpeakingControlsProps) {
  const { user } = useCurrentUser();
  const [showInvitationDialog, setShowInvitationDialog] = useState(false);
  
  const {
    requestToSpeak,
    cancelSpeakingRequest,
    acceptSpeakingInvitation,
    declineSpeakingInvitation,
    removeSpeakingCapability,
    hasActiveSpeakingPermission,
    hasPendingSpeakingRequest,
    hasRequestDenied,
    hasPendingSpeakingInvitation,
    getUserSpeakingInvitation,
  } = useSpeakingRequests(nestNaddr);

  const userPubkey = user?.pubkey;
  const hasPermission = userPubkey ? hasActiveSpeakingPermission(userPubkey) : false;
  const hasPendingRequest = userPubkey ? hasPendingSpeakingRequest(userPubkey) : false;
  const hasRequestBeenDenied = userPubkey ? hasRequestDenied(userPubkey) : false;
  const hasPendingInvitation = userPubkey ? hasPendingSpeakingInvitation(userPubkey) : false;
  const invitation = userPubkey ? getUserSpeakingInvitation(userPubkey) : undefined;

  // Show invitation dialog when user receives an invitation
  useEffect(() => {
    if (hasPendingInvitation && invitation) {
      setShowInvitationDialog(true);
    } else if (!hasPendingInvitation) {
      // Close dialog when invitation is no longer pending (accepted/declined)
      setShowInvitationDialog(false);
    }
  }, [hasPendingInvitation, invitation]);

  const handleRequestToSpeak = async () => {
    try {
      console.log('🗣️ Requesting to speak for nest:', nestNaddr);
      await requestToSpeak.mutateAsync();
      console.log('🗣️ Speaking request sent successfully');
    } catch (error) {
      console.error('Failed to request speaking:', error);
    }
  };

  const handleCancelRequest = async () => {
    try {
      await cancelSpeakingRequest.mutateAsync();
    } catch (error) {
      console.error('Failed to cancel request:', error);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!invitation) return;
    
    try {
      await acceptSpeakingInvitation.mutateAsync({ invitationEventId: invitation.id });
      setShowInvitationDialog(false);
      
      // Restart session to enable microphone
      if (onRestartSession) {
        onRestartSession();
      }
    } catch (error) {
      console.error('Failed to accept invitation:', error);
    }
  };

  const handleDeclineInvitation = async () => {
    if (!invitation) return;
    
    try {
      await declineSpeakingInvitation.mutateAsync({ invitationEventId: invitation.id });
      setShowInvitationDialog(false);
    } catch (error) {
      console.error('Failed to decline invitation:', error);
    }
  };

  const handleRemoveSpeakingCapability = async () => {
    try {
      await removeSpeakingCapability.mutateAsync();
    } catch (error) {
      console.error('Failed to remove speaking capability:', error);
    }
  };

  if (!user) {
    return null; // Only logged-in users can interact with speaking controls
  }

  // Host always has speaking permissions
  if (isHost) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="default" className="bg-purple-600">
          <UserCheck className="h-3 w-3 mr-1" />
          Host
        </Badge>
        <Button
          variant={isMicrophoneEnabled ? "default" : "secondary"}
          size="sm"
          onClick={onToggleMicrophone}
          className={`rounded-full w-10 h-10 ${isMicrophoneEnabled ? 'bg-gradient-purple glow-purple' : ''}`}
        >
          {isMicrophoneEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {hasPermission ? (
          // User has speaking permission
          <>
            <Badge variant="default" className="bg-green-600">
              <Mic className="h-3 w-3 mr-1" />
              Speaker
            </Badge>
            <Button
              variant={isMicrophoneEnabled ? "default" : "secondary"}
              size="sm"
              onClick={onToggleMicrophone}
              className={`rounded-full w-10 h-10 ${isMicrophoneEnabled ? 'bg-gradient-purple glow-purple' : ''}`}
            >
              {isMicrophoneEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemoveSpeakingCapability}
              disabled={removeSpeakingCapability.isPending}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              <UserMinus className="h-4 w-4 mr-1" />
              Leave Speakers
            </Button>
          </>
        ) : hasPendingRequest ? (
          // User has pending request
          <>
            <Badge variant="outline" className="text-yellow-600 border-yellow-300">
              <Clock className="h-3 w-3 mr-1" />
              Request Pending
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelRequest}
              disabled={cancelSpeakingRequest.isPending}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </>
        ) : hasRequestBeenDenied ? (
          // User's request was denied
          <>
            <Badge variant="outline" className="text-red-600 border-red-300">
              <X className="h-3 w-3 mr-1" />
              Request Denied
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRequestToSpeak}
              disabled={requestToSpeak.isPending}
              className="text-yellow-600 border-yellow-300 hover:bg-yellow-50"
            >
              <Hand className="h-4 w-4 mr-1" />
              {requestToSpeak.isPending ? 'Requesting...' : 'Request Again'}
            </Button>
          </>
        ) : (
          // User can request to speak
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRequestToSpeak}
              disabled={requestToSpeak.isPending}
              className="text-yellow-600 border-yellow-300 hover:bg-yellow-50"
            >
              <Hand className="h-4 w-4 mr-1" />
              {requestToSpeak.isPending ? 'Requesting...' : 'Request to Speak'}
            </Button>
            
            {/* Debug: Show current user pubkey for testing */}
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-muted-foreground">
                Debug: {user?.pubkey?.slice(0, 16)}...
              </div>
            )}
          </>
        )}
      </div>

      {/* Speaking Invitation Dialog */}
      <Dialog open={showInvitationDialog} onOpenChange={setShowInvitationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HandMetal className="h-5 w-5 text-purple-600" />
              Speaking Invitation
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mb-4">
                <Mic className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">You've been invited to speak!</h3>
              <p className="text-muted-foreground">
                The host has invited you to participate in the audio conversation. 
                Accepting will restart your session to enable your microphone.
              </p>
            </div>

            {invitation && (
              <InvitationDetails invitation={invitation} />
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleDeclineInvitation}
                disabled={declineSpeakingInvitation.isPending}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Decline
              </Button>
              <Button
                onClick={handleAcceptInvitation}
                disabled={acceptSpeakingInvitation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-2" />
                Accept & Join
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InvitationDetails({ invitation }: { invitation: { id: string; pubkey: string; created_at: number } }) {
  const hostPubkey = invitation.pubkey;
  const author = useAuthor(hostPubkey);
  const hostName = author.data?.metadata?.name || genUserName(hostPubkey);
  const hostAvatar = author.data?.metadata?.picture;
  const timeAgo = Math.floor((Date.now() / 1000 - invitation.created_at) / 60);

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={hostAvatar} />
            <AvatarFallback className="text-sm">
              {hostName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{hostName}</p>
            <p className="text-sm text-muted-foreground">
              Invited you {timeAgo}m ago
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}