/**
 * P2P连接管理器
 * 负责WebRTC P2P连接的建立、维护和数据传输
 */

const SimplePeer = require('simple-peer');
const EventEmitter = require('events');

class P2PConnection extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      initiator: false,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
      },
      stream: null,
      ...options
    };

    this.peer = null;
    this.stream = this.options.stream;
    this.connected = false;
    this.connectionStats = {
      latency: 0,
      packetLoss: 0,
      bytesSent: 0,
      bytesReceived: 0,
      lastUpdate: Date.now()
    };

    this.statsInterval = null;
  }

  /**
   * 初始化P2P连接
   */
  init() {
    try {
      this.peer = new SimplePeer({
        initiator: this.options.initiator,
        trickle: this.options.trickle,
        config: this.options.config,
        stream: this.stream
      });

      this.setupEventListeners();
      console.log('P2P连接初始化完成');

      return this;
    } catch (error) {
      console.error('P2P连接初始化失败:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 信号数据（需要发送给对等方）
    this.peer.on('signal', (data) => {
      this.emit('signal', data);
    });

    // 连接建立
    this.peer.on('connect', () => {
      console.log('P2P连接已建立');
      this.connected = true;
      this.startStatsMonitoring();
      this.emit('connect');
    });

    // 收到数据
    this.peer.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.emit('data', message);
      } catch (error) {
        console.error('解析接收数据失败:', error);
      }
    });

    // 收到音频流
    this.peer.on('stream', (stream) => {
      console.log('收到远程音频流');
      this.emit('stream', stream);
    });

    // 连接关闭
    this.peer.on('close', () => {
      console.log('P2P连接已关闭');
      this.cleanup();
      this.emit('close');
    });

    // 错误处理
    this.peer.on('error', (error) => {
      console.error('P2P连接错误:', error);
      this.emit('error', error);
    });

    // ICE连接状态变化
    this.peer.on('iceStateChange', (state) => {
      console.log('ICE状态变化:', state);
      this.emit('ice-state-change', state);
    });
  }

  /**
   * 发送信号数据（用于建立连接）
   */
  signal(data) {
    if (this.peer) {
      this.peer.signal(data);
    }
  }

  /**
   * 发送数据
   */
  send(data) {
    if (!this.connected || !this.peer) {
      console.warn('连接未建立，无法发送数据');
      return false;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.peer.send(message);
      return true;
    } catch (error) {
      console.error('发送数据失败:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * 发送音频流
   */
  addStream(stream) {
    if (this.peer && stream) {
      this.peer.addStream(stream);
      this.stream = stream;
    }
  }

  /**
   * 移除音频流
   */
  removeStream() {
    if (this.peer && this.stream) {
      // SimplePeer没有直接的removeStream方法
      // 需要重新创建连接或使用其他方式
      console.log('需要重新创建连接来移除音频流');
    }
  }

  /**
   * 开始监控连接统计信息
   */
  startStatsMonitoring() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    this.statsInterval = setInterval(() => {
      this.updateConnectionStats();
    }, 3000);
  }

  /**
   * 更新连接统计信息
   */
  async updateConnectionStats() {
    if (!this.peer || !this.connected) {
      return;
    }

    try {
      // 获取WebRTC统计信息
      const stats = await this.peer._pc.getStats();

      let bytesSent = 0;
      let bytesReceived = 0;
      let packetsSent = 0;
      let packetsReceived = 0;
      let packetsLost = 0;

      stats.forEach(report => {
        if (report.type === 'outbound-rtp' && report.mediaType === 'audio') {
          bytesSent = report.bytesSent || 0;
          packetsSent = report.packetsSent || 0;
        }

        if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
          bytesReceived = report.bytesReceived || 0;
          packetsReceived = report.packetsReceived || 0;
          packetsLost = report.packetsLost || 0;
        }

        if (report.type === 'candidate-pair' && report.nominated) {
          // 可以获取RTT等信息
          if (report.currentRoundTripTime) {
            this.connectionStats.latency = Math.round(report.currentRoundTripTime * 1000);
          }
        }
      });

      // 计算丢包率
      const totalPackets = packetsSent + packetsReceived;
      if (totalPackets > 0) {
        this.connectionStats.packetLoss = packetsLost / totalPackets;
      }

      // 更新字节计数
      this.connectionStats.bytesSent = bytesSent;
      this.connectionStats.bytesReceived = bytesReceived;
      this.connectionStats.lastUpdate = Date.now();

      // 触发统计更新事件
      this.emit('stats-update', { ...this.connectionStats });

    } catch (error) {
      console.error('获取连接统计失败:', error);
    }
  }

  /**
   * 获取连接统计信息
   */
  getStats() {
    return { ...this.connectionStats };
  }

  /**
   * 检查连接状态
   */
  isConnected() {
    return this.connected;
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.peer) {
      this.peer.destroy();
    }
    this.cleanup();
  }

  /**
   * 清理资源
   */
  cleanup() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    this.connected = false;
    this.peer = null;
    this.stream = null;

    console.log('P2P连接资源已清理');
  }
}

module.exports = P2PConnection;