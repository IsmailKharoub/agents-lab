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
import time
import warnings
from datetime import datetime
from dotenv import load_dotenv
import traceback
import re

# Add the parent directory to sys.path to import the autonomous_browser_agent package
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(parent_dir)
print(f"Adding to Python path: {parent_dir}")
print(f"Python path: {sys.path}")

try:
    from autonomous_browser_agent import browse_website
    print("Successfully imported autonomous_browser_agent")
except ImportError as e:
    print(f"Error: Could not import autonomous_browser_agent. Make sure it's installed. Error: {e}")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f"agent_{sys.argv[1] if len(sys.argv) > 1 else 'unknown'}.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class AgentLogger:
    """Simple logger to track agent progress and send structured updates to NestJS."""
    
    def __init__(self):
        self.current_url = None
        self.last_screenshot = None
        self.current_step = 0
        self.url_pattern = re.compile(r'https?://[^\s]+')
    
    def log_event(self, status, message, details=None, step=None, level="info"):
        """Log a structured event to stdout for NestJS to process."""
        log_entry = {
            "status": status,
            "message": message,
            "level": level,
            "timestamp": datetime.now().isoformat()
        }
        
        if step is not None:
            log_entry["step"] = step
            
        if details:
            log_entry["details"] = details
            
        if self.current_url:
            log_entry["url"] = self.current_url
            
        if self.last_screenshot:
            log_entry["screenshot"] = self.last_screenshot
            
        # Print as JSON for NestJS to parse
        print(json.dumps(log_entry))
        sys.stdout.flush()  # Ensure output is immediately sent to parent process
    
    def update_url(self, url):
        """Update the current URL and log a navigation event."""
        if url and url != self.current_url:
            self.current_url = url
            self.log_event("running", f"Navigating to: {url}", {"event": "navigation", "url": url})
    
    def update_step(self, step_num):
        """Update the current step number and log a step event."""
        if step_num > 0 and step_num != self.current_step:
            self.current_step = step_num
            self.log_event("running", f"Step {step_num}", {"event": "step"}, step_num)
    
    def update_screenshot(self, screenshot_data):
        """Update the latest screenshot."""
        if screenshot_data:
            self.last_screenshot = screenshot_data
            self.log_event("running", "Screenshot captured", {"event": "screenshot"})
    
    def log_error(self, error_message, stack_trace=None):
        """Log an error event."""
        details = {"event": "error"}
        if stack_trace:
            details["stack_trace"] = stack_trace
        self.log_event("running", error_message, details, level="error")

async def run_agent():
    """Run the autonomous browser agent with the provided configuration."""
    if len(sys.argv) < 9:
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
    
    # Add safety for browser_size parameter
    try:
        browser_size = sys.argv[8]
        # Validate that browser_size is one of the allowed values
        if browser_size not in ["mobile", "tablet", "pc"]:
            logger.warning(f"Invalid browser_size value: {browser_size}. Using default 'mobile'.")
            browser_size = "mobile"
    except (IndexError, ValueError):
        logger.warning("Browser size parameter missing or invalid. Using default 'mobile'.")
        browser_size = "mobile"

    logger.info(f"Starting agent {agent_id} with instruction: {instruction}")
    logger.info(f"Using browser size: {browser_size}")
    
    # Create agent logger
    agent_logger = AgentLogger()
    
    # Log initial agent parameters
    agent_logger.log_event("running", "Agent started", {
        "event": "agent_start",
        "config": {
            "agent_id": agent_id,
            "model": model,
            "headless": headless,
            "max_steps": max_steps,
            "use_vision": use_vision,
            "generate_gif": generate_gif,
            "browser_size": browser_size,
            "instruction": instruction
        }
    }, 0)

    try:
        # Run the browser agent
        result = await browse_website(
            instruction=instruction,
            model=model,
            headless=headless,
            max_steps=max_steps,
            use_vision=use_vision,
            generate_gif=generate_gif,
            browser_size=browser_size
        )
        
        # Process the result - handle both string and dictionary results
        formatted_result = {}
        
        # If result is a string, use it directly as outputText
        if isinstance(result, str):
            formatted_result = {
                "summary": "Task completed",
                "outputText": result,
            }
            logger.info("Result from browse_website is a string")
        # If result is a dictionary, extract fields as before
        elif isinstance(result, dict):
            formatted_result = {
                "summary": result.get("summary", "Task completed"),
                "outputText": result.get("result", ""),
            }
            
            # Extract the URL from the result if available
            if "url" in result:
                formatted_result["url"] = result["url"]
                agent_logger.update_url(result["url"])
            elif "current_url" in result:
                formatted_result["url"] = result["current_url"]
                agent_logger.update_url(result["current_url"])
            elif "final_url" in result:
                formatted_result["url"] = result["final_url"]
                agent_logger.update_url(result["final_url"])
                
            # Add HTML result if available
            if "html" in result:
                formatted_result["htmlResult"] = result["html"]
                
            # Handle screenshots and artifacts
            artifacts = []
            
            # If we have screenshots in the result
            if "screenshots" in result and result["screenshots"]:
                for i, screenshot in enumerate(result["screenshots"]):
                    artifacts.append({
                        "type": "screenshot",
                        "name": f"screenshot_{i+1}.png",
                        "mimeType": "image/png",
                        "content": screenshot
                    })
                
                # Store first screenshot directly in the result for quick access
                if artifacts:
                    formatted_result["screenshot"] = artifacts[0]["content"]
                    agent_logger.update_screenshot(artifacts[0]["content"])
                    
            # If we generated a GIF
            if generate_gif and "history_gif" in result and result["history_gif"]:
                artifacts.append({
                    "type": "gif",
                    "name": "browsing_session.gif",
                    "mimeType": "image/gif",
                    "content": result["history_gif"]
                })
                
            if artifacts:
                formatted_result["artifacts"] = artifacts
        else:
            # For any other result type, convert to string
            formatted_result = {
                "summary": "Task completed",
                "outputText": str(result),
            }
            logger.info(f"Result from browse_website is of type {type(result).__name__}")
        
        # Log success with the formatted result
        print(json.dumps({
            "status": "completed",
            "message": "Agent completed successfully",
            "result": formatted_result,
            "timestamp": datetime.now().isoformat(),
            "url": agent_logger.current_url,
            "screenshot": agent_logger.last_screenshot
        }))
        
    except Exception as e:
        error_message = str(e)
        stack_trace = traceback.format_exc()
        logger.error(f"Error running agent: {error_message}")
        logger.error(stack_trace)
        
        # Log error
        agent_logger.log_error(error_message, stack_trace)
        
        # Send final error status for NestJS
        print(json.dumps({
            "status": "failed",
            "message": "Agent failed",
            "error": error_message,
            "stack_trace": stack_trace,
            "timestamp": datetime.now().isoformat(),
            "url": agent_logger.current_url,
            "screenshot": agent_logger.last_screenshot
        }))

if __name__ == "__main__":
    asyncio.run(run_agent())
