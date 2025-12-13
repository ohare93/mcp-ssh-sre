# MCP SSH SRE

An MCP server providing read-only server monitoring tools to AI assistants. Runs predefined diagnostic commands over SSH and passes only the results to the LLM - your server credentials and shell are never exposed.

## Quick Start (Docker)

Pre-built images available on [GitHub Container Registry](https://github.com/ohare93/mcp-ssh-sre/pkgs/container/mcp-ssh-sre).

```bash
docker run -d \
  -p 3000:3000 \
  -e SSH_HOST=server.local \
  -e SSH_USERNAME=mcp-readonly \
  -e SSH_KEY_PATH=/keys/id_ed25519 \
  -v ~/.ssh/id_ed25519_mcp:/keys/id_ed25519:ro \
  ghcr.io/ohare93/mcp-ssh-sre:latest
```

Then add to your MCP client:

```json
{
  "mcpServers": {
    "ssh-sre": {
      "url": "http://your-server:3000/mcp"
    }
  }
}
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for Docker Compose, local installation, authentication setup, and security configuration.

## Why Use This?

Managing a Linux server involves SSH-ing in, running commands, correlating logs, and interpreting metrics. This MCP server lets AI assistants do that work using natural language.

**Ask questions like:**

- "Why is my Plex container crashing?"
- "Is my array healthy and are there any drives showing signs of failure?"
- "Which containers are consuming the most resources?"
- "Help me debug network connectivity between my nginx and database containers"

Instead of manually running `docker logs`, `smartctl`, `docker inspect`, and correlating outputs, your AI assistant does it in seconds.

## Supported Platforms

| Platform | Status | Tools |
|----------|--------|-------|
| **Unraid** | Full support | 12 modules (10 core + 2 Unraid-specific) |
| **Generic Linux** | Full support | 10 core modules |
| **TrueNAS** | Untested (PRs welcome) | Core tools should work |
| **Proxmox** | Untested (PRs welcome) | Core tools should work |

The server auto-detects your platform at startup and loads appropriate tools.

## Features

- **12 tool modules with 79+ actions** for comprehensive server management
- **Dual transport** - Stdio (local) or HTTP/SSE (network-accessible)
- **Read-only by design** - Zero risk of accidental modifications
- **Docker management** - Logs, stats, environment, ports, network topology
- **Storage & array** - Parity checks, SMART data, temperatures, mover logs (Unraid)
- **Health diagnostics** - Aggregated status with automatic issue detection
- **System monitoring** - Processes, disk I/O, network connections
- **Log analysis** - Search across containers and system logs
- **VM management** - List, inspect, VNC details, libvirt logs
- **Security auditing** - Port scanning, login monitoring, permission audits

## Why SSH Instead of Platform APIs?

| Feature | APIs | SSH |
|---------|------|-----|
| Docker container logs | ❌ | ✅ |
| SMART disk health data | ❌ | ✅ |
| Real-time CPU/load averages | ❌ | ✅ |
| Network bandwidth monitoring | ❌ | ✅ |
| Process monitoring (ps/top) | ❌ | ✅ |
| Log file analysis | ❌ | ✅ |

SSH provides unrestricted access to system tools without API rate limiting.

## Architecture

```
src/
├── platforms/
│   ├── linux/        # Generic Linux (baseline)
│   └── unraid/       # Unraid-specific tools
├── tools/core/       # 10 core tool modules
├── index.ts          # Stdio transport
└── http-server.ts    # HTTP transport
```

### Adding New Platforms

1. Create `src/platforms/<platform>/index.ts` implementing `Platform`
2. Add detection logic
3. Create platform-specific tool modules
4. Register in `src/platforms/index.ts`

## Development

```bash
npm run dev      # Development with auto-reload
npm test         # Run tests
npm run build    # Build for production
```

## License

ISC

## Support

For issues and questions, open an issue on the [GitHub repository](https://github.com/ohare93/mcp-ssh-sre).
