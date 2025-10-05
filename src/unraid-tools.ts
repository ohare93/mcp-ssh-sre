import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * SSH executor function type that executes commands on remote host
 */
type SSHExecutor = (command: string) => Promise<string>;

/**
 * Register all Unraid-specific debugging tools with the MCP server
 */
export function registerUnraidTools(
  server: McpServer,
  sshExecutor: SSHExecutor
): void {
  // Tool 1: unraid array status - Check Unraid array status
  server.tool(
    "unraid array status",
    "Check Unraid array status including array state, disk status, and parity information. Shows which disks are active, their state, and sync progress if applicable.",
    {},
    async () => {
      try {
        // Try /proc/mdcmd first (more detailed), fall back to mdcmd status
        let output: string;
        try {
          output = await sshExecutor("cat /proc/mdcmd");
        } catch {
          // Fallback to mdcmd status command
          output = await sshExecutor("mdcmd status");
        }

        return {
          content: [
            {
              type: "text",
              text: `Unraid Array Status:\n\n${output}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting array status: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 2: unraid drive smart status - Get SMART data for a drive
  server.tool(
    "unraid drive smart status",
    "Get SMART data for a specific drive. Shows health status, temperature, error count, power-on hours, and other diagnostic information. Automatically detects drive type (SATA/NVMe).",
    {
      device: z.string().describe("Device name (e.g., 'sda', 'nvme0n1')"),
    },
    async (args) => {
      try {
        // Determine device type based on name
        const isNvme = args.device.startsWith("nvme");
        const devicePath = `/dev/${args.device}`;

        // Build smartctl command with appropriate flags
        let command = `smartctl -a ${devicePath}`;
        if (isNvme) {
          command = `smartctl -a -d nvme ${devicePath}`;
        } else {
          // Try with -d ata for SATA drives, but don't fail if not needed
          command = `smartctl -a -d ata ${devicePath} || smartctl -a ${devicePath}`;
        }

        const output = await sshExecutor(command);

        return {
          content: [
            {
              type: "text",
              text: `SMART Status - ${args.device}:\n\n${output}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting SMART status: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 3: unraid check temperatures - System and drive temperatures
  server.tool(
    "unraid check temperatures",
    "Get system and drive temperatures. Collects CPU/system temperatures using sensors and drive temperatures from SMART data. Provides comprehensive thermal monitoring.",
    {},
    async () => {
      try {
        let output = "";

        // Get CPU/system temperatures
        try {
          const sensorsOutput = await sshExecutor("sensors 2>/dev/null || echo 'sensors command not available'");
          output += "=== System Temperatures ===\n\n";
          output += sensorsOutput + "\n\n";
        } catch (error) {
          output += "=== System Temperatures ===\n\nCould not retrieve system temperatures\n\n";
        }

        // Get drive temperatures from SMART
        try {
          // List all sd* and nvme* devices
          const devices = await sshExecutor("ls -1 /dev/sd? /dev/nvme?n? 2>/dev/null || true");
          const deviceList = devices.trim().split("\n").filter(d => d.trim());

          if (deviceList.length > 0) {
            output += "=== Drive Temperatures ===\n\n";

            for (const devicePath of deviceList) {
              const deviceName = devicePath.replace("/dev/", "");
              try {
                const isNvme = deviceName.startsWith("nvme");
                const smartCmd = isNvme
                  ? `smartctl -A -d nvme ${devicePath} | grep -i temperature || smartctl -A ${devicePath} | grep -i temperature`
                  : `smartctl -A -d ata ${devicePath} | grep -i temperature || smartctl -A ${devicePath} | grep -i temperature`;

                const temp = await sshExecutor(smartCmd);
                output += `${deviceName}:\n${temp}\n\n`;
              } catch {
                // Skip devices that fail (may not support SMART)
                output += `${deviceName}: Unable to read temperature\n\n`;
              }
            }
          }
        } catch (error) {
          output += "Could not retrieve drive temperatures\n";
        }

        return {
          content: [
            {
              type: "text",
              text: output,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error checking temperatures: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 4: unraid shares list - List Unraid user shares
  server.tool(
    "unraid shares list",
    "List all Unraid user shares. Shows share names and basic information from /mnt/user/ directory.",
    {},
    async () => {
      try {
        const output = await sshExecutor("ls -la /mnt/user/");

        return {
          content: [
            {
              type: "text",
              text: `Unraid User Shares:\n\n${output}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing shares: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 5: unraid share usage - Check share disk usage
  server.tool(
    "unraid share usage",
    "Check disk usage for Unraid user shares. Can show usage for a specific share or all shares. Displays human-readable sizes.",
    {
      share: z.string().optional().describe("Specific share name (optional, shows all shares if not specified)"),
    },
    async (args) => {
      try {
        let command: string;
        let title: string;

        if (args.share) {
          // Check if share exists first
          await sshExecutor(`test -d /mnt/user/${args.share}`);
          command = `du -sh /mnt/user/${args.share}`;
          title = `Share Usage - ${args.share}`;
        } else {
          // Get all shares
          command = "du -sh /mnt/user/*";
          title = "All Shares Usage";
        }

        const output = await sshExecutor(command);

        return {
          content: [
            {
              type: "text",
              text: `${title}:\n\n${output}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting share usage: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
