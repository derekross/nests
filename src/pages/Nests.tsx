import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LoginArea } from '@/components/auth/LoginArea';
import { RelaySelector } from '@/components/RelaySelector';
import { NestCard } from '@/components/NestCard';
import { CreateNestDialog } from '@/components/CreateNestDialog';
import { NestRoom } from '@/components/NestRoom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useNests } from '@/hooks/useNests';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Plus, Search, Mic, Users, Zap } from 'lucide-react';

export function Nests() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNest, setSelectedNest] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'live' | 'open'>('all');
  
  const { data: nests, isLoading } = useNests();
  const { user } = useCurrentUser();

  // Filter nests based on search and status
  const filteredNests = nests?.filter(nest => {
    const room = nest.tags.find(([name]) => name === 'room')?.[1] || '';
    const summary = nest.tags.find(([name]) => name === 'summary')?.[1] || '';
    const status = nest.tags.find(([name]) => name === 'status')?.[1] || '';
    const hashtags = nest.tags.filter(([name]) => name === 't').map(([, tag]) => tag);
    
    // Search filter
    const searchText = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      room.toLowerCase().includes(searchText) ||
      summary.toLowerCase().includes(searchText) ||
      hashtags.some(tag => tag.toLowerCase().includes(searchText));
    
    // Status filter
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'live' && status === 'live') ||
      (filterStatus === 'open' && (status === 'open' || status === 'live'));
    
    return matchesSearch && matchesStatus;
  }) || [];

  const handleJoinNest = (nestNaddr: string) => {
    setSelectedNest(nestNaddr);
  };

  const handleLeaveNest = () => {
    setSelectedNest(null);
  };

  const handleNestCreated = (nestNaddr: string) => {
    setSelectedNest(nestNaddr);
  };

  // If a nest is selected, show the room interface
  if (selectedNest) {
    return (
      <NestRoom 
        nestNaddr={selectedNest} 
        onLeave={handleLeaveNest}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-gradient-purple-soft">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-purple glow-purple">
                  <Mic className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gradient-purple">Nests</h1>
                  <p className="text-sm text-muted-foreground">
                    Nostr audio spaces for chatting, jamming, and live events
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <RelaySelector />
              <LoginArea className="max-w-60" />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search nests, topics, or hashtags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('all')}
              size="sm"
              className={filterStatus === 'all' ? 'bg-gradient-purple glow-purple' : ''}
            >
              All
            </Button>
            <Button
              variant={filterStatus === 'live' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('live')}
              size="sm"
              className={filterStatus === 'live' ? 'bg-gradient-purple glow-purple' : ''}
            >
              Live
            </Button>
            <Button
              variant={filterStatus === 'open' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('open')}
              size="sm"
              className={filterStatus === 'open' ? 'bg-gradient-purple glow-purple' : ''}
            >
              Open
            </Button>
          </div>

          {user && (
            <CreateNestDialog onNestCreated={handleNestCreated}>
              <Button className="flex items-center gap-2 bg-gradient-purple hover:opacity-90 glow-purple">
                <Plus className="h-4 w-4" />
                Create Nest
              </Button>
            </CreateNestDialog>
          )}
        </div>

        {/* Features section for new users */}
        {!user && (
          <Card className="mb-6 bg-gradient-purple-soft border-primary/20">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold text-gradient-purple">Welcome to Nests</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                  Nostr Nests is an audio space for chatting, jamming, micro-conferences, 
                  live podcast recordings, etc. that's powered by Nostr.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                  <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-card border border-primary/10">
                    <div className="p-3 rounded-full bg-primary/10">
                      <Users className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg">Join Conversations</h3>
                    <p className="text-sm text-muted-foreground text-center">
                      Listen to live discussions or raise your hand to speak
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-card border border-primary/10">
                    <div className="p-3 rounded-full bg-primary/10">
                      <Mic className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg">Host Your Own</h3>
                    <p className="text-sm text-muted-foreground text-center">
                      Create nests for any topic and moderate the conversation
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-card border border-primary/10">
                    <div className="p-3 rounded-full bg-primary/10">
                      <Zap className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg">Support Creators</h3>
                    <p className="text-sm text-muted-foreground text-center">
                      Send zaps to show appreciation for great content
                    </p>
                  </div>
                </div>
                <div className="pt-6">
                  <LoginArea className="mx-auto max-w-60" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Nests grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-16 w-16 rounded-lg" />
                    </div>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                    <Skeleton className="h-10 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredNests.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredNests.map((nest) => (
              <NestCard
                key={nest.id}
                nest={nest}
                onJoin={handleJoinNest}
              />
            ))}
          </div>
        ) : (
          <div className="col-span-full">
            <Card className="border-dashed">
              <CardContent className="py-12 px-8 text-center">
                <div className="max-w-sm mx-auto space-y-6">
                  <Mic className="h-12 w-12 text-muted-foreground mx-auto" />
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      {searchQuery ? 'No nests found' : 'No nests available'}
                    </h3>
                    <p className="text-muted-foreground">
                      {searchQuery 
                        ? 'Try adjusting your search or filters'
                        : 'No active nests found. Try another relay or create your own!'
                      }
                    </p>
                  </div>
                  <div className="space-y-3">
                    {user && (
                      <CreateNestDialog onNestCreated={handleNestCreated}>
                        <Button className="w-full bg-gradient-purple hover:opacity-90 glow-purple">
                          <Plus className="h-4 w-4 mr-2" />
                          Create Your First Nest
                        </Button>
                      </CreateNestDialog>
                    )}
                    <RelaySelector className="w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>
            Vibed with{' '}
            <a 
              href="https://soapbox.pub/mkstack" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              MKStack
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}