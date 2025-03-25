#!/bin/bash

# Script to kill processes using the API and daemon ports

# Default ports
API_PORT=3030
DAEMON_PORT=3031
WEBSOCKET_PORT=3032

# Check if ports were provided as arguments
if [ ! -z "$1" ]; then
  API_PORT=$1
fi

if [ ! -z "$2" ]; then
  DAEMON_PORT=$2
fi

if [ ! -z "$3" ]; then
  WEBSOCKET_PORT=$3
fi

echo "Looking for processes using ports $API_PORT, $DAEMON_PORT, and $WEBSOCKET_PORT..."

# Find and kill processes using API port
API_PIDS=$(lsof -t -i:$API_PORT)
if [ ! -z "$API_PIDS" ]; then
  echo "Found processes using API port $API_PORT: $API_PIDS"
  echo "Killing processes..."
  for PID in $API_PIDS; do
    echo "Killing process $PID"
    kill -9 $PID
  done
else
  echo "No processes found using API port $API_PORT"
fi

# Find and kill processes using daemon port
DAEMON_PIDS=$(lsof -t -i:$DAEMON_PORT)
if [ ! -z "$DAEMON_PIDS" ]; then
  echo "Found processes using daemon port $DAEMON_PORT: $DAEMON_PIDS"
  echo "Killing processes..."
  for PID in $DAEMON_PIDS; do
    echo "Killing process $PID"
    kill -9 $PID
  done
else
  echo "No processes found using daemon port $DAEMON_PORT"
fi

# Find and kill processes using WebSocket port
WS_PIDS=$(lsof -t -i:$WEBSOCKET_PORT)
if [ ! -z "$WS_PIDS" ]; then
  echo "Found processes using WebSocket port $WEBSOCKET_PORT: $WS_PIDS"
  echo "Killing processes..."
  for PID in $WS_PIDS; do
    echo "Killing process $PID"
    kill -9 $PID
  done
else
  echo "No processes found using WebSocket port $WEBSOCKET_PORT"
fi

echo "Done."
echo "To check if ports are still in use, run:"
echo "lsof -i:$API_PORT && lsof -i:$DAEMON_PORT && lsof -i:$WEBSOCKET_PORT" 