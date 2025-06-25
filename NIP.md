# Nests - Nostr Audio Spaces

This document describes the Nostr event kinds and implementation used by Nests, a social audio application built on Nostr following NIP-53.

## Event Kinds

### Interactive Room (kind: 30312)

Nests uses the Interactive Room event kind from NIP-53 to represent audio spaces. Each nest is an addressable event that defines the configuration and properties of a virtual interactive audio space.

**Required tags:**
- `d`: Unique identifier for the nest (room ID from LiveKit API)
- `room`: Display name of the nest
- `status`: Room accessibility (`open`, `private`, `closed`) - Note: `live` status is only for meetings (kind 30313), not rooms
- `service`: API endpoint for nest management (`https://nostrnests.com/api/v1/nests`)
- `p`: At least one provider with role (e.g., `Host`, `Moderator`, `Speaker`)

**Optional tags:**
- `summary`: Description of the nest
- `image`: Cover image URL
- `streaming`: LiveKit WebSocket URL and/or HLS stream URL
- `starts`: Unix timestamp when the nest started
- `ends`: Unix timestamp when the nest ended
- `current_participants`: Number of currently active participants
- `total_participants`: Total number of registered participants
- `t`: Hashtags for categorization
- `relays`: Preferred relays for the nest

**Example:**
```json
{
  "kind": 30312,
  "tags": [
    ["d", "abc123-def456"],
    ["room", "Bitcoin Discussion"],
    ["summary", "Weekly discussion about Bitcoin development"],
    ["image", "https://example.com/bitcoin.jpg"],
    ["status", "open"],
    ["service", "https://nostrnests.com/api/v1/nests"],
    ["streaming", "wss://nostrnests.com"],
    ["streaming", "https://nostrnests.com/api/v1/live/abc123-def456/live.m3u8"],
    ["starts", "1708945852"],
    ["current_participants", "15"],
    ["total_participants", "23"],
    ["p", "91cf9..4e5ca", "", "Host"],
    ["p", "14aeb..8dad4", "", "Moderator"],
    ["t", "bitcoin"],
    ["t", "development"],
    ["relays", "wss://relay.nostr.band", "wss://relay.damus.io"]
  ],
  "content": ""
}
```

### Live Chat Message (kind: 1311)

Chat messages within nests use the Live Chat Message event kind from NIP-53. These events reference their parent nest using an `a` tag.

**Required tags:**
- `a`: Reference to the parent nest event (`30312:<pubkey>:<d-identifier>`)

**Optional tags:**
- `e`: Reference to parent message for replies
- `q`: Quote tags for citing other events

**Example:**
```json
{
  "kind": 1311,
  "tags": [
    ["a", "30312:91cf9..4e5ca:abc123-def456", "", "root"]
  ],
  "content": "Great discussion about Lightning Network!",
}
```

### Room Presence (kind: 10312)

Presence events signal when a user is actively participating in a nest. These are replaceable events that should be published every 2 minutes while the user remains in the nest.

**Required tags:**
- `a`: Reference to the nest event (`30312:<pubkey>:<d-identifier>`)

**Optional tags:**
- `hand`: Set to "1" when the user has raised their hand to speak

**Example:**
```json
{
  "kind": 10312,
  "tags": [
    ["a", "30312:91cf9..4e5ca:abc123-def456", "", "root"],
    ["hand", "1"]
  ],
  "content": ""
}
```

### Speaking Request (kind: 1833)

Speaking request events are used by participants to request permission to speak in a nest. These events signal to the host that a user wants to participate in the audio conversation.

**Required tags:**
- `a`: Reference to the nest event (`30312:<pubkey>:<d-identifier>`)
- `status`: Current status of the request (`requested`, `cancelled`)

**Example:**
```json
{
  "kind": 1833,
  "tags": [
    ["a", "30312:91cf9..4e5ca:abc123-def456", "", "root"],
    ["status", "requested"]
  ],
  "content": ""
}
```

### Speaking Permission (kind: 3979)

Speaking permission events are used by hosts to grant, deny, or revoke speaking permissions for participants. These events control who can unmute their microphone and speak in the nest.

**Required tags:**
- `a`: Reference to the nest event (`30312:<pubkey>:<d-identifier>`)
- `p`: Public key of the participant being granted/denied permission
- `status`: Permission status (`granted`, `denied`, `revoked`)

**Optional tags:**
- `e`: Reference to the original speaking request event (when responding to a request)

