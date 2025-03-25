import asyncio
import os
import logging
import argparse
import traceback
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from browser_use import Agent, Browser, BrowserConfig, BrowserContextConfig

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Predefined browser sizes
BROWSER_SIZES = {
    "mobile": {"width": 390, "height": 844},
    "tablet": {"width": 810, "height": 1080},
    "pc": {"width": 1366, "height": 768}
}

class AutonomousBrowserAgent:
    """
    A browser agent that can autonomously browse any website based on instructions.
    
    This agent uses the browser-use library to control a Chrome browser and leverages
    OpenAI's GPT models to understand and interact with web content.
    """
    
    def __init__(
        self,
        instruction: str,
        model: str = "gpt-4o",
        headless: bool = False,
        max_steps: int = 50,
        use_vision: bool = True,
        generate_gif: bool = False,
        browser_size: str = "mobile"
    ):
        """
        Initialize the autonomous browser agent.
        
        Args:
            instruction (str): The instruction for what the agent should do
            model (str): The OpenAI model to use (default: gpt-4o)
            headless (bool): Whether to run the browser in headless mode
            max_steps (int): Maximum number of steps for the agent to take
            use_vision (bool): Whether to use vision capabilities for better understanding web content
            generate_gif (bool): Whether to generate a GIF of the browsing session
            browser_size (str): Size of the browser window ('mobile', 'tablet', or 'pc')
        """
        logger.info("Starting AutonomousBrowserAgent initialization")
        
        # Check for OpenAI API key
        if not os.getenv("OPENAI_API_KEY"):
            logger.error("OPENAI_API_KEY is not set in environment variables or .env file")
            raise ValueError("OPENAI_API_KEY is not set in environment variables or .env file")
            
        self.instruction = instruction
        self.model = model
        self.headless = headless
        self.max_steps = max_steps
        self.use_vision = use_vision
        self.generate_gif = generate_gif
        
        # Set browser size dimensions
        if browser_size not in BROWSER_SIZES:
            logger.warning(f"Invalid browser_size '{browser_size}'. Using 'mobile' as default.")
            browser_size = "mobile"
        self.browser_size = browser_size
        window_size = BROWSER_SIZES[browser_size]
        
        logger.info(f"Initializing browser with window size {browser_size}: {window_size}")
        
        # Initialize the LLM
        logger.info(f"Initializing LLM with model {model}")
        try:
            self.llm = ChatOpenAI(
                model=self.model,
                temperature=0.0,  # Use deterministic outputs
                max_tokens=16000,
            )
            logger.info("LLM initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing LLM: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            raise
        
        # Initialize the browser with enhanced timeout and navigation settings
        logger.info("Initializing browser")
        try:
            self.browser = Browser(
                config=BrowserConfig(
                    headless=self.headless,
                    disable_security=True,
                    new_context_config=BrowserContextConfig(
                        disable_security=True,
                        browser_window_size=window_size,
                    ),
                )
            )
            logger.info("Browser initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing browser: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            raise
        
        # Initialize the agent with additional settings
        logger.info("Initializing agent")
        try:
            self.agent = Agent(
                task=self.instruction,
                llm=self.llm,
                browser=self.browser,
                use_vision=self.use_vision,
                generate_gif=self.generate_gif
            )
            logger.info("Agent initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing agent: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            raise
        
        self.history = None
        logger.info("AutonomousBrowserAgent initialization completed")
        
    async def run(self):
        """Run the browser agent to complete the given instruction."""
        logger.info(f"Starting autonomous browser agent with instruction: {self.instruction}")
        logger.info(f"Configuration: model={self.model}, headless={self.headless}, max_steps={self.max_steps}, use_vision={self.use_vision}, generate_gif={self.generate_gif}, browser_size={self.browser_size}")
        
        try:
            # Ensure browser is ready by navigating to a simple test page first
            logger.info("Performing browser readiness check...")
            try:
                await self.browser.goto("https://example.com")
                logger.info("Browser readiness check passed - successfully loaded example.com")
            except Exception as e:
                logger.warning(f"Browser readiness check failed: {str(e)}. Continuing anyway...")
            
            # Run the agent and get the history
            logger.info("Running agent with max_steps=" + str(self.max_steps))
            
            # Set a timeout for the agent's run method to prevent infinite hanging
            async def run_with_timeout():
                self.history = await self.agent.run(max_steps=self.max_steps)
                return self.history
            
            try:
                # Run the agent with a timeout to prevent hanging
                self.history = await asyncio.wait_for(run_with_timeout(), timeout=300)  # 5 minute timeout
                logger.info("Agent run completed successfully")
            except asyncio.TimeoutError:
                logger.error("Agent execution timed out after 5 minutes")
                return "Agent execution timed out. The browser agent was unable to complete the task within the allocated time."
            except Exception as e:
                logger.error(f"Error during agent.run(): {str(e)}")
                logger.error(f"Stack trace: {traceback.format_exc()}")
                raise
            
            # Save the history to a file
            logger.info("Saving history to file")
            
            if hasattr(self.history, 'save_to_file'):
                self.history.save_to_file('./agent_history.json')
                logger.info("History saved successfully")
            else:
                logger.warning("History doesn't have save_to_file method")
            
            if self.generate_gif:
                logger.info("GIF of the browsing session has been generated")
                
            # Return the final result
            logger.info("Processing agent result")
            
            if hasattr(self.history, 'history'):
                if self.history.history and len(self.history.history) > 0:
                    logger.info(f"History has {len(self.history.history)} steps")
                    last_history_entry = self.history.history[-1]
                    
                    if hasattr(last_history_entry, 'result') and last_history_entry.result:
                        last_result = last_history_entry.result[-1]
                        
                        if hasattr(last_result, 'is_done') and last_result.is_done:
                            logger.info("Agent completed task successfully")
                            return last_result.extracted_content
                        else:
                            logger.warning("Agent did not complete the task (is_done is False)")
                            return "Task was not completed successfully"
                    else:
                        logger.warning("Last history entry has no result")
                else:
                    logger.warning("No history steps found")
            else:
                logger.warning("History object does not have 'history' attribute")
            
            logger.info("No results found in history, returning default message")
            return "No results found in history"
            
        except Exception as e:
            logger.error(f"Error running browser agent: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            return f"An error occurred while running the browser agent: {str(e)}"
        finally:
            # Cleanup resources
            logger.info("Starting cleanup")
            await self.cleanup()
            logger.info("Cleanup completed")
    
    async def cleanup(self):
        """Clean up browser resources."""
        try:
            logger.info("Cleaning up browser resources")
            if hasattr(self.agent, 'close'):
                await self.agent.close()
                logger.info("Agent closed successfully")
            elif hasattr(self.agent, 'browser') and hasattr(self.agent.browser, 'close'):
                await self.agent.browser.close()
                logger.info("Browser closed successfully")
            else:
                logger.warning("No close method found on agent or agent.browser")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
            logger.error(f"Stack trace: {traceback.format_exc()}")

async def browse_website(instruction, model="gpt-4o", headless=False, max_steps=50, use_vision=True, generate_gif=False, browser_size="mobile", initial_url=None):
    """
    Convenience function to browse a website using the autonomous browser agent.
    
    Args:
        instruction (str): The instruction for what the agent should do
        model (str): The OpenAI model to use
        headless (bool): Whether to run the browser in headless mode
        max_steps (int): Maximum number of steps for the agent to take
        use_vision (bool): Whether to use vision capabilities
        generate_gif (bool): Whether to generate a GIF of the browsing session
        browser_size (str): Size of the browser window ('mobile', 'tablet', or 'pc')
        initial_url (str): Optional starting URL for the browser to navigate to
        
    Returns:
        str: The result of the browsing session
    """
    logger.info(f"browse_website called with instruction: {instruction}")
    logger.info(f"Parameters: model={model}, headless={headless}, max_steps={max_steps}, use_vision={use_vision}, generate_gif={generate_gif}, browser_size={browser_size}, initial_url={initial_url}")
    
    # Enhance the instruction with a default URL if one isn't specified in the instruction and initial_url is provided
    if initial_url and "http" not in instruction.lower():
        enhanced_instruction = f"Go to {initial_url} and {instruction}"
        logger.info(f"Enhanced instruction with URL: {enhanced_instruction}")
        instruction = enhanced_instruction
    
    # If the instruction is still vague, add a specific task with a default company to research
    if instruction.lower() in ["test instruction for browsing", "test browsing"] or len(instruction.strip()) < 20:
        default_company = "OpenAI"
        default_url = initial_url or "https://openai.com"
        instruction = f"""
        Go to {default_url} and find everything you can about the company called "{default_company}".
        Then, create a detailed report with the following information:
        1. What products or services they offer
        2. When the company was founded
        3. Key team members or leadership
        4. Recent news or announcements
        5. Summary of their mission and values
        
        Visit multiple pages on their website if needed, and provide a well-structured report.
        """
        logger.info(f"Using detailed default instruction with specific research task")
    
    logger.info("Creating AutonomousBrowserAgent instance")
    try:
        agent = AutonomousBrowserAgent(
            instruction=instruction,
            model=model,
            headless=headless,
            max_steps=max_steps,
            use_vision=use_vision,
            generate_gif=generate_gif,
            browser_size=browser_size
        )
        logger.info("AutonomousBrowserAgent instance created successfully")
    except Exception as e:
        logger.error(f"Error creating agent instance: {str(e)}")
        logger.error(f"Stack trace: {traceback.format_exc()}")
        raise
    
    logger.info("Running agent")
    try:
        result = await agent.run()
        logger.info("Agent run completed")
        return result
    except Exception as e:
        logger.error(f"Error during agent.run(): {str(e)}")
        logger.error(f"Stack trace: {traceback.format_exc()}")
        raise

def browse_website_cli():
    """
    Command-line interface for the autonomous browser agent.
    This function is used by the console script entry point.
    """
    parser = argparse.ArgumentParser(description="Autonomous Browser Agent - Browse any website with natural language instructions")
    
    parser.add_argument(
        "instruction", 
        type=str, 
        nargs="?",
        help="Instruction for what the agent should do"
    )
    
    parser.add_argument(
        "--model", 
        type=str, 
        default="gpt-4o", 
        help="OpenAI model to use for the agent (default: gpt-4o)"
    )
    
    parser.add_argument(
        "--headless", 
        action="store_true", 
        help="Run the browser in headless mode"
    )
    
    parser.add_argument(
        "--max-steps", 
        type=int, 
        default=50, 
        help="Maximum number of steps for the agent (default: 50)"
    )
    
    parser.add_argument(
        "--generate-gif", 
        action="store_true", 
        help="Generate a GIF of the browsing session"
    )
    
    parser.add_argument(
        "--browser-size",
        type=str,
        default="mobile",
        choices=["mobile", "tablet", "pc"],
        help="Size of the browser window (default: mobile)"
    )
    
    parser.add_argument(
        "--interactive", 
        action="store_true", 
        help="Run in interactive mode where the instruction is prompted"
    )
    
    args = parser.parse_args()
    
    # Check if we're in interactive mode or if no instruction was provided
    if args.interactive or not args.instruction:
        print("🤖 Autonomous Browser Agent 🌐")
        print("=" * 50)
        print("Enter your instruction for what the agent should do.")
        print("For example: 'Go to Wikipedia, search for 'Python programming', and summarize the first paragraph.'")
        print("=" * 50)
        args.instruction = input("Your instruction: ").strip()
    
    # Set up default headless mode from environment if available
    if not args.headless and os.getenv("DEFAULT_HEADLESS", "").lower() == "true":
        args.headless = True
    
    # Set up max steps from environment if available
    max_steps_env = os.getenv("DEFAULT_MAX_STEPS")
    if max_steps_env:
        try:
            default_max_steps = int(max_steps_env)
            if args.max_steps == 50:  # Only use env default if user didn't specify
                args.max_steps = default_max_steps
        except ValueError:
            pass
    
    # Run the agent
    print(f"\n📋 Task: {args.instruction}")
    print(f"🔄 Running with model: {args.model}, max steps: {args.max_steps}, headless: {args.headless}, browser size: {args.browser_size}")
    
    if not args.instruction:
        print("❌ Error: No instruction provided.")
        return
    
    result = asyncio.run(browse_website(
        instruction=args.instruction,
        model=args.model,
        headless=args.headless,
        max_steps=args.max_steps,
        generate_gif=args.generate_gif,
        browser_size=args.browser_size
    ))
    
    print("\n" + "="*80)
    print("🤖 RESULT:")
    print("="*80)
    print(result)
    print("="*80) 