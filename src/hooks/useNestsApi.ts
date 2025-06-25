import { useMutation } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';
import { NUser } from '@nostrify/react/login';

interface CreateNestRequest {
  relays: string[];
  hls_stream?: boolean;
}

interface CreateNestResponse {
  roomId: string;
  endpoints: string[];
  token: string;
}

interface JoinNestResponse {
  token: string;
}

interface UpdatePermissionsRequest {
  participant: string;
  can_publish?: boolean;
  mute_microphone?: boolean;
  is_admin?: boolean;
}

interface NestInfo {
  host: string;
  speakers: string[];
  admins: string[];
  link: string;
  recording: boolean;
}

const NESTS_API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://nostrnests.com/api/v1/nests'
  : 'http://localhost:5544/api/v1/nests';

/**
 * Hook for creating a new nest
 */
export function useCreateNest() {
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (request: CreateNestRequest): Promise<CreateNestResponse> => {
      if (!user) throw new Error('User must be logged in');

      const authHeader = await createNip98AuthHeader(user, 'PUT', `${NESTS_API_BASE}`, JSON.stringify(request));
      
      const response = await fetch(NESTS_API_BASE, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Failed to create nest: ${response.statusText}`);
      }

      return response.json();
    },
  });
}

/**
 * Hook for joining an existing nest
 */
export function useJoinNest() {
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (roomId: string): Promise<JoinNestResponse> => {
      if (!user) throw new Error('User must be logged in');

      const url = `${NESTS_API_BASE}/${roomId}`;
      console.log('Joining nest with authenticated user:', { roomId, url });
      
      const authHeader = await createNip98AuthHeader(user, 'GET', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
        },
      });

      console.log('Join nest response:', { 
        status: response.status, 
        statusText: response.statusText,
        url 
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error('Join nest failed:', { status: response.status, errorText });
        throw new Error(`Failed to join nest: ${response.statusText}`);
      }

      return response.json();
    },
  });
}

/**
 * Hook for joining a nest as a guest (no auth required)
 */
export function useJoinNestAsGuest() {
  return useMutation({
    mutationFn: async (roomId: string): Promise<JoinNestResponse> => {
      const url = `${NESTS_API_BASE}/${roomId}/guest`;
      console.log('Joining nest as guest:', { roomId, url });
      
      const response = await fetch(url, {
        method: 'GET',
      });

      console.log('Join nest as guest response:', { 
        status: response.status, 
        statusText: response.statusText,
        url 
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error('Join nest as guest failed:', { status: response.status, errorText });
        throw new Error(`Failed to join nest as guest: ${response.statusText}`);
      }

      return response.json();
    },
  });
}

/**
 * Hook for updating nest permissions
 */
export function useUpdateNestPermissions() {
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ roomId, ...request }: UpdatePermissionsRequest & { roomId: string }) => {
      if (!user) throw new Error('User must be logged in');

      const authHeader = await createNip98AuthHeader(user, 'POST', `${NESTS_API_BASE}/${roomId}/permissions`, JSON.stringify(request));
      
      const response = await fetch(`${NESTS_API_BASE}/${roomId}/permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Failed to update permissions: ${response.statusText}`);
      }

      return response.status;
    },
  });
}

/**
 * Hook for restarting a nest (host only)
 */
export function useRestartNest() {
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (roomId: string): Promise<CreateNestResponse> => {
      if (!user) throw new Error('User must be logged in');

      const url = `${NESTS_API_BASE}/${roomId}/restart`;
      console.log('Restarting nest:', { roomId, url });
      
      const authHeader = await createNip98AuthHeader(user, 'POST', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
        },
      });

      console.log('Restart nest response:', { 
        status: response.status, 
        statusText: response.statusText,
        url 
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error('Restart nest failed:', { status: response.status, errorText });
        
        if (response.status === 403) {
          throw new Error('Only the host can restart the nest');
        } else if (response.status === 404) {
          throw new Error('Nest not found');
        } else {
          throw new Error(`Failed to restart nest: ${response.statusText}`);
        }
      }

      const jsonResponse = await response.json();
      console.log('Restart nest JSON response:', jsonResponse);
      console.log('Restart nest token analysis:', {
        hasToken: 'token' in jsonResponse,
        tokenType: typeof jsonResponse.token,
        tokenValue: jsonResponse.token,
        tokenIsString: typeof jsonResponse.token === 'string',
        tokenLength: jsonResponse.token?.length,
        tokenPreview: typeof jsonResponse.token === 'string' ? jsonResponse.token.substring(0, 50) + '...' : 'Not a string'
      });

      return jsonResponse;
    },
  });
}

/**
 * Hook for getting nest info
 */
export function useGetNestInfo() {
  return useMutation({
    mutationFn: async (roomId: string): Promise<NestInfo> => {
      const response = await fetch(`${NESTS_API_BASE}/${roomId}/info`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Failed to get nest info: ${response.statusText}`);
      }

      return response.json();
    },
  });
}

/**
 * Creates a NIP-98 authorization header
 */
async function createNip98AuthHeader(user: NUser, method: string, url: string, body?: string): Promise<string> {
  if (!user) {
    throw new Error('User must be logged in to create NIP-98 auth header');
  }

  // Create the tags for the NIP-98 event
  const tags: string[][] = [
    ['u', url],
    ['method', method.toUpperCase()],
  ];

  // If there's a request body, include its SHA256 hash
  if (body) {
    const encoder = new TextEncoder();
    const data = encoder.encode(body);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const payloadHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    tags.push(['payload', payloadHash]);
  }

  // Create the unsigned event
  const unsignedEvent = {
    kind: 27235,
    content: '',
    tags,
    created_at: Math.floor(Date.now() / 1000),
    pubkey: user.pubkey,
  };

  // Sign the event using the user's signer
  const signedEvent = await user.signer.signEvent(unsignedEvent);

  // Base64 encode the signed event
  const encodedEvent = btoa(JSON.stringify(signedEvent));

  // Return the Authorization header value
  return `Nostr ${encodedEvent}`;
}