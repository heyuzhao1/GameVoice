import { EventEmitter } from 'events';
// const { EventEmitter } = require('events');

// WebSocket兼容性处理
let WebSocketImpl;
if (typeof window !== 'undefined' && window.WebSocket) {
    // 浏览器环境
    WebSocketImpl = window.WebSocket;
} else {
    // Node.js环境 (Electron主进程)
    // 动态require，避免打包时被静态分析
    try {
        WebSocketImpl = eval('require')('ws');
    } catch (e) {
        console.warn('ws module not found, signaling server may not work in Node environment');
    }
}

function safeJsonParse(text) {
    try {
        return JSON.parse(text);
    } catch (_) {
        return null;
    }
}

class SignalingClient extends EventEmitter {
    constructor({ url, userId, userName }) {
        super();
        this.url = url;
        this.userId = userId;
        this.userName = userName;
        this.ws = null;
        this.isConnected = false;
        this.currentRoomId = null;
        this._helloAcked = false;
        this._connectPromise = null;
        this._reconnectTimer = null;
        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = 5;
    }

    async connect() {
        if (this._connectPromise) return this._connectPromise;

        // 清除重连定时器
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }

        this._connectPromise = new Promise((resolve, reject) => {
            try {
                const ws = new WebSocketImpl(this.url);
                this.ws = ws;

                const timeout = setTimeout(() => {
                    if (!settled) {
                        reject(new Error('连接信令服务器超时'));
                        try {
                            ws.close();
                        } catch (_) { }
                    }
                }, 8000);

                let settled = false;
                const safeResolve = (v) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeout);
                    this._reconnectAttempts = 0; // 重置重连次数
                    resolve(v);
                };
                const safeReject = (e) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeout);
                    this._connectPromise = null;
                    reject(e);
                };

                ws.onopen = () => {
                    this.isConnected = true;
                    ws.send(
                        JSON.stringify({
                            type: 'hello',
                            userId: this.userId,
                            userName: this.userName
                        })
                    );
                };

                ws.onmessage = (evt) => {
                    const msg = safeJsonParse(evt.data);
                    if (!msg || typeof msg.type !== 'string') return;

                    if (msg.type === 'hello-ack') {
                        this._helloAcked = true;
                        this.emit('connected');
                        safeResolve(true);
                        return;
                    }

                    if (msg.type === 'room-created') {
                        this.emit('room-created', { roomId: msg.roomId, roomName: msg.roomName });
                        return;
                    }

                    if (msg.type === 'room-joined') {
                        this.currentRoomId = msg.roomId;
                        this.emit('room-joined', { roomId: msg.roomId, roomName: msg.roomName, users: msg.users || [] });
                        return;
                    }

                    if (msg.type === 'room-left') {
                        const oldRoomId = this.currentRoomId;
                        this.currentRoomId = null;
                        this.emit('room-left', { roomId: oldRoomId });
                        return;
                    }

                    if (msg.type === 'user-joined') {
                        this.emit('user-joined', { roomId: msg.roomId, user: msg.user });
                        return;
                    }

                    if (msg.type === 'user-left') {
                        this.emit('user-left', { roomId: msg.roomId, userId: msg.userId });
                        return;
                    }

                    if (msg.type === 'signal') {
                        this.emit('signal', { from: msg.from, data: msg.data });
                        return;
                    }

                    if (msg.type === 'user-speaking') {
                        this.emit('user-speaking', {
                            roomId: msg.roomId,
                            userId: msg.userId,
                            speaking: !!msg.speaking,
                            volumeDb: typeof msg.volumeDb === 'number' ? msg.volumeDb : null
                        });
                        return;
                    }

                    if (msg.type === 'error') {
                        const err = new Error(msg.message || '信令错误');
                        err.code = msg.code;
                        this.emit('error', err);
                    }
                };

                ws.onclose = () => {
                    const wasConnected = this.isConnected;
                    this.isConnected = false;
                    this._helloAcked = false;
                    this.currentRoomId = null;
                    this._connectPromise = null;

                    if (!settled) {
                        safeReject(new Error('信令连接已关闭'));
                        return;
                    }

                    if (wasConnected) {
                        this.emit('disconnected');
                        // 尝试自动重连
                        this._tryReconnect();
                    }
                };

                ws.onerror = () => {
                    if (!settled) {
                        safeReject(new Error('信令连接失败'));
                    }
                };
            } catch (e) {
                this._connectPromise = null;
                reject(e);
            }
        });
        return this._connectPromise;
    }

    _tryReconnect() {
        if (this._reconnectAttempts >= this._maxReconnectAttempts) {
            console.error('达到最大重连次数，停止重连');
            this.emit('error', new Error('无法连接到服务器，请检查网络'));
            return;
        }

        const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 10000);
        this._reconnectAttempts++;

        console.log(`尝试重连 (${this._reconnectAttempts}/${this._maxReconnectAttempts})，延迟: ${delay}ms`);

        this._reconnectTimer = setTimeout(() => {
            this.connect().catch(err => {
                console.warn('重连失败:', err);
                // connect() 内部的 onclose 会再次触发 _tryReconnect
            });
        }, delay);
    }

    /**
     * 创建房间
     */
    async createRoom(name = null) {
        await this.connect();

        return new Promise((resolve, reject) => {
            let timer = null;
            let cleanup = null;

            const onCreated = ({ roomId, roomName }) => {
                cleanup();
                resolve({ id: roomId, name: roomName });
            };

            const onError = (err) => {
                cleanup();
                reject(err);
            };

            cleanup = () => {
                if (timer) clearTimeout(timer);
                this.off('room-created', onCreated);
                this.off('error', onError);
            };

            timer = setTimeout(() => {
                cleanup();
                reject(new Error('创建房间超时'));
            }, 5000);

            this.on('room-created', onCreated);
            this.on('error', onError);

            this._send({ type: 'create-room', name });
        });
    }

    /**
     * 加入房间
     */
    async join(roomId) {
        const rid = String(roomId || '').trim();
        if (!rid) throw new Error('roomId 不能为空');
        await this.connect();

        return new Promise((resolve, reject) => {
            let timer = null;
            let cleanup = null;

            const onJoined = ({ roomId: joinedRoomId, users }) => {
                if (joinedRoomId === rid) {
                    cleanup();
                    resolve({ id: joinedRoomId, users });
                }
            };

            const onError = (err) => {
                cleanup();
                reject(err);
            };

            cleanup = () => {
                if (timer) clearTimeout(timer);
                this.off('room-joined', onJoined);
                this.off('error', onError);
            };

            timer = setTimeout(() => {
                cleanup();
                reject(new Error('加入房间超时'));
            }, 5000);

            this.on('room-joined', onJoined);
            this.on('error', onError);

            this._send({ type: 'join-room', roomId: rid });
        });
    }

    async leave() {
        await this.connect();
        this._send({ type: 'leave-room' });
    }

    sendSignal(toUserId, data) {
        if (!this.ws || this.ws.readyState !== WebSocketImpl.OPEN) return;
        this._send({ type: 'signal', to: toUserId, data });
    }

    sendSpeaking(speaking, volumeDb = null) {
        if (!this.ws || this.ws.readyState !== WebSocketImpl.OPEN) return;
        this._send({ type: 'speaking', speaking: !!speaking, volumeDb });
    }

    disconnect() {
        try {
            if (this.ws) this.ws.close();
        } catch (_) { }
        this.ws = null;
        this.isConnected = false;
        this._helloAcked = false;
        this.currentRoomId = null;
        this._connectPromise = null;
    }

    _send(obj) {
        try {
            if (!this.ws || this.ws.readyState !== WebSocketImpl.OPEN) return;
            this.ws.send(JSON.stringify(obj));
        } catch (_) { }
    }
}

export default SignalingClient;
// module.exports = SignalingClient;
