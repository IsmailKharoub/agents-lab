#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting setup...${NC}"

# Check for Homebrew and install if not present
if ! command -v brew &> /dev/null; then
    echo -e "${BLUE}Installing Homebrew...${NC}"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"
else
    echo -e "${GREEN}Homebrew is already installed${NC}"
fi

# Check for Python 3 and install if not present
if ! command -v python3 &> /dev/null; then
    echo -e "${BLUE}Installing Python 3...${NC}"
    brew install python@3.11
else
    echo -e "${GREEN}Python 3 is already installed${NC}"
fi

# Check for Node.js LTS and install if not present
if ! command -v node &> /dev/null; then
    echo -e "${BLUE}Installing Node.js LTS...${NC}"
    brew install node@22
    echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zprofile
    source ~/.zprofile
else
    echo -e "${GREEN}Node.js is already installed${NC}"
fi

# Check for MongoDB Community Edition and install if not present
if ! brew services list | grep -q mongodb-community; then
    echo -e "${BLUE}Installing MongoDB Community Edition...${NC}"
    brew tap mongodb/brew
    brew install mongodb-community
    brew services start mongodb-community
else
    echo -e "${GREEN}MongoDB Community Edition is already installed${NC}"
fi

# Create Python virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo -e "${BLUE}Creating Python virtual environment...${NC}"
    python3 -m venv venv
else
    echo -e "${GREEN}Python virtual environment already exists${NC}"
fi

# Activate virtual environment and install requirements
echo -e "${BLUE}Activating virtual environment and installing Python requirements...${NC}"
source venv/bin/activate
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
else
    echo -e "${RED}requirements.txt not found${NC}"
fi

# Install Node.js dependencies
echo -e "${BLUE}Installing Node.js dependencies...${NC}"
if [ -f "package.json" ]; then
    npm install
else
    echo -e "${RED}package.json not found${NC}"
fi

echo -e "${GREEN}Setup complete!${NC}"
echo -e "${BLUE}To activate the Python virtual environment in the future, run:${NC}"
echo -e "${GREEN}source venv/bin/activate${NC}"

# Make the virtual environment activation automatic for this directory
if [ ! -f ".envrc" ]; then
    echo -e "${BLUE}Creating .envrc for automatic virtual environment activation...${NC}"
    echo "source venv/bin/activate" > .envrc
    if command -v direnv &> /dev/null; then
        direnv allow
    else
        echo -e "${BLUE}Installing direnv for automatic environment switching...${NC}"
        brew install direnv
        echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
        direnv allow
    fi
fi 