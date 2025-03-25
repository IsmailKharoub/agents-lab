import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { AgentsService } from '../agents/agents.service';
import { EventEmitter } from 'events';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { AgentStatus } from '../common/types/agent.types';

@Injectable()
export class DaemonService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DaemonService.name);
  private daemonProcess: ChildProcess | null = null;
  private daemonEnabled: boolean;
  private daemonPort: number;
  private events = new EventEmitter();

  constructor(
    private readonly configService: ConfigService,
    private readonly agentsService: AgentsService,
  ) {
    this.daemonEnabled = this.configService.get<boolean>('DAEMON_ENABLED') || false;
    this.daemonPort = this.configService.get<number>('DAEMON_PORT') || 3001;
  }

  async onModuleInit() {
    if (this.daemonEnabled) {
      this.startDaemon();
    } else {
      this.logger.log('Daemon is disabled. Running in single process mode.');
    }
  }

  async onModuleDestroy() {
    this.stopDaemon();
  }

  private startDaemon() {
    this.logger.log(`Starting daemon on port ${this.daemonPort}...`);
    
    try {
      // In a real implementation, this would spawn a new process
      // For development, we'll just create a dummy daemon
      this.daemonProcess = spawn('node', [
        join(__dirname, '..', '..', 'dist', 'daemon', 'daemon-process.js'),
      ], {
        env: {
          ...process.env,
          PORT: this.daemonPort.toString(),
        },
        detached: true,
        stdio: 'inherit',
      });

      this.daemonProcess.on('error', (error) => {
        this.logger.error(`Daemon process error: ${error.message}`);
      });

      this.daemonProcess.on('exit', (code, signal) => {
        this.logger.log(`Daemon process exited with code ${code} and signal ${signal}`);
      });

      this.logger.log('Daemon started successfully');
    } catch (error) {
      this.logger.error(`Failed to start daemon: ${error.message}`);
    }
  }

  private stopDaemon() {
    if (this.daemonProcess) {
      this.logger.log('Stopping daemon...');
      this.daemonProcess.kill();
      this.daemonProcess = null;
      this.logger.log('Daemon stopped');
    }
  }

  async startAgent(agentId: string): Promise<boolean> {
    try {
      if (this.daemonEnabled) {
        // In a real implementation, this would send a message to the daemon process
        // For development, we'll just emit an event
        this.events.emit('agent:start', agentId);
        return true;
      } else {
        // In single process mode, handle the agent directly
        await this.agentsService.updateAgentStatus(agentId, AgentStatus.RUNNING);
        // Simulate agent running...
        setTimeout(() => {
          this.agentsService.updateAgentStatus(agentId, AgentStatus.COMPLETED);
        }, 5000);
        return true;
      }
    } catch (error) {
      this.logger.error(`Failed to start agent ${agentId}: ${error.message}`);
      return false;
    }
  }

  async stopAgent(agentId: string): Promise<boolean> {
    try {
      if (this.daemonEnabled) {
        // In a real implementation, this would send a message to the daemon process
        this.events.emit('agent:stop', agentId);
        return true;
      } else {
        // In single process mode, handle the agent directly
        return await this.agentsService.updateAgentStatus(agentId, AgentStatus.STOPPED);
      }
    } catch (error) {
      this.logger.error(`Failed to stop agent ${agentId}: ${error.message}`);
      return false;
    }
  }

  async pauseAgent(agentId: string): Promise<boolean> {
    try {
      if (this.daemonEnabled) {
        // In a real implementation, this would send a message to the daemon process
        this.events.emit('agent:pause', agentId);
        return true;
      } else {
        // In single process mode, handle the agent directly
        return await this.agentsService.updateAgentStatus(agentId, AgentStatus.PAUSED);
      }
    } catch (error) {
      this.logger.error(`Failed to pause agent ${agentId}: ${error.message}`);
      return false;
    }
  }

  async resumeAgent(agentId: string): Promise<boolean> {
    try {
      if (this.daemonEnabled) {
        // In a real implementation, this would send a message to the daemon process
        this.events.emit('agent:resume', agentId);
        return true;
      } else {
        // In single process mode, handle the agent directly
        return await this.agentsService.updateAgentStatus(agentId, AgentStatus.RUNNING);
      }
    } catch (error) {
      this.logger.error(`Failed to resume agent ${agentId}: ${error.message}`);
      return false;
    }
  }
} 