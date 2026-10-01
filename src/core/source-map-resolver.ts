import type { ResolvedPosition } from "./types";

/**
 * Décodeur sourcemap minimal (VLQ) — supporte les maps standard et les
 * "index maps" (sections) produits par Turbopack. Résout un (line, col) d'un
 * chunk compilé vers le fichier source d'origine.
 */

type Mapping =
  | { generatedColumn: number }
  | {
      generatedColumn: number;
      sourceIndex: number;
      sourceLine: number;
      sourceColumn: number;
    };

type PlainMap = {
  mappings: string;
  sources: (string | null)[];
};

type ParsedMap = {
  mappings: (Mapping[] | null)[];
  sources: (string | null)[];
};

const CHUNK_CACHE_KEY = "__rfComponentTraceChunkCache__";
type ChunkCache = Map<string, Promise<ParsedLikeMap | null>>;
type ParsedLikeMap =
  | ({ kind: "plain" } & {
      mappings: (Mapping[] | null)[];
      sources: (string | null)[];
    })
  | {
      kind: "index";
      spanSources: (string | null)[][];
      spanMappings: (Mapping[] | null)[][];
      offsets: { line: number; column: number }[];
    };

const BASE64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const CHAR_TO_INT: Record<string, number> = {};
for (let i = 0; i < BASE64.length; i++) CHAR_TO_INT[BASE64[i]!] = i;

function decodeVLQ(str: string, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let index = offset;
  let value: number;

  do {
    value = CHAR_TO_INT[str[index]!] ?? -1;
    index++;
    result += (value & 31) << shift;
    shift += 5;
  } while (value >= 32);

  const negated = result & 1;
  result >>>= 1;
  return [negated ? -result : result, index];
}

function isMappingContinued(char: string): boolean {
  return char !== "," && char !== ";" && char !== "";
}

function parsePlainMap(raw: PlainMap): ParsedMap {
  const mappings: (Mapping[] | null)[] = [];
  let sourceIndex = 0;
  let sourceLine = 0;
  let sourceColumn = 0;

  const lines = raw.mappings.split(";");
  for (const line of lines) {
    if (!line) {
      mappings.push(null);
      continue;
    }
    const columns: Mapping[] = [];
    let generatedColumn = 0;
    let offset = 0;

    while (offset < line.length) {
      const [deltaCol, next] = decodeVLQ(line, offset);
      generatedColumn += deltaCol;
      offset = next;

      let mapping: Mapping = { generatedColumn };
      if (offset < line.length && isMappingContinued(line[offset]!)) {
        const [dSrcIdx, o2] = decodeVLQ(line, offset);
        const [dSrcLine, o3] = decodeVLQ(line, o2);
        const [dSrcCol, o4] = decodeVLQ(line, o3);
        sourceIndex += dSrcIdx;
        sourceLine += dSrcLine;
        sourceColumn += dSrcCol;
        mapping = {
          generatedColumn,
          sourceIndex,
          sourceLine,
          sourceColumn,
        };
        offset = o4;
      } else {
        mapping = { generatedColumn };
      }
      columns.push(mapping);

      while (offset < line.length && line[offset] === ",") offset++;
    }

    mappings.push(columns);
  }

  return { mappings, sources: raw.sources ?? [] };
}

function parseChunkMap(json: unknown): ParsedLikeMap {
  const raw = json as {
    mappings?: string;
    sources?: (string | null)[];
    sections?: { offset: { line: number; column: number }; map: PlainMap }[];
  };

  if (raw.sections) {
    const sections = raw.sections.map((section) => ({
      offset: section.offset,
      parsed: parsePlainMap(section.map),
    }));
    return {
      kind: "index",
      spanSources: sections.map((s) => s.parsed.sources),
      spanMappings: sections.map((s) => s.parsed.mappings),
      offsets: sections.map((s) => s.offset),
    };
  }

  const plain = parsePlainMap(raw as PlainMap);
  return { kind: "plain", ...plain };
}

async function getChunkMap(chunkUrl: string): Promise<ParsedLikeMap | null> {
  const cache = chunkCache();
  const cached = cache.get(chunkUrl);
  if (cached) return cached;

  const promise = (async () => {
    try {
      // Prober d'abord le host du script lui-même (200 OK, jamais de log
      // réseau 404 en console). Un chunk sans `//# sourceMappingURL=` pointant
      // vers un .map n'a pas de sourcemap — inutile de fetch et de produire
      // un 404 attribué à ce module.
      const scriptRes = await fetch(chunkUrl);
      if (!scriptRes.ok) return null;
      const source = await scriptRes.text();
      const mapMatch = source.match(/\/\/#\s*sourceMappingURL=(\S+?\.map)\b/);
      if (!mapMatch) return null;

      // Le chunk annonce un .map : résoudre relatif au dossier du chunk,
      // sauf si le sourceMappingURL est absolu.
      const mapUrl = mapMatch[1]!;
      const fullMapUrl = /^[a-z]+:\/\//i.test(mapUrl)
        ? mapUrl
        : `${chunkUrl.replace(/\/[^/]*$/, "/")}${mapUrl}`;
      const res = await fetch(fullMapUrl);
      if (!res.ok) return null;
      return parseChunkMap(await res.json());
    } catch {
      return null;
    }
  })();

  cache.set(chunkUrl, promise);
  return promise;
}

function chunkCache(): ChunkCache {
  const g = globalThis as { [key: string]: unknown };
  const key = CHUNK_CACHE_KEY;
  if (!g[key]) g[key] = new Map();
  return g[key] as ChunkCache;
}

export function normalizeSourcePath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const match = normalized.match(
    /(?:^|[\\/])((?:src|app)\/[^?#]*?\.(?:tsx?|jsx?|css))/,
  );
  return match ? match[1]! : normalized;
}

export async function resolvePosition(
  chunkUrl: string,
  line: number,
  column: number,
): Promise<ResolvedPosition | null> {
  const sm = await getChunkMap(chunkUrl);
  if (!sm) return null;

  if (sm.kind === "plain") {
    return resolveInPlain(sm.mappings, sm.sources, line, column);
  }

  // Index map : trouver la section contenant la ligne générée.
  for (let i = sm.offsets.length - 1; i >= 0; i--) {
    const offset = sm.offsets[i]!;
    if (line - 1 <= offset.line) {
      continue;
    }
    if (line - 1 > offset.line) {
      return resolveInPlain(
        sm.spanMappings[i] ?? [],
        sm.spanSources[i] ?? [],
        line - offset.line,
        column,
      );
    }
  }
  return null;
}

function resolveInPlain(
  mappings: (Mapping[] | null)[],
  sources: (string | null)[],
  line: number,
  column: number,
): ResolvedPosition | null {
  const rows = mappings[line - 1];
  if (!rows) return null;

  let selected: Mapping = rows[0] ?? { generatedColumn: 0 };
  for (const m of rows) {
    if (m.generatedColumn <= column) selected = m;
    else break;
  }
  if (!("sourceIndex" in selected)) return null;

  const source = sources[selected.sourceIndex];
  if (source == null) return null;

  const relative = normalizeSourcePath(source);
  return {
    source: relative,
    line: selected.sourceLine + 1,
    column: selected.sourceColumn,
  };
}
