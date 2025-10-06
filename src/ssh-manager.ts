import { NodeSSH } from "node-ssh";
import "dotenv/config";

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
