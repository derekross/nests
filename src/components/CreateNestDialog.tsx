import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCreateNest } from '@/hooks/useNestsApi';
import { useAppContext } from '@/hooks/useAppContext';
import { nip19 } from 'nostr-tools';

const createNestSchema = z.object({
  room: z.string().min(1, 'Nest name is required'),
  summary: z.string().optional(),
  image: z.string().url().optional().or(z.literal('')),
  hashtags: z.string().optional(),
  status: z.enum(['open', 'private']),
  hls_stream: z.boolean().default(false),
});

type CreateNestForm = z.infer<typeof createNestSchema>;

interface CreateNestDialogProps {
  children: React.ReactNode;
  onNestCreated?: (nestNaddr: string) => void;
}

export function CreateNestDialog({ children, onNestCreated }: CreateNestDialogProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const { user } = useCurrentUser();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { mutateAsync: createNest } = useCreateNest();
  const { config } = useAppContext();

  const form = useForm<CreateNestForm>({
    resolver: zodResolver(createNestSchema),
    defaultValues: {
      room: '',
      summary: '',
      image: '',
      hashtags: '',
      status: 'open',
      hls_stream: true,
    },
  });

  const onSubmit = async (data: CreateNestForm) => {
    if (!user) return;

    setIsCreating(true);
    try {
      // Create nest via API
      const response = await createNest({
        relays: [config.relayUrl],
        hls_stream: data.hls_stream,
      });

      // Parse hashtags
      const hashtags = data.hashtags
        ? data.hashtags.split(',').map(tag => tag.trim()).filter(Boolean)
        : [];

      // Create nest event (kind 30312)
      const tags: string[][] = [
        ['d', response.roomId],
        ['room', data.room],
        ['status', data.status],
        ['service', import.meta.env.VITE_NESTS_API_URL || (process.env.NODE_ENV === 'production' ? 'https://dev.nostrnests.com/api/v1/nests' : 'http://localhost:5544/api/v1/nests')],
        ['p', user.pubkey, '', 'Host'],
      ];

      if (data.summary) {
        tags.push(['summary', data.summary]);
      }

      if (data.image) {
        tags.push(['image', data.image]);
      }

      // Add streaming endpoints
      response.endpoints.forEach(endpoint => {
        tags.push(['streaming', endpoint]);
      });

      // Add hashtags
      hashtags.forEach(tag => {
        tags.push(['t', tag]);
      });

      // Add current timestamp as start time
      tags.push(['starts', Math.floor(Date.now() / 1000).toString()]);

      // Wait for the Nostr event to be published
      await createEvent({
        kind: 30312,
        content: '',
        tags,
      });

      // Create naddr for the new nest
      const nestNaddr = nip19.naddrEncode({
        kind: 30312,
        pubkey: user.pubkey,
        identifier: response.roomId,
      });

      setOpen(false);
      form.reset();
      onNestCreated?.(nestNaddr);
    } catch (error) {
      console.error('Failed to create nest:', error);
    } finally {
      setIsCreating(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Nest</DialogTitle>
          <DialogDescription>
            Create a new audio space for conversations, discussions, or events.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="room"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nest Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="My Awesome Nest" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="What's this nest about?"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cover Image URL</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="https://example.com/image.jpg"
                      type="url"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hashtags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hashtags</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="bitcoin, nostr, technology"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Separate multiple hashtags with commas
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nest Type</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={field.value === 'open' ? 'default' : 'outline'}
                        onClick={() => field.onChange('open')}
                        className={`flex-1 ${field.value === 'open' ? 'bg-gradient-purple glow-purple' : ''}`}
                      >
                        Open
                      </Button>
                      <Button
                        type="button"
                        variant={field.value === 'private' ? 'default' : 'outline'}
                        onClick={() => field.onChange('private')}
                        className={`flex-1 ${field.value === 'private' ? 'bg-gradient-purple glow-purple' : ''}`}
                      >
                        Private
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Open nests can be joined by anyone. Private nests require invitation.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hls_stream"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>HLS Stream</FormLabel>
                    <FormDescription>
                      Enable HLS streaming for compatibility with other Nostr clients
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isCreating}
                className="bg-gradient-purple hover:opacity-90 glow-purple"
              >
                {isCreating ? 'Creating...' : 'Create Nest'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}