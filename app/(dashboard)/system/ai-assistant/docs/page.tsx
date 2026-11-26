import McpDocs from "@/features/mcp-docs/McpDocs";

/**
 * TAFSD-615: the same MCP Docs, reached from the AI Assistant page. It sits
 * under /system/ai-assistant, so the AI Assistant (MCP) tile owns it: whoever
 * may connect an assistant can read how to, without a second grant.
 */
export default function AiAssistantDocsPage() {
    return <McpDocs />;
}
