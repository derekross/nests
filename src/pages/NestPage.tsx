import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { nip19 } from 'nostr-tools';
import { NestRoom } from '@/components/NestRoom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export function NestPage() {
  const { naddr } = useParams<{ naddr: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [validNaddr, setValidNaddr] = useState<string | null>(null);

  useEffect(() => {
    if (!naddr) {
      setError('No nest address provided');
      return;
    }

    try {
      // Validate and decode the naddr
      const decoded = nip19.decode(naddr);
      
      if (decoded.type !== 'naddr') {
        setError('Invalid nest address format. Expected naddr format.');
        return;
      }

      const { kind, pubkey, identifier } = decoded.data;
      
      // Verify it's a nest event (kind 30312)
      if (kind !== 30312) {
        setError(`Invalid event kind: ${kind}. Expected kind 30312 for nests.`);
        return;
      }

      // Validate required fields
      if (!pubkey || !identifier) {
        setError('Invalid nest address: missing required fields.');
        return;
      }

      // If validation passes, set the valid naddr
      setValidNaddr(naddr);
      setError(null);
    } catch (err) {
      console.error('Failed to decode naddr:', err);
      setError('Invalid nest address format. Please check the URL.');
    }
  }, [naddr]);

  const handleLeaveNest = () => {
    navigate('/');
  };

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <div className="flex justify-center">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <div>
              <h1 className="text-xl font-semibold mb-2">Invalid Nest Address</h1>
              <p className="text-muted-foreground text-sm">{error}</p>
            </div>
            <Button 
              onClick={handleLeaveNest}
              className="w-full"
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Nests
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading state while validating
  if (!validNaddr) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading nest...</p>
        </div>
      </div>
    );
  }

  // Show the nest room
  return (
    <NestRoom 
      nestNaddr={validNaddr} 
      onLeave={handleLeaveNest}
    />
  );
}