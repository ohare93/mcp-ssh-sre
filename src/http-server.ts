import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Request, Response } from "express";
import cors from "cors";
import "dotenv/config";
import { SSHConnectionManager } from "./ssh-manager.js";
import { registerDockerTools } from "./docker-tools.js";
import { registerDockerAdvancedTools } from "./docker-advanced-tools.js";
import { registerDockerNetworkTools } from "./docker-network-tools.js";
import { registerSystemTools } from "./system-tools.js";
import { registerUnraidTools } from "./unraid-tools.js";
import { registerUnraidArrayTools } from "./unraid-array-tools.js";
import { registerMonitoringTools } from "./monitoring-tools.js";
import { registerVMTools } from "./vm-tools.js";
import { registerContainerTopologyTools } from "./container-topology-tools.js";
import { registerPluginConfigTools } from "./plugin-config-tools.js";
import { registerPerformanceSecurityTools } from "./performance-security-tools.js";
import { registerLogAnalysisTools } from "./log-analysis-tools.js";
import { registerResourceManagementTools } from "./resource-management-tools.js";
import { registerHealthDiagnosticsTools } from "./health-diagnostics-tools.js";

/**
 * HTTP MCP Server
 * Serves MCP over HTTP using StreamableHTTPServerTransport
 */
async function main() {
  const app = express();
  const port = parseInt(process.env.HTTP_PORT || "3000");

  // Middleware
  app.use(cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  }));
  app.use(express.json());

  // Initialize SSH connection manager
  const sshManager = new SSHConnectionManager();

  try {
    // Establish initial connection
    await sshManager.connect();
  } catch (error) {
    console.error(`Warning: Could not establish initial SSH connection: ${error instanceof Error ? error.message : String(error)}`);
    console.error("Server will attempt to connect when first command is executed");
  }

  // Create MCP server (shared across all requests)
  const server = new McpServer({
    name: "ssh-unraid-server-http",
    version: "1.1.0",
  });

  // Create SSH executor adapter for tool modules
  const sshExecutor = async (command: string): Promise<string> => {
    const result = await sshManager.executeCommand(command);
    if (result.exitCode !== 0 && result.stderr) {
      throw new Error(result.stderr);
    }
    return result.stdout;
  };

  // Register all tools
  registerDockerTools(server, sshExecutor);
  registerDockerAdvancedTools(server, sshExecutor);
  registerDockerNetworkTools(server, sshExecutor);
  registerSystemTools(server, sshExecutor);
  registerUnraidTools(server, sshExecutor);
  registerUnraidArrayTools(server, sshExecutor);
  registerMonitoringTools(server, sshExecutor);
  registerVMTools(server, sshExecutor);
  registerContainerTopologyTools(server, sshExecutor);
  registerPluginConfigTools(server, sshExecutor);
  registerPerformanceSecurityTools(server, sshExecutor);
  registerLogAnalysisTools(server, sshExecutor);
  registerResourceManagementTools(server, sshExecutor);
  registerHealthDiagnosticsTools(server, sshExecutor);

  // Health check endpoint
  app.get("/health", async (req: Request, res: Response) => {
    const isSSHConnected = sshManager.isConnected();
    const status = isSSHConnected ? "healthy" : "degraded";
    const httpCode = isSSHConnected ? 200 : 503;

    res.status(httpCode).json({
      status,
      ssh_connected: isSSHConnected,
      server: "mcp-ssh-unraid",
      version: "1.1.0",
      transport: "http",
    });
  });

  // MCP endpoint
  app.post("/mcp", async (req: Request, res: Response) => {
    try {
      // Create a new transport for each request to prevent ID collisions
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
        enableJsonResponse: true,
      });

      // Connect the server to the transport
      await server.connect(transport);

      // Handle the MCP request
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Internal server error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });

  // Handle graceful shutdown
  const shutdown = async () => {
    console.error("\nShutting down gracefully...");
    await sshManager.disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start the server
  app.listen(port, () => {
    console.error(`SSH Unraid MCP Server (HTTP) listening on port ${port}`);
    console.error(`Health endpoint: http://localhost:${port}/health`);
    console.error(`MCP endpoint: http://localhost:${port}/mcp`);
  });
}

// Start the server
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
