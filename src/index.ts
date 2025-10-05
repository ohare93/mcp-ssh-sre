import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { NodeSSH } from "node-ssh";
import "dotenv/config";
import { z } from "zod";
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
 * SSH Connection Manager
 * Handles SSH connections to Unraid server with auto-reconnect functionality
 */
export class SSHConnectionManager {
  private ssh: NodeSSH;
  private config: {
    host: string;
    port: number;
    username: string;
    privateKeyPath?: string;
    password?: string;
  };
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private baseBackoffMs: number = 1000;

  constructor() {
    this.ssh = new NodeSSH();

    // Load SSH configuration from environment variables
    const host = process.env.SSH_HOST;
    const port = process.env.SSH_PORT ? parseInt(process.env.SSH_PORT) : 22;
    const username = process.env.SSH_USERNAME;
    const privateKeyPath = process.env.SSH_PRIVATE_KEY_PATH;
    const password = process.env.SSH_PASSWORD;

    if (!host) {
      throw new Error("SSH_HOST environment variable is required");
    }
    if (!username) {
      throw new Error("SSH_USERNAME environment variable is required");
    }
    if (!privateKeyPath && !password) {
      throw new Error("Either SSH_PRIVATE_KEY_PATH or SSH_PASSWORD environment variable is required");
    }

    this.config = {
      host,
      port,
      username,
      privateKeyPath,
      password,
    };
  }

  /**
   * Establish SSH connection
   */
  async connect(): Promise<void> {
    try {
      const connectionConfig: any = {
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
      };

      if (this.config.privateKeyPath) {
        connectionConfig.privateKeyPath = this.config.privateKeyPath;
      } else if (this.config.password) {
        connectionConfig.password = this.config.password;
      }

      await this.ssh.connect(connectionConfig);
      this.connected = true;
      this.reconnectAttempts = 0;
      console.error(`Successfully connected to ${this.config.host}`);
    } catch (error) {
      this.connected = false;
      throw new Error(`Failed to connect to SSH server: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Reconnect with exponential backoff
   */
  private async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      throw new Error(`Failed to reconnect after ${this.maxReconnectAttempts} attempts`);
    }

    this.reconnectAttempts++;
    const backoffMs = this.baseBackoffMs * Math.pow(2, this.reconnectAttempts - 1);

    console.error(`Attempting to reconnect (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${backoffMs}ms...`);

    await new Promise(resolve => setTimeout(resolve, backoffMs));
    await this.connect();
  }

  /**
   * Execute command via SSH
   */
  async executeCommand(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const result = await this.ssh.execCommand(command);

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.code ?? 0,
      };
    } catch (error) {
      // Attempt to reconnect on connection errors
      if (error instanceof Error && error.message.includes("connection")) {
        this.connected = false;
        await this.reconnect();
        // Retry the command after reconnection
        const result = await this.ssh.execCommand(command);
        return {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.code ?? 0,
        };
      }

      throw new Error(`Failed to execute command: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Disconnect from SSH
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      this.ssh.dispose();
      this.connected = false;
      console.error("Disconnected from SSH server");
    }
  }
}

/**
 * Main server function
 */
async function main() {
  // Initialize SSH connection manager
  const sshManager = new SSHConnectionManager();

  try {
    // Establish initial connection
    await sshManager.connect();
  } catch (error) {
    console.error(`Warning: Could not establish initial SSH connection: ${error instanceof Error ? error.message : String(error)}`);
    console.error("Server will attempt to connect when first command is executed");
  }

  // Create MCP server
  const server = new McpServer({
    name: "ssh-unraid-server",
    version: "1.0.0",
  });

  // Create SSH executor adapter for tool modules
  // Converts SSHConnectionManager's full response to simple stdout string
  const sshExecutor = async (command: string): Promise<string> => {
    const result = await sshManager.executeCommand(command);
    if (result.exitCode !== 0 && result.stderr) {
      throw new Error(result.stderr);
    }
    return result.stdout;
  };

  // Register all Docker tools
  registerDockerTools(server, sshExecutor);

  // Register all advanced Docker tools
  registerDockerAdvancedTools(server, sshExecutor);

  // Register Docker network and volume tools
  registerDockerNetworkTools(server, sshExecutor);

  // Register all system tools
  registerSystemTools(server, sshExecutor);

  // Register all Unraid tools
  registerUnraidTools(server, sshExecutor);

  // Register all Unraid array, parity, and mover tools
  registerUnraidArrayTools(server, sshExecutor);

  // Register all monitoring tools
  registerMonitoringTools(server, sshExecutor);

  // Register all VM tools
  registerVMTools(server, sshExecutor);

  // Register all container topology tools
  registerContainerTopologyTools(server, sshExecutor);

  // Register all plugin and configuration management tools
  registerPluginConfigTools(server, sshExecutor);

  // Register all performance profiling and security audit tools
  registerPerformanceSecurityTools(server, sshExecutor);

  // Register all log analysis tools
  registerLogAnalysisTools(server, sshExecutor);

  // Register all resource management and optimization tools
  registerResourceManagementTools(server, sshExecutor);

  // Register all health diagnostics tools
  registerHealthDiagnosticsTools(server, sshExecutor);

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.error("\nReceived SIGINT, shutting down gracefully...");
    await sshManager.disconnect();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.error("\nReceived SIGTERM, shutting down gracefully...");
    await sshManager.disconnect();
    process.exit(0);
  });

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("SSH Unraid MCP Server running on stdio");
}

// Start the server only if not in test environment
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