**Example:**
```json
{
  "kind": 3979,
  "tags": [
    ["a", "30312:91cf9..4e5ca:abc123-def456", "", "root"],
    ["p", "14aeb..8dad4"],
    ["status", "granted"],
    ["e", "abc123..def456"]
  ],
  "content": ""
}
```

### Speaking Invitation (kind: 7051)

Speaking invitation events are used by hosts to invite specific participants to speak, and by participants to accept or decline those invitations.

**Required tags:**
- `a`: Reference to the nest event (`30312:<pubkey>:<d-identifier>`)
- `status`: Invitation status (`invited`, `accepted`, `declined`)

**Conditional tags:**
- `p`: Public key of the invited participant (required when status is "invited")
- `e`: Reference to the original invitation event (required when status is "accepted" or "declined")

**Example (Host inviting participant):**
```json
{
  "kind": 7051,
  "tags": [
    ["a", "30312:91cf9..4e5ca:abc123-def456", "", "root"],
    ["p", "14aeb..8dad4"],
    ["status", "invited"]
  ],
  "content": ""
}
```

**Example (Participant accepting invitation):**
```json
{
  "kind": 7051,
  "tags": [
    ["a", "30312:91cf9..4e5ca:abc123-def456", "", "root"],
    ["e", "invitation-event-id"],
    ["status", "accepted"]
  ],
  "content": ""
}
```

## Implementation Details

### LiveKit Integration

Nests integrates with LiveKit for real-time audio communication:

1. **Authentication**: Uses NIP-98 HTTP Auth to authenticate with the Nests API
2. **Room Creation**: Creates LiveKit rooms via the `/api/v1/nests` endpoint
3. **Token Management**: Obtains LiveKit access tokens for room participation
4. **Streaming URLs**: Supports both LiveKit WebSocket and HLS streaming formats

### Streaming URL Formats

- **LiveKit WebSocket**: `wss+livekit://example.com` - For real-time audio participation
- **HLS Playlist**: `https://example.com/live.m3u8` - For cross-client compatibility

### Presence Management

- Presence events (kind 10312) are published every 2 minutes while in a nest
- Events older than 5 minutes are considered stale and filtered out
- Hand raising is managed through the `hand` tag and LiveKit participant metadata

### Permission System

Nests implements a role-based permission system:

- **Host**: Full nest management capabilities, can invite participants to speak, grant/deny speaking requests, and revoke speaking permissions
- **Moderator**: Can manage speakers and moderate content (future implementation)
- **Speaker**: Can unmute and speak in the nest after receiving permission from the host
- **Listener**: Can listen, raise hand to request speaking privileges, and respond to speaking invitations

### Moderation Workflow

The moderation system follows this workflow:

1. **Request to Speak**: Participants can request speaking permission by publishing a kind 1833 event
2. **Host Review**: Hosts see pending requests in the moderation panel and can grant or deny them
3. **Permission Grant**: When granted, a kind 3979 event is published, allowing the participant to unmute
4. **Invitation System**: Hosts can proactively invite participants using kind 7051 events
5. **Session Restart**: When accepting an invitation, the participant's session restarts to enable microphone access
6. **Permission Revocation**: Hosts can revoke speaking permissions at any time

### Event Lifecycle

- **Speaking requests** (kind 1833) are filtered to show only events from the last hour
- **Speaking permissions** (kind 3979) remain active until explicitly revoked
- **Speaking invitations** (kind 7051) expire after 1 hour if not responded to
- All moderation events reference the parent nest using the `a` tag

### Cross-Client Compatibility

By following NIP-53 and providing HLS streams, Nests maintains compatibility with other Nostr clients that support live activities, such as:

- zap.stream
- Nostrudel
- Amethyst

## API Integration

Nests uses a custom API for LiveKit integration while maintaining full Nostr compatibility:

- **Create Nest**: `PUT /api/v1/nests` - Creates new LiveKit room and returns tokens
- **Join Nest**: `GET /api/v1/nests/<room-id>` - Obtains access token for existing room
- **Guest Access**: `GET /api/v1/nests/<room-id>/guest` - Allows anonymous participation
- **Permissions**: `POST /api/v1/nests/<room-id>/permissions` - Updates user roles
- **Room Info**: `GET /api/v1/nests/<room-id>/info` - Retrieves current room state

All authenticated endpoints use NIP-98 HTTP Auth for secure access control.