# Nests - Nostr Audio Spaces

Nests is a social audio application built on Nostr, similar to Clubhouse, that enables users to create and join live audio conversations. It follows NIP-53 specifications for live activities and integrates with LiveKit for real-time audio communication.

## Features

- **Create Audio Spaces**: Host live audio rooms for discussions, conferences, or casual conversations
- **Join Conversations**: Participate as a listener or request speaking privileges
- **Real-time Chat**: Text chat alongside audio conversations
- **Nostr Integration**: Fully decentralized using Nostr protocol
- **LiveKit Audio**: High-quality real-time audio powered by LiveKit
- **Cross-Client Compatibility**: Compatible with other Nostr clients via NIP-53
- **Zap Support**: Send and receive Bitcoin Lightning payments
- **Presence Management**: Automatic presence updates and hand-raising features

## Technology Stack

- **React 18** with TypeScript
- **Nostr Protocol** (NIP-53 Live Activities)
- **LiveKit** for real-time audio
- **TailwindCSS** for styling
- **shadcn/ui** components
- **Vite** for build tooling

## Nostr Event Types

Nests uses the following Nostr event kinds:

- **Kind 30312**: Interactive Room (nest configuration)
- **Kind 1311**: Live Chat Message (text chat in nests)
- **Kind 10312**: Room Presence (user presence and hand-raising)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A Nostr identity (browser extension like Alby, nos2x, etc.)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

### Running Tests

```bash
npm test
```

## Usage

### Creating a Nest

1. Log in with your Nostr identity
2. Click "Create Nest" 
3. Fill in the nest details (name, description, hashtags)
4. Choose between Open or Private nest
5. Your nest will be created and you'll be connected as the host

### Joining a Nest

1. Browse available nests on the main page
2. Click "Join Nest" on any open nest
3. You can join as a logged-in user or as a guest
4. Use the hand-raise feature to request speaking privileges

### Chat Features

- Send text messages in the nest chat
- Messages are published as Nostr events (kind 1311)
- Chat history is preserved on Nostr relays

### Audio Controls

- **Microphone**: Toggle your microphone on/off
- **Raise Hand**: Signal that you want to speak
- **Leave**: Exit the nest

## Configuration

The app connects to Nostr relays for event publishing and retrieval. You can change relays using the relay selector in the header.

Default relay: `wss://relay.nostr.band`

## API Integration

Nests integrates with the Nests API for LiveKit room management:

- **Base URL**: `https://nostrnests.com/api/v1/nests`
- **Authentication**: NIP-98 HTTP Auth
- **Features**: Room creation, joining, permission management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Links

- [Nostr Protocol](https://nostr.com)
- [NIP-53 Specification](https://github.com/nostr-protocol/nips/blob/master/53.md)
- [LiveKit](https://livekit.io)
- Built with [MKStack](https://soapbox.pub/mkstack)

## Tagline

*Nostr Nests is an audio space for chatting, jamming, micro-conferences, live podcast recordings, etc. that's powered by Nostr.*