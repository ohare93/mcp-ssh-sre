import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * SSH executor function type that executes commands on remote host
 */
type SSHExecutor = (command: string) => Promise<string>;

/**
 * Register all process and system monitoring tools with the MCP server
 * All tools are READ-ONLY and safe for monitoring operations
 */
export function registerMonitoringTools(
  server: McpServer,
  sshExecutor: SSHExecutor
): void {
  // Tool 1: monitoring ps list - List all running processes
  server.tool(
    "monitoring ps list",
    "List all running processes with details. Can be sorted by CPU or memory usage. Shows PID, user, CPU%, memory%, and command.",
    {
      sortBy: z
        .enum(["cpu", "memory"])
        .optional()
        .describe("Sort processes by 'cpu' or 'memory' usage (optional)"),
    },
    async (args) => {
      try {
        let command = "ps aux";

        // Add sorting based on parameter
        if (args.sortBy === "cpu") {
          command += " --sort=-%cpu";
        } else if (args.sortBy === "memory") {
          command += " --sort=-%mem";
        }

        const output = await sshExecutor(command);

        return {
          content: [
            {
              type: "text",
              text: `Process List${args.sortBy ? ` (sorted by ${args.sortBy})` : ""}:\n\n${output}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing processes: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 2: monitoring process tree - Show process hierarchy
  server.tool(
    "monitoring process tree",
    "Display process hierarchy showing parent-child relationships. Shows the tree structure of all running processes with PIDs.",
    {},
    async (_args) => {
      try {
        // Try pstree first (cleaner output), fall back to ps auxf
        const command = "command -v pstree >/dev/null 2>&1 && pstree -p || ps auxf";

        const output = await sshExecutor(command);

        return {
          content: [
            {
              type: "text",
              text: `Process Tree:\n\n${output}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error showing process tree: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 3: monitoring top snapshot - Snapshot of top processes
  server.tool(
    "monitoring top snapshot",
    "Get a snapshot of top processes with current system load and resource usage. Non-streaming, returns immediately with detailed CPU, memory, and process information.",
    {
      count: z
        .number()
        .int()
        .positive()
        .optional()
        .default(20)
        .describe("Number of top processes to show (default: 20)"),
    },
    async (args) => {
      try {
        const count = args.count ?? 20;
        // top -b for batch mode, -n 1 for single iteration
        // head to limit output (7 lines of header + count processes)
        const command = `top -b -n 1 | head -n ${count + 7}`;

        const output = await sshExecutor(command);

        return {
          content: [
            {
              type: "text",
              text: `Top Processes Snapshot (${count} processes):\n\n${output}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting top snapshot: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 4: monitoring iostat snapshot - Disk I/O statistics
  server.tool(
    "monitoring iostat snapshot",
    "Get disk I/O statistics showing read/write throughput and utilization. Returns a single snapshot of extended disk statistics including tps, read/write rates, and utilization percentages.",
    {},
    async (_args) => {
      try {
        // iostat -x for extended statistics, 1 1 for 1 second interval, 1 count
        // This gives a snapshot without needing to wait for averaging
        const command = "command -v iostat >/dev/null 2>&1 && iostat -x 1 1 || echo 'iostat not available. Install sysstat package.'";

        const output = await sshExecutor(command);

        return {
          content: [
            {
              type: "text",
              text: `Disk I/O Statistics:\n\n${output}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting I/O statistics: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 5: monitoring network connections - Active network connections
  server.tool(
    "monitoring network connections",
    "Show active network connections and listening ports. Displays TCP and UDP connections with process information. Can optionally filter to show only listening ports.",
    {
      listening: z
        .boolean()
        .optional()
        .describe("Show only listening ports (default: false, shows all connections)"),
    },
    async (args) => {
      try {
        // Try ss first (modern replacement for netstat), fall back to netstat
        // -t: TCP, -u: UDP, -n: numeric, -a: all or -l: listening, -p: process
        let ssCommand = "ss -tunap";
        let netstatCommand = "netstat -tunap";

        if (args.listening) {
          ssCommand = "ss -tulnp";
          netstatCommand = "netstat -tulnp";
        }

        const command = `command -v ss >/dev/null 2>&1 && ${ssCommand} || ${netstatCommand}`;

        const output = await sshExecutor(command);

        const filterType = args.listening ? " (listening only)" : "";
        return {
          content: [
            {
              type: "text",
              text: `Network Connections${filterType}:\n\n${output}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting network connections: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
