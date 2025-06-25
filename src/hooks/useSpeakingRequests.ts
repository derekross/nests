import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Hook to manage speaking requests in a nest
 */
export function useSpeakingRequests(nestNaddr: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  console.log('🔍 useSpeakingRequests initialized for nest:', nestNaddr, 'user:', user?.pubkey?.slice(0, 8));

  // Query speaking requests for this nest
  const { data: speakingRequests = [], isLoading } = useQuery({
    queryKey: ['speaking-requests', nestNaddr],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);
      
      console.log('🔍 Querying speaking requests for:', nestNaddr);
      
      // Try multiple query strategies to ensure we get all events
      const queries = [
        {
          kinds: [1833], // Speaking request events
          '#a': [nestNaddr],
          limit: 100,
        },
        // Fallback query without the # prefix in case relay doesn't support it
        {
          kinds: [1833],
          limit: 100,
        }
      ];
      
      const events = await nostr.query(queries, { signal });
      
      console.log('🔍 Raw speaking request events (all):', events.length);
      
      // Filter events that reference this nest
      const nestEvents = events.filter(event => {
        const aTags = event.tags.filter(([name]) => name === 'a');
        const hasNestRef = aTags.some(([, value]) => value === nestNaddr);
        console.log('🔍 Event', event.id.slice(0, 8), 'a-tags:', aTags, 'matches nest:', hasNestRef);
        return hasNestRef;
      });
      
      console.log('🔍 Events matching nest:', nestEvents.length, nestEvents.map(e => ({
        id: e.id.slice(0, 8),
        pubkey: e.pubkey.slice(0, 8),
        status: e.tags.find(([name]) => name === 'status')?.[1],
        created_at: e.created_at,
        aTags: e.tags.filter(([name]) => name === 'a')
      })));
      
      // Filter out requests older than 24 hours (increased from 1 hour for debugging)
      const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - (24 * 3600);
      const filtered = nestEvents.filter(event => event.created_at > twentyFourHoursAgo);
      
      console.log('🔍 Filtered speaking requests (last 24h):', filtered.length);
      
      return filtered;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Query speaking permissions for this nest
  const { data: speakingPermissions = [] } = useQuery({
    queryKey: ['speaking-permissions', nestNaddr],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);
      
      // Try multiple query strategies
      const queries = [
        {
          kinds: [3979], // Speaking permission events
          '#a': [nestNaddr],
          limit: 100,
        },
        // Fallback query
        {
          kinds: [3979],
          limit: 100,
        }
      ];
      
      const events = await nostr.query(queries, { signal });
      
      // Filter events that reference this nest
      const nestEvents = events.filter(event => {
        const aTags = event.tags.filter(([name]) => name === 'a');
        return aTags.some(([, value]) => value === nestNaddr);
      });
      
      console.log('🔍 Speaking permissions for nest:', nestEvents.length, nestEvents.map(e => ({
        id: e.id.slice(0, 8),
        pubkey: e.pubkey.slice(0, 8),
        status: e.tags.find(([name]) => name === 'status')?.[1],
        targetPubkey: e.tags.find(([name]) => name === 'p')?.[1]?.slice(0, 8),
        created_at: e.created_at,
      })));
      
      // Filter out permissions older than 24 hours (increased for debugging)
      const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - (24 * 3600);
      return nestEvents.filter(event => event.created_at > twentyFourHoursAgo);
    },
    refetchInterval: 5000,
  });

  // Query speaking invitations for this nest
  const { data: speakingInvitations = [] } = useQuery({
    queryKey: ['speaking-invitations', nestNaddr],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);
      
      // Try multiple query strategies
      const queries = [
        {
          kinds: [7051], // Speaking invitation events
          '#a': [nestNaddr],
          limit: 100,
        },
        // Fallback query
        {
          kinds: [7051],
          limit: 100,
        }
      ];
      
      const events = await nostr.query(queries, { signal });
      
      // Filter events that reference this nest
      const nestEvents = events.filter(event => {
        const aTags = event.tags.filter(([name]) => name === 'a');
        return aTags.some(([, value]) => value === nestNaddr);
      });
      
      console.log('🔍 Speaking invitations for nest:', nestEvents.length);
      
      // Filter out invitations older than 24 hours (increased for debugging)
      const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - (24 * 3600);
      return nestEvents.filter(event => event.created_at > twentyFourHoursAgo);
    },
    refetchInterval: 5000,
  });

  // Request to speak
  const requestToSpeak = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Must be logged in to request speaking');

      const eventData = {
        kind: 1833,
        content: '',
        tags: [
          ['a', nestNaddr, '', 'root'],
          ['status', 'requested'],
        ],
      };

      console.log('🗣️ Publishing speaking request:', {
        nestNaddr,
        userPubkey: user.pubkey.slice(0, 8),
        eventData
      });

      await createEvent(eventData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speaking-requests', nestNaddr] });
      toast({
        title: "Speaking Request Sent",
        description: "Your request to speak has been sent to the host.",
      });
    },
    onError: (error) => {
      toast({
        title: "Request Failed",
        description: error instanceof Error ? error.message : "Failed to send speaking request.",
        variant: "destructive",
      });
    },
  });

  // Cancel speaking request
  const cancelSpeakingRequest = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Must be logged in');

      await createEvent({
        kind: 1833,
        content: '',
        tags: [
          ['a', nestNaddr, '', 'root'],
          ['status', 'cancelled'],
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speaking-requests', nestNaddr] });
      toast({
        title: "Request Cancelled",
        description: "Your speaking request has been cancelled.",
      });
    },
  });

  // Grant speaking permission (host only)
  const grantSpeakingPermission = useMutation({
    mutationFn: async ({ participantPubkey, requestEventId }: { participantPubkey: string; requestEventId?: string }) => {
      if (!user) throw new Error('Must be logged in');

      const tags = [
        ['a', nestNaddr, '', 'root'],
        ['p', participantPubkey],
        ['status', 'granted'],
      ];

      if (requestEventId) {
        tags.push(['e', requestEventId]);
      }

      await createEvent({
        kind: 3979,
        content: '',
        tags,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speaking-permissions', nestNaddr] });
      toast({
        title: "Permission Granted",
        description: "Speaking permission has been granted.",
      });
    },
  });

  // Deny speaking permission (host only)
  const denySpeakingPermission = useMutation({
    mutationFn: async ({ participantPubkey, requestEventId }: { participantPubkey: string; requestEventId?: string }) => {
      if (!user) throw new Error('Must be logged in');

      const tags = [
        ['a', nestNaddr, '', 'root'],
        ['p', participantPubkey],
        ['status', 'denied'],
      ];

      if (requestEventId) {
        tags.push(['e', requestEventId]);
      }

      await createEvent({
        kind: 3979,
        content: '',
        tags,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speaking-permissions', nestNaddr] });
      toast({
        title: "Permission Denied",
        description: "Speaking permission has been denied.",
      });
    },
  });

  // Revoke speaking permission (host only)
  const revokeSpeakingPermission = useMutation({
    mutationFn: async ({ participantPubkey }: { participantPubkey: string }) => {
      if (!user) throw new Error('Must be logged in');

      await createEvent({
        kind: 3979,
        content: '',
        tags: [
          ['a', nestNaddr, '', 'root'],
          ['p', participantPubkey],
          ['status', 'revoked'],
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speaking-permissions', nestNaddr] });
      toast({
        title: "Permission Revoked",
        description: "Speaking permission has been revoked.",
      });
    },
  });

  // Invite to speak (host only)
  const inviteToSpeak = useMutation({
    mutationFn: async ({ participantPubkey }: { participantPubkey: string }) => {
      if (!user) throw new Error('Must be logged in');

      await createEvent({
        kind: 7051,
        content: '',
        tags: [
          ['a', nestNaddr, '', 'root'],
          ['p', participantPubkey],
          ['status', 'invited'],
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speaking-invitations', nestNaddr] });
      toast({
        title: "Invitation Sent",
        description: "Speaking invitation has been sent.",
      });
    },
  });

  // Accept speaking invitation
  const acceptSpeakingInvitation = useMutation({
    mutationFn: async ({ invitationEventId }: { invitationEventId: string }) => {
      if (!user) throw new Error('Must be logged in');

      await createEvent({
        kind: 7051,
        content: '',
        tags: [
          ['a', nestNaddr, '', 'root'],
          ['e', invitationEventId],
          ['status', 'accepted'],
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speaking-invitations', nestNaddr] });
      toast({
        title: "Invitation Accepted",
        description: "You have accepted the speaking invitation.",
      });
    },
  });

  // Decline speaking invitation
  const declineSpeakingInvitation = useMutation({
    mutationFn: async ({ invitationEventId }: { invitationEventId: string }) => {
      if (!user) throw new Error('Must be logged in');

      await createEvent({
        kind: 7051,
        content: '',
        tags: [
          ['a', nestNaddr, '', 'root'],
          ['e', invitationEventId],
          ['status', 'declined'],
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speaking-invitations', nestNaddr] });
      toast({
        title: "Invitation Declined",
        description: "You have declined the speaking invitation.",
      });
    },
  });

  // Remove speaking capability (participant removes themselves)
  const removeSpeakingCapability = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Must be logged in');

      await createEvent({
        kind: 3979,
        content: '',
        tags: [
          ['a', nestNaddr, '', 'root'],
          ['p', user.pubkey],
          ['status', 'removed'],
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speaking-permissions', nestNaddr] });
      toast({
        title: "Left Speakers",
        description: "You have removed yourself from the speakers list.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Leave",
        description: error instanceof Error ? error.message : "Failed to remove speaking capability.",
        variant: "destructive",
      });
    },
  });

  // Helper functions to get current status
  const getUserSpeakingRequest = (pubkey: string): NostrEvent | undefined => {
    return speakingRequests
      .filter(req => req.pubkey === pubkey)
      .sort((a, b) => b.created_at - a.created_at)[0];
  };

  const getUserSpeakingPermission = (pubkey: string): NostrEvent | undefined => {
    return speakingPermissions
      .filter(perm => perm.tags.find(([name, value]) => name === 'p' && value === pubkey))
      .sort((a, b) => b.created_at - a.created_at)[0];
  };

  const getUserSpeakingInvitation = (pubkey: string): NostrEvent | undefined => {
    return speakingInvitations
      .filter(inv => inv.tags.find(([name, value]) => name === 'p' && value === pubkey))
      .sort((a, b) => b.created_at - a.created_at)[0];
  };

  const hasActiveSpeakingPermission = (pubkey: string): boolean => {
    const permission = getUserSpeakingPermission(pubkey);
    const status = permission?.tags.find(([name]) => name === 'status')?.[1];
    return status === 'granted';
  };

  const hasPendingSpeakingRequest = (pubkey: string): boolean => {
    const request = getUserSpeakingRequest(pubkey);
    const permission = getUserSpeakingPermission(pubkey);
    
    // Check if user has a "requested" status request
    const hasRequestedStatus = request?.tags.find(([name, value]) => name === 'status' && value === 'requested') !== undefined;
    
    if (!hasRequestedStatus) return false;
    
    // Check if there's a newer permission response that denies or grants the request
    if (permission && request) {
      const permissionStatus = permission.tags.find(([name]) => name === 'status')?.[1];
      const permissionTime = permission.created_at;
      const requestTime = request.created_at;
      
      // If permission is newer than request and is a response (granted/denied), then no longer pending
      if (permissionTime > requestTime && (permissionStatus === 'granted' || permissionStatus === 'denied')) {
        return false;
      }
    }
    
    return true;
  };

  const hasRequestDenied = (pubkey: string): boolean => {
    const request = getUserSpeakingRequest(pubkey);
    const permission = getUserSpeakingPermission(pubkey);
    
    if (!request || !permission) return false;
    
    const requestStatus = request.tags.find(([name]) => name === 'status')?.[1];
    const permissionStatus = permission.tags.find(([name]) => name === 'status')?.[1];
    const permissionTime = permission.created_at;
    const requestTime = request.created_at;
    
    // Check if:
    // 1. User's latest request was "requested"
    // 2. There's a newer permission with "denied" status
    return requestStatus === 'requested' && 
           permissionTime > requestTime && 
           permissionStatus === 'denied';
  };

  const hasPendingSpeakingInvitation = (pubkey: string): boolean => {
    const invitation = getUserSpeakingInvitation(pubkey);
    return invitation?.tags.find(([name, value]) => name === 'status' && value === 'invited') !== undefined;
  };

  return {
    speakingRequests,
    speakingPermissions,
    speakingInvitations,
    isLoading,
    requestToSpeak,
    cancelSpeakingRequest,
    grantSpeakingPermission,
    denySpeakingPermission,
    revokeSpeakingPermission,
    inviteToSpeak,
    acceptSpeakingInvitation,
    declineSpeakingInvitation,
    removeSpeakingCapability,
    getUserSpeakingRequest,
    getUserSpeakingPermission,
    getUserSpeakingInvitation,
    hasActiveSpeakingPermission,
    hasPendingSpeakingRequest,
    hasRequestDenied,
    hasPendingSpeakingInvitation,
  };
}