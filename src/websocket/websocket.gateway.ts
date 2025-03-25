import { 
  WebSocketGateway as NestWebSocketGateway, 
  WebSocketServer, 
  SubscribeMessage, 
  OnGatewayConnection, 
  OnGatewayDisconnect,
  OnGatewayInit
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentStatus } from '../common/types/agent.types';

@NestWebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:4000'],
    credentials: true,
  },
})
export class WebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(WebSocketGateway.name);

  constructor(private readonly configService: ConfigService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Methods to emit events
  emitAgentStatusUpdate(agentId: string, status: AgentStatus, currentStep: number) {
    this.server.emit('agent-status-update', {
      agentId,
      status,
      currentStep,
      timestamp: new Date().toISOString(),
    });
  }

  emitAgentLogUpdate(agentId: string, log: any) {
    this.server.emit('agent-log-update', {
      agentId,
      log,
    });
  }

  // Handle client subscription to a specific agent's updates
  @SubscribeMessage('subscribe-to-agent')
  handleSubscribeToAgent(client: Socket, agentId: string) {
    client.join(`agent:${agentId}`);
    this.logger.log(`Client ${client.id} subscribed to agent ${agentId}`);
    return { status: 'success', message: `Subscribed to agent ${agentId}` };
  }

  // Handle client unsubscription from a specific agent's updates
  @SubscribeMessage('unsubscribe-from-agent')
  handleUnsubscribeFromAgent(client: Socket, agentId: string) {
    client.leave(`agent:${agentId}`);
    this.logger.log(`Client ${client.id} unsubscribed from agent ${agentId}`);
    return { status: 'success', message: `Unsubscribed from agent ${agentId}` };
  }
} 