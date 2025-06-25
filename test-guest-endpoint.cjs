const fetch = require('node-fetch');

async function testGuestEndpoint() {
  const roomId = '72e1c1fb-672d-4441-8f69-5be1a7b0e767';
  const url = `http://localhost:5544/api/v1/nests/${roomId}/guest`;
  
  console.log('🧪 Testing guest endpoint...');
  console.log('URL:', url);
  
  try {
    const response = await fetch(url);
    const result = await response.text();
    
    console.log('Status:', response.status);
    console.log('Response:', result);
    
    // Also test the info endpoint for comparison
    console.log('\n📋 Testing info endpoint for comparison...');
    const infoResponse = await fetch(`http://localhost:5544/api/v1/nests/${roomId}/info`);
    const infoResult = await infoResponse.text();
    
    console.log('Info Status:', infoResponse.status);
    console.log('Info Response:', infoResult);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testGuestEndpoint();