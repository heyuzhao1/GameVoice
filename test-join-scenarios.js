
const { startSignalingServer } = require('./src/signaling-server');
const WebSocket = require('ws');

// 模拟客户端
class MockClient {
    constructor(port, userId) {
        this.port = port;
        this.userId = userId;
        this.ws = null;
        this.msgs = [];
    }

    connect() {
        return new Promise((resolve) => {
            this.ws = new WebSocket(`ws://127.0.0.1:${this.port}`);
            this.ws.on('open', () => {
                this.ws.send(JSON.stringify({ type: 'hello', userId: this.userId, userName: this.userId }));
            });
            this.ws.on('message', (data) => {
                const msg = JSON.parse(data);
                this.msgs.push(msg);
                if (msg.type === 'hello-ack') resolve();
            });
        });
    }

    send(data) {
        this.ws.send(JSON.stringify(data));
    }

    async waitFor(predicate, timeout = 2000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const found = this.msgs.find(predicate);
            if (found) return found;
            await new Promise(r => setTimeout(r, 100));
        }
        throw new Error('Wait timeout');
    }

    close() {
        this.ws.close();
    }
}

async function runTests() {
    const PORT = 9988;
    const server = startSignalingServer({ port: PORT, log: () => {} });
    console.log('Server started');

    try {
        const clientA = new MockClient(PORT, 'userA');
        await clientA.connect();
        console.log('Client A connected');

        // 测试1: 加入不存在的房间 (create=false)
        console.log('Test 1: Join non-existent room');
        clientA.send({ type: 'join', roomId: 'room1' }); // default create=false
        const err1 = await clientA.waitFor(m => m.type === 'error');
        if (err1.code === 'ROOM_NOT_FOUND') {
            console.log('✅ Passed: Got ROOM_NOT_FOUND');
        } else {
            console.error('❌ Failed: Expected ROOM_NOT_FOUND, got', err1);
        }

        // 测试2: 创建房间 (create=true)
        console.log('Test 2: Create room');
        clientA.msgs = [];
        clientA.send({ type: 'join', roomId: 'room1', create: true });
        const joined1 = await clientA.waitFor(m => m.type === 'room-joined');
        if (joined1.roomId === 'room1') {
            console.log('✅ Passed: Room created and joined');
        } else {
            console.error('❌ Failed: Expected room-joined');
        }

        // 测试3: 加入已存在的房间
        const clientB = new MockClient(PORT, 'userB');
        await clientB.connect();
        console.log('Client B connected');
        
        console.log('Test 3: Join existing room');
        clientB.send({ type: 'join', roomId: 'room1' });
        const joined2 = await clientB.waitFor(m => m.type === 'room-joined');
        if (joined2.roomId === 'room1') {
            console.log('✅ Passed: Joined existing room');
        } else {
            console.error('❌ Failed: Expected room-joined');
        }

        clientA.close();
        clientB.close();

    } catch (e) {
        console.error('Test Error:', e);
    } finally {
        await server.close();
        console.log('Server closed');
    }
}

runTests();
