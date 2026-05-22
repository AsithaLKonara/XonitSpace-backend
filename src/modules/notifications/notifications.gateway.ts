import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'ws',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Active client connections mapped by user ID
  private activeClients = new Map<string, Socket>();

  constructor(private jwtService: JwtService) {}

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.query?.token;

    if (!token) {
      console.log(`🔌 Connection rejected: No authorization token provided. Socket ID: ${client.id}`);
      client.disconnect(true);
      return;
    }

    try {
      const decoded = this.jwtService.verify(token.replace('Bearer ', ''), {
        secret: process.env.JWT_SECRET || 'xonit_space_ultra_secure_jwt_secret_2026_primary',
      }) as any;
      
      const userId = decoded.sub || decoded.id;
      this.activeClients.set(userId, client);
      console.log(`🔌 Client connected successfully: User ID: ${userId}, Socket ID: ${client.id}`);
    } catch (error) {
      console.log(`🔌 Connection rejected: Invalid token parameter. Socket ID: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    for (const [userId, socket] of this.activeClients.entries()) {
      if (socket.id === client.id) {
        this.activeClients.delete(userId);
        console.log(`🔌 Client disconnected: User ID: ${userId}, Socket ID: ${client.id}`);
        break;
      }
    }
  }

  /**
   * Broadcasts a real-time event alert to a specific authenticated user.
   */
  sendToUser(userId: string, event: string, data: any): boolean {
    const client = this.activeClients.get(userId);
    if (client) {
      client.emit(event, data);
      return true;
    }
    return false;
  }
}
