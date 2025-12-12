import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { applyFilters, applyFiltersToText, outputFiltersSchema } from "./filters.js";

/**
 * SSH executor function type that executes commands on remote host
 */
type SSHExecutor = (command: string) => Promise<string>;

/**
 * Register all Docker debugging tools with the MCP server
 */
export function registerDockerTools(
  server: McpServer,
  sshExecutor: SSHExecutor
): void {
  // Tool 1: docker list containers - List all containers with status
  server.tool(
    "docker list containers",
    "List Docker containers with ID, name, image, status, state, and ports.",
    {
      all: z.boolean().optional().default(true).describe("Include stopped"),
      ...outputFiltersSchema.shape,
    },
    async (args) => {
      try {
        const all = args.all ?? true;
        const command = all
          ? "docker ps -a --format json"
          : "docker ps --format json";

        const output = await sshExecutor(command);

        // Parse JSON lines and format output
        const lines = output
          .trim()
          .split("\n")
          .filter((line) => line.trim());
        if (lines.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No containers found.",
              },
            ],
          };
        }

        const containers = lines.map((line) => JSON.parse(line));
        let formatted = containers
          .map(
            (c) =>
              `ID: ${c.ID}\nName: ${c.Names}\nImage: ${c.Image}\nStatus: ${c.Status}\nState: ${c.State}\nPorts: ${c.Ports || "none"}\n`
          )
          .join("\n---\n\n");

        // Apply filters to formatted output
        formatted = applyFiltersToText(formatted, args);

        return {
          content: [
            {
              type: "text",
              text: `Docker Containers:\n\n${formatted}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing containers: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 2: docker inspect - Get detailed container info
  server.tool(
    "docker inspect",
    "Get detailed container info in JSON (config, state, network, mounts).",
    {
      container: z.string().describe("Container name or ID"),
      ...outputFiltersSchema.shape,
    },
    async (args) => {
      try {
        let command = `docker inspect ${args.container}`;

        const output = await sshExecutor(command);

        // Pretty print the JSON output
        const inspectData = JSON.parse(output);
        let formatted = JSON.stringify(inspectData, null, 2);

        // Apply filters to formatted output
        formatted = applyFiltersToText(formatted, args);

        return {
          content: [
            {
              type: "text",
              text: `Docker Inspect - ${args.container}:\n\n${formatted}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error inspecting container: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 3: docker logs - Retrieve container logs
  server.tool(
    "docker logs",
    "Retrieve container logs with optional line/time filters.",
    {
      container: z.string().describe("Container name or ID"),
      dockerTail: z.number().optional().describe("Lines from end (--tail)"),
      dockerSince: z.string().optional().describe("Since timestamp or relative (e.g. 42m)"),
      ...outputFiltersSchema.shape,
    },
    async (args) => {
      try {
        let command = `docker logs ${args.container}`;

        if (args.dockerTail !== undefined) {
          command += ` --tail ${args.dockerTail}`;
        }
        if (args.dockerSince !== undefined) {
          command += ` --since ${args.dockerSince}`;
        }

        // Apply comprehensive filters
        command = applyFilters(command, args);

        const output = await sshExecutor(command);

        return {
          content: [
            {
              type: "text",
              text: `Docker Logs - ${args.container}:\n\n${output}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving logs: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 4: docker stats snapshot - Get current resource usage
  server.tool(
    "docker stats snapshot",
    "Get current CPU/memory/network/block I/O for containers (non-streaming).",
    {
      container: z.string().optional().describe("Container (all if not specified)"),
      ...outputFiltersSchema.shape,
    },
    async (args) => {
      try {
        let command = "docker stats --no-stream";

        if (args.container) {
          command += ` ${args.container}`;
        }

        // Apply comprehensive filters
        command = applyFilters(command, args);

        const output = await sshExecutor(command);

        return {
          content: [
            {
              type: "text",
              text: `Docker Stats Snapshot:\n\n${output}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting stats: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 5: docker port - Show port mappings
  server.tool(
    "docker port",
    "Show container-to-host port mappings.",
    {
      container: z.string().describe("Container name or ID"),
      ...outputFiltersSchema.shape,
    },
    async (args) => {
      try {
        let command = `docker port ${args.container}`;

        // Apply comprehensive filters
        command = applyFilters(command, args);

        const output = await sshExecutor(command);

        const result = output.trim() || "No port mappings found.";

        return {
          content: [
            {
              type: "text",
              text: `Docker Port Mappings - ${args.container}:\n\n${result}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting port mappings: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
