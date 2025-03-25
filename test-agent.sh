#!/bin/bash

# Create a new agent
echo "Creating a new agent..."
RESPONSE=$(curl -s -X POST http://localhost:3030/api/v1/agents \
  -H "Content-Type: application/json" \
  -H "X-API-Key: development-key" \
  -d '{
    "instruction": "Test instruction for browsing",
    "modelName": "gpt-4o",
    "maxSteps": 10,
    "headless": true,
    "useVision": true,
    "generateGif": false
  }')

AGENT_ID=$(echo $RESPONSE | jq -r '.data.agent.id')
echo "Created agent with ID: $AGENT_ID"

# Start the agent
echo "Starting agent..."
curl -s -X POST http://localhost:3030/api/v1/agents/$AGENT_ID/start \
  -H "Content-Type: application/json" \
  -H "X-API-Key: development-key"

echo "Agent started. Monitor logs to see progress."
echo "Waiting for agent to process (30 seconds)..."
sleep 30

# Check the agent's status
echo "Checking agent status..."
curl -s -X GET http://localhost:3030/api/v1/agents/$AGENT_ID \
  -H "Content-Type: application/json" \
  -H "X-API-Key: development-key" | jq

# Check the agent's logs
echo "Checking agent logs..."
curl -s -X GET http://localhost:3030/api/v1/agents/$AGENT_ID/logs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: development-key" | jq

echo "Checking raw agent logs from the filesystem:"
echo "----------------------------------------"
if [ -f "agent_${AGENT_ID}.log" ]; then
  tail -30 "agent_${AGENT_ID}.log"
else
  echo "No agent log file found at agent_${AGENT_ID}.log"
fi

echo "----------------------------------------"
echo "Checking Python agent service logs:"
echo "----------------------------------------"
if [ -f "logs/python-agent-service.log" ]; then
  tail -30 "logs/python-agent-service.log"
else
  echo "No log file found at logs/python-agent-service.log"
fi 