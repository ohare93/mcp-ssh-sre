# Deployment Guide

## Prerequisites

- Linux server with SSH access enabled
- SSH key pair for passwordless authentication

## Docker (Recommended)

### HTTP Mode

Run as a network-accessible service on your server:

```bash
docker run -d \
  -p 3000:3000 \
  -e SSH_HOST=server.local \
  -e SSH_PORT=22 \
  -e SSH_USERNAME=mcp-readonly \
  -e SSH_KEY_PATH=/keys/id_ed25519 \
  -e OAUTH_SERVER_URL=https://mcp.example.com \
  -v ~/.ssh/id_ed25519_mcp:/keys/id_ed25519:ro \
  ghcr.io/ohare93/mcp-ssh-sre:latest
```

Or with Docker Compose (`docker-compose.http.yml`):

```yaml
services:
  mcp-ssh-sre:
    image: ghcr.io/ohare93/mcp-ssh-sre:latest
    ports:
      - "3000:3000"
    environment:
      - SSH_HOST=server.local
      - SSH_PORT=22
      - SSH_USERNAME=mcp-readonly
      - SSH_KEY_PATH=/keys/id_ed25519
      - OAUTH_SERVER_URL=https://mcp.example.com
    volumes:
      - ~/.ssh/id_ed25519_mcp:/keys/id_ed25519:ro
```

#### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SSH_HOST` | Yes | - | Server hostname or IP |
| `SSH_PORT` | No | 22 | SSH port |
| `SSH_USERNAME` | Yes | - | SSH username |
| `SSH_KEY_PATH` | Yes | - | Path to SSH private key (inside container) |
| `HTTP_PORT` | No | 3000 | HTTP server port |
| `CORS_ORIGIN` | No | * | CORS origin |
| `OAUTH_SERVER_URL` | Prod | - | Public URL for OAuth discovery |
| `REQUIRE_AUTH` | No | true | Require OAuth authentication |

#### MCP Client Configuration

```json
{
  "mcpServers": {
    "ssh-sre": {
      "url": "http://your-server:3000/mcp"
    }
  }
}
```

### Stdio Mode

For local MCP clients (like Claude Desktop running on the same machine):

```bash
docker build -t mcp-ssh-sre .
docker run -d --env-file .env mcp-ssh-sre
```

## Running Locally

### Installation

```bash
git clone https://github.com/ohare93/mcp-ssh-sre.git
cd mcp-ssh-sre
npm install
npm run build
```

### Configuration

Create a `.env` file:

```bash
SSH_HOST=server.local
SSH_PORT=22
SSH_USERNAME=mcp-readonly
SSH_KEY_PATH=~/.ssh/id_rsa_mcp
```

### Running

```bash
# Stdio mode (for local MCP clients)
node dist/index.js

# HTTP mode
node dist/http-server.js

# Development mode with auto-reload
npm run dev
```

### MCP Client Configuration (Stdio)

```json
{
  "mcpServers": {
    "ssh-sre": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-ssh-sre/dist/index.js"]
    }
  }
}
```

## Security Setup

### Create a Read-Only User

```bash
# On server as root
useradd -m -s /bin/bash mcp-readonly
passwd mcp-readonly
usermod -aG docker mcp-readonly
```

### Generate and Deploy SSH Key

```bash
# On your local machine
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_mcp -C "mcp-ssh-sre"
ssh-copy-id -i ~/.ssh/id_ed25519_mcp.pub mcp-readonly@server.local
```

## Authentication

OAuth authentication is **required by default** (v2.0.0+).

| `REQUIRE_AUTH` | Use Case |
|----------------|----------|
| `true` (default) | Production - require OAuth token |
| `false` | Local dev only - allows unauthenticated |
| `development` | Local dev - logs warnings |

### OAuth Flow

1. Register client:
   ```bash
   curl -X POST http://localhost:3000/register \
     -H "Content-Type: application/json" \
     -d '{"client_name": "My Client"}'
   ```

2. Get authorization code (visit in browser):
   ```
   http://localhost:3000/authorize?client_id=YOUR_ID&redirect_uri=YOUR_REDIRECT&state=xyz&response_type=code
   ```

3. Exchange for token:
   ```bash
   curl -X POST http://localhost:3000/token \
     -d grant_type=authorization_code \
     -d code=YOUR_CODE \
     -d client_id=YOUR_ID \
     -d client_secret=YOUR_SECRET
   ```

## Network Security

- **Don't** expose directly to the internet
- **Do** use VPN/Tailscale or reverse proxy with TLS
- Set `OAUTH_SERVER_URL` when behind a reverse proxy

### Security Checklist

- [ ] `REQUIRE_AUTH=true` in production
- [ ] Server behind firewall/VPN or reverse proxy
- [ ] OAuth credentials stored securely
- [ ] Logs monitored for unauthorized attempts
