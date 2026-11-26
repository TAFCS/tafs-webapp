/**
 * TAFSD-615. Runs INSIDE a tafs-backend checkout (sync-tools.sh copies it
 * there): imports the live MCP tool registry and the tiles manifest, and
 * prints, for every tool, its schema and the permission metadata of the route
 * it mirrors, with tile and action labels resolved. The MCP Docs page and PDF
 * are built from this output, so they cannot drift from the server silently.
 */
import 'reflect-metadata';
import { MCP_TOOLS } from './src/modules/mcp/mcp-tools';
import { TILES_MANIFEST } from './src/modules/access/tiles.manifest';
import { MCP_RESULT_MAX_CHARS } from './src/modules/mcp/mcp-result';
import { MCP_TILE_ID } from './src/modules/mcp/mcp.constants';

type Meta = { mode?: string; actionKeys?: string[]; tileIds?: string[] };

const tiles = new Map(TILES_MANIFEST.map((t) => [t.id, t]));
const tileLabel = (id: string) => tiles.get(id)?.label ?? id;
const actionLabel = (key: string) => {
  const [tileId, actionId] = key.split('#');
  const tile = tiles.get(tileId);
  const action = tile?.actions?.find((a) => a.id === actionId);
  return { key, tile: tileId, tileLabel: tileLabel(tileId), action: actionId, actionLabel: action?.label ?? actionId };
};

const tools = MCP_TOOLS.map((t) => {
  let access: Record<string, unknown> | null = null;
  if (t.route) {
    const handler = (t.route.controller.prototype as Record<string, object>)[t.route.method];
    const meta = (Reflect.getMetadata('require_action', handler) ?? {}) as Meta;
    const policies = (Reflect.getMetadata('check_policies', handler) ?? []) as Array<(...a: unknown[]) => unknown>;
    access = {
      route: `${t.route.controller.name}.${t.route.method}`,
      mode: meta.mode ?? null,
      actions: (meta.actionKeys ?? []).map(actionLabel),
      tiles: (meta.tileIds ?? []).map((id) => ({ id, label: tileLabel(id) })),
      policies: policies.map((p) => String(p).replace(/\s+/g, ' ')),
    };
  }
  return { name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema, access };
});

console.log(
  JSON.stringify(
    {
      server: { resultMaxChars: MCP_RESULT_MAX_CHARS, tile: { id: MCP_TILE_ID, label: tileLabel(MCP_TILE_ID) } },
      tools,
    },
    null,
    2,
  ),
);
