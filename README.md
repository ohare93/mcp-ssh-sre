# MCP SSH Unraid

A Model Context Protocol (MCP) server that provides secure, read-only SSH access to Unraid servers for debugging and monitoring through AI assistants like Claude.

## Why Use This?

Managing an Unraid server often involves SSH-ing in, running multiple commands, correlating logs, and interpreting system metrics. This MCP server enables AI assistants to do that work for you using natural language.

**Ask questions like:**
- "Why is my Plex container crashing?"
- "Is my array healthy and are there any drives showing signs of failure?"
- "Which containers are consuming the most resources and why?"
- "Help me debug network connectivity between my nginx and database containers"

Instead of manually running `docker logs`, `smartctl`, `docker inspect`, parsing outputs, and correlating information across multiple tools, your AI assistant does it all in seconds.

## Features

- **86 specialized tools** for comprehensive Unraid server management through natural language
- **Read-only by design** - Zero risk of accidental system modifications
- **Docker container management** - Inspect, logs, stats, environment variables, port mappings, network topology, and inter-container communication testing
- **Storage & array management** - Parity checks, SMART data analysis, drive temperatures, array sync status, mover logs, cache usage, and share configuration
- **Health diagnostics** - Comprehensive monitoring that aggregates array status, temperatures, disk space, container health, and system resources with automatic issue detection
- **System monitoring** - Process monitoring, resource usage analysis, disk I/O statistics, network connections, and memory pressure detection
- **Log analysis** - Search and analyze logs across all containers and system logs simultaneously with pattern detection
- **VM management** - List, inspect, and monitor virtual machines with VNC connection details and libvirt/QEMU logs
- **Security auditing** - Port scanning, failed login monitoring, permission audits, and vulnerability scanning
- **Filesystem operations** - Browse files, search patterns, check permissions, and monitor disk usage with read-only safety
- **AI-powered insights** - Let Claude correlate data across multiple tools and provide actionable recommendations
- **Faster troubleshooting** - Diagnose complex issues in seconds instead of manually running multiple commands

## Quick Start

### Prerequisites

- Node.js 18 or higher
- Unraid server with SSH access enabled
- SSH key pair for passwordless authentication

### Installation

```bash
git clone <repository-url>
cd mcp-ssh-unraid
npm install
npm run build
```

### Configuration

Create a `.env` file with your Unraid server details:

```bash
cp .env.example .env
# Edit .env with your settings
```

Required environment variables:

```bash
SSH_HOST=unraid.local          # Your Unraid server hostname or IP
SSH_PORT=22                     # SSH port (default: 22)
SSH_USERNAME=mcp-readonly       # Username for SSH connection
SSH_KEY_PATH=~/.ssh/id_rsa_mcp  # Path to SSH private key
```

### MCP Client Setup

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "unraid-ssh": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-ssh-unraid/dist/index.js"]
    }
  }
}
```

## Security Setup

For secure access, create a dedicated read-only user on your Unraid server:

```bash
# On Unraid server as root
useradd -m -s /bin/bash mcp-readonly
passwd mcp-readonly
usermod -aG docker mcp-readonly

# Make persistent across reboots
echo "useradd -m -s /bin/bash mcp-readonly 2>/dev/null" >> /boot/config/go
echo "usermod -aG docker mcp-readonly 2>/dev/null" >> /boot/config/go
```

Generate and deploy SSH key:

```bash
# On your local machine
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_mcp -C "mcp-ssh-unraid"
ssh-copy-id -i ~/.ssh/id_ed25519_mcp.pub mcp-readonly@unraid.local
```

## Example Usage

Once configured, you can use natural language prompts with your MCP client:

- "List all Docker containers on my Unraid server"
- "Show me the logs for the Plex container"
- "What's the current system load and memory usage?"
- "Run a comprehensive health check"
- "Check the array status and drive temperatures"
- "Which containers are using the most resources?"

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Docker Deployment

```bash
# Build and run with Docker
docker build -t mcp-ssh-unraid .
docker run -d --env-file .env mcp-ssh-unraid

# Or use Docker Compose
docker-compose up -d
```

## Contributing

Contributions are welcome! Please ensure:

- All changes maintain read-only security posture
- Tests pass (`npm test`)
- Code follows existing style
- Security considerations are documented

## License

ISC

## Support

For issues and questions, please open an issue on the repository.
