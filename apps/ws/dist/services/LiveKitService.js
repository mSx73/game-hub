import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { logger } from '../utils/monitoring.js';

const MAIN_ROOM_PREFIX = 'mafia-';
const MAFIA_SUB_ROOM_SUFFIX = '-mafia-only';

function isMafiaRole(role) {
  return role === 'mafia' || role === 'don';
}

export class LiveKitService {
  constructor() {
    const url = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!url || !apiKey || !apiSecret) {
      this.roomService = null;
      this.enabled = false;
      return;
    }
    this.roomService = new RoomServiceClient(url, apiKey, apiSecret);
    this.enabled = true;
  }

  getMainRoomName(roomCode) {
    return `${MAIN_ROOM_PREFIX}${roomCode}`;
  }

  getMafiaRoomName(roomCode) {
    return `${MAIN_ROOM_PREFIX}${roomCode}${MAFIA_SUB_ROOM_SUFFIX}`;
  }

  async generateToken(roomCode, playerId, name, role, canSpeak, isMafiaGame = false) {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !apiSecret) return null;

    const mainRoom = isMafiaGame ? this.getMainRoomName(roomCode) : roomCode;
    const at = new AccessToken(apiKey, apiSecret, {
      identity: playerId,
      name: name || playerId,
      ttl: '10m',
    });

    at.addGrant({
      roomJoin: true,
      room: mainRoom,
      canPublish: canSpeak,
      canSubscribe: true,
      canPublishData: true,
    });

    return await at.toJwt();
  }

  async generateMafiaChannelToken(roomCode, playerId, name) {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !apiSecret) return null;

    const mafiaRoom = this.getMafiaRoomName(roomCode);
    const at = new AccessToken(apiKey, apiSecret, {
      identity: playerId,
      name: name || playerId,
      ttl: '10m',
    });

    at.addGrant({
      roomJoin: true,
      room: mafiaRoom,
      canPublish: true,
      canSubscribe: true,
    });

    return await at.toJwt();
  }

  async muteParticipant(roomCode, playerId) {
    if (!this.roomService || !this.enabled) return;
    const mainRoom = this.getMainRoomName(roomCode);
    try {
      const participant = await this.roomService.getParticipant(mainRoom, playerId);
      const tracks = participant?.tracks || [];
      const micTrack = tracks.find((t) => t.source === 2 || t.source === 'MICROPHONE');
      if (micTrack?.sid) {
        await this.roomService.mutePublishedTrack(mainRoom, playerId, micTrack.sid, true);
        logger.info('[LiveKit] Muted participant', { roomCode, playerId });
      }
    } catch (e) {
      if (e?.message?.includes?.('not found') || e?.code === 5) return;
      logger.error('[LiveKit] Mute failed', { roomCode, playerId, err: e?.message });
    }
  }

  async removeParticipant(roomCode, playerId) {
    if (!this.roomService || !this.enabled) return;
    const mainRoom = this.getMainRoomName(roomCode);
    try {
      await this.roomService.removeParticipant(mainRoom, playerId);
      logger.info('[LiveKit] Removed participant', { roomCode, playerId });
    } catch (e) {
      if (e?.message?.includes?.('not found') || e?.code === 5) return;
      logger.error('[LiveKit] Remove participant failed', { roomCode, playerId, err: e?.message });
    }
  }

  async createRooms(roomCode) {
    if (!this.roomService || !this.enabled) return;
    const mainRoom = this.getMainRoomName(roomCode);
    const mafiaRoom = this.getMafiaRoomName(roomCode);
    try {
      await this.roomService.createRoom({
        name: mainRoom,
        emptyTimeout: 10 * 60,
        maxParticipants: 20,
      });
      await this.roomService.createRoom({
        name: mafiaRoom,
        emptyTimeout: 10 * 60,
        maxParticipants: 6,
      });
    } catch (e) {
      if (!e?.message?.includes?.('already exists')) {
        logger.warn('[LiveKit] Create rooms', { roomCode, err: e?.message });
      }
    }
  }

  async deleteRooms(roomCode) {
    if (!this.roomService || !this.enabled) return;
    const mainRoom = this.getMainRoomName(roomCode);
    const mafiaRoom = this.getMafiaRoomName(roomCode);
    try {
      await this.roomService.deleteRoom(mainRoom);
      await this.roomService.deleteRoom(mafiaRoom);
    } catch (e) {
      logger.error('[LiveKit] Delete rooms failed', { roomCode, err: e?.message });
    }
  }

  static isMafiaRole(role) {
    return isMafiaRole(role);
  }
}
