/**
 * 语音应用核心
 * 整合音频管理、P2P连接和房间管理
 */

// const AudioManager = require('./audio-manager');
// const P2PManager = require('./p2p-manager');
// const { EventEmitter } = require('events');
// const SignalingClient = require('./signaling-client');

import AudioManager from './audio-manager';
import P2PManager from './p2p-manager';
import { EventEmitter } from 'events';
import SignalingClient from './signaling-client';

class VoiceApp extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      userId: this.generateUserId(),
      userName: `玩家${Math.floor(Math.random() * 1000)}`,
      ...options
    };

    // 初始化管理器
    this.audioManager = new AudioManager();
    this.p2pManager = new P2PManager();
    const signalingUrl =
      (typeof import.meta !== 'undefined' &&
        import.meta.env &&
        import.meta.env.VITE_SIGNALING_URL) ||
      'ws://127.0.0.1:8765';
    this.signaling = new SignalingClient({
      url: signalingUrl,
      userId: this.options.userId,
      userName: this.options.userName
    });

    // 应用状态
    this.state = {
      isConnected: false,
      currentRoom: null,
      activeUsers: [],
      connectionStats: {
        latency: 0,
        packetLoss: 0,
        bandwidth: 0,
        bytesSent: 0,
        bytesReceived: 0
      },
      performanceStats: {
        cpuUsage: 0,
        memoryUsage: 0,
        networkUsage: 0,
        audioLatency: 0
      }
    };

    // 设置事件监听
    this.setupEventListeners();

    console.log('VoiceApp初始化完成，用户ID:', this.options.userId);
  }

  /**
   * 生成用户ID
   */
  generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    // 音频管理器事件
    this.audioManager.on('local-stream-ready', (stream) => {
      console.log('本地音频流准备就绪');
      this.emit('local-stream-ready', stream);
    });

    this.audioManager.on('remote-stream-added', ({ peerId, stream }) => {
      console.log(`远程音频流添加: ${peerId}`);
      this.emit('remote-stream-added', { peerId, stream });
    });

    this.audioManager.on('speech-detected', (data) => {
      this.emit('speech-detected', data);
      this.signaling.sendSpeaking(data.type === 'start', data.volume ?? null);
    });

    // P2P管理器事件
    this.p2pManager.on('signal', ({ peerId, data }) => {
      console.log(`收到P2P信号: ${peerId}`);
      this.signaling.sendSignal(peerId, data);
      this.emit('p2p-signal', { peerId, data });
    });

    this.p2pManager.on('connected', (peerId) => {
      console.log(`P2P连接建立: ${peerId}`);
      this.updateUserConnection(peerId, { connected: true });
    });

    this.p2pManager.on('stream', ({ peerId, stream }) => {
      console.log(`收到远程流: ${peerId}`);
      this.audioManager.addRemoteStream(peerId, stream);
    });

    this.p2pManager.on('disconnected', (peerId) => {
      console.log(`P2P连接断开: ${peerId}`);
      this.updateUserConnection(peerId, { connected: false });
      this.audioManager.removeRemoteStream(peerId);
    });

    // 信令事件
    this.signaling.on('room-joined', ({ roomId, users }) => {
      this.state.currentRoom = roomId;
      this.state.isConnected = true;
      this.state.activeUsers = (users || []).map((u) => ({
        id: u.id,
        name: u.name,
        speaking: !!u.speaking,
        volume: typeof u.volume === 'number' ? u.volume : 80,
        connectionInfo: {
          region: this.detectRegion(),
          platform: this.detectPlatform(),
          connected: u.id === this.options.userId ? true : false
        }
      }));
      this.emit('active-users-updated', this.state.activeUsers);
      this.emit('room-joined', { id: roomId });

      for (const user of this.state.activeUsers) {
        if (user.id === this.options.userId) continue;
        const initiator = String(this.options.userId) < String(user.id);
        this.p2pManager.createPeer(user.id, initiator);
      }
    });

    this.signaling.on('room-left', () => {
      this.state.currentRoom = null;
      this.state.isConnected = false;
      this.state.activeUsers = [];
      this.emit('active-users-updated', this.state.activeUsers);
      this.emit('room-left');
    });

    this.signaling.on('user-joined', ({ roomId, user }) => {
      if (!user || user.id === this.options.userId) return;
      if (this.state.currentRoom !== roomId) return;

      const exists = this.state.activeUsers.some((u) => u.id === user.id);
      if (!exists) {
        this.state.activeUsers.push({
          id: user.id,
          name: user.name,
          speaking: false,
          volume: 80,
          connectionInfo: {
            region: this.detectRegion(),
            platform: this.detectPlatform(),
            connected: false
          }
        });
        this.emit('active-users-updated', this.state.activeUsers);
      }

      const initiator = String(this.options.userId) < String(user.id);
      this.p2pManager.createPeer(user.id, initiator);
    });

    this.signaling.on('user-left', ({ roomId, userId }) => {
      if (this.state.currentRoom !== roomId) return;
      this.p2pManager.removePeer(userId);
      this.audioManager.removeRemoteStream(userId);
      this.state.activeUsers = this.state.activeUsers.filter((u) => u.id !== userId);
      this.emit('active-users-updated', this.state.activeUsers);
    });

    this.signaling.on('signal', ({ from, data }) => {
      if (!from || !data) return;
      this.p2pManager.handleSignal(from, data);
    });

    this.signaling.on('user-speaking', ({ userId, speaking }) => {
      if (!userId) return;
      this.updateUserSpeaking(userId, speaking);
    });

    this.signaling.on('error', (error) => {
      this.emit('error', error);
    });
  }

  /**
   * 初始化应用
   */
  async init() {
    try {
      // 初始化音频管理器（仅加载模块，不请求权限）
      // await this.audioManager.init(); // 延迟到 startAudio()

      // 连接信令服务器
      await this.signaling.connect();

      console.log('VoiceApp初始化成功（等待音频授权）');
      this.emit('initialized');

      return true;
    } catch (error) {
      console.error('VoiceApp初始化失败:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * 启动音频（请求权限）
   */
  async startAudio() {
    try {
      await this.audioManager.init();
      // 获取本地音频流
      const localStream = await this.audioManager.getLocalStream();
      // 设置P2P管理器的本地流
      this.p2pManager.localStream = localStream;
      console.log('音频启动成功');
      return true;
    } catch (error) {
      console.error('启动音频失败:', error);
      this.emit('audio-permission-denied', error);
      throw error;
    }
  }

  /**
   * 创建房间
   */
  async createRoom(roomId = null) {
    // 确保音频已启动
    await this.startAudio();
    
    const id = roomId || `room_${Math.random().toString(36).slice(2, 8)}`;
    await this.joinRoom(id, { create: true });
    const room = { id };
    this.emit('room-created', room);
    return room;
  }

  /**
   * 加入房间
   */
  async joinRoom(roomId, options = {}) {
    // 确保音频已启动
    await this.startAudio();

    try {
      await this.signaling.join(roomId, options);
      console.log(`加入房间成功: ${roomId}`);
      return { id: roomId };
    } catch (error) {
      console.error('加入房间失败:', error);
      // 不要在这里 emit error，否则会被全局 ErrorBoundary 捕获导致黑屏
      // 让调用者 (App.jsx) 处理错误显示
      throw error;
    }
  }

  /**
   * 离开房间
   */
  async leaveRoom() {
    if (!this.state.currentRoom) {
      return false;
    }

    try {
      await this.signaling.leave();
      this.p2pManager.cleanup();
      this.state.currentRoom = null;
      this.state.isConnected = false;
      this.state.activeUsers = [];
      this.emit('active-users-updated', this.state.activeUsers);
      console.log('离开房间成功');
      this.emit('room-left');
      return true;
    } catch (error) {
      console.error('离开房间失败:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * 更新用户连接状态
   */
  updateUserConnection(userId, connectionInfo) {
    // 移除 this.roomManager 调用，因为它已被移除或合并
    // this.roomManager.updateUserConnection(userId, connectionInfo);

    // 更新本地状态
    const userIndex = this.state.activeUsers.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      this.state.activeUsers[userIndex].connectionInfo = {
        ...this.state.activeUsers[userIndex].connectionInfo,
        ...connectionInfo
      };
      this.emit('active-users-updated', this.state.activeUsers);
    }
  }

  /**
   * 更新用户说话状态
   */
  updateUserSpeaking(userId, speaking) {
    const userIndex = this.state.activeUsers.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      this.state.activeUsers[userIndex].speaking = speaking;
      this.emit('active-users-updated', this.state.activeUsers);
    }
  }

  /**
   * 切换静音状态
   */
  toggleMute() {
    const isMuted = this.audioManager.toggleMute();
    this.emit('mute-toggled', isMuted);
    return isMuted;
  }

  /**
   * 设置音量
   */
  setVolume(volume) {
    const newVolume = this.audioManager.setVolume(volume);
    this.emit('volume-changed', newVolume);
    return newVolume;
  }

  /**
   * 设置音频设备
   */
  async setAudioDevice(deviceId) {
    const success = await this.audioManager.setAudioDevice(deviceId);
    if (success) {
      this.emit('device-changed', deviceId);
    }
    return success;
  }

  /**
   * 获取音频设备列表
   */
  getAudioDevices() {
    return this.audioManager.getAudioDevices();
  }

  /**
   * 获取当前状态
   */
  getState() {
    return { ...this.state };
  }

  /**
   * 获取连接统计
   */
  getConnectionStats() {
    const p2pStats = this.p2pManager.getConnectionStats();
    this.state.connectionStats = {
      ...this.state.connectionStats,
      ...p2pStats
    };
    return this.state.connectionStats;
  }

  /**
   * 检测区域
   */
  detectRegion() {
    // 简化实现，实际应该根据IP检测
    const regions = ['cn-east', 'cn-north', 'cn-south', 'us-west', 'eu-central'];
    return regions[Math.floor(Math.random() * regions.length)];
  }

  /**
   * 检测平台
   */
  detectPlatform() {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent;
      if (ua.includes('Windows')) return 'windows';
      if (ua.includes('Mac')) return 'macos';
      if (ua.includes('Linux')) return 'linux';
    }
    return 'unknown';
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 离开房间
    if (this.state.currentRoom) {
      this.leaveRoom();
    }

    // 清理管理器
    this.audioManager.cleanup();
    this.p2pManager.cleanup();
    this.signaling.disconnect();

    console.log('VoiceApp资源已清理');
    this.emit('cleanup');
  }
}

export default VoiceApp;
// module.exports = VoiceApp;
