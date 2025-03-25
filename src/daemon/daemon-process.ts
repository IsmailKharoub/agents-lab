// This file represents a standalone daemon process that would be spawned
// by the main NestJS application to handle agent operations in a separate process

import { createServer } from 'http';
import * as WebSocket from 'ws';
import { config } from 'dotenv';
import { Logger } from '@nestjs/common';
import { AgentStatus } from '../common/types/agent.types';

// Load environment variables
config();

const logger = new Logger('DaemonProcess');
const port = process.env.DAEMON_PORT || 3001;

// Create a simple HTTP server
const server = createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store active agents
const activeAgents = new Map<string, { 
  status: AgentStatus, 
  currentStep: number, 
  maxSteps: number,
  interval: NodeJS.Timeout | null
}>();

// Handle WebSocket connections
wss.on('connection', (ws) => {
  logger.log('Client connected to daemon');

  // Handle messages from the main application
  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message);
      logger.log(`Received command: ${data.command} for agent: ${data.agentId}`);

      switch (data.command) {
        case 'start':
          startAgent(data.agentId, data.options);
          break;
        case 'stop':
          stopAgent(data.agentId);
          break;
        case 'pause':
          pauseAgent(data.agentId);
          break;
        case 'resume':
          resumeAgent(data.agentId);
          break;
        default:
          logger.error(`Unknown command: ${data.command}`);
      }
    } catch (error) {
      logger.error(`Failed to process message: ${error.message}`);
    }
  });

  ws.on('close', () => {
    logger.log('Client disconnected from daemon');
  });
});

// Start an agent
function startAgent(agentId: string, options: any) {
  if (activeAgents.has(agentId)) {
    logger.error(`Agent ${agentId} is already running`);
    return;
  }

  const agentData = {
    status: AgentStatus.RUNNING,
    currentStep: 0,
    maxSteps: options.maxSteps || 50,
    interval: null as NodeJS.Timeout | null
  };

  // Simulate agent steps
  agentData.interval = setInterval(() => {
    agentData.currentStep++;
    
    // Send progress update to all connected clients
    broadcastUpdate({
      type: 'status-update',
      agentId,
      status: agentData.status,
      currentStep: agentData.currentStep,
      timestamp: new Date().toISOString()
    });

    // Generate a log entry
    broadcastUpdate({
      type: 'log-update',
      agentId,
      log: {
        id: `log-${Date.now()}`,
        agentId,
        stepNumber: agentData.currentStep,
        level: 'info',
        message: `Executing step ${agentData.currentStep}`,
        timestamp: new Date().toISOString()
      }
    });

    // Check if agent has completed all steps
    if (agentData.currentStep >= agentData.maxSteps) {
      if (agentData.interval) {
        clearInterval(agentData.interval);
      }
      agentData.status = AgentStatus.COMPLETED;
      
      // Send completion update
      broadcastUpdate({
        type: 'status-update',
        agentId,
        status: agentData.status,
        currentStep: agentData.currentStep,
        timestamp: new Date().toISOString()
      });
      
      // Remove from active agents
      activeAgents.delete(agentId);
    }
  }, 1000);  // Run a step every second

  activeAgents.set(agentId, agentData);
  logger.log(`Agent ${agentId} started with max steps: ${agentData.maxSteps}`);
}

// Stop an agent
function stopAgent(agentId: string) {
  const agent = activeAgents.get(agentId);
  if (!agent) {
    logger.error(`Agent ${agentId} is not running`);
    return;
  }

  if (agent.interval) {
    clearInterval(agent.interval);
  }
  agent.status = AgentStatus.STOPPED;
  
  // Send update
  broadcastUpdate({
    type: 'status-update',
    agentId,
    status: agent.status,
    currentStep: agent.currentStep,
    timestamp: new Date().toISOString()
  });
  
  activeAgents.delete(agentId);
  logger.log(`Agent ${agentId} stopped`);
}

// Pause an agent
function pauseAgent(agentId: string) {
  const agent = activeAgents.get(agentId);
  if (!agent) {
    logger.error(`Agent ${agentId} is not running`);
    return;
  }

  if (agent.interval) {
    clearInterval(agent.interval);
    agent.interval = null;
  }
  agent.status = AgentStatus.PAUSED;
  
  // Send update
  broadcastUpdate({
    type: 'status-update',
    agentId,
    status: agent.status,
    currentStep: agent.currentStep,
    timestamp: new Date().toISOString()
  });
  
  logger.log(`Agent ${agentId} paused`);
}

// Resume an agent
function resumeAgent(agentId: string) {
  const agent = activeAgents.get(agentId);
  if (!agent) {
    logger.error(`Agent ${agentId} is not running`);
    return;
  }

  if (agent.status !== AgentStatus.PAUSED) {
    logger.error(`Agent ${agentId} is not paused`);
    return;
  }

  agent.status = AgentStatus.RUNNING;
  
  // Restart the interval
  agent.interval = setInterval(() => {
    agent.currentStep++;
    
    // Send progress update
    broadcastUpdate({
      type: 'status-update',
      agentId,
      status: agent.status,
      currentStep: agent.currentStep,
      timestamp: new Date().toISOString()
    });

    // Generate a log entry
    broadcastUpdate({
      type: 'log-update',
      agentId,
      log: {
        id: `log-${Date.now()}`,
        agentId,
        stepNumber: agent.currentStep,
        level: 'info',
        message: `Executing step ${agent.currentStep}`,
        timestamp: new Date().toISOString()
      }
    });

    // Check if agent has completed all steps
    if (agent.currentStep >= agent.maxSteps) {
      if (agent.interval) {
        clearInterval(agent.interval);
      }
      agent.status = AgentStatus.COMPLETED;
      
      // Send completion update
      broadcastUpdate({
        type: 'status-update',
        agentId,
        status: agent.status,
        currentStep: agent.currentStep,
        timestamp: new Date().toISOString()
      });
      
      // Remove from active agents
      activeAgents.delete(agentId);
    }
  }, 1000);  // Run a step every second
  
  // Send update
  broadcastUpdate({
    type: 'status-update',
    agentId,
    status: agent.status,
    currentStep: agent.currentStep,
    timestamp: new Date().toISOString()
  });
  
  logger.log(`Agent ${agentId} resumed`);
}

// Broadcast an update to all connected clients
function broadcastUpdate(data: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Start the server
server.listen(port, () => {
  logger.log(`Daemon process running on port ${port}`);
});

// Handle process termination
process.on('SIGINT', () => {
  logger.log('Daemon process shutting down...');
  
  // Clear all intervals
  activeAgents.forEach((agent, agentId) => {
    if (agent.interval) {
      clearInterval(agent.interval);
    }
    logger.log(`Stopped agent ${agentId}`);
  });
  
  // Close server
  server.close(() => {
    logger.log('Daemon process shut down');
    process.exit(0);
  });
}); 