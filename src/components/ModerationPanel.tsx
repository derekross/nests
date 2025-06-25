import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthor } from '@/hooks/useAuthor';
import { useSpeakingRequests } from '@/hooks/useSpeakingRequests';
import { useIsMobile } from '@/hooks/useIsMobile';

import { genUserName } from '@/lib/genUserName';
import { nip19 } from 'nostr-tools';
import { 
  Hand, 
  Mic, 
  MicOff, 
  UserPlus, 
  UserMinus, 
  Check, 
  X, 
  Clock,
  Users,
  Settings
} from 'lucide-react';
import type { NostrEvent } from '@nostrify/nostrify';

interface ModerationPanelProps {
  nestNaddr: string;
  isHost: boolean;
  participants: Array<{
    identity?: string;
    sid: string;
    isSpeaking?: boolean;
    getTrackPublication?: (source: string) => { isMuted?: boolean } | undefined;
  }>;
}

export function ModerationPanel({ nestNaddr, isHost, participants }: ModerationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [invitePubkey, setInvitePubkey] = useState('');
  const isMobile = useIsMobile();
  
  const {
    speakingRequests,
    speakingPermissions,
    speakingInvitations,
    isLoading,
    grantSpeakingPermission,
    denySpeakingPermission,
    revokeSpeakingPermission,
    inviteToSpeak,
    hasActiveSpeakingPermission,
  } = useSpeakingRequests(nestNaddr);

  // Debug logging
  console.log('🔍 ModerationPanel Debug:', {
    nestNaddr,
    speakingRequestsCount: speakingRequests.length,
    speakingPermissionsCount: speakingPermissions.length,
    speakingRequests: speakingRequests.map(r => ({
      id: r.id.slice(0, 8),
      pubkey: r.pubkey.slice(0, 8),
      status: r.tags.find(([name]) => name === 'status')?.[1],
      created_at: r.created_at,
      tags: r.tags
    })),
    speakingPermissions: speakingPermissions.map(p => ({
      id: p.id.slice(0, 8),
      pubkey: p.pubkey.slice(0, 8),
      status: p.tags.find(([name]) => name === 'status')?.[1],
      targetPubkey: p.tags.find(([name]) => name === 'p')?.[1]?.slice(0, 8),
      eventRef: p.tags.find(([name]) => name === 'e')?.[1]?.slice(0, 8),
      created_at: p.created_at,
    })),
    isLoading
  });

  // Get the latest request status for each user (since users can request/cancel multiple times)
  const latestRequestsByUser = speakingRequests.reduce((acc, request) => {
    const pubkey = request.pubkey;
    const existing = acc[pubkey];
    
    // Keep the most recent request for each user
    if (!existing || request.created_at > existing.created_at) {
      acc[pubkey] = request;
    }
    
    return acc;
  }, {} as Record<string, NostrEvent>);

  console.log('🔍 Latest requests by user:', Object.entries(latestRequestsByUser).map(([pubkey, request]) => ({
    pubkey: pubkey.slice(0, 8),
    id: request.id.slice(0, 8),
    status: request.tags.find(([name]) => name === 'status')?.[1],
    created_at: request.created_at
  })));

  // Filter pending requests (not yet responded to)
  const pendingRequests = Object.values(latestRequestsByUser).filter(request => {
    const status = request.tags.find(([name]) => name === 'status')?.[1];
    console.log('🔍 Checking latest request', request.id.slice(0, 8), 'status:', status);
    
    if (status !== 'requested') {
      console.log('🔍 Request', request.id.slice(0, 8), 'filtered out - status is not "requested"');
      return false;
    }
    
    // Check if there's already a permission response for this user's request
    // Look for the most recent permission for this user
    const userPermissions = speakingPermissions
      .filter(permission => {
        const permissionPubkey = permission.tags.find(([name]) => name === 'p')?.[1];
        return permissionPubkey === request.pubkey;
      })
      .sort((a, b) => b.created_at - a.created_at); // Most recent first
    
    const latestPermission = userPermissions[0];
    
    if (latestPermission) {
      const permissionStatus = latestPermission.tags.find(([name]) => name === 'status')?.[1];
      const permissionTime = latestPermission.created_at;
      const requestTime = request.created_at;
      
      console.log('🔍 Found permission for user', request.pubkey.slice(0, 8), {
        permissionStatus,
        permissionTime,
        requestTime,
        permissionIsNewer: permissionTime > requestTime
      });
      
      // Only consider the permission as a response if it's newer than the request
      if (permissionTime > requestTime && (permissionStatus === 'granted' || permissionStatus === 'denied')) {
        console.log('🔍 Request', request.id.slice(0, 8), 'filtered out - has newer permission response');
        return false;
      }
    }
    
    console.log('🔍 Request', request.id.slice(0, 8), 'is pending - no newer response found');
    return true;
  });

  console.log('🔍 Final pendingRequests:', pendingRequests.length, pendingRequests.map(r => ({
    id: r.id.slice(0, 8),
    pubkey: r.pubkey.slice(0, 8),
    status: r.tags.find(([name]) => name === 'status')?.[1]
  })));

  // Filter pending invitations (sent but not yet responded to)
  const pendingInvitations = speakingInvitations.filter(invitation => {
    const status = invitation.tags.find(([name]) => name === 'status')?.[1];
    return status === 'invited';
  });

  // Get participants with speaking permissions
  const speakingParticipants = participants.filter(participant => {
    const pubkey = participant.identity || participant.sid;
    return hasActiveSpeakingPermission(pubkey);
  });

  const handleInviteToSpeak = async () => {
    if (!invitePubkey.trim()) return;
    
    try {
      let pubkeyHex = invitePubkey.trim();
      
      // If it's an npub, decode it to hex
      if (pubkeyHex.startsWith('npub1')) {
        try {
          const decoded = nip19.decode(pubkeyHex);
          if (decoded.type === 'npub') {
            pubkeyHex = decoded.data;
          } else {
            throw new Error('Invalid npub format');
          }
        } catch {
          throw new Error('Invalid npub format. Please provide a valid npub or hex pubkey.');
        }
      }
      
      // Validate hex pubkey (should be 64 characters)
      if (!/^[a-fA-F0-9]{64}$/.test(pubkeyHex)) {
        throw new Error('Invalid pubkey format. Please provide a valid npub or 64-character hex pubkey.');
      }
      
      await inviteToSpeak.mutateAsync({ participantPubkey: pubkeyHex });
      setInvitePubkey('');
    } catch (error) {
      console.error('Failed to invite to speak:', error);
    }
  };

  if (!isHost) {
    return null; // Only hosts can see the moderation panel
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Settings className="h-4 w-4 mr-2" />
          {isMobile ? 'Mod' : 'Moderation'}
          {pendingRequests.length > 0 && (
            <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs">
              {pendingRequests.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className={`${isMobile ? 'max-w-[95vw] max-h-[90vh] p-4' : 'max-w-4xl max-h-[80vh]'}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {isMobile ? 'Moderation' : 'Nest Moderation'}
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="requests" className="w-full">
          <TabsList className={`grid w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-5'}`}>
            <TabsTrigger value="requests" className="relative">
              {isMobile ? 'Requests' : 'Speaking Requests'}
              {pendingRequests.length > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs">
                  {pendingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="speakers">{isMobile ? 'Speakers' : 'Current Speakers'}</TabsTrigger>
            {!isMobile && (
              <>
                <TabsTrigger value="invitations">Invitations</TabsTrigger>
                <TabsTrigger value="invite">Invite to Speak</TabsTrigger>
                <TabsTrigger value="debug">Debug</TabsTrigger>
              </>
            )}
          </TabsList>
          
          {/* Mobile: Show additional tabs in a second row */}
          {isMobile && (
            <TabsList className="grid w-full grid-cols-3 mt-2">
              <TabsTrigger value="invitations">Invites</TabsTrigger>
              <TabsTrigger value="invite">Add</TabsTrigger>
              <TabsTrigger value="debug">Debug</TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="requests" className="mt-4">
            <Card>
              <CardHeader className={isMobile ? 'pb-3' : ''}>
                <CardTitle className={`${isMobile ? 'text-base' : 'text-lg'}`}>
                  {isMobile ? 'Speaking Requests' : 'Pending Speaking Requests'}
                </CardTitle>
              </CardHeader>
              <CardContent className={isMobile ? 'pt-0' : ''}>
                <ScrollArea className={isMobile ? 'h-48' : 'h-64'}>
                  {isLoading ? (
                    <div className={`text-center ${isMobile ? 'py-6' : 'py-8'} text-muted-foreground`}>
                      Loading requests...
                    </div>
                  ) : pendingRequests.length === 0 ? (
                    <div className={`text-center ${isMobile ? 'py-6' : 'py-8'} text-muted-foreground`}>
                      <Hand className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} mx-auto mb-2 opacity-50`} />
                      <p className={isMobile ? 'text-sm' : ''}>No pending speaking requests</p>
                    </div>
                  ) : (
                    <div className={isMobile ? 'space-y-2' : 'space-y-3'}>
                      {pendingRequests.map((request) => (
                        <SpeakingRequestCard
                          key={request.id}
                          request={request}
                          onGrant={() => grantSpeakingPermission.mutateAsync({
                            participantPubkey: request.pubkey,
                            requestEventId: request.id,
                          })}
                          onDeny={() => denySpeakingPermission.mutateAsync({
                            participantPubkey: request.pubkey,
                            requestEventId: request.id,
                          })}
                          isProcessing={grantSpeakingPermission.isPending || denySpeakingPermission.isPending}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="speakers" className="mt-4">
            <Card>
              <CardHeader className={isMobile ? 'pb-3' : ''}>
                <CardTitle className={`${isMobile ? 'text-base' : 'text-lg'}`}>Current Speakers</CardTitle>
              </CardHeader>
              <CardContent className={isMobile ? 'pt-0' : ''}>
                <ScrollArea className={isMobile ? 'h-48' : 'h-64'}>
                  {speakingParticipants.length === 0 ? (
                    <div className={`text-center ${isMobile ? 'py-6' : 'py-8'} text-muted-foreground`}>
                      <Mic className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} mx-auto mb-2 opacity-50`} />
                      <p className={isMobile ? 'text-sm' : ''}>No participants have speaking permissions</p>
                    </div>
                  ) : (
                    <div className={isMobile ? 'space-y-2' : 'space-y-3'}>
                      {speakingParticipants.map((participant) => (
                        <SpeakerCard
                          key={participant.sid}
                          participant={participant}
                          onRevoke={() => revokeSpeakingPermission.mutateAsync({
                            participantPubkey: participant.identity || participant.sid,
                          })}
                          isProcessing={revokeSpeakingPermission.isPending}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitations" className="mt-4">
            <Card>
              <CardHeader className={isMobile ? 'pb-3' : ''}>
                <CardTitle className={`${isMobile ? 'text-base' : 'text-lg'}`}>
                  {isMobile ? 'Invitations' : 'Pending Invitations'}
                </CardTitle>
              </CardHeader>
              <CardContent className={isMobile ? 'pt-0' : ''}>
                <ScrollArea className={isMobile ? 'h-48' : 'h-64'}>
                  {pendingInvitations.length === 0 ? (
                    <div className={`text-center ${isMobile ? 'py-6' : 'py-8'} text-muted-foreground`}>
                      <UserPlus className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} mx-auto mb-2 opacity-50`} />
                      <p className={isMobile ? 'text-sm' : ''}>No pending invitations</p>
                    </div>
                  ) : (
                    <div className={isMobile ? 'space-y-2' : 'space-y-3'}>
                      {pendingInvitations.map((invitation) => {
                        const invitedPubkey = invitation.tags.find(([name]) => name === 'p')?.[1];
                        return invitedPubkey ? (
                          <InvitationCard
                            key={invitation.id}
                            invitation={invitation}
                            invitedPubkey={invitedPubkey}
                          />
                        ) : null;
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invite" className="mt-4">
            <Card>
              <CardHeader className={isMobile ? 'pb-3' : ''}>
                <CardTitle className={`${isMobile ? 'text-base' : 'text-lg'}`}>
                  {isMobile ? 'Invite to Speak' : 'Invite Participant to Speak'}
                </CardTitle>
              </CardHeader>
              <CardContent className={`${isMobile ? 'pt-0 space-y-3' : 'space-y-4'}`}>
                <div className="space-y-2">
                  <Label htmlFor="pubkey" className={isMobile ? 'text-sm' : ''}>
                    {isMobile ? 'Public Key (npub or hex)' : 'Participant Public Key (npub or hex)'}
                  </Label>
                  <Input
                    id="pubkey"
                    value={invitePubkey}
                    onChange={(e) => setInvitePubkey(e.target.value)}
                    placeholder={isMobile ? 'npub1...' : 'npub1... or hex pubkey'}
                    className={`font-mono ${isMobile ? 'text-xs' : 'text-sm'}`}
                  />
                </div>
                <Button 
                  onClick={handleInviteToSpeak}
                  disabled={!invitePubkey.trim() || inviteToSpeak.isPending}
                  className="w-full"
                  size={isMobile ? 'sm' : 'default'}
                >
                  {inviteToSpeak.isPending ? 'Sending...' : (isMobile ? 'Send Invitation' : 'Send Speaking Invitation')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="debug" className="mt-4">
            <Card>
              <CardHeader className={isMobile ? 'pb-3' : ''}>
                <CardTitle className={`${isMobile ? 'text-base' : 'text-lg'}`}>Debug Information</CardTitle>
              </CardHeader>
              <CardContent className={`${isMobile ? 'pt-0 space-y-3' : 'space-y-4'}`}>
                <div className={isMobile ? 'space-y-2' : 'space-y-3'}>
                  <div>
                    <h4 className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'} mb-2`}>Nest Information</h4>
                    <div className={`bg-muted p-2 rounded ${isMobile ? 'text-xs' : 'text-xs'} font-mono space-y-1`}>
                      <div>Nest naddr: {isMobile ? nestNaddr.slice(0, 30) + '...' : nestNaddr}</div>
                      <div>Is loading: {isLoading ? 'Yes' : 'No'}</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'} mb-2`}>
                      Raw Speaking Requests ({speakingRequests.length})
                    </h4>
                    <ScrollArea className={isMobile ? 'h-24' : 'h-32'}>
                      <div className={`bg-muted p-2 rounded ${isMobile ? 'text-xs' : 'text-xs'} font-mono space-y-2`}>
                        {speakingRequests.length === 0 ? (
                          <div>No speaking requests found</div>
                        ) : (
                          speakingRequests.slice(0, isMobile ? 3 : 10).map((request, index) => (
                            <div key={request.id} className="border-b border-border pb-2 last:border-b-0">
                              <div>#{index + 1} ID: {request.id.slice(0, isMobile ? 8 : 16)}...</div>
                              <div>Pubkey: {request.pubkey.slice(0, isMobile ? 8 : 16)}...</div>
                              <div>Status: {request.tags.find(([name]) => name === 'status')?.[1] || 'none'}</div>
                              {!isMobile && <div>Created: {new Date(request.created_at * 1000).toLocaleString()}</div>}
                            </div>
                          ))
                        )}
                        {isMobile && speakingRequests.length > 3 && (
                          <div className="text-muted-foreground">... and {speakingRequests.length - 3} more</div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  <div>
                    <h4 className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'} mb-2`}>
                      Filtered Pending Requests ({pendingRequests.length})
                    </h4>
                    <div className={`bg-muted p-2 rounded ${isMobile ? 'text-xs' : 'text-xs'} font-mono`}>
                      {pendingRequests.length === 0 ? (
                        <div>No pending requests after filtering</div>
                      ) : (
                        pendingRequests.map((request, index) => (
                          <div key={request.id} className="mb-2">
                            #{index + 1}: {request.pubkey.slice(0, isMobile ? 8 : 16)}... - {request.tags.find(([name]) => name === 'status')?.[1]}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {!isMobile && (
                    <>
                      <div>
                        <h4 className="font-medium text-sm mb-2">Raw Speaking Permissions ({speakingPermissions.length})</h4>
                        <ScrollArea className="h-32">
                          <div className="bg-muted p-3 rounded text-xs font-mono space-y-2">
                            {speakingPermissions.length === 0 ? (
                              <div>No speaking permissions found</div>
                            ) : (
                              speakingPermissions.map((permission, index) => (
                                <div key={permission.id} className="border-b border-border pb-2 last:border-b-0">
                                  <div>#{index + 1} ID: {permission.id.slice(0, 16)}...</div>
                                  <div>Pubkey: {permission.pubkey.slice(0, 16)}...</div>
                                  <div>Status: {permission.tags.find(([name]) => name === 'status')?.[1] || 'none'}</div>
                                  <div>Target: {permission.tags.find(([name]) => name === 'p')?.[1]?.slice(0, 16) || 'none'}...</div>
                                  <div>Event Ref: {permission.tags.find(([name]) => name === 'e')?.[1]?.slice(0, 16) || 'none'}...</div>
                                  <div>Created: {new Date(permission.created_at * 1000).toLocaleString()}</div>
                                </div>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </div>

                      <div>
                        <h4 className="font-medium text-sm mb-2">Latest Requests by User ({Object.keys(latestRequestsByUser).length})</h4>
                        <ScrollArea className="h-32">
                          <div className="bg-muted p-3 rounded text-xs font-mono space-y-2">
                            {Object.keys(latestRequestsByUser).length === 0 ? (
                              <div>No requests found</div>
                            ) : (
                              Object.entries(latestRequestsByUser).map(([pubkey, request], index) => (
                                <div key={pubkey} className="border-b border-border pb-2 last:border-b-0">
                                  <div>#{index + 1} User: {pubkey.slice(0, 16)}...</div>
                                  <div>Latest Request ID: {request.id.slice(0, 16)}...</div>
                                  <div>Status: {request.tags.find(([name]) => name === 'status')?.[1] || 'none'}</div>
                                  <div>Created: {new Date(request.created_at * 1000).toLocaleString()}</div>
                                </div>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function SpeakingRequestCard({ 
  request, 
  onGrant, 
  onDeny, 
  isProcessing 
}: { 
  request: NostrEvent; 
  onGrant: () => void; 
  onDeny: () => void; 
  isProcessing: boolean;
}) {
  const author = useAuthor(request.pubkey);
  const displayName = author.data?.metadata?.name || genUserName(request.pubkey);
  const avatar = author.data?.metadata?.picture;
  const timeAgo = Math.floor((Date.now() / 1000 - request.created_at) / 60);
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="p-3 border rounded-lg bg-card space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatar} />
            <AvatarFallback className="text-xs">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{displayName}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{timeAgo}m ago</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={onGrant}
            disabled={isProcessing}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <Check className="h-3 w-3 mr-1" />
            Grant
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onDeny}
            disabled={isProcessing}
            className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
          >
            <X className="h-3 w-3 mr-1" />
            Deny
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={avatar} />
          <AvatarFallback className="text-sm">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{displayName}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{timeAgo}m ago</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="default"
          onClick={onGrant}
          disabled={isProcessing}
          className="bg-green-600 hover:bg-green-700"
        >
          <Check className="h-4 w-4 mr-1" />
          Grant
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDeny}
          disabled={isProcessing}
          className="border-red-200 text-red-600 hover:bg-red-50"
        >
          <X className="h-4 w-4 mr-1" />
          Deny
        </Button>
      </div>
    </div>
  );
}

function SpeakerCard({ 
  participant, 
  onRevoke, 
  isProcessing 
}: { 
  participant: {
    identity?: string;
    sid: string;
    isSpeaking?: boolean;
    getTrackPublication?: (source: string) => { isMuted?: boolean } | undefined;
  }; 
  onRevoke: () => void; 
  isProcessing: boolean;
}) {
  const pubkey = participant.identity || participant.sid;
  const author = useAuthor(pubkey);
  const displayName = author.data?.metadata?.name || genUserName(pubkey);
  const avatar = author.data?.metadata?.picture;
  const isMuted = participant.getTrackPublication?.('microphone')?.isMuted ?? true;
  const isSpeaking = participant.isSpeaking;
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="p-3 border rounded-lg bg-card space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-8 w-8">
              <AvatarImage src={avatar} />
              <AvatarFallback className="text-xs">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {isSpeaking && (
              <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-white animate-pulse" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{displayName}</p>
            <div className="flex items-center gap-1">
              {isMuted ? (
                <Badge variant="secondary" className="text-xs">
                  <MicOff className="h-2 w-2 mr-1" />
                  Muted
                </Badge>
              ) : (
                <Badge variant="default" className="text-xs bg-green-600">
                  <Mic className="h-2 w-2 mr-1" />
                  Unmuted
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onRevoke}
          disabled={isProcessing}
          className="w-full border-red-200 text-red-600 hover:bg-red-50"
        >
          <UserMinus className="h-3 w-3 mr-1" />
          Revoke Speaking
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar className="h-10 w-10">
            <AvatarImage src={avatar} />
            <AvatarFallback className="text-sm">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isSpeaking && (
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse" />
          )}
        </div>
        <div>
          <p className="font-medium">{displayName}</p>
          <div className="flex items-center gap-2">
            {isMuted ? (
              <Badge variant="secondary" className="text-xs">
                <MicOff className="h-3 w-3 mr-1" />
                Muted
              </Badge>
            ) : (
              <Badge variant="default" className="text-xs bg-green-600">
                <Mic className="h-3 w-3 mr-1" />
                Unmuted
              </Badge>
            )}
          </div>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onRevoke}
        disabled={isProcessing}
        className="border-red-200 text-red-600 hover:bg-red-50"
      >
        <UserMinus className="h-4 w-4 mr-1" />
        Revoke
      </Button>
    </div>
  );
}

function InvitationCard({ 
  invitation, 
  invitedPubkey 
}: { 
  invitation: NostrEvent; 
  invitedPubkey: string;
}) {
  const author = useAuthor(invitedPubkey);
  const displayName = author.data?.metadata?.name || genUserName(invitedPubkey);
  const avatar = author.data?.metadata?.picture;
  const timeAgo = Math.floor((Date.now() / 1000 - invitation.created_at) / 60);
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="p-3 border rounded-lg bg-card space-y-2">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatar} />
            <AvatarFallback className="text-xs">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{displayName}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Invited {timeAgo}m ago</span>
            </div>
          </div>
        </div>
        <Badge variant="outline" className="text-yellow-600 border-yellow-300 w-fit">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={avatar} />
          <AvatarFallback className="text-sm">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{displayName}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Invited {timeAgo}m ago</span>
          </div>
        </div>
      </div>
      <Badge variant="outline" className="text-yellow-600 border-yellow-300">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    </div>
  );
}