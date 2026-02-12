const WebSocket = require('ws');

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function startSignalingServer({ port, host = '127.0.0.1', log = () => {} }) {
  const clientsByUserId = new Map();
  const clientInfoBySocket = new Map();
  const rooms = new Map(); // roomId -> Set(userId)

  const wss = new WebSocket.Server({ port, host });

  wss.on('error', (err) => {
    log('signaling-error', err && err.stack ? err.stack : String(err));
  });

  function getRoomUsers(roomId) {
    const set = rooms.get(roomId);
    if (!set) return [];
    const users = [];
    for (const userId of set) {
      const info = clientsByUserId.get(userId);
      if (info) {
        users.push({
          id: info.userId,
          name: info.userName,
          speaking: false,
          volume: 80
        });
      }
    }
    return users;
  }

  function broadcastToRoom(roomId, message, excludeUserId = null) {
    const set = rooms.get(roomId);
    if (!set) return 0;
    const payload = JSON.stringify(message);
    let count = 0;
    for (const userId of set) {
      if (excludeUserId && userId === excludeUserId) continue;
      const info = clientsByUserId.get(userId);
      if (!info) continue;
      if (info.ws.readyState !== WebSocket.OPEN) continue;
      info.ws.send(payload);
      count++;
    }
    return count;
  }

  function leaveRoom(userId) {
    const info = clientsByUserId.get(userId);
    if (!info || !info.roomId) return;
    const { roomId } = info;
    info.roomId = null;
    const set = rooms.get(roomId);
    if (set) {
      set.delete(userId);
      if (set.size === 0) rooms.delete(roomId);
    }
    broadcastToRoom(roomId, { type: 'user-left', roomId, userId }, userId);
  }

  wss.on('connection', (ws) => {
    clientInfoBySocket.set(ws, { userId: null, userName: null, roomId: null });

    ws.on('message', (data) => {
      const message = safeJsonParse(data.toString());
      if (!message || typeof message.type !== 'string') return;

      const clientInfo = clientInfoBySocket.get(ws);
      if (!clientInfo) return;

      if (message.type === 'hello') {
        if (typeof message.userId !== 'string' || typeof message.userName !== 'string') return;
        clientInfo.userId = message.userId;
        clientInfo.userName = message.userName;
        clientsByUserId.set(message.userId, { ws, userId: message.userId, userName: message.userName, roomId: null });
        ws.send(JSON.stringify({ type: 'hello-ack', userId: message.userId }));
        return;
      }

      if (!clientInfo.userId) {
        ws.send(JSON.stringify({ type: 'error', message: '未注册(hello)的连接' }));
        return;
      }

      if (message.type === 'join') {
        const roomId = String(message.roomId || '').trim();
        const create = !!message.create;

        if (!roomId) {
          ws.send(JSON.stringify({ type: 'error', code: 'INVALID_ROOM_ID', message: '房间号不能为空' }));
          return;
        }

        let set = rooms.get(roomId);
        if (!create && !set) {
          ws.send(JSON.stringify({ type: 'error', code: 'ROOM_NOT_FOUND', message: '房间不存在' }));
          return;
        }

        leaveRoom(clientInfo.userId);

        // 重新获取，防止leaveRoom副作用（虽然理论上不会影响其他房间）
        set = rooms.get(roomId);
        if (!set) {
          set = new Set();
          rooms.set(roomId, set);
        }
        set.add(clientInfo.userId);

        const record = clientsByUserId.get(clientInfo.userId);
        if (record) record.roomId = roomId;
        clientInfo.roomId = roomId;

        ws.send(JSON.stringify({ type: 'room-joined', roomId, users: getRoomUsers(roomId) }));
        broadcastToRoom(roomId, {
          type: 'user-joined',
          roomId,
          user: { id: clientInfo.userId, name: clientInfo.userName, speaking: false, volume: 80 }
        }, clientInfo.userId);
        return;
      }

      if (message.type === 'leave') {
        leaveRoom(clientInfo.userId);
        ws.send(JSON.stringify({ type: 'room-left' }));
        return;
      }

      if (message.type === 'signal') {
        const to = String(message.to || '');
        const target = clientsByUserId.get(to);
        if (!target || target.ws.readyState !== WebSocket.OPEN) return;
        target.ws.send(JSON.stringify({ type: 'signal', from: clientInfo.userId, data: message.data }));
        return;
      }

      if (message.type === 'speaking') {
        if (!clientInfo.roomId) return;
        broadcastToRoom(clientInfo.roomId, {
          type: 'user-speaking',
          roomId: clientInfo.roomId,
          userId: clientInfo.userId,
          speaking: !!message.speaking,
          volumeDb: typeof message.volumeDb === 'number' ? message.volumeDb : null
        }, clientInfo.userId);
        return;
      }
    });

    ws.on('close', () => {
      const clientInfo = clientInfoBySocket.get(ws);
      clientInfoBySocket.delete(ws);
      if (!clientInfo || !clientInfo.userId) return;
      leaveRoom(clientInfo.userId);
      clientsByUserId.delete(clientInfo.userId);
    });

    ws.on('error', () => {});
  });

  wss.on('listening', () => {
    log(`signaling: listening ws://${host}:${port}`);
  });

  return {
    port,
    host,
    close: () =>
      new Promise((resolve) => {
        try {
          wss.close(() => resolve());
        } catch (_) {
          resolve();
        }
      })
  };
}

module.exports = { startSignalingServer };
