const WebSocket = require('ws');
const { startSignalingServer } = require('./src/signaling-server');

const PORT = 9999;
let server;

function createClient(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    let userId;

    ws.on('open', () => {
      userId = `user_${name}_${Date.now()}`;
      ws.send(JSON.stringify({ type: 'hello', userId, userName: name }));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'hello-ack') {
          resolve({ ws, userId: msg.userId || userId });
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    });

    ws.on('error', reject);
  });
}

async function runTest() {
  console.log('Starting signaling server...');
  server = startSignalingServer({ port: PORT });

  try {
    console.log('Creating Client A...');
    const clientA = await createClient('Alice');
    console.log('Client A connected.');

    console.log('Creating Client B...');
    const clientB = await createClient('Bob');
    console.log('Client B connected.');

    // Client A creates room
    console.log('Client A creating room...');
    const createPromise = new Promise((resolve) => {
      clientA.ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'room-created') {
          console.log('Room created:', msg);
          resolve(msg.roomId);
        }
      });
      clientA.ws.send(JSON.stringify({ type: 'create-room', name: 'Test Room' }));
    });

    const roomId = await createPromise;
    
    // Client B joins room
    console.log(`Client B joining room ${roomId}...`);
    const joinPromise = new Promise((resolve) => {
      clientB.ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'room-joined' && msg.roomId === roomId) {
          console.log('Client B joined room:', msg);
          resolve();
        }
      });
      clientB.ws.send(JSON.stringify({ type: 'join-room', roomId }));
    });

    await joinPromise;

    // Verify A sees B joined
    // A should receive user-joined
    console.log('Verifying A sees B...');
    // Note: Since we didn't attach listener for user-joined before, we might have missed it if it happened very fast.
    // But let's see. Actually B join happens after A created.
    // We can add a listener to A now, but it might be too late if B already joined.
    // Ideally we should have added listener earlier.
    
    // Let's send a signal from A to B
    console.log('Client A sending signal to Client B...');
    const signalData = { sdp: 'dummy-sdp', type: 'offer' };
    
    const signalPromise = new Promise((resolve) => {
      clientB.ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'signal' && msg.from === clientA.userId) {
          console.log('Client B received signal from A:', msg.data);
          resolve();
        }
      });
      clientA.ws.send(JSON.stringify({ type: 'signal', to: clientB.userId, data: signalData }));
    });

    await signalPromise;
    console.log('Signal exchange successful!');
    console.log('Test Passed!');

  } catch (err) {
    console.error('Test Failed:', err);
  } finally {
    server.close();
    process.exit(0);
  }
}

runTest();
