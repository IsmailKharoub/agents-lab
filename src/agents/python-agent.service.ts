import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { AgentsService } from './agents.service';
import { AgentStatus } from '../common/types/agent.types';
import { WebSocketGateway } from '../websocket/websocket.gateway';

interface AgentLogMessage {
  status: 'running' | 'step' | 'completed' | 'failed' | 'error';
  message: string;
  stepNumber?: number;
  timestamp: string;
  details?: Record<string, any>;
  error?: string;
  stack_trace?: string;
  result?: any;
}

@Injectable()
export class PythonAgentService {
  private readonly logger = new Logger(PythonAgentService.name);
  private readonly pythonPath: string;
  private readonly scriptDir: string;
  private readonly logDir: string;
  private activeAgents: Map<string, { process: any, logs: string[] }> = new Map();

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => AgentsService))
    private readonly agentsService: AgentsService,
    private readonly webSocketGateway?: WebSocketGateway,
  ) {
    // Determine Python path based on environment
    this.pythonPath = this.configService.get<string>('PYTHON_PATH') || 'python3';
    this.scriptDir = path.join(process.cwd(), 'scripts');
    this.logDir = path.join(process.cwd(), 'logs');

    // Ensure script directory exists
    if (!fs.existsSync(this.scriptDir)) {
      fs.mkdirSync(this.scriptDir, { recursive: true });
    }

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Create the agent runner script if it doesn't exist
    this.ensureAgentRunnerScript();
    
    // Log that the service has initialized
    this.writeToServiceLog(`PythonAgentService initialized with Python path: ${this.pythonPath}`);
  }

  private writeToServiceLog(message: string): void {
    const logFile = path.join(this.logDir, 'python-agent-service.log');
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
  }

  private ensureAgentRunnerScript(): void {
    const scriptPath = path.join(this.scriptDir, 'run_agent.py');
    
    if (!fs.existsSync(scriptPath)) {
      const scriptContent = `#!/usr/bin/env python3
"""
Agent Runner Script for NestJS Backend

This script runs the autonomous browser agent with configuration from command line arguments
and reports results back to the NestJS backend.
"""

import os
import sys
import json
import asyncio
import logging
from datetime import datetime
from dotenv import load_dotenv
import traceback

# Add the parent directory to sys.path to import the autonomous_browser_agent package
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from autonomous_browser_agent import browse_website
except ImportError:
    print("Error: Could not import autonomous_browser_agent. Make sure it's installed.")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f"agent_{sys.argv[1]}.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

async def run_agent():
    """Run the autonomous browser agent with the provided configuration."""
    if len(sys.argv) < 8:
        logger.error("Not enough arguments provided.")
        print(json.dumps({
            "status": "error",
            "message": "Not enough arguments provided",
            "timestamp": datetime.now().isoformat()
        }))
        return

    # Parse arguments
    agent_id = sys.argv[1]
    instruction = sys.argv[2]
    model = sys.argv[3]
    headless = sys.argv[4].lower() == "true"
    max_steps = int(sys.argv[5])
    use_vision = sys.argv[6].lower() == "true"
    generate_gif = sys.argv[7].lower() == "true"

    logger.info(f"Starting agent {agent_id} with instruction: {instruction}")
    
    # Log agent parameters
    print(json.dumps({
        "status": "running",
        "step": 0,
        "message": "Agent started",
        "details": {
            "agent_id": agent_id,
            "model": model,
            "headless": headless,
            "max_steps": max_steps,
            "use_vision": use_vision,
            "generate_gif": generate_gif
        },
        "timestamp": datetime.now().isoformat()
    }))

    try:
        # Run the agent
        result = await browse_website(
            instruction=instruction,
            model=model,
            headless=headless,
            max_steps=max_steps,
            use_vision=use_vision,
            generate_gif=generate_gif
        )
        
        # Log success
        print(json.dumps({
            "status": "completed",
            "message": "Agent completed successfully",
            "result": result,
            "timestamp": datetime.now().isoformat()
        }))
    except Exception as e:
        error_message = str(e)
        stack_trace = traceback.format_exc()
        logger.error(f"Error running agent: {error_message}")
        logger.error(stack_trace)
        
        # Log error
        print(json.dumps({
            "status": "failed",
            "message": "Agent failed",
            "error": error_message,
            "stack_trace": stack_trace,
            "timestamp": datetime.now().isoformat()
        }))

if __name__ == "__main__":
    asyncio.run(run_agent())
`;
      fs.writeFileSync(scriptPath, scriptContent);
      fs.chmodSync(scriptPath, '755'); // Make executable
      this.logger.log('Created agent runner script');
    }
  }

  async startAgent(agentId: string): Promise<boolean> {
    try {
      this.writeToServiceLog(`Starting agent ${agentId}`);
      
      // Get agent details from database
      const agent = await this.agentsService.findOne(agentId);
      this.writeToServiceLog(`Found agent in database: ${JSON.stringify(agent)}`);
      
      // Check if agent is already running
      if (this.activeAgents.has(agentId)) {
        this.logger.warn(`Agent ${agentId} is already running`);
        this.writeToServiceLog(`Agent ${agentId} is already running with status ${agent.status}`);
        
        // For debugging, log active agents
        const activeAgentKeys = Array.from(this.activeAgents.keys());
        this.writeToServiceLog(`Currently active agents: ${JSON.stringify(activeAgentKeys)}`);
        
        return false;
      }
      
      // Update agent status to RUNNING
      await this.agentsService.updateAgentStatus(agentId, AgentStatus.RUNNING);
      this.writeToServiceLog(`Updated agent status to RUNNING`);
      
      // Add initial log
      await this.agentsService.addAgentLog(
        agentId,
        'info',
        'Starting agent execution',
        1,
        {
          modelName: agent.modelName,
          headless: agent.headless,
          maxSteps: agent.maxSteps,
          useVision: agent.useVision,
          generateGif: agent.generateGif,
          browserSize: agent.browserSize || 'mobile'
        }
      );
      this.writeToServiceLog(`Added initial log for agent ${agentId}`);
      
      // Prepare arguments for the Python script
      const args = [
        path.join(this.scriptDir, 'run_agent.py'),
        agentId,
        agent.instruction,
        agent.modelName,
        String(agent.headless),
        String(agent.maxSteps),
        String(agent.useVision),
        String(agent.generateGif),
        agent.browserSize || 'mobile'
      ];
      
      const command = `${this.pythonPath} ${args.join(' ')}`;
      this.logger.log(`Starting Python agent with command: ${command}`);
      this.writeToServiceLog(`Starting Python agent with command: ${command}`);
      
      // Spawn Python process
      const pythonProcess = spawn(this.pythonPath, args);
      
      // Store the active agent process
      this.activeAgents.set(agentId, { 
        process: pythonProcess,
        logs: []
      });
      
      // Handle stdout (for JSON messages)
      pythonProcess.stdout.on('data', async (data) => {
        const output = data.toString().trim();
        this.logger.debug(`Agent ${agentId} stdout: ${output}`);
        this.writeToServiceLog(`Agent ${agentId} stdout: ${output}`);
        
        try {
          // First try to parse as structured log message
          const parsedLog = this.parseAgentLogMessage(output);
          if (parsedLog.stepData) {
            if (parsedLog.isStep) {
              // Handle as a step update
              await this.handleAgentMessage(agentId, parsedLog.stepData);
            } else {
              // Handle as a regular log message
              await this.agentsService.addAgentLog(
                agentId,
                'info',
                parsedLog.stepData.message,
                0,
                parsedLog.stepData.details
              );
            }
            return;
          }

          // If not a structured log, try to parse as JSON
          const messages = output.split('\n')
            .filter(line => line.trim().startsWith('{'))
            .map(line => JSON.parse(line));
          
          for (const message of messages) {
            await this.handleAgentMessage(agentId, message);
          }
        } catch (error) {
          // If not valid JSON, just log as normal output
          this.logger.log(`Agent ${agentId} output: ${output}`);
          this.writeToServiceLog(`Agent ${agentId} output (not JSON): ${output}`);
          
          // Store in the logs array
          const agentData = this.activeAgents.get(agentId);
          if (agentData) {
            agentData.logs.push(output);
          }
        }
      });
      
      // Handle stderr
      pythonProcess.stderr.on('data', async (data) => {
        const errorOutput = data.toString().trim();
        
        this.logger.error(`Agent ${agentId} stderr: ${errorOutput}`);
        this.writeToServiceLog(`Agent ${agentId} stderr: ${errorOutput}`);
        
        // Log error
        await this.agentsService.addAgentLog(
          agentId,
          'error',
          errorOutput,
          0,
          { type: 'stderr' }
        );
      });
      
      // Handle process exit
      pythonProcess.on('close', async (code) => {
        this.logger.log(`Agent ${agentId} process exited with code ${code}`);
        this.writeToServiceLog(`Agent ${agentId} process exited with code ${code}`);
        
        // Remove from active agents
        this.activeAgents.delete(agentId);
        
        // If process didn't exit successfully and agent status is still RUNNING, mark as FAILED
        if (code !== 0) {
          const agent = await this.agentsService.findOne(agentId);
          if (agent.status === AgentStatus.RUNNING) {
            await this.agentsService.updateAgentStatus(agentId, AgentStatus.FAILED);
            await this.agentsService.addAgentLog(
              agentId,
              'error',
              `Agent process exited with code ${code}`,
              0,
              { exitCode: code }
            );
          }
        }
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to start agent ${agentId}: ${error.message}`);
      this.writeToServiceLog(`Failed to start agent ${agentId}: ${error.message}`);
      this.writeToServiceLog(`Stack trace: ${error.stack}`);
      
      // Update agent status to FAILED
      await this.agentsService.updateAgentStatus(agentId, AgentStatus.FAILED);
      await this.agentsService.addAgentLog(
        agentId,
        'error',
        `Failed to start agent: ${error.message}`,
        0,
        { stack: error.stack }
      );
      return false;
    }
  }
  
  async stopAgent(agentId: string): Promise<boolean> {
    const agentData = this.activeAgents.get(agentId);
    if (!agentData) {
      this.logger.warn(`Agent ${agentId} is not running`);
      return false;
    }
    
    try {
      // Kill the process
      agentData.process.kill();
      
      // Update agent status to STOPPED
      await this.agentsService.updateAgentStatus(agentId, AgentStatus.STOPPED);
      
      // Log stopping
      await this.agentsService.addAgentLog(
        agentId,
        'info',
        'Agent execution stopped by user',
        0,
        { action: 'user_stop' }
      );
      
      // Remove from active agents
      this.activeAgents.delete(agentId);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to stop agent ${agentId}: ${error.message}`);
      return false;
    }
  }
  
  private async handleAgentMessage(agentId: string, message: any): Promise<void> {
    // Handle different message types from the Python script
    this.writeToServiceLog(`Handling message for agent ${agentId}: ${JSON.stringify(message)}`);
    
    // Process structured data if available
    const processedMessage = this.processStructuredData(message);
    
    // Get the agent to update max steps if needed
    const agent = await this.agentsService.findOne(agentId);
    
    switch (processedMessage.status) {
      case 'running':
        // Update step count if available
        if (processedMessage.step !== undefined) {
          const stepNumber = typeof processedMessage.step === 'number' ? processedMessage.step : 0;
          
          // Update agent status
          await this.agentsService.updateAgentStatus(agentId, AgentStatus.RUNNING);
          
          // Extract event type for better categorization
          const eventType = processedMessage.details?.event || 'step';
          let logLevel = 'info';
          
          // Adjust log level based on event type
          if (eventType === 'error') {
            logLevel = 'error';
          } else if (eventType === 'warning') {
            logLevel = 'warn';
          }
          
          // Add log entry with more information
          await this.agentsService.addAgentLog(
            agentId,
            logLevel,
            processedMessage.message || `Agent running: ${eventType}`,
            stepNumber,
            processedMessage.details || {},
            processedMessage.url,
            processedMessage.screenshot
          );
          
          // Update agent's current step
          if (stepNumber > 0) {
            await this.agentsService.update(agentId, { currentStep: stepNumber });
            
            // Emit WebSocket event for real-time updates if WebSocketGateway is available
            if (this.webSocketGateway) {
              this.webSocketGateway.emitAgentStatusUpdate(
                agentId, 
                AgentStatus.RUNNING, 
                stepNumber,
                agent.maxSteps
              );
            }
          }
          
          // For specific events, send additional real-time updates
          if (eventType === 'navigation' && this.webSocketGateway && processedMessage.url) {
            // Real-time navigation update
            this.webSocketGateway.emitAgentNavigationUpdate(
              agentId,
              processedMessage.url,
              stepNumber
            );
          }
          
          if (eventType === 'screenshot' && processedMessage.screenshot && this.webSocketGateway) {
            // Real-time screenshot update
            this.webSocketGateway.emitAgentScreenshotUpdate(
              agentId,
              processedMessage.screenshot,
              processedMessage.url,
              stepNumber
            );
          }
        }
        break;
        
      case 'completed':
        // Update agent status to COMPLETED
        await this.agentsService.updateAgentStatus(agentId, AgentStatus.COMPLETED);
        
        // Add final log
        await this.agentsService.addAgentLog(
          agentId,
          'info',
          'Agent execution completed successfully',
          0,
          { result: processedMessage.result },
          processedMessage.url,
          processedMessage.screenshot
        );
        
        // Save the result in the agent_results collection
        if (processedMessage.result) {
          try {
            // First save the result without artifacts
            const savedResult = await this.agentsService.saveAgentResult(
              agentId,
              processedMessage.result.summary || 'Agent completed successfully',
              typeof processedMessage.result === 'string' 
                ? processedMessage.result 
                : processedMessage.result.outputText || JSON.stringify(processedMessage.result),
              processedMessage.result.htmlResult || undefined
            );
            
            // If we have artifacts, process and save them
            if (processedMessage.result.artifacts && processedMessage.result.artifacts.length > 0) {
              const resultId = (savedResult as any)._id.toString();
              const artifactIds = await this.agentsService.createArtifactsFromData(
                agentId,
                resultId,
                processedMessage.result.artifacts
              );
              
              // Update the result with the artifact IDs
              if (artifactIds.length > 0) {
                await this.agentsService.saveAgentResult(
                  agentId,
                  processedMessage.result.summary || 'Agent completed successfully',
                  typeof processedMessage.result === 'string' 
                    ? processedMessage.result 
                    : processedMessage.result.outputText || JSON.stringify(processedMessage.result),
                  processedMessage.result.htmlResult || undefined,
                  artifactIds
                );
              }
            }
            
            this.writeToServiceLog(`Saved result for agent ${agentId}`);
          } catch (error) {
            this.logger.error(`Failed to save result for agent ${agentId}: ${error.message}`);
            this.writeToServiceLog(`Failed to save result for agent ${agentId}: ${error.message}`);
          }
        }
        break;
        
      case 'failed':
        // Update agent status to FAILED
        await this.agentsService.updateAgentStatus(agentId, AgentStatus.FAILED);
        
        // Add error log
        await this.agentsService.addAgentLog(
          agentId,
          'error',
          processedMessage.message || 'Agent execution failed',
          0,
          { 
            error: processedMessage.error,
            stack_trace: processedMessage.stack_trace
          },
          processedMessage.url,
          processedMessage.screenshot
        );
        break;
        
      default:
        // For any other messages, just log them
        this.logger.log(`Unknown message type for agent ${agentId}: ${JSON.stringify(processedMessage)}`);
        
        // Add generic log
        await this.agentsService.addAgentLog(
          agentId,
          'info',
          typeof processedMessage === 'string' ? processedMessage : JSON.stringify(processedMessage),
          0,
          {},
          processedMessage.url,
          processedMessage.screenshot
        );
    }
  }
  
  /**
   * Process structured data from the browser agent
   * Extracts artifacts, screenshots, HTML content from the message
   */
  private processStructuredData(message: any): any {
    // Process the message data and extract structured information
    if (!message) return {};
    
    // Already structured
    if (typeof message === 'object') {
      return message;
    }
    
    // Try to parse string as JSON
    if (typeof message === 'string') {
      try {
        return JSON.parse(message);
      } catch (e) {
        // Not valid JSON, return as is
        return {
          status: 'running',
          message: message,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    // Return a default structure for unknown types
    return {
      status: 'running',
      message: String(message),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Stop all running agents
   * This is used during application shutdown to ensure all agent processes are terminated
   */
  async stopAllAgents(): Promise<void> {
    if (this.activeAgents.size === 0) {
      this.logger.log('No active agents to stop');
      return;
    }

    this.logger.log(`Stopping all ${this.activeAgents.size} active agents...`);
    const agentIds = Array.from(this.activeAgents.keys());
    
    for (const agentId of agentIds) {
      try {
        await this.stopAgent(agentId);
        this.logger.log(`Agent ${agentId} stopped successfully during shutdown`);
      } catch (error) {
        this.logger.error(`Error stopping agent ${agentId} during shutdown: ${error.message}`);
      }
    }
    
    // Double-check if there are any remaining processes
    if (this.activeAgents.size > 0) {
      this.logger.warn(`${this.activeAgents.size} agents could not be stopped gracefully, forcing termination`);
      
      // Force kill any remaining processes
      for (const [agentId, agentData] of this.activeAgents.entries()) {
        try {
          agentData.process.kill('SIGKILL');
          this.activeAgents.delete(agentId);
          this.logger.log(`Agent ${agentId} forcefully terminated`);
        } catch (error) {
          this.logger.error(`Failed to forcefully terminate agent ${agentId}: ${error.message}`);
        }
      }
    }
    
    this.logger.log('All agent processes stopped');
  }

  private parseAgentLogMessage(output: string): { isStep: boolean; stepData?: any } {
    // Parse step information
    const stepMatch = output.match(/INFO\s+\[agent\]\s+📍\s+Step\s+(\d+)/);
    if (stepMatch) {
      return {
        isStep: true,
        stepData: {
          status: 'running',
          step: parseInt(stepMatch[1], 10),
          message: output,
          details: { event: 'step' },
          timestamp: new Date().toISOString()
        }
      };
    }

    // Parse evaluation
    const evalMatch = output.match(/INFO\s+\[agent\]\s+🤷\s+Eval:\s+(.*)/);
    if (evalMatch) {
      return {
        isStep: false,
        stepData: {
          status: 'running',
          message: evalMatch[1],
          details: { event: 'evaluation' },
          timestamp: new Date().toISOString()
        }
      };
    }

    // Parse next goal
    const goalMatch = output.match(/INFO\s+\[agent\]\s+🎯\s+Next goal:\s+(.*)/);
    if (goalMatch) {
      return {
        isStep: false,
        stepData: {
          status: 'running',
          message: goalMatch[1],
          details: { event: 'goal' },
          timestamp: new Date().toISOString()
        }
      };
    }

    return { isStep: false };
  }
} 