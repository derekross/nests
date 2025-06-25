import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Switch } from '@/components/ui/switch';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';

const editNestSchema = z.object({
  room: z.string().min(1, 'Nest name is required'),
  summary: z.string().optional(),
  image: z.string().url().optional().or(z.literal('')),
  hashtags: z.string().optional(),
  status: z.enum(['open', 'private', 'closed']),
  hls_stream: z.boolean().default(false),
});

type EditNestForm = z.infer<typeof editNestSchema>;

interface EditNestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  nest: NostrEvent;
  onNestUpdated?: () => void;
}

export function EditNestDialog({ isOpen, onClose, nest, onNestUpdated }: EditNestDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useCurrentUser();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EditNestForm>({
    resolver: zodResolver(editNestSchema),
    defaultValues: {
      room: '',
      summary: '',
      image: '',
      hashtags: '',
      status: 'open',
      hls_stream: false,
    },
  });

  // Extract current nest data and populate form
  useEffect(() => {
    if (nest) {
      const room = nest.tags.find(([name]) => name === 'room')?.[1] || '';
      const summary = nest.tags.find(([name]) => name === 'summary')?.[1] || '';
      const image = nest.tags.find(([name]) => name === 'image')?.[1] || '';
      const status = nest.tags.find(([name]) => name === 'status')?.[1] as 'open' | 'private' | 'closed' || 'open';
      const hashtags = nest.tags.filter(([name]) => name === 't').map(([, tag]) => tag);
      
      // Check if HLS streaming is enabled (look for streaming tags)
      const hasHlsStream = nest.tags.some(([name]) => name === 'streaming');

      form.reset({
        room,
        summary,
        image,
        hashtags: hashtags.join(', '),
        status,
        hls_stream: hasHlsStream,
      });
    }
  }, [nest, form]);

  const onSubmit = async (data: EditNestForm) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to edit a nest.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get the original nest identifier
      const d = nest.tags.find(([name]) => name === 'd')?.[1];
      if (!d) {
        throw new Error('Original nest identifier not found');
      }

      // Parse hashtags
      const hashtags = data.hashtags
        ? data.hashtags.split(',').map(tag => tag.trim()).filter(Boolean)
        : [];

      // Preserve original tags that shouldn't be changed
      const originalTags = nest.tags.filter(([name]) => 
        ['d', 'service', 'p'].includes(name)
      );

      // Build new tags
      const tags = [
        ...originalTags,
        ['room', data.room.trim()],
        ['status', data.status],
      ];

      // Add optional tags
      if (data.summary?.trim()) {
        tags.push(['summary', data.summary.trim()]);
      }

      if (data.image?.trim()) {
        tags.push(['image', data.image.trim()]);
      }

      // Add hashtags
      hashtags.forEach(tag => {
        if (tag.trim()) {
          tags.push(['t', tag.trim().toLowerCase()]);
        }
      });

      // Handle HLS streaming - preserve existing streaming endpoints if enabled
      if (data.hls_stream) {
        const existingStreamingTags = nest.tags.filter(([name]) => name === 'streaming');
        tags.push(...existingStreamingTags);
      }

      // Preserve other important tags like starts, status (live/ended), etc.
      const preserveTags = nest.tags.filter(([name]) => 
        ['starts', 'ends'].includes(name)
      );
      tags.push(...preserveTags);

      // Create updated nest event
      const updatedEvent = await createEvent({
        kind: 30312,
        content: '',
        tags,
      });

      // Create naddr for cache invalidation
      const nestNaddr = nip19.naddrEncode({
        kind: 30312,
        pubkey: updatedEvent.pubkey,
        identifier: d,
      });

      // Invalidate and refetch the specific nest query
      queryClient.invalidateQueries({ queryKey: ['nest', nestNaddr] });
      
      // Invalidate the general nests list to ensure it shows updated data
      queryClient.invalidateQueries({ queryKey: ['nests'] });

      // Optionally update the cache directly with the new event
      queryClient.setQueryData(['nest', nestNaddr], updatedEvent);

      toast({
        title: "Nest Updated",
        description: "Your nest has been successfully updated.",
      });

      onNestUpdated?.();
      onClose();
    } catch (error) {
      console.error('Failed to update nest:', error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update nest. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };



  if (!user) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Nest</DialogTitle>
          <DialogDescription>
            Update your nest settings. Changes will be published to the Nostr network.
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
                      <Button
                        type="button"
                        variant={field.value === 'closed' ? 'default' : 'outline'}
                        onClick={() => field.onChange('closed')}
                        className={`flex-1 ${field.value === 'closed' ? 'bg-gradient-purple glow-purple' : ''}`}
                      >
                        Closed
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Open nests can be joined by anyone. Private nests require invitation. Closed nests don't accept new participants.
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="bg-gradient-purple hover:opacity-90 glow-purple"
              >
                {isSubmitting ? 'Updating...' : 'Update Nest'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}