import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { Users, Mic } from 'lucide-react';
import type { NostrEvent } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

interface NestCardProps {
  nest: NostrEvent;
  onJoin: (nestNaddr: string) => void;
}

export function NestCard({ nest, onJoin }: NestCardProps) {
  // Extract nest data from tags
  const d = nest.tags.find(([name]) => name === 'd')?.[1] || '';
  const room = nest.tags.find(([name]) => name === 'room')?.[1] || 'Untitled Nest';
  const summary = nest.tags.find(([name]) => name === 'summary')?.[1] || '';
  const image = nest.tags.find(([name]) => name === 'image')?.[1];
  const status = nest.tags.find(([name]) => name === 'status')?.[1] || 'closed';
  const currentParticipants = nest.tags.find(([name]) => name === 'current_participants')?.[1];
  const totalParticipants = nest.tags.find(([name]) => name === 'total_participants')?.[1];
  const hashtags = nest.tags.filter(([name]) => name === 't').map(([, tag]) => tag);
  
  // Get host information (first p tag)
  const hostTag = nest.tags.find(([name]) => name === 'p');
  const hostPubkey = hostTag?.[1];
  const hostRole = hostTag?.[3] || 'Host';
  
  const host = useAuthor(hostPubkey);
  const hostName = host.data?.metadata?.name || genUserName(hostPubkey || '');
  const hostAvatar = host.data?.metadata?.picture;

  // Create naddr for this nest
  const nestNaddr = nip19.naddrEncode({
    kind: 30312,
    pubkey: nest.pubkey,
    identifier: d,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-green-500';
      case 'open': return 'bg-primary';
      case 'private': return 'bg-yellow-500';
      case 'closed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'live': return 'Live';
      case 'open': return 'Open';
      case 'private': return 'Private';
      case 'closed': return 'Closed';
      default: return 'Unknown';
    }
  };

  const isJoinable = status === 'live' || status === 'open';

  return (
    <Card className="hover:shadow-lg hover:shadow-primary/10 transition-all duration-200 border-primary/10 hover:border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className={`${getStatusColor(status)} text-white`}>
                {getStatusText(status)}
              </Badge>
              {status === 'live' && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Mic className="h-3 w-3" />
                  <span>Live</span>
                </div>
              )}
            </div>
            <h3 className="font-semibold text-lg leading-tight mb-1 truncate">
              {room}
            </h3>
            {summary && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {summary}
              </p>
            )}
          </div>
          {image && (
            <img 
              src={image} 
              alt={room}
              className="w-16 h-16 rounded-lg object-cover ml-3 flex-shrink-0"
            />
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Host info */}
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={hostAvatar} />
              <AvatarFallback className="text-xs">
                {hostName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">
              {hostRole}: {hostName}
            </span>
          </div>

          {/* Participant count */}
          {(currentParticipants || totalParticipants) && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>
                {currentParticipants && totalParticipants 
                  ? `${currentParticipants}/${totalParticipants} participants`
                  : currentParticipants 
                    ? `${currentParticipants} participants`
                    : `${totalParticipants} total participants`
                }
              </span>
            </div>
          )}

          {/* Hashtags */}
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {hashtags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  #{tag}
                </Badge>
              ))}
              {hashtags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{hashtags.length - 3} more
                </Badge>
              )}
            </div>
          )}

          {/* Join button */}
          <Button 
            onClick={() => onJoin(nestNaddr)}
            disabled={!isJoinable}
            className={`w-full ${isJoinable ? 'bg-gradient-purple hover:opacity-90 glow-purple' : ''}`}
            variant={isJoinable ? "default" : "secondary"}
          >
            {isJoinable ? 'Join Nest' : 'Nest Closed'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}