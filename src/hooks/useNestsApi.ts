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

interface DiagnosticCheck {
  status?: number;
  statusText?: string;
  url?: string;
  data?: unknown;
  error?: string;
  errorText?: string;
}

interface DiagnosticSummary {
  passedChecks: number;
  totalChecks: number;
  allPassed: boolean;
  roomExists: boolean;
  guestAccessWorks: boolean;
}

interface DiagnosticsResult {
  roomId: string;
  apiBase: string;
  timestamp: string;
  checks: {
    health?: DiagnosticCheck;
    roomInfo?: DiagnosticCheck;
    guestAccess?: DiagnosticCheck;
  };
  summary: DiagnosticSummary;
}

interface AttemptInfo {
  type: string;
  status: number;
  statusText: string;
  url: string;
  timestamp: string;
  errorText?: string;
}

interface DebugInfo {
  roomId: string;
  hasUser: boolean;
  apiBase: string;
  timestamp: string;
  attempts: AttemptInfo[];
  roomInfoCheck?: DiagnosticCheck;
  roomInfo?: unknown;
  roomInfoError?: string;
  authError?: string;
}

// Auto-detect API URL based on current domain or use environment variable
const getApiBaseUrl = () => {
  // First check for explicit environment variable
  if (import.meta.env.VITE_NESTS_API_URL) {
    return import.meta.env.VITE_NESTS_API_URL;
  }
  
  // Auto-detect based on current domain in production
  if (process.env.NODE_ENV === 'production') {
    const currentDomain = window.location.hostname;
    return `https://${currentDomain}/api/v1/nests`;
  }
  
  // Development fallback
  return 'http://localhost:5544/api/v1/nests';
};

const NESTS_API_BASE = getApiBaseUrl();

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
        
        // Provide more specific error messages based on status code
        if (response.status === 404) {
          throw new Error('Nest not found. The room may not be ready yet or has been closed.');
        } else if (response.status === 401) {
          throw new Error('Authentication failed. Please try logging in again.');
        } else if (response.status === 403) {
          throw new Error('Access denied. You may not have permission to join this nest.');
        } else {
          throw new Error(`Failed to join nest: ${response.statusText}`);
        }
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
        
        // Provide more specific error messages for guest access
        if (response.status === 404) {
          throw new Error('Nest not found. The room may not be ready yet or has been closed.');
        } else if (response.status === 403) {
          throw new Error('Guest access is not allowed for this nest.');
        } else {
          throw new Error(`Failed to join nest as guest: ${response.statusText}`);
        }
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
 * Hook for joining a nest with intelligent fallback
 * Tries authenticated join first, falls back to guest if needed
 */
