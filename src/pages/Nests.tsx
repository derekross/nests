import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { LoginArea } from '@/components/auth/LoginArea';

import { NestCard } from '@/components/NestCard';
import { CreateNestDialog } from '@/components/CreateNestDialog';
import { NestRoom } from '@/components/NestRoom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useNests } from '@/hooks/useNests';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsMobile } from '@/hooks/useIsMobile';
import { 
  Plus, 
  Search, 
  Mic, 
  Users, 
  Zap, 
  Radio, 
  Globe, 
  Shield, 
  Headphones,
  MessageCircle,
  Calendar,
  Podcast,
  Music,
  Briefcase,
  GraduationCap,
  Heart,
  ArrowRight,
  Play,
  Volume2,
  Menu,
  X
} from 'lucide-react';

export function Nests() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNest, setSelectedNest] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'live' | 'open'>('live');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const { data: nests, isLoading } = useNests();
  const { user } = useCurrentUser();
  const isMobile = useIsMobile();

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
    const matchesStatus = (filterStatus === 'live' && status === 'live') ||
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

  const handleExploreLiveNests = () => {
    setFilterStatus('live');
    // Scroll to nests section
    const nestsSection = document.getElementById('nests-section');
    if (nestsSection) {
      nestsSection.scrollIntoView({ behavior: 'smooth' });
    }
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
      <header className="sticky top-0 z-50 border-b bg-gradient-purple-soft/95 backdrop-blur-sm">
        <div className="container mx-auto">
          <div className="flex items-center justify-between py-3 sm:py-4">
            {/* Logo and title */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gradient-purple glow-purple">
                <Mic className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-gradient-purple truncate">Nests</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  Decentralized audio spaces on Nostr
                </p>
              </div>
            </div>

            {/* Desktop navigation */}
            <div className="hidden md:flex items-center gap-3">
              <LoginArea className="max-w-60" />
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="touch-target"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {/* Mobile navigation menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t bg-background/95 backdrop-blur-sm">
              <div className="py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Theme</span>
                  <ThemeToggle />
                </div>
                <div className="pt-2 border-t">
                  <LoginArea className="w-full" />
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      {!user && (
        <section className="bg-gradient-purple-soft border-b">
          <div className="container mx-auto py-8 sm:py-12 lg:py-16">
            <div className="text-center max-w-4xl mx-auto space-y-6 sm:space-y-8">
              <div className="space-y-4 sm:space-y-6">
                <Badge variant="secondary" className="text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
                  <Radio className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  Powered by Nostr Protocol
                </Badge>
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gradient-purple leading-tight">
                  Your Voice,<br />
                  <span className="text-foreground">Uncensored</span>
                </h1>
                <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed px-4 sm:px-0">
                  Join the revolution of decentralized audio conversations. Host live discussions, 
                  attend virtual events, and connect with communities worldwide—all without 
                  platform restrictions or algorithmic interference.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center px-4 sm:px-0">
                <LoginArea className="w-full sm:w-auto sm:max-w-60" />
                <Button 
                  variant="outline" 
                  size={isMobile ? "default" : "lg"} 
                  className="w-full sm:w-auto flex items-center justify-center gap-2"
                  onClick={handleExploreLiveNests}
                >
                  <Play className="h-4 w-4" />
                  Listen to Live Nests
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 pt-6 sm:pt-8 border-t border-border/50 px-4 sm:px-0">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-gradient-purple">100%</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Decentralized</div>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-gradient-purple">0</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Censorship</div>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-gradient-purple">∞</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Possibilities</div>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-gradient-purple">24/7</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Available</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      {!user && (
        <section className="py-8 sm:py-12 lg:py-16">
          <div className="container mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4">
                Why Choose <span className="text-gradient-purple">Nests</span>?
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4 sm:px-0">
                Experience the future of audio communication with true ownership, 
                privacy, and freedom of expression.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              <Card className="border-primary/20 hover:border-primary/40 transition-colors">
                <CardContent className="p-4 sm:p-6 text-center space-y-3 sm:space-y-4">
                  <div className="p-3 sm:p-4 rounded-full bg-gradient-purple glow-purple w-fit mx-auto">
                    <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold">Truly Decentralized</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Built on Nostr protocol. No single point of failure, no corporate control. 
                    Your conversations belong to you.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20 hover:border-primary/40 transition-colors">
                <CardContent className="p-4 sm:p-6 text-center space-y-3 sm:space-y-4">
                  <div className="p-3 sm:p-4 rounded-full bg-gradient-purple glow-purple w-fit mx-auto">
                    <Globe className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold">Global Reach</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Connect with people worldwide. No geographical restrictions, 
                    no platform bans. True global communication.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20 hover:border-primary/40 transition-colors">
                <CardContent className="p-4 sm:p-6 text-center space-y-3 sm:space-y-4">
                  <div className="p-3 sm:p-4 rounded-full bg-gradient-purple glow-purple w-fit mx-auto">
                    <Zap className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold">Lightning Integration</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Support creators instantly with Bitcoin Lightning zaps. 
                    Monetize your content without intermediaries.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20 hover:border-primary/40 transition-colors">
                <CardContent className="p-4 sm:p-6 text-center space-y-3 sm:space-y-4">
                  <div className="p-3 sm:p-4 rounded-full bg-gradient-purple glow-purple w-fit mx-auto">
                    <Users className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold">Community Driven</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Join vibrant communities or create your own. Moderate discussions 
                    your way, with your rules.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20 hover:border-primary/40 transition-colors">
                <CardContent className="p-4 sm:p-6 text-center space-y-3 sm:space-y-4">
                  <div className="p-3 sm:p-4 rounded-full bg-gradient-purple glow-purple w-fit mx-auto">
                    <Volume2 className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold">High Quality Audio</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Crystal clear audio powered by modern web technologies. 
                    Perfect for podcasts, music, and professional discussions.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20 hover:border-primary/40 transition-colors">
                <CardContent className="p-4 sm:p-6 text-center space-y-3 sm:space-y-4">
                  <div className="p-3 sm:p-4 rounded-full bg-gradient-purple glow-purple w-fit mx-auto">
                    <Headphones className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold">Listen or Participate</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Join as a listener or raise your hand to speak. 
                    Flexible participation for every type of user.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      )}

      {/* Use Cases Section */}
      {!user && (
        <section className="py-8 sm:py-12 lg:py-16 bg-gradient-purple-soft">
          <div className="container mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4">
                Perfect for <span className="text-gradient-purple">Every Occasion</span>
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4 sm:px-0">
                From casual chats to professional conferences, Nests adapts to your needs.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <Card className="text-center p-4 sm:p-6 hover:shadow-lg transition-shadow">
                <div className="p-2.5 sm:p-3 rounded-full bg-primary/10 w-fit mx-auto mb-3 sm:mb-4">
                  <Podcast className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold mb-2">Podcast Recording</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Record live podcasts with guests and audience interaction
                </p>
              </Card>

              <Card className="text-center p-4 sm:p-6 hover:shadow-lg transition-shadow">
                <div className="p-2.5 sm:p-3 rounded-full bg-primary/10 w-fit mx-auto mb-3 sm:mb-4">
                  <Music className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold mb-2">Music Jamming</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Collaborate with musicians and share live performances
                </p>
              </Card>

              <Card className="text-center p-4 sm:p-6 hover:shadow-lg transition-shadow">
                <div className="p-2.5 sm:p-3 rounded-full bg-primary/10 w-fit mx-auto mb-3 sm:mb-4">
                  <Briefcase className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold mb-2">Business Meetings</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Host team meetings and client calls with privacy
                </p>
              </Card>

              <Card className="text-center p-4 sm:p-6 hover:shadow-lg transition-shadow">
                <div className="p-2.5 sm:p-3 rounded-full bg-primary/10 w-fit mx-auto mb-3 sm:mb-4">
                  <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold mb-2">Educational Sessions</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Teach courses and host study groups with students
                </p>
              </Card>

              <Card className="text-center p-4 sm:p-6 hover:shadow-lg transition-shadow">
                <div className="p-2.5 sm:p-3 rounded-full bg-primary/10 w-fit mx-auto mb-3 sm:mb-4">
                  <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold mb-2">Community Chats</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Build communities around shared interests and hobbies
                </p>
              </Card>

              <Card className="text-center p-4 sm:p-6 hover:shadow-lg transition-shadow">
                <div className="p-2.5 sm:p-3 rounded-full bg-primary/10 w-fit mx-auto mb-3 sm:mb-4">
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold mb-2">Live Events</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Host conferences, AMAs, and special events
                </p>
              </Card>

              <Card className="text-center p-4 sm:p-6 hover:shadow-lg transition-shadow">
                <div className="p-2.5 sm:p-3 rounded-full bg-primary/10 w-fit mx-auto mb-3 sm:mb-4">
                  <Heart className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold mb-2">Support Groups</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Create safe spaces for mental health and wellness
                </p>
              </Card>

              <Card className="text-center p-4 sm:p-6 hover:shadow-lg transition-shadow">
                <div className="p-2.5 sm:p-3 rounded-full bg-primary/10 w-fit mx-auto mb-3 sm:mb-4">
                  <Radio className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold mb-2">Radio Shows</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Broadcast your own radio show to a global audience
                </p>
              </Card>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      {!user && (
        <section className="py-8 sm:py-12 lg:py-16">
          <div className="container mx-auto">
            <Card className="bg-gradient-purple glow-purple text-white border-0">
              <CardContent className="p-6 sm:p-8 lg:p-12 text-center">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4">
                  Ready to Join the Conversation?
                </h2>
                <p className="text-base sm:text-lg opacity-90 mb-6 sm:mb-8 max-w-2xl mx-auto">
                  Start hosting your own audio spaces or join existing conversations. 
                  No algorithms, no censorship, just pure human connection.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                  <LoginArea className="w-full sm:w-auto sm:max-w-60" />
                  <Button 
                    variant="secondary" 
                    size={isMobile ? "default" : "lg"} 
                    className="w-full sm:w-auto flex items-center justify-center gap-2"
                    onClick={handleExploreLiveNests}
                  >
                    Explore Live Nests
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      <div id="nests-section" className="container mx-auto py-4 sm:py-6">
        {/* Search and filters */}
        <div className="flex flex-col gap-4 mb-6">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search nests, topics, or hashtags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 touch-target"
            />
          </div>
          
          {/* Filters and create button */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex gap-2 flex-1">
              <Button
                variant={filterStatus === 'live' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('live')}
                size="sm"
                className={`flex-1 sm:flex-none touch-target ${filterStatus === 'live' ? 'bg-gradient-purple glow-purple' : ''}`}
              >
                Live
              </Button>
              <Button
                variant={filterStatus === 'open' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('open')}
                size="sm"
                className={`flex-1 sm:flex-none touch-target ${filterStatus === 'open' ? 'bg-gradient-purple glow-purple' : ''}`}
              >
                Open
              </Button>
            </div>

            {user && (
              <CreateNestDialog onNestCreated={handleNestCreated}>
                <Button className="flex items-center justify-center gap-2 bg-gradient-purple hover:opacity-90 glow-purple touch-target w-full sm:w-auto">
                  <Plus className="h-4 w-4" />
                  <span className="sm:inline">Create Nest</span>
                </Button>
              </CreateNestDialog>
            )}
          </div>
        </div>

        {/* Quick stats for logged in users */}
        {user && (
          <Card className="mb-6 bg-gradient-purple-soft border-primary/20">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-purple glow-purple flex-shrink-0">
                    <Radio className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base">Welcome back!</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Discover active conversations and create your own nests
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:gap-6 text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-gradient-purple text-lg sm:text-xl">{filteredNests.length}</div>
                    <div className="text-muted-foreground text-xs sm:text-sm">Active Nests</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gradient-purple text-lg sm:text-xl">
                      {filteredNests.filter(nest => 
                        nest.tags.find(([name]) => name === 'status')?.[1] === 'live'
                      ).length}
                    </div>
                    <div className="text-muted-foreground text-xs sm:text-sm">Live Now</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Nests grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 sm:h-6 w-16" />
                      <Skeleton className="h-12 w-12 sm:h-16 sm:w-16 rounded-lg" />
                    </div>
                    <Skeleton className="h-5 sm:h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 sm:h-6 w-16" />
                      <Skeleton className="h-5 sm:h-6 w-20" />
                    </div>
                    <Skeleton className="h-9 sm:h-10 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredNests.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
              <CardContent className="py-8 sm:py-12 px-6 sm:px-8 text-center">
                <div className="max-w-sm mx-auto space-y-4 sm:space-y-6">
                  <Mic className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto" />
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold mb-2">
                      {searchQuery ? 'No nests found' : 'No nests available'}
                    </h3>
                    <p className="text-sm sm:text-base text-muted-foreground">
                      {searchQuery 
                        ? 'Try adjusting your search or filters'
                        : 'No active nests found. Try another relay or create your own!'
                      }
                    </p>
                  </div>
                  <div className="space-y-3">
                    {user && (
                      <CreateNestDialog onNestCreated={handleNestCreated}>
                        <Button className="w-full bg-gradient-purple hover:opacity-90 glow-purple touch-target">
                          <Plus className="h-4 w-4 mr-2" />
                          Create Your First Nest
                        </Button>
                      </CreateNestDialog>
                    )}
                    {!user && (
                      <p className="text-sm text-muted-foreground">
                        Log in to create nests or switch relays to discover content
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t text-center text-xs sm:text-sm text-muted-foreground">
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