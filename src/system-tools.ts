import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * SSH executor function type that executes commands on remote server
 */
type SSHExecutor = (command: string) => Promise<string>;

/**
 * Register all system tools with the MCP server
 */
export function registerSystemTools(
  server: McpServer,
  sshExecutor: SSHExecutor
): void {
  // System list files tool
  server.tool(
    "system list files",
    "List contents of a directory on the Unraid server. Use long format for detailed file information.",
    {
      path: z.string().describe("Directory path to list"),
      long: z.boolean().optional().describe("Use long format with details (ls -lah)"),
    },
    async (args) => {
      try {
        const command = args.long ? `ls -lah "${args.path}"` : `ls "${args.path}"`;
        const output = await sshExecutor(command);
        return {
          content: [{ type: "text", text: output }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to list files in ${args.path}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // System read file tool
  server.tool(
    "system read file",
    "Read contents of a file on the Unraid server. Limited to first N lines for safety (default: 1000).",
    {
      path: z.string().describe("File path to read"),
      maxLines: z
        .number()
        .int()
        .positive()
        .optional()
        .default(1000)
        .describe("Maximum number of lines to read (default: 1000)"),
    },
    async (args) => {
      try {
        const maxLines = args.maxLines ?? 1000;
        const command =
          maxLines > 0
            ? `head -n ${maxLines} "${args.path}"`
            : `cat "${args.path}"`;
        const output = await sshExecutor(command);

        // Add warning if file might be truncated
        const lineCount = output.split("\n").length;
        let result = output;
        if (lineCount >= maxLines) {
          result += `\n\n[Note: Output limited to ${maxLines} lines. Use tail_log to read from the end, or increase maxLines.]`;
        }

        return {
          content: [{ type: "text", text: result }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to read file ${args.path}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // System tail log tool
  server.tool(
    "system tail log",
    "Read the last N lines of a log file efficiently. Best for monitoring logs.",
    {
      path: z.string().describe("Log file path to tail"),
      lines: z
        .number()
        .int()
        .positive()
        .optional()
        .default(100)
        .describe("Number of lines to show from end (default: 100)"),
    },
    async (args) => {
      try {
        const lines = args.lines ?? 100;
        const command = `tail -n ${lines} "${args.path}"`;
        const output = await sshExecutor(command);
        return {
          content: [{ type: "text", text: output }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to tail log file ${args.path}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // System find files tool
  server.tool(
    "system find files",
    "Search for files by name pattern in a directory and its subdirectories. Supports wildcards (*.log, etc.).",
    {
      path: z.string().describe("Directory path to search in"),
      pattern: z.string().describe("File name pattern (supports wildcards like *.log)"),
    },
    async (args) => {
      try {
        const command = `find "${args.path}" -name "${args.pattern}" -type f 2>/dev/null`;
        const output = await sshExecutor(command);

        if (!output || output.trim() === "") {
          return {
            content: [
              {
                type: "text",
                text: `No files matching pattern "${args.pattern}" found in ${args.path}`,
              },
            ],
          };
        }

        // Count and limit results for safety
        const files = output.trim().split("\n");
        const maxResults = 1000;

        let result = output;
        if (files.length > maxResults) {
          const truncated = files.slice(0, maxResults).join("\n");
          result = `${truncated}\n\n[Note: Found ${files.length} files, showing first ${maxResults} results]`;
        }

        return {
          content: [{ type: "text", text: result }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to find files matching "${args.pattern}" in ${args.path}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // System disk usage tool
  server.tool(
    "system disk usage",
    "Check disk usage and available space for a given path or filesystem.",
    {
      path: z
        .string()
        .optional()
        .default("/")
        .describe("Path to check disk usage for (default: /)"),
    },
    async (args) => {
      try {
        const path = args.path ?? "/";
        const command = `df -h "${path}"`;
        const output = await sshExecutor(command);
        return {
          content: [{ type: "text", text: output }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to check disk usage for ${args.path ?? "/"}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // System get system info tool
  server.tool(
    "system get system info",
    "Get comprehensive Unraid system information including kernel version, uptime, and memory usage.",
    {},
    async (_args) => {
      try {
        const command = `uname -a && echo "---" && uptime && echo "---" && free -h`;
        const output = await sshExecutor(command);
        return {
          content: [{ type: "text", text: output }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get system info: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
