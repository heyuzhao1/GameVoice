const WebSocket = require('ws');
const RoomManager = require('./room-manager');

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function startSignalingServer({ port, host = '127.0.0.1', log = () => {} }) {
  const wss = new WebSocket.Server({ port, host });
  const roomManager = new RoomManager();
  
  // 映射 WebSocket 到 userId，用于断开连接时清理
  const wsToUserId = new Map();

  // 监听 RoomManager 事件并转发给客户端
  roomManager.on('room-message', ({ userId, message }) => {
    const user = roomManager.getUserInfo(userId);
    if (user && user.connectionInfo && user.connectionInfo.ws) {
      if (user.connectionInfo.ws.readyState === WebSocket.OPEN) {
        user.connectionInfo.ws.send(JSON.stringify(message));
      }
    }
  });

  roomManager.on('user-joined', ({ roomId, userId, room }) => {
    // 这里的逻辑其实已经被 roomManager.joinRoom 内部的 broadcastToRoom 覆盖了部分
    // 但我们需要给*当前用户*发送 room-joined 消息，包含房间信息
    const user = roomManager.getUserInfo(userId);
    if (user && user.connectionInfo && user.connectionInfo.ws) {
      const ws = user.connectionInfo.ws;
      // 构建房间内其他用户列表
      const users = Array.from(room.users).map(uid => {
        const u = roomManager.getUserInfo(uid);
        return {
          id: u.id,
          name: u.name,
          speaking: false,
          volume: 80 // 默认音量
        };
      });
      
      ws.send(JSON.stringify({
        type: 'room-joined',
        roomId: room.id,
        roomName: room.name,
        users: users
      }));
    }
  });

  roomManager.on('room-created', ({ roomId, room }) => {
    // 房间创建成功，通知创建者
    // 注意：createRoom 后通常会自动 joinRoom，或者客户端显式 join
    // 这里我们只负责通知创建成功，如果客户端逻辑是 create -> join，则由 join 处理
    // 但如果是一步到位，我们需要确认 createRoom 是否自动 join
    // 查看 room-manager.js，createRoom 会将 creator 加入 users Set，但不会触发 user-joined 事件
    // 所以我们需要手动处理
    
    // 发送 room-created 给创建者
    const creatorId = room.creator;
    const user = roomManager.getUserInfo(creatorId);
    if (user && user.connectionInfo && user.connectionInfo.ws) {
      user.connectionInfo.ws.send(JSON.stringify({
        type: 'room-created',
        roomId: room.id,
        roomName: room.name
      }));
      
      // 同时也发送 room-joined，因为创建者就在房间里
      const users = [{
        id: user.id,
        name: user.name,
        speaking: false,
        volume: 80
      }];
      
      user.connectionInfo.ws.send(JSON.stringify({
        type: 'room-joined',
        roomId: room.id,
        roomName: room.name,
        users: users
      }));
    }
  });

  wss.on('error', (err) => {
    log('signaling-error', err && err.stack ? err.stack : String(err));
  });

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      const message = safeJsonParse(data.toString());
      if (!message || typeof message.type !== 'string') return;

      if (message.type === 'hello') {
        if (typeof message.userId !== 'string' || typeof message.userName !== 'string') return;
        
        // 注册用户，保存 ws 连接
        roomManager.registerUser(message.userId, {
          name: message.userName,
          connectionInfo: { ws }
        });
        wsToUserId.set(ws, message.userId);
        
        ws.send(JSON.stringify({ type: 'hello-ack', userId: message.userId }));
        return;
      }

      // 获取当前用户 ID
      const userId = wsToUserId.get(ws);
      if (!userId) {
        ws.send(JSON.stringify({ type: 'error', message: '未注册(hello)的连接' }));
        return;
      }

      try {
        if (message.type === 'create-room') {
          // 创建房间
          const roomName = message.name || null;
          roomManager.createRoom(roomName, userId);
          return;
        }

        if (message.type === 'join-room' || message.type === 'join') {
          // 加入房间
          const roomId = String(message.roomId || '').trim();
          
          // 兼容旧逻辑：如果带 create=true，则尝试创建
          if (message.create) {
             roomManager.createRoom(null, userId);
             return;
          }

          if (!roomId) {
            ws.send(JSON.stringify({ type: 'error', code: 'INVALID_ROOM_ID', message: '房间号不能为空' }));
            return;
          }

          // 如果用户已经在其他房间，先离开
          const userInfo = roomManager.getUserInfo(userId);
          if (userInfo && userInfo.currentRoom) {
            roomManager.leaveRoom(userId);
          }

          roomManager.joinRoom(roomId, userId);
          return;
        }

        if (message.type === 'leave-room' || message.type === 'leave') {
          roomManager.leaveRoom(userId);
          ws.send(JSON.stringify({ type: 'room-left' }));
          return;
        }

        if (message.type === 'signal') {
          const to = String(message.to || '');
          const targetUser = roomManager.getUserInfo(to);
          
          if (targetUser && targetUser.connectionInfo && targetUser.connectionInfo.ws) {
             if (targetUser.connectionInfo.ws.readyState === WebSocket.OPEN) {
               targetUser.connectionInfo.ws.send(JSON.stringify({
                 type: 'signal',
                 from: userId,
                 data: message.data
               }));
             }
          }
          return;
        }

        if (message.type === 'speaking') {
          const userInfo = roomManager.getUserInfo(userId);
          if (userInfo && userInfo.currentRoom) {
            roomManager.broadcastToRoom(userInfo.currentRoom, {
              type: 'user-speaking',
              roomId: userInfo.currentRoom,
              userId: userId,
              speaking: !!message.speaking,
              volumeDb: typeof message.volumeDb === 'number' ? message.volumeDb : null
            }, userId); // 排除自己
          }
          return;
        }

      } catch (err) {
        // 捕获 RoomManager 抛出的错误（如房间满、不存在等）
        ws.send(JSON.stringify({
          type: 'error',
          code: err.message === '房间不存在' ? 'ROOM_NOT_FOUND' : 'JOIN_FAILED',
          message: err.message
        }));
      }
    });

    ws.on('close', () => {
      const userId = wsToUserId.get(ws);
      if (userId) {
        roomManager.leaveRoom(userId);
        // 这里不需要从 roomManager 删除用户，只需断开连接状态?
        // RoomManager 没有 deleteUser 方法，但有 cleanupInactiveRooms
        // 我们可以保留用户数据一段时间
        wsToUserId.delete(ws);
      }
    });

    ws.on('error', () => {});
  });

  wss.on('listening', () => {
    log(`signaling: listening ws://${host}:${port}`);
  });

  return {
    port,
    host,
    close: () => {
      roomManager.cleanup();
      return new Promise((resolve) => {
        try {
          wss.close(() => resolve());
        } catch (_) {
          resolve();
        }
      });
    }
  };
}

module.exports = { startSignalingServer };