export function useJoinNestSmart() {
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (roomId: string): Promise<JoinNestResponse & { joinType: 'authenticated' | 'guest'; debugInfo: DebugInfo }> => {
      const debugInfo: DebugInfo = {
        roomId,
        hasUser: !!user,
        apiBase: NESTS_API_BASE,
        timestamp: new Date().toISOString(),
        attempts: []
      };

      console.log('🔍 Smart join attempt:', debugInfo);

      // First, let's check if the room info endpoint works (no auth required)
      try {
        const infoUrl = `${NESTS_API_BASE}/${roomId}/info`;
        console.log('🔍 Checking room info:', infoUrl);
        
        const infoResponse = await fetch(infoUrl, { method: 'GET' });
        debugInfo.roomInfoCheck = {
          status: infoResponse.status,
          statusText: infoResponse.statusText,
          url: infoUrl
        };
        
        if (infoResponse.ok) {
          const roomInfo = await infoResponse.json();
          debugInfo.roomInfo = roomInfo;
          console.log('✅ Room info found:', roomInfo);
        } else {
          console.log('❌ Room info failed:', debugInfo.roomInfoCheck);
        }
      } catch (error) {
        debugInfo.roomInfoError = error instanceof Error ? error.message : 'Unknown error';
        console.log('❌ Room info check error:', error);
      }

      // If user is logged in, try authenticated join first
      if (user) {
        try {
          const url = `${NESTS_API_BASE}/${roomId}`;
          console.log('🔐 Trying authenticated join:', { roomId, url });
          
          const authHeader = await createNip98AuthHeader(user, 'GET', url);
          
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': authHeader,
            },
          });

          const attemptInfo: AttemptInfo = {
            type: 'authenticated',
            status: response.status,
            statusText: response.statusText,
            url,
            timestamp: new Date().toISOString()
          };
          debugInfo.attempts.push(attemptInfo);

          console.log('🔐 Authenticated join response:', attemptInfo);

          if (response.ok) {
            const result = await response.json();
            console.log('✅ Authenticated join successful');
            return { ...result, joinType: 'authenticated', debugInfo };
          }

          // If authenticated join fails with 404, try guest access as fallback
          if (response.status === 404) {
            console.log('⚠️ Authenticated join failed with 404, trying guest access...');
            // Fall through to guest attempt below
          } else {
            // For other errors, throw immediately
            const errorText = await response.text().catch(() => response.statusText);
            attemptInfo.errorText = errorText;
            console.error('❌ Authenticated join failed:', attemptInfo);
            
            if (response.status === 401) {
              throw new Error('Authentication failed. Please try logging in again.');
            } else if (response.status === 403) {
              throw new Error('Access denied. You may not have permission to join this nest.');
            } else {
              throw new Error(`Failed to join nest: ${response.statusText}`);
            }
          }
        } catch (error) {
          // If it's not a 404 error, re-throw it
          if (error instanceof Error && !error.message.includes('404')) {
            debugInfo.authError = error.message;
            throw error;
          }
          console.log('⚠️ Authenticated join failed, trying guest access...');
          // Fall through to guest attempt
        }
      }

      // Try guest access (either user not logged in, or authenticated join failed with 404)
      const guestUrl = `${NESTS_API_BASE}/${roomId}/guest`;
      console.log('👤 Trying guest join:', { roomId, url: guestUrl });
      
      const guestResponse = await fetch(guestUrl, {
        method: 'GET',
      });

      const guestAttemptInfo: AttemptInfo = {
        type: 'guest',
        status: guestResponse.status,
        statusText: guestResponse.statusText,
        url: guestUrl,
        timestamp: new Date().toISOString()
      };
      debugInfo.attempts.push(guestAttemptInfo);

      console.log('👤 Guest join response:', guestAttemptInfo);

      if (!guestResponse.ok) {
        const errorText = await guestResponse.text().catch(() => guestResponse.statusText);
        guestAttemptInfo.errorText = errorText;
        console.error('❌ Guest join failed:', guestAttemptInfo);
        
        // Log comprehensive debug info before throwing
        console.error('🚨 Complete debug info:', debugInfo);
        
        if (guestResponse.status === 404) {
          // Check if this is the specific "not found or no longer active" error
          // when we know the room actually exists (from room info check)
          if (debugInfo.roomInfo && (debugInfo.roomInfo as { status?: string }).status === 'active') {
            throw new Error('🚨 API Server Issue Detected: The room exists and is active (confirmed via /info endpoint) but both guest and authenticated join are failing with 404 errors. This indicates a bug in the API server\'s join logic or LiveKit integration. Please check API server logs and LiveKit connectivity.');
          } else {
            throw new Error('Nest not found. The room may not be ready yet or has been closed.');
          }
        } else if (guestResponse.status === 403) {
          throw new Error('Guest access is not allowed for this nest.');
        } else {
          throw new Error(`Failed to join nest as guest: ${guestResponse.statusText}`);
        }
      }

      const result = await guestResponse.json();
      console.log('✅ Guest join successful');
      return { ...result, joinType: 'guest', debugInfo };
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
 * Hook for comprehensive API diagnostics
 */
