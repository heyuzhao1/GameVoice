/**
 * 房间管理器
 * 负责房间的创建、加入、用户管理等功能
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');

class RoomManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      maxUsers: 8,
      roomTimeout: 300000, // 5分钟无活动自动清理
      heartbeatInterval: 30000, // 30秒心跳
      ...options
    };

    this.rooms = new Map(); // roomId -> roomData
    this.users = new Map(); // userId -> userData
    this.cleanupInterval = null;
    this.heartbeatInterval = null;

    this.startCleanupTimer();
    this.startHeartbeat();
  }

  /**
   * 创建房间
   */
  createRoom(roomName, creatorId, options = {}) {
    const roomId = this.generateRoomId();
    const room = {
      id: roomId,
      name: roomName || `房间 ${roomId.slice(0, 6)}`,
      creator: creatorId,
      users: new Set([creatorId]),
      createdAt: Date.now(),
      lastActivity: Date.now(),
      options: {
        maxUsers: this.options.maxUsers,
        password: null,
        isPublic: true,
        ...options
      },
      metadata: {
        region: this.detectRegion(),
        latencyMap: new Map()
      }
    };

    this.rooms.set(roomId, room);

    // 更新用户信息
    const user = this.users.get(creatorId);
    if (user) {
      user.currentRoom = roomId;
    }

    console.log(`房间创建成功: ${roomId} (${roomName})`);
    this.emit('room-created', { roomId, room });

    return room;
  }

  /**
   * 加入房间
   */
  joinRoom(roomId, userId, password = null) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('房间不存在');
    }

    // 检查密码
    if (room.options.password && room.options.password !== password) {
      throw new Error('密码错误');
    }

    // 检查人数限制
    if (room.users.size >= room.options.maxUsers) {
      throw new Error('房间已满');
    }

    // 检查用户是否已在房间中
    if (room.users.has(userId)) {
      throw new Error('用户已在房间中');
    }

    // 加入房间
    room.users.add(userId);
    room.lastActivity = Date.now();

    // 更新用户信息
    const user = this.users.get(userId);
    if (user) {
      user.currentRoom = roomId;
      user.joinedAt = Date.now();
    }

    console.log(`用户 ${userId} 加入房间 ${roomId}`);

    // 通知其他用户
    this.broadcastToRoom(roomId, {
      type: 'user-joined',
      userId,
      timestamp: Date.now()
    }, userId);

    this.emit('user-joined', { roomId, userId, room });

    return room;
  }

  /**
   * 离开房间
   */
  leaveRoom(userId) {
    const user = this.users.get(userId);
    if (!user || !user.currentRoom) {
      return false;
    }

    const roomId = user.currentRoom;
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    // 从房间移除用户
    room.users.delete(userId);
    room.lastActivity = Date.now();

    // 更新用户信息
    user.currentRoom = null;
    user.leftAt = Date.now();

    console.log(`用户 ${userId} 离开房间 ${roomId}`);

    // 通知其他用户
    this.broadcastToRoom(roomId, {
      type: 'user-left',
      userId,
      timestamp: Date.now()
    }, userId);

    this.emit('user-left', { roomId, userId });

    // 如果房间为空，清理房间
    if (room.users.size === 0) {
      this.cleanupRoom(roomId);
    }

    return true;
  }

  /**
   * 获取房间信息
   */
  getRoomInfo(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    const users = Array.from(room.users).map(userId => {
      const user = this.users.get(userId);
      return user ? this.getUserInfo(userId) : null;
    }).filter(Boolean);

    return {
      id: room.id,
      name: room.name,
      creator: room.creator,
      userCount: room.users.size,
      maxUsers: room.options.maxUsers,
      createdAt: room.createdAt,
      lastActivity: room.lastActivity,
      users,
      options: room.options,
      metadata: room.metadata
    };
  }

  /**
   * 获取用户信息
   */
  getUserInfo(userId) {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      currentRoom: user.currentRoom,
      joinedAt: user.joinedAt,
      connectionInfo: user.connectionInfo || {},
      stats: user.stats || {}
    };
  }

  /**
   * 注册用户
   */
  registerUser(userId, userData = {}) {
    const user = {
      id: userId,
      name: userData.name || `用户 ${userId.slice(0, 6)}`,
      currentRoom: null,
      joinedAt: null,
      leftAt: null,
      connectionInfo: userData.connectionInfo || {},
      stats: userData.stats || {},
      lastSeen: Date.now(),
      ...userData
    };

    this.users.set(userId, user);
    this.emit('user-registered', { userId, user });

    return user;
  }

  /**
   * 更新用户连接信息
   */
  updateUserConnection(userId, connectionInfo) {
    const user = this.users.get(userId);
    if (!user) {
      return false;
    }

    user.connectionInfo = {
      ...user.connectionInfo,
      ...connectionInfo,
      lastUpdate: Date.now()
    };

    // 如果用户在房间中，更新房间的延迟地图
    if (user.currentRoom) {
      this.updateRoomLatencyMap(user.currentRoom, userId, connectionInfo);
    }

    this.emit('user-connection-updated', { userId, connectionInfo });

    return true;
  }

  /**
   * 更新房间延迟地图
   */
  updateRoomLatencyMap(roomId, userId, connectionInfo) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    if (!room.metadata.latencyMap) {
      room.metadata.latencyMap = new Map();
    }

    const latencyMap = room.metadata.latencyMap;
    if (!latencyMap.has(userId)) {
      latencyMap.set(userId, new Map());
    }

    const userLatencyMap = latencyMap.get(userId);

    // 更新该用户到其他用户的延迟
    room.users.forEach(otherUserId => {
      if (otherUserId === userId) return;

      // 这里应该根据实际网络测量更新延迟
      // 目前使用模拟数据
      const simulatedLatency = Math.floor(Math.random() * 50) + 10;
      userLatencyMap.set(otherUserId, {
        latency: simulatedLatency,
        lastUpdate: Date.now()
      });
    });
  }

  /**
   * 获取房间延迟优化建议
   */
  getRoomLatencyOptimization(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || !room.metadata.latencyMap) {
      return [];
    }

    const suggestions = [];
    const latencyMap = room.metadata.latencyMap;

    // 找出延迟较高的连接
    latencyMap.forEach((userMap, userId) => {
      userMap.forEach((data, otherUserId) => {
        if (data.latency > 100) { // 延迟超过100ms
          suggestions.push({
            type: 'high-latency',
            users: [userId, otherUserId],
            latency: data.latency,
            suggestion: '考虑使用TURN服务器或检查网络连接'
          });
        }
      });
    });

    // 找出同区域用户
    const usersByRegion = new Map();
    room.users.forEach(userId => {
      const user = this.users.get(userId);
      if (user && user.connectionInfo.region) {
        const region = user.connectionInfo.region;
        if (!usersByRegion.has(region)) {
          usersByRegion.set(region, []);
        }
        usersByRegion.get(region).push(userId);
      }
    });

    // 建议同区域用户优化连接
    usersByRegion.forEach((userIds, region) => {
      if (userIds.length >= 2) {
        suggestions.push({
          type: 'same-region',
          users: userIds,
          region,
          suggestion: '同区域用户，可优化为直接P2P连接'
        });
      }
    });

    return suggestions;
  }

  /**
   * 广播消息到房间
   */
  broadcastToRoom(roomId, message, excludeUserId = null) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return 0;
    }

    let count = 0;
    room.users.forEach(userId => {
      if (userId !== excludeUserId) {
        this.emit('room-message', {
          roomId,
          userId,
          message
        });
        count++;
      }
    });

    return count;
  }

  /**
   * 发送私信
   */
  sendPrivateMessage(fromUserId, toUserId, message) {
    const fromUser = this.users.get(fromUserId);
    const toUser = this.users.get(toUserId);

    if (!fromUser || !toUser) {
      return false;
    }

    this.emit('private-message', {
      fromUserId,
      toUserId,
      message,
      timestamp: Date.now()
    });

    return true;
  }

  /**
   * 生成房间ID
   */
  generateRoomId() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  /**
   * 检测用户区域
   */
  detectRegion() {
    // 这里应该根据IP地址或其他方法检测区域
    // 目前返回模拟数据
    const regions = ['cn-east', 'cn-north', 'cn-south', 'us-west', 'eu-central'];
    return regions[Math.floor(Math.random() * regions.length)];
  }

  /**
   * 开始清理定时器
   */
  startCleanupTimer() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveRooms();
    }, 60000); // 每分钟检查一次
  }

  /**
   * 开始心跳定时器
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeats();
    }, this.options.heartbeatInterval);
  }

  /**
   * 清理不活跃的房间
   */
  cleanupInactiveRooms() {
    const now = Date.now();
    let cleanedCount = 0;

    this.rooms.forEach((room, roomId) => {
      // 检查房间是否超时
      if (now - room.lastActivity > this.options.roomTimeout) {
        this.cleanupRoom(roomId);
        cleanedCount++;
      }

      // 检查空房间
      if (room.users.size === 0) {
        this.cleanupRoom(roomId);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      console.log(`清理了 ${cleanedCount} 个不活跃房间`);
    }
  }

  /**
   * 清理房间
   */
  cleanupRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    // 通知所有用户房间关闭
    room.users.forEach(userId => {
      const user = this.users.get(userId);
      if (user) {
        user.currentRoom = null;
      }

      this.emit('room-closed', { roomId, userId });
    });

    this.rooms.delete(roomId);
    console.log(`房间 ${roomId} 已清理`);
    this.emit('room-cleaned', { roomId });
  }

  /**
   * 发送心跳
   */
  sendHeartbeats() {
    this.users.forEach((user, userId) => {
      if (user.currentRoom) {
        this.emit('heartbeat', {
          userId,
          roomId: user.currentRoom,
          timestamp: Date.now()
        });
      }
    });
  }

  /**
   * 获取所有房间列表
   */
  getAllRooms() {
    const rooms = [];
    this.rooms.forEach(room => {
      rooms.push(this.getRoomInfo(room.id));
    });
    return rooms;
  }

  /**
   * 获取活跃用户数
   */
  getActiveUserCount() {
    let count = 0;
    this.users.forEach(user => {
      if (user.currentRoom) {
        count++;
      }
    });
    return count;
  }

  /**
   * 清理所有资源
   */
  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.rooms.clear();
    this.users.clear();

    this.emit('cleanup');
    console.log('房间管理器已清理');
  }
}

module.exports = RoomManager;