import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/useToast';
import { useSpeakingRequests } from '@/hooks/useSpeakingRequests';
import { useCurrentUser } from '@/hooks/useCurrentUser';


interface SpeakingNotificationsProps {
  nestNaddr: string;
}

export function SpeakingNotifications({ nestNaddr }: SpeakingNotificationsProps) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { speakingPermissions } = useSpeakingRequests(nestNaddr);
  
  // Use ref to persist processed events across re-renders
  const processedEventsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!user) return;

    const processedEvents = processedEventsRef.current;

    // Check for speaking permission grants
    const userPermissions = speakingPermissions.filter(permission => {
      const targetPubkey = permission.tags.find(([name]) => name === 'p')?.[1];
      const status = permission.tags.find(([name]) => name === 'status')?.[1];
      return targetPubkey === user.pubkey && 
             status === 'granted' && 
             !processedEvents.has(permission.id);
    });

    userPermissions.forEach(permission => {
      processedEvents.add(permission.id);
      
      toast({
        title: "Speaking Permission Granted",
        description: "You can now unmute your microphone and speak in the nest.",
        duration: 5000,
      });
    });

    // Check for speaking permission denials
    const userDenials = speakingPermissions.filter(permission => {
      const targetPubkey = permission.tags.find(([name]) => name === 'p')?.[1];
      const status = permission.tags.find(([name]) => name === 'status')?.[1];
      return targetPubkey === user.pubkey && 
             status === 'denied' && 
             !processedEvents.has(permission.id);
    });

    userDenials.forEach(permission => {
      processedEvents.add(permission.id);
      
      toast({
        title: "Speaking Request Denied",
        description: "Your request to speak has been denied by the host.",
        variant: "destructive",
        duration: 5000,
      });
    });

    // Check for speaking permission revocations
    const userRevocations = speakingPermissions.filter(permission => {
      const targetPubkey = permission.tags.find(([name]) => name === 'p')?.[1];
      const status = permission.tags.find(([name]) => name === 'status')?.[1];
      return targetPubkey === user.pubkey && 
             status === 'revoked' && 
             !processedEvents.has(permission.id);
    });

    userRevocations.forEach(permission => {
      processedEvents.add(permission.id);
      
      toast({
        title: "Speaking Permission Revoked",
        description: "Your speaking permission has been revoked by the host.",
        variant: "destructive",
        duration: 5000,
      });
    });

    // Check for speaking permission removals (self-initiated)
    const userRemovals = speakingPermissions.filter(permission => {
      const targetPubkey = permission.tags.find(([name]) => name === 'p')?.[1];
      const status = permission.tags.find(([name]) => name === 'status')?.[1];
      return targetPubkey === user.pubkey && 
             status === 'removed' && 
             !processedEvents.has(permission.id);
    });

    userRemovals.forEach(permission => {
      processedEvents.add(permission.id);
      
      // Don't show toast for self-initiated removals as the mutation already shows one
    });

  }, [user, speakingPermissions, toast]);

  // This component doesn't render anything, it just handles notifications
  return null;
}