export function useApiDiagnostics() {
  return useMutation({
    mutationFn: async (roomId: string): Promise<DiagnosticsResult> => {
      const diagnostics: DiagnosticsResult = {
        roomId,
        apiBase: NESTS_API_BASE,
        timestamp: new Date().toISOString(),
        checks: {},
        summary: {
          passedChecks: 0,
          totalChecks: 0,
          allPassed: false,
          roomExists: false,
          guestAccessWorks: false,
        }
      };

      console.log('🔧 Starting API diagnostics for room:', roomId);

      // 1. Check API health (if health endpoint exists)
      try {
        const healthUrl = NESTS_API_BASE.replace('/api/v1/nests', '/health');
        console.log('🔧 Checking API health:', healthUrl);
        
        const healthResponse = await fetch(healthUrl, { method: 'GET' });
        diagnostics.checks.health = {
          status: healthResponse.status,
          statusText: healthResponse.statusText,
          url: healthUrl
        };
        
        if (healthResponse.ok) {
          const healthData = await healthResponse.json().catch(() => null);
          diagnostics.checks.health.data = healthData;
          console.log('✅ API health check passed:', healthData);
        } else {
          console.log('⚠️ API health check failed:', diagnostics.checks.health);
        }
      } catch (error) {
        diagnostics.checks.health = { error: error instanceof Error ? error.message : 'Unknown error' };
        console.log('❌ API health check error:', error);
      }

      // 2. Check room info endpoint
      try {
        const infoUrl = `${NESTS_API_BASE}/${roomId}/info`;
        console.log('🔧 Checking room info:', infoUrl);
        
        const infoResponse = await fetch(infoUrl, { method: 'GET' });
        diagnostics.checks.roomInfo = {
          status: infoResponse.status,
          statusText: infoResponse.statusText,
          url: infoUrl
        };
        
        if (infoResponse.ok) {
          const roomInfo = await infoResponse.json();
          diagnostics.checks.roomInfo.data = roomInfo;
          console.log('✅ Room info check passed:', roomInfo);
        } else {
          const errorText = await infoResponse.text().catch(() => infoResponse.statusText);
          diagnostics.checks.roomInfo.errorText = errorText;
          console.log('❌ Room info check failed:', diagnostics.checks.roomInfo);
        }
      } catch (error) {
        diagnostics.checks.roomInfo = { error: error instanceof Error ? error.message : 'Unknown error' };
        console.log('❌ Room info check error:', error);
      }

      // 3. Check guest endpoint
      try {
        const guestUrl = `${NESTS_API_BASE}/${roomId}/guest`;
        console.log('🔧 Checking guest endpoint:', guestUrl);
        
        const guestResponse = await fetch(guestUrl, { method: 'GET' });
        diagnostics.checks.guestAccess = {
          status: guestResponse.status,
          statusText: guestResponse.statusText,
          url: guestUrl
        };
        
        if (guestResponse.ok) {
          const guestData = await guestResponse.json();
          diagnostics.checks.guestAccess.data = guestData;
          console.log('✅ Guest access check passed');
        } else {
          const errorText = await guestResponse.text().catch(() => guestResponse.statusText);
          diagnostics.checks.guestAccess.errorText = errorText;
          console.log('❌ Guest access check failed:', diagnostics.checks.guestAccess);
        }
      } catch (error) {
        diagnostics.checks.guestAccess = { error: error instanceof Error ? error.message : 'Unknown error' };
        console.log('❌ Guest access check error:', error);
      }

      // 4. Summary
      const passedChecks = Object.values(diagnostics.checks).filter((check) => 
        check && check.status && check.status >= 200 && check.status < 300
      ).length;
      const totalChecks = Object.keys(diagnostics.checks).length;
      
      diagnostics.summary = {
        passedChecks,
        totalChecks,
        allPassed: passedChecks === totalChecks,
        roomExists: diagnostics.checks.roomInfo?.status === 200,
        guestAccessWorks: diagnostics.checks.guestAccess?.status === 200
      };

      console.log('🔧 Diagnostics complete:', diagnostics.summary);
      console.log('🔧 Full diagnostics:', diagnostics);

      return diagnostics;
    },
  });
}

/**
 * Hook for deleting a nest (host only)
 */
export function useDeleteNest() {
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (roomId: string): Promise<void> => {
      if (!user) throw new Error('User must be logged in');

      const url = `${NESTS_API_BASE}/${roomId}`;
      console.log('Deleting nest:', { roomId, url });
      
      const authHeader = await createNip98AuthHeader(user, 'DELETE', url);
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': authHeader,
        },
      });

      console.log('Delete nest response:', { 
        status: response.status, 
        statusText: response.statusText,
        url 
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error('Delete nest failed:', { status: response.status, errorText });
        
        if (response.status === 403) {
          throw new Error('Only the host can delete the nest');
        } else if (response.status === 404) {
          throw new Error('Nest not found');
        } else {
          throw new Error(`Failed to delete nest: ${response.statusText}`);
        }
      }
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