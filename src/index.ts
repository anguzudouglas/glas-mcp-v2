import "dotenv/config";
import Fastify from "fastify";
import toolRoutes from "./routes/tools.js";
import { loadTools } from "./tools/loadTools.js";

const app = Fastify({ logger: true });

async function start() {
  const tools = await loadTools();

  app.get("/", async () => ({
    success: true,
    service: "glas-mcp",
    version: "2.0.0",
    tools: tools.map((t) => t.name),
    endpoints: {
      listTools: "GET /tools",
      executeTool: "POST /tools/:toolName",
      health: "GET /health",
    },
  }));

  app.get("/health", async () => ({
    status: "ok",
    uptime: process.uptime(),
    loadedTools: tools.length,
    timestamp: new Date().toISOString(),
  }));

  app.register(toolRoutes, { tools });

  const PORT = Number(process.env.PORT || 3000);

  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`[GLAS MCP] Running on port ${PORT}`);
    console.log(`[GLAS MCP] ${tools.length} tools loaded: ${tools.map((t) => t.name).join(", ")}`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

start();
