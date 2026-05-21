import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userMap = new Map<string, { socket: Socket; user: any }>();

  constructor(
    private jwtService: JwtService,
    private chatService: ChatService,
  ) {}

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    if (!token) { client.disconnect(true); return; }
    try {
      const decoded = this.jwtService.verify(
        (token as string).replace('Bearer ', ''),
        { secret: process.env.JWT_SECRET },
      ) as any;
      this.userMap.set(client.id, { socket: client, user: decoded });
      client.data.user = decoded;
      // Broadcast online users list
      this.server.emit('online_users', this.getOnlineUsers());
      console.log(`💬 Chat connected: ${decoded.email}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.userMap.delete(client.id);
    this.server.emit('online_users', this.getOnlineUsers());
    console.log(`💬 Chat disconnected: ${client.id}`);
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() data: { content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    if (!user || !data.content?.trim()) return;

    const message = await this.chatService.saveMessage(user.sub, data.content.trim());
    // Broadcast to everyone in the namespace
    this.server.emit('new_message', message);
  }

  @SubscribeMessage('get_history')
  async handleGetHistory(@ConnectedSocket() client: Socket) {
    const history = await this.chatService.getHistory(50);
    client.emit('chat_history', history);
  }

  private getOnlineUsers() {
    return Array.from(this.userMap.values()).map(({ user }) => ({
      id: user.sub,
      email: user.email,
      role: user.role,
    }));
  }
}
