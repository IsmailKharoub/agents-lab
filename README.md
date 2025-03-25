# Web Agent Backend API

A backend API for the Web Agent application that can be run as a daemon locally.

## Features

- Agent management (create, run, pause, stop, resume)
- Preset prompts
- WebSocket support for real-time updates
- Daemon mode for running agents in a separate process
- API Key authentication
- Rate limiting
- Graceful shutdown management for proper resource cleanup

## Requirements

- Node.js 16+
- MongoDB
- Redis (optional, for production rate limiting)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd desktop-api

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env file with your configuration
```

## Running the Application

### Development Mode

```bash
# Start MongoDB (if not already running)
mongod --dbpath /path/to/your/data/directory

# Start the application in development mode
npm run start:dev

# Or restart if ports might be in use
npm run restart:dev
```

### Production Mode

```bash
# Build the application
npm run build

# Start the application in production mode
npm run start:prod

# Or restart if ports might be in use
npm run restart:prod
```

### Daemon Mode

The application can be run in daemon mode, where agent operations are handled in a separate process. This is controlled by the `DAEMON_ENABLED` environment variable in the `.env` file.

```
# Enable daemon mode
DAEMON_ENABLED=true
DAEMON_PORT=3001
```

### Port Management

The application handles graceful shutdowns to properly release ports and clean up resources. If you ever encounter port conflicts, you can use:

```bash
# Kill processes using the API ports
npm run kill-ports

# Kill processes using specific ports
scripts/kill-ports.sh [API_PORT] [DAEMON_PORT] [WEBSOCKET_PORT]
```

The default ports are:
- API: 3030
- Daemon: 3031
- WebSocket: 3032

## API Documentation

The API follows RESTful principles and returns responses in a consistent format:

```json
{
  "status": "success" | "error",
  "data": { /* Response data */ },
  "message": "Human-readable message",
  "code": 200, // HTTP status code
  "details": { /* Additional error details */ }
}
```

### Authentication

All API requests require an API key to be included in the request header:

```
X-API-Key: <your-api-key>
```

### Endpoints

- `GET /api/v1/agents` - Get all agents
- `GET /api/v1/agents/:id` - Get agent by ID
- `POST /api/v1/agents` - Create a new agent
- `PATCH /api/v1/agents/:id` - Update an agent
- `DELETE /api/v1/agents/:id` - Delete an agent
- `POST /api/v1/agents/:id/start` - Start an agent
- `POST /api/v1/agents/:id/stop` - Stop an agent
- `POST /api/v1/agents/:id/pause` - Pause an agent
- `POST /api/v1/agents/:id/resume` - Resume an agent
- `GET /api/v1/agents/:id/logs` - Get agent logs
- `GET /api/v1/agents/:id/results` - Get agent results
- `GET /api/v1/agents/:id/artifacts` - Get agent artifacts
- `GET /api/v1/preset-prompts` - Get all preset prompts
- `GET /api/v1/preset-prompts/:id` - Get preset prompt by ID
- `POST /api/v1/credentials/verify` - Verify credentials

## WebSocket

The application provides WebSocket support for real-time updates:

```javascript
// Connect to WebSocket
const socket = io('http://localhost:3000');

// Subscribe to agent updates
socket.emit('subscribe-to-agent', 'agent-id');

// Listen for status updates
socket.on('agent-status-update', (data) => {
  console.log('Agent status update:', data);
});

// Listen for log updates
socket.on('agent-log-update', (data) => {
  console.log('Agent log update:', data);
});

// Unsubscribe from agent updates
socket.emit('unsubscribe-from-agent', 'agent-id');
```

## License

[MIT](LICENSE)
