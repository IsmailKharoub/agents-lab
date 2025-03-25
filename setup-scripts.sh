#!/bin/bash

# Create the scripts directory if it doesn't exist
mkdir -p scripts

# Create the Python agent script if it doesn't exist
if [ ! -f scripts/run_agent.py ]; then
  cat > scripts/run_agent.py << 'EOL'
#!/usr/bin/env python3
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
EOL

  chmod +x scripts/run_agent.py
  echo "Created run_agent.py script"
fi

echo "Script setup complete!" 