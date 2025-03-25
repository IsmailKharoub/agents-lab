import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { AgentsService } from '../agents/agents.service';
import { EventEmitter } from 'events';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { AgentStatus } from '../common/types/agent.types';
import { PythonAgentService } from '../agents/python-agent.service';

@Injectable()
export class DaemonService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DaemonService.name);
  private daemonProcess: ChildProcess | null = null;
  private daemonEnabled: boolean;
  private daemonPort: number;
  private events = new EventEmitter();
  private isShuttingDown = false;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => AgentsService))
    private readonly agentsService: AgentsService,
    private readonly webSocketGateway: WebSocketGateway,
    @Inject(forwardRef(() => PythonAgentService))
    private readonly pythonAgentService: PythonAgentService,
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
    this.isShuttingDown = true;
    this.logger.log('Daemon service is shutting down...');
    
    try {
      // Get all running agents and stop them
      const runningAgents = await this.agentsService.findAll({ 
        status: AgentStatus.RUNNING,
        limit: 100,
        offset: 0
      });
      
      if (runningAgents && runningAgents.items.length > 0) {
        this.logger.log(`Stopping ${runningAgents.items.length} running agents...`);
        
        // Stop all running agents
        for (const agent of runningAgents.items) {
          try {
            await this.stopAgent(agent.id);
            this.logger.log(`Agent ${agent.id} stopped successfully.`);
          } catch (error) {
            this.logger.error(`Failed to stop agent ${agent.id}: ${error.message}`);
          }
        }
      }
      
      // Stop the Python agent service (which will terminate any remaining child processes)
      await this.pythonAgentService.stopAllAgents();
      
      // Finally, stop the daemon process
      await this.stopDaemon();
      
      // Release event emitter resources
      this.events.removeAllListeners();
      
      this.logger.log('Daemon service shutdown complete.');
    } catch (error) {
      this.logger.error(`Error during daemon service shutdown: ${error.message}`);
    }
  }

  private startDaemon() {
    if (this.isShuttingDown) {
      this.logger.warn('Attempted to start daemon during shutdown. Request ignored.');
      return;
    }
    
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
        detached: false, // Changed to false to ensure the child process terminates with the parent
        stdio: 'inherit',
      });

      this.daemonProcess.on('error', (error) => {
        this.logger.error(`Daemon process error: ${error.message}`);
      });

      this.daemonProcess.on('exit', (code, signal) => {
        this.logger.log(`Daemon process exited with code ${code} and signal ${signal}`);
        this.daemonProcess = null;
      });

      this.logger.log('Daemon started successfully');
    } catch (error) {
      this.logger.error(`Failed to start daemon: ${error.message}`);
    }
  }

  private async stopDaemon(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.daemonProcess) {
        this.logger.log('Stopping daemon process...');
        
        // Set up a timeout in case the process doesn't exit cleanly
        const timeout = setTimeout(() => {
          this.logger.warn('Daemon process did not exit gracefully, forcing termination');
          if (this.daemonProcess) {
            this.daemonProcess.kill('SIGKILL');
          }
          this.daemonProcess = null;
          resolve();
        }, 5000);
        
        // Set up exit handler
        const exitHandler = () => {
          clearTimeout(timeout);
          this.daemonProcess = null;
          this.logger.log('Daemon process stopped');
          resolve();
        };
        
        // Listen for exit event
        this.daemonProcess.once('exit', exitHandler);
        
        // Send SIGTERM to allow graceful shutdown
        this.daemonProcess.kill('SIGTERM');
      } else {
        this.logger.log('No daemon process to stop');
        resolve();
      }
    });
  }

  async startAgent(agentId: string): Promise<boolean> {
    if (this.isShuttingDown) {
      this.logger.warn('Attempted to start agent during shutdown. Request ignored.');
      return false;
    }
    
    try {
      if (this.daemonEnabled) {
        // In daemon mode, send a message to the daemon process
        this.events.emit('agent:start', agentId);
        return true;
      } else {
        // In single process mode, run the agent using PythonAgentService
        this.logger.log(`Running agent ${agentId} using PythonAgentService in non-daemon mode`);
        return await this.pythonAgentService.startAgent(agentId);
      }
    } catch (error) {
      this.logger.error(`Failed to start agent ${agentId}: ${error.message}`);
      return false;
    }
  }

  async stopAgent(agentId: string): Promise<boolean> {
    try {
      if (this.daemonEnabled && !this.isShuttingDown) {
        // In daemon mode, send a message to the daemon process
        this.events.emit('agent:stop', agentId);
        return true;
      } else {
        // In single process mode or during shutdown, stop the agent using PythonAgentService directly
        return await this.pythonAgentService.stopAgent(agentId);
      }
    } catch (error) {
      this.logger.error(`Failed to stop agent ${agentId}: ${error.message}`);
      return false;
    }
  }

  async pauseAgent(agentId: string): Promise<boolean> {
    if (this.isShuttingDown) {
      this.logger.warn('Attempted to pause agent during shutdown. Request ignored.');
      return false;
    }
    
    try {
      if (this.daemonEnabled) {
        // In daemon mode, send a message to the daemon process
        this.events.emit('agent:pause', agentId);
        return true;
      } else {
        // In single process mode, update agent status to PAUSED
        return await this.agentsService.updateAgentStatus(agentId, AgentStatus.PAUSED);
      }
    } catch (error) {
      this.logger.error(`Failed to pause agent ${agentId}: ${error.message}`);
      return false;
    }
  }

  async resumeAgent(agentId: string): Promise<boolean> {
    if (this.isShuttingDown) {
      this.logger.warn('Attempted to resume agent during shutdown. Request ignored.');
      return false;
    }
    
    try {
      if (this.daemonEnabled) {
        // In daemon mode, send a message to the daemon process
        this.events.emit('agent:resume', agentId);
        return true;
      } else {
        // In single process mode, update agent status to RUNNING
        return await this.agentsService.updateAgentStatus(agentId, AgentStatus.RUNNING);
      }
    } catch (error) {
      this.logger.error(`Failed to resume agent ${agentId}: ${error.message}`);
      return false;
    }
  }
} 