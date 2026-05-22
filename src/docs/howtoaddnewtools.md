# GLAS MCP — Adding New Tools

This document explains how GLAS MCP automatically discovers and loads tools.

The system uses a plugin-based architecture.

This means:
- No manual imports
- No registry updates
- No route edits
- No app restart logic changes

To add a new tool:
1. Create a folder inside `src/tools`
2. Add an `index.ts`
3. Export a default tool object

GLAS MCP automatically loads it.

---

# Tool Discovery System

At startup:

```text
src/index.ts
      ↓
loadTools()
      ↓
Scans dist/tools/
      ↓
Finds all tool folders
      ↓
Loads each index.js
      ↓
Registers tools dynamically
```

The loader automatically discovers every tool.

---

# Required Tool Structure

Every tool MUST follow this structure:

```text
src/tools/tool_name/
├── index.ts
├── schema.ts
├── service.ts
└── types.ts
```

Minimal tools may only need:

```text
src/tools/tool_name/
└── index.ts
```

---

# Required Export

Every tool MUST export:

```ts
export default tool
```

Example:

```ts
const myTool = {
  name: "my_tool",

  description: "Example tool",

  inputSchema: {},

  async execute(input: unknown) {
    return {
      success: true
    };
  }
};

export default myTool;
```

Without `export default`, GLAS MCP cannot load the tool.

---

# Tool Object Requirements

Every tool should contain:

| Property | Required | Description |
|---|---|---|
| name | Yes | Unique tool identifier |
| description | Yes | Human-readable description |
| inputSchema | Yes | JSON schema for inputs |
| execute | Yes | Main tool logic |

---

# Example Tool

Directory:

```text
src/tools/weather/
```

---

## index.ts

```ts
const weatherTool = {
  name: "weather",

  description: "Get weather information",

  inputSchema: {
    type: "object",

    properties: {
      city: {
        type: "string"
      }
    },

    required: ["city"]
  },

  async execute(input: any) {
    return {
      success: true,
      city: input.city,
      temperature: "24°C"
    };
  }
};

export default weatherTool;
```

---

# How Auto Discovery Works

The loader scans:

```text
dist/tools/
```

Not:

```text
src/tools/
```

Why?

Because TypeScript compiles into:

```text
dist/
```

Render runs compiled JavaScript only.

The loader checks every folder:

```text
dist/tools/*
```

Then searches for:

```text
index.js
```

If found:
- imports tool dynamically
- validates default export
- registers tool automatically

---

# Example Discovery Flow

Suppose you create:

```text
src/tools/github/
└── index.ts
```

After build:

```text
dist/tools/github/
└── index.js
```

Loader detects it automatically:

```text
[GLAS MCP] Loaded tool: github
```

No extra configuration needed.

---

# Accessing Your Tool

If your tool name is:

```ts
name: "weather"
```

It becomes available at:

```text
POST /tools/weather
```

Automatically.

---

# Listing All Tools

Endpoint:

```text
GET /tools
```

Returns all dynamically loaded tools.

Example:

```json
{
  "success": true,
  "tools": [
    {
      "name": "web_search"
    },
    {
      "name": "weather"
    }
  ]
}
```

---

# Recommended Tool Naming

Use:

```text
snake_case
```

Examples:

```text
web_search
browser_control
filesystem_read
github_search
youtube_transcript
```

Avoid:
- spaces
- dashes
- uppercase

---

# Recommended Internal Structure

As tools grow:

```text
src/tools/browser/
├── index.ts
├── schema.ts
├── service.ts
├── actions/
├── utils/
└── types.ts
```

This keeps tools modular.

---

# Best Practices

## Keep Tool Logic Separate

Good:

```text
index.ts → metadata
service.ts → logic
schema.ts → validation
```

Bad:

```text
everything inside index.ts
```

---

## Validate Inputs

Always validate using:
- zod
- custom validators

Never trust raw input.

---

## Return Structured JSON

Good:

```json
{
  "success": true,
  "results": []
}
```

Bad:

```text
"something happened"
```

---

## Make Tools Stateless

Tools should:
- execute
- return result
- not store memory internally

Memory systems should be separate tools.

---

# Future GLAS MCP Features

Planned architecture:

```text
GLAS MCP
├── Tool Runtime
├── Agent Runtime
├── Memory Engine
├── Browser Engine
├── Code Execution
├── Task Graphs
├── Streaming
├── MCP Protocol
└── AI Planning
```

The current plugin system is the foundation for all future expansion.

---

# Current Tool Lifecycle

```text
Create Tool Folder
       ↓
Build Project
       ↓
TypeScript → dist/
       ↓
GLAS Loader Scans dist/tools
       ↓
Dynamic Import
       ↓
Tool Registered
       ↓
Route Available
       ↓
AI Can Execute Tool
```

---

# Summary

To add a tool:

1. Create folder in `src/tools`
2. Add `index.ts`
3. Export default tool object
4. Deploy

GLAS MCP handles:
- discovery
- loading
- registration
- routing

automatically.

