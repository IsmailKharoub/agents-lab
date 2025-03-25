import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { INestApplicationContext, Logger } from '@nestjs/common';
import * as WebSocket from 'ws';
import { Server } from 'http';
import { NestExpressApplication } from '@nestjs/platform-express';

export class WebSocketAdapter extends IoAdapter {
  private wss: WebSocket.Server;
  private logger = new Logger(WebSocketAdapter.name);
  
  constructor(private app: NestExpressApplication) {
    super(app);
  }
  
  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: ['http://localhost:3000', 'http://localhost:4000', '*'],
        credentials: true,
      },
    });
    
    // Log Socket.io connections and messages
    this.patchSocketIoServer(server);
    
    // Also set up a raw WebSocket server for clients using the native WebSocket API
    this.setupWsServer(this.app.getHttpServer());
    
    return server;
  }
  
  private patchSocketIoServer(server: any) {
    // Save original Socket.io methods
    const originalOnConnection = server.on.bind(server);
    
    // Override Socket.io "on" method to intercept connections
    server.on = (event: string, listener: Function) => {
      if (event === 'connection') {
        return originalOnConnection(event, (socket: any) => {
          this.logger.log(`[Socket.io] Client connected: ${socket.id}`);
          
          // Save original socket emit method
          const originalEmit = socket.emit.bind(socket);
          
          // Override socket emit method to log outgoing messages
          socket.emit = (event: string, ...args: any[]) => {
            this.logger.debug(`[Socket.io] OUT [${socket.id}] ${event} ${JSON.stringify(args)}`);
            return originalEmit(event, ...args);
          };
          
          // Save original socket on method
          const originalOn = socket.on.bind(socket);
          
          // Override socket on method to log incoming messages
          socket.on = (event: string, callback: Function) => {
            return originalOn(event, (...args: any[]) => {
              if (event !== 'error') {
                this.logger.debug(`[Socket.io] IN [${socket.id}] ${event} ${JSON.stringify(args)}`);
              }
              callback(...args);
            });
          };
          
          // Call original listener
          listener(socket);
        });
      }
      return originalOnConnection(event, listener);
    };
  }
  
  private setupWsServer(httpServer: Server) {
    this.wss = new WebSocket.Server({
      server: httpServer,
      path: '/ws',
    });
    
    this.wss.on('connection', (socket: WebSocket, req) => {
      const clientIp = req.socket.remoteAddress;
      this.logger.log(`[WS] Client connected from ${clientIp}`);
      
      socket.on('message', (message: WebSocket.Data) => {
        try {
          // Log the raw message
          this.logger.debug(`[WS] IN Raw message: ${message.toString()}`);
          
          const data = JSON.parse(message.toString());
          this.logger.debug(`[WS] IN Parsed message: ${JSON.stringify(data, null, 2)}`);
          
          // Echo message back for now
          const response = {
            type: 'echo',
            data,
            timestamp: new Date().toISOString()
          };
          
          this.logger.debug(`[WS] OUT Response: ${JSON.stringify(response, null, 2)}`);
          socket.send(JSON.stringify(response));
        } catch (error) {
          this.logger.error(`[WS] Error processing WebSocket message: ${error.message}`);
          
          // Send error response
          const errorResponse = {
            type: 'error',
            message: 'Failed to process message',
            error: error.message,
            timestamp: new Date().toISOString()
          };
          
          this.logger.debug(`[WS] OUT Error response: ${JSON.stringify(errorResponse, null, 2)}`);
          socket.send(JSON.stringify(errorResponse));
        }
      });
      
      socket.on('close', (code, reason) => {
        this.logger.log(`[WS] Client disconnected with code ${code} and reason: ${reason || 'No reason provided'}`);
      });
      
      socket.on('error', (error) => {
        this.logger.error(`[WS] WebSocket error: ${error.message}`);
      });
      
      // Send a welcome message
      const welcomeMessage = {
        type: 'connected',
        message: 'Connected to WebSocket server',
        timestamp: new Date().toISOString()
      };
      
      this.logger.debug(`[WS] OUT Welcome message: ${JSON.stringify(welcomeMessage, null, 2)}`);
      socket.send(JSON.stringify(welcomeMessage));
    });
  }
} 