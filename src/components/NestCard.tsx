import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { Users, Mic } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { NostrEvent } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

interface NestCardProps {
  nest: NostrEvent;
}

export function NestCard({ nest }: NestCardProps) {
  const navigate = useNavigate();
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
      case 'open': return 'bg-green-500';
      case 'private': return 'bg-yellow-500';
      case 'closed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open': return 'Open';
      case 'private': return 'Private';
      case 'closed': return 'Closed';
      default: return 'Unknown';
    }
  };

  const isJoinable = status === 'open';

  const handleJoinNest = () => {
    if (isJoinable) {
      navigate(`/${nestNaddr}`);
    }
  };

  return (
    <Card className="hover:shadow-lg hover:shadow-primary/10 transition-all duration-200 border-primary/10 hover:border-primary/20 h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="secondary" className={`${getStatusColor(status)} text-white text-xs`}>
                {getStatusText(status)}
              </Badge>
              {status === 'open' && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Mic className="h-3 w-3" />
                  <span>Available</span>
                </div>
              )}
            </div>
            <h3 className="font-semibold text-base sm:text-lg leading-tight mb-1 line-clamp-2">
              {room}
            </h3>
            {summary && (
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                {summary}
              </p>
            )}
          </div>
          {image && (
            <img 
              src={image} 
              alt={room}
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover flex-shrink-0"
            />
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 flex-1 flex flex-col">
        <div className="space-y-3 flex-1">
          {/* Host info */}
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0">
              <AvatarImage src={hostAvatar} />
              <AvatarFallback className="text-xs">
                {hostName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs sm:text-sm text-muted-foreground truncate">
              {hostRole}: {hostName}
            </span>
          </div>

          {/* Participant count */}
          {(currentParticipants || totalParticipants) && (
            <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
              <Users className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="truncate">
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
        </div>

        {/* Join button */}
        <Button 
          onClick={handleJoinNest}
          disabled={!isJoinable}
          className={`w-full mt-4 touch-target ${isJoinable ? 'bg-gradient-purple hover:opacity-90 glow-purple' : ''}`}
          variant={isJoinable ? "default" : "secondary"}
          size="sm"
        >
          {isJoinable ? 'Join Nest' : 'Nest Closed'}
        </Button>
      </CardContent>
    </Card>
  );
}