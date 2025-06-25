#!/usr/bin/env node

const crypto = require('crypto');
const { finalizeEvent, generateSecretKey, getPublicKey } = require('nostr-tools');

// Generate a test keypair
const secretKey = generateSecretKey();
const publicKey = getPublicKey(secretKey);

console.log('Test keypair generated:');
console.log('Public key:', publicKey);
console.log('Secret key:', Buffer.from(secretKey).toString('hex'));

// Create NIP-98 auth event
function createNip98Auth(method, url, secretKey) {
  const event = {
    kind: 27235,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['method', method.toUpperCase()],
      ['u', url]
    ],
    content: '',
    pubkey: getPublicKey(secretKey)
  };

  return finalizeEvent(event, secretKey);
}

// Test room creation
async function testRoomCreation() {
  const url = 'http://localhost:5544/api/v1/nests';
  const method = 'PUT';
  
  // Create auth event
  const authEvent = createNip98Auth(method, url, secretKey);
  const authToken = Buffer.from(JSON.stringify(authEvent)).toString('base64');
  
  console.log('\nCreating room...');
  console.log('Auth token:', authToken);
  
  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Nostr ${authToken}`
      },
      body: JSON.stringify({
        relays: ['wss://relay.primal.net'],
        hls_stream: false
      })
    });
    
    const result = await response.text();
    console.log('Response status:', response.status);
    console.log('Response:', result);
    
    if (response.ok) {
      const data = JSON.parse(result);
      console.log('\n✅ Room created successfully!');
      console.log('Room ID:', data.roomId);
      console.log('Endpoints:', data.endpoints);
      console.log('Token length:', data.token.length);
      
      // Test guest access immediately
      console.log('\n🧪 Testing guest access...');
      const guestResponse = await fetch(`http://localhost:5544/api/v1/nests/${data.roomId}/guest`);
      const guestResult = await guestResponse.text();
      console.log('Guest response status:', guestResponse.status);
      console.log('Guest response:', guestResult);
      
      // Test info endpoint
      console.log('\n📋 Testing info endpoint...');
      const infoResponse = await fetch(`http://localhost:5544/api/v1/nests/${data.roomId}/info`);
      const infoResult = await infoResponse.text();
      console.log('Info response status:', infoResponse.status);
      console.log('Info response:', infoResult);
      
      return data.roomId;
    } else {
      console.log('❌ Room creation failed');
      return null;
    }
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

// Test authenticated access
async function testAuthenticatedAccess(roomId) {
  if (!roomId) return;
  
  console.log('\n🔐 Testing authenticated access...');
  const url = `http://localhost:5544/api/v1/nests/${roomId}`;
  const method = 'GET';
  
  const authEvent = createNip98Auth(method, url, secretKey);
  const authToken = Buffer.from(JSON.stringify(authEvent)).toString('base64');
  
  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        'Authorization': `Nostr ${authToken}`
      }
    });
    
    const result = await response.text();
    console.log('Auth access status:', response.status);
    console.log('Auth access response:', result);
  } catch (error) {
    console.error('Auth access error:', error);
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Nests API tests...\n');
  
  const roomId = await testRoomCreation();
  await testAuthenticatedAccess(roomId);
  
  console.log('\n✨ Tests completed!');
}

runTests().catch(console.error);