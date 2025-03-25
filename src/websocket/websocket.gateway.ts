import { 
  WebSocketGateway as NestWebSocketGateway, 
  WebSocketServer, 
  SubscribeMessage, 
  OnGatewayConnection, 
  OnGatewayDisconnect,
  OnGatewayInit
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentStatus } from '../common/types/agent.types';

@NestWebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  path: '/api/ws',
  namespace: '/',
})
export class WebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(WebSocketGateway.name);
  private connectedClients: Map<string, Socket> = new Map();
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  constructor(private readonly configService: ConfigService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.connectedClients.set(client.id, client);
    this.logger.log(`Client connected: ${client.id} (Total: ${this.connectedClients.size})`);
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id} (Remaining: ${this.connectedClients.size})`);
  }

  async onModuleDestroy() {
    this.logger.log(`Closing all WebSocket connections (${this.connectedClients.size} clients)...`);
    
    // Notify all clients that the server is shutting down
    this.server.emit('server-shutdown', {
      message: 'Server is shutting down',
      timestamp: new Date().toISOString(),
    });
    
    // Close each client connection
    for (const [clientId, client] of this.connectedClients.entries()) {
      try {
        client.disconnect(true);
        this.logger.debug(`Disconnected client ${clientId}`);
      } catch (error) {
        this.logger.error(`Error disconnecting client ${clientId}: ${error.message}`);
      }
    }
    
    // Clear the clients map
    this.connectedClients.clear();
    
    // Close the server
    if (this.server) {
      try {
        this.server.disconnectSockets(true);
        this.server.close();
        this.logger.log('WebSocket server closed successfully');
      } catch (error) {
        this.logger.error(`Error closing WebSocket server: ${error.message}`);
      }
    }
  }

  private async emitWithRetry(room: string, event: string, data: any, retries = 0): Promise<void> {
    try {
      this.logger.debug(
        `Emitting event "${event}" to room "${room}" (attempt ${retries + 1}/${this.maxRetries + 1}):\n` +
        `Data: ${JSON.stringify(data, null, 2)}`
      );

      await this.server.to(room).emit(event, data);
      
      this.logger.log(`Successfully emitted event "${event}" to room "${room}"`);
    } catch (error) {
      this.logger.error(
        `Failed to emit "${event}" to room "${room}" (attempt ${retries + 1}/${this.maxRetries + 1}): ${error.message}`
      );
      
      if (retries < this.maxRetries) {
        this.logger.log(`Retrying emission of "${event}" to room "${room}" in ${this.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.emitWithRetry(room, event, data, retries + 1);
      }
      throw error;
    }
  }

  async emitAgentStatusUpdate(agentId: string, status: AgentStatus, currentStep: number, maxSteps?: number) {
    try {
      const update = {
        agentId,
        status,
        currentStep,
        maxSteps,
        progress: maxSteps ? Math.min(100, Math.round((currentStep / maxSteps) * 100)) : 0,
        timestamp: new Date().toISOString(),
      };
      
      // Emit to both general channel and agent-specific room with retry logic
      await Promise.all([
        this.emitWithRetry('all', 'agent-status-update', update),
        this.emitWithRetry(`agent:${agentId}`, 'agent-status-update', update)
      ]);
    } catch (error) {
      this.logger.error(`Failed to emit status update for agent ${agentId} after retries: ${error.message}`);
    }
  }

  async emitAgentLogUpdate(agentId: string, log: any) {
    try {
      await Promise.all([
        this.emitWithRetry('all', 'agent-log-update', { agentId, log }),
        this.emitWithRetry(`agent:${agentId}`, 'agent-log-update', { agentId, log })
      ]);
    } catch (error) {
      this.logger.error(`Failed to emit log update for agent ${agentId} after retries: ${error.message}`);
    }
  }

  async emitAgentResultUpdate(agentId: string, result: any) {
    try {
      const formattedResult = {
        agentId,
        result: {
          ...result,
          summary: result.summary || (typeof result.outputText === 'string' 
            ? result.outputText.slice(0, 150) + (result.outputText.length > 150 ? '...' : '') 
            : 'Agent execution completed'),
          hasArtifacts: result.artifacts && result.artifacts.length > 0,
          artifactCount: result.artifacts ? result.artifacts.length : 0,
          formattedTimestamp: new Date().toLocaleString()
        },
        timestamp: new Date().toISOString(),
      };
      
      await Promise.all([
        this.emitWithRetry('all', 'agent-result-update', formattedResult),
        this.emitWithRetry(`agent:${agentId}`, 'agent-result-update', formattedResult)
      ]);
    } catch (error) {
      this.logger.error(`Failed to emit result update for agent ${agentId} after retries: ${error.message}`);
    }
  }

  async emitAgentNavigationUpdate(agentId: string, url: string, stepNumber: number) {
    if (!url) return;
    
    try {
      const navigationUpdate = {
        agentId,
        url, 
        stepNumber,
        timestamp: new Date().toISOString(),
      };
      
      await Promise.all([
        this.emitWithRetry('all', 'agent-navigation-update', navigationUpdate),
        this.emitWithRetry(`agent:${agentId}`, 'agent-navigation-update', navigationUpdate)
      ]);
    } catch (error) {
      this.logger.error(`Failed to emit navigation update for agent ${agentId} after retries: ${error.message}`);
    }
  }

  async emitAgentScreenshotUpdate(agentId: string, screenshot: string, url?: string, stepNumber?: number) {
    if (!screenshot) return;
    
    try {
      const screenshotUpdate = {
        agentId,
        screenshot,
        url,
        stepNumber,
        timestamp: new Date().toISOString(),
      };
      
      // Only emit to agent-specific room to avoid bandwidth issues
      await this.emitWithRetry(`agent:${agentId}`, 'agent-screenshot-update', screenshotUpdate);
    } catch (error) {
      this.logger.error(`Failed to emit screenshot update for agent ${agentId} after retries: ${error.message}`);
    }
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