const { RoomServiceClient } = require('livekit-server-sdk');

const config = {
  livekit: {
    url: 'http://livekit:7880', // Note: using http:// not ws://
    apiKey: 'nests-api-key',
    apiSecret: 'nests-super-secret-key-change-in-production',
  }
};

const roomService = new RoomServiceClient(
  config.livekit.url,
  config.livekit.apiKey,
  config.livekit.apiSecret
);

async function debugLiveKit() {
  try {
    console.log('🔍 Debugging LiveKit connection...');
    console.log('URL:', config.livekit.url);
    console.log('API Key:', config.livekit.apiKey);
    
    console.log('\n📋 Listing all rooms...');
    const rooms = await roomService.listRooms();
    console.log('Found', rooms.length, 'rooms:');
    rooms.forEach(room => {
      const creationTime = typeof room.creationTime === 'bigint' 
        ? Number(room.creationTime) 
        : room.creationTime;
      console.log(`- ${room.name} (${room.numParticipants} participants, created: ${new Date(creationTime * 1000)})`);
    });
    
    console.log('\n🎯 Testing specific room...');
    const testRoomId = '72e1c1fb-672d-4441-8f69-5be1a7b0e767';
    
    try {
      const participants = await roomService.listParticipants(testRoomId);
      console.log(`Room ${testRoomId} has ${participants.length} participants`);
    } catch (error) {
      console.log(`❌ Failed to get participants for ${testRoomId}:`, error.message);
    }
    
    // Check if room exists in the list
    const roomExists = rooms.some(room => room.name === testRoomId);
    console.log(`Room ${testRoomId} exists in list:`, roomExists);
    
  } catch (error) {
    console.error('❌ LiveKit debug error:', error);
  }
}

debugLiveKit();