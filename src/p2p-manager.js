/**
 * P2P连接管理器
 * 负责建立和维护P2P语音连接
 */

import SimplePeer from 'simple-peer';
import { EventEmitter } from 'events';
// const SimplePeer = require('simple-peer');
// const { EventEmitter } = require('events');

class P2PManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      trickle: true, // 使用trickle ICE
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
      ...options
    };

    this.peers = new Map(); // 存储所有连接
    this.localStream = null;
    this.connectionStats = new Map();

    // 性能监控
    this.statsInterval = null;
    this.lastStats = {};
  }

  /**
   * 初始化本地音频流
   */
  async initLocalStream(constraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
      sampleRate: 48000,
      sampleSize: 16
    },
    video: false
  }) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.emit('local-stream-ready', this.localStream);
      console.log('本地音频流初始化成功');
      return this.localStream;
    } catch (error) {
      console.error('获取音频流失败:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 创建新的P2P连接
   */
  createPeer(peerId, initiator = false) {
    if (this.peers.has(peerId)) {
      console.warn(`连接 ${peerId} 已存在`);
      return this.peers.get(peerId);
    }

    const peerOptions = {
      initiator,
      stream: this.localStream,
      trickle: this.options.trickle,
      config: this.options.config,
      sdpTransform: (sdp) => {
        // 优化SDP以减少延迟
        return this.optimizeSDP(sdp);
      }
    };

    const peer = new SimplePeer(peerOptions);

    // 设置连接超时
    const connectionTimeout = setTimeout(() => {
      if (peer.destroyed) return;
      console.warn(`连接 ${peerId} 超时`);
      this.emit('connection-timeout', peerId);
      peer.destroy();
    }, 30000);

    peer.on('signal', (data) => {
      clearTimeout(connectionTimeout);
      this.emit('signal', { peerId, data });
    });

    peer.on('connect', () => {
      clearTimeout(connectionTimeout);
      console.log(`连接 ${peerId} 建立成功`);
      this.emit('connected', peerId);

      // 开始监控连接状态
      this.startMonitoring(peerId, peer);
    });

    peer.on('stream', (stream) => {
      console.log(`收到 ${peerId} 的音频流`);
      this.emit('stream', { peerId, stream });
    });

    peer.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.emit('data', { peerId, message });
      } catch (error) {
        console.error('解析数据失败:', error);
      }
    });

    peer.on('close', () => {
      console.log(`连接 ${peerId} 关闭`);
      this.removePeer(peerId);
      this.emit('disconnected', peerId);
    });

    peer.on('error', (error) => {
      console.error(`连接 ${peerId} 错误:`, error);
      this.removePeer(peerId);
      this.emit('error', { peerId, error });
    });

    this.peers.set(peerId, peer);
    this.connectionStats.set(peerId, {
      connectedAt: null,
      bytesSent: 0,
      bytesReceived: 0,
      latency: null,
      packetLoss: 0
    });

    return peer;
  }

  /**
   * 处理收到的信号数据
   */
  handleSignal(peerId, signalData) {
    let peer = this.peers.get(peerId);
    if (!peer) {
      peer = this.createPeer(peerId, false);
    }

    try {
      peer.signal(signalData);
    } catch (error) {
      console.error(`处理信号失败:`, error);
      this.emit('error', { peerId, error });
    }
  }

  /**
   * 发送数据到指定连接
   */
  sendData(peerId, data) {
    const peer = this.peers.get(peerId);
    if (!peer || !peer.connected) {
      console.warn(`连接 ${peerId} 不存在或未连接`);
      return false;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      peer.send(message);

      // 更新统计
      const stats = this.connectionStats.get(peerId);
      if (stats) {
        stats.bytesSent += message.length;
      }

      return true;
    } catch (error) {
      console.error(`发送数据失败:`, error);
      return false;
    }
  }

  /**
   * 广播数据到所有连接
   */
  broadcast(data) {
    let successCount = 0;
    this.peers.forEach((peer, peerId) => {
      if (this.sendData(peerId, data)) {
        successCount++;
      }
    });
    return successCount;
  }

  /**
   * 移除连接
   */
  removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (peer) {
      if (!peer.destroyed) {
        peer.destroy();
      }
      this.peers.delete(peerId);
      this.connectionStats.delete(peerId);
    }
  }

  /**
   * 获取所有连接状态
   */
  getConnectionStats() {
    const stats = {};
    this.connectionStats.forEach((value, key) => {
      stats[key] = { ...value };
    });
    return stats;
  }

  /**
   * 获取延迟最低的连接
   */
  getLowestLatencyPeer() {
    let lowestLatency = Infinity;
    let lowestPeerId = null;

    this.connectionStats.forEach((stats, peerId) => {
      if (stats.latency && stats.latency < lowestLatency) {
        lowestLatency = stats.latency;
        lowestPeerId = peerId;
      }
    });

    return lowestPeerId;
  }

  /**
   * 优化SDP以减少延迟
   */
  optimizeSDP(sdp) {
    // 移除视频相关配置（纯音频应用）
    sdp = sdp.replace(/m=video.*\r\n/g, '');

    // 设置低延迟参数
    sdp = sdp.replace(/a=mid:video\r\n/g, '');
    sdp = sdp.replace(/a=sendrecv\r\n/g, 'a=sendrecv\r\na=bundle-only\r\n');

    // 优化编解码器优先级
    sdp = sdp.replace(/a=rtpmap:111 opus\/48000\/2\r\n/, 'a=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10;useinbandfec=1\r\n');

    return sdp;
  }

  /**
   * 开始监控连接状态
   */
  startMonitoring(peerId, peer) {
    const stats = this.connectionStats.get(peerId);
    if (stats) {
      stats.connectedAt = new Date();
    }

    // 定期获取连接统计
    if (!this.statsInterval) {
      this.statsInterval = setInterval(() => {
        this.updateConnectionStats();
      }, 5000);
    }
  }

  /**
   * 更新连接统计
   */
  async updateConnectionStats() {
    for (const [peerId, peer] of this.peers) {
      if (peer.destroyed || !peer._channel) continue;

      try {
        const stats = peer._channel.getStats();
        const connectionStats = this.connectionStats.get(peerId);

        if (connectionStats) {
          // 这里可以添加更详细的统计信息
          // 实际实现需要根据WebRTC统计API调整
        }
      } catch (error) {
        // 统计获取可能失败，忽略
      }
    }
  }

  /**
   * 清理所有连接
   */
  cleanup() {
    this.peers.forEach((peer, peerId) => {
      this.removePeer(peerId);
    });

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.emit('cleanup');
  }

  /**
   * 获取活动连接数量
   */
  getActiveConnections() {
    let count = 0;
    this.peers.forEach(peer => {
      if (peer.connected && !peer.destroyed) {
        count++;
      }
    });
    return count;
  }
}

export default P2PManager;
// module.exports = P2PManager;
