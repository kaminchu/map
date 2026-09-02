import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import {
  copyFile,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import type { Feature, Geometry, Position } from "geojson";
import * as flatbuffers from "flatbuffers";
import { magicbytes } from "flatgeobuf/lib/mjs/constants.js";
import { Column } from "flatgeobuf/lib/mjs/flat-geobuf/column.js";
import { Header } from "flatgeobuf/lib/mjs/flat-geobuf/header.js";
import { GeometryType } from "flatgeobuf/lib/mjs/flat-geobuf/geometry-type.js";
import { buildFeature } from "flatgeobuf/lib/mjs/generic/feature.js";
import { mapColumn } from "flatgeobuf/lib/mjs/generic/featurecollection.js";
import { toGeometryType } from "flatgeobuf/lib/mjs/generic/geometry.js";
import { parseGC, parseGeometry } from "flatgeobuf/lib/mjs/geojson/geometry.js";
import type { HeaderMeta } from "flatgeobuf/lib/mjs/header-meta.js";
import { DEFAULT_NODE_SIZE, generateLevelBounds } from "flatgeobuf/lib/mjs/packedrtree.js";
import parserStream from "stream-json";
import pick from "stream-json/filters/pick.js";
import streamArray from "stream-json/streamers/stream-array.js";
import type { Plugin, ResolvedConfig } from "vite";

type CacheEntry = {
  mtimeMs: number;
  size: number;
  dictionaryMtimeMs?: number;
  dictionarySize?: number;
  converterVersion: number;
};

type CacheManifest = Record<string, CacheEntry>;

const CONVERTER_VERSION = 3;
const DICTIONARY_FILENAME = "geojson.zdict";

export function flatGeobufPlugin(): Plugin {
  let config: ResolvedConfig;

  return {
    name: "flatgeobuf",
    apply: "build",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    async writeBundle(options) {
      const outDir = options.dir ?? resolve(config.root, config.build.outDir);

      await buildFlatGeobufFiles(
        resolve(config.root, "data"),
        outDir,
        resolve(config.root, ".vite/flatgeobuf"),
        (message) => config.logger.info(message),
      );
    },
  };
}

export async function buildFlatGeobufFiles(
  dataDir: string,
  outDir: string,
  cacheDir: string,
  log: (message: string) => void = () => {},
): Promise<void> {
  const sourceFiles = await findGeoJsonFiles(dataDir);
  const dictionaryPath = resolve(dataDir, DICTIONARY_FILENAME);
  const manifestPath = resolve(cacheDir, "manifest.json");
  const manifest = await readManifest(manifestPath);

  for (const sourcePath of sourceFiles) {
    const relativePath = relative(dataDir, sourcePath);
    const outputPath = relativePath.replace(/\.geojson(?:\.zst)?$/i, ".fgb");
    const cachePath = resolve(cacheDir, "files", outputPath);
    const sourceStat = await stat(sourcePath);
    const dictionaryStat = /\.zst$/i.test(sourcePath) ? await stat(dictionaryPath) : undefined;
    const cached = manifest[relativePath];
    const isCurrent =
      cached !== undefined &&
      cached.mtimeMs === sourceStat.mtimeMs &&
      cached.size === sourceStat.size &&
      cached.dictionaryMtimeMs === dictionaryStat?.mtimeMs &&
      cached.dictionarySize === dictionaryStat?.size &&
      cached.converterVersion === CONVERTER_VERSION &&
      (await fileExists(cachePath));

    if (isCurrent) {
      log(`FlatGeobuf: ${relativePath} は生成済みのため変換をスキップします`);
    } else {
      log(`FlatGeobuf: ${relativePath} を変換しています`);
      await mkdir(dirname(cachePath), { recursive: true });
      await convertGeoJson(sourcePath, cachePath, dictionaryPath);
      manifest[relativePath] = {
        mtimeMs: sourceStat.mtimeMs,
        size: sourceStat.size,
        dictionaryMtimeMs: dictionaryStat?.mtimeMs,
        dictionarySize: dictionaryStat?.size,
        converterVersion: CONVERTER_VERSION,
      };
    }

    const destinationPath = resolve(outDir, outputPath);
    await mkdir(dirname(destinationPath), { recursive: true });
    await copyFile(cachePath, destinationPath);
  }

  await mkdir(cacheDir, { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest));
}

async function findGeoJsonFiles(directory: string): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return [];
    throw error;
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return findGeoJsonFiles(path);
      return entry.isFile() && /\.geojson(?:\.zst)?$/i.test(entry.name) ? [path] : [];
    }),
  );

  return files.flat().sort();
}

async function readManifest(path: string): Promise<CacheManifest> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as CacheManifest;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return {};
    if (error instanceof SyntaxError) return {};
    throw error;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

async function convertGeoJson(
  sourcePath: string,
  cachePath: string,
  dictionaryPath: string,
): Promise<void> {
  const bodyPath = `${cachePath}.body.tmp`;
  const temporaryPath = `${cachePath}.tmp`;
  const bodyFile = await open(bodyPath, "w");
  let header: HeaderMeta | undefined;
  let geometryType: GeometryType | undefined;
  let featuresCount = 0;
  let bodyOffset = 0;
  const leaves: TreeNode[] = [];

  try {
    for await (const feature of streamFeatures(sourcePath, dictionaryPath)) {
      if (feature.geometry === null) {
        throw new Error(`${sourcePath} contains a feature without geometry`);
      }

      const currentGeometryType = toGeometryType(feature.geometry.type);
      geometryType =
        geometryType === undefined
          ? currentGeometryType
          : geometryType === currentGeometryType
            ? geometryType
            : GeometryType.Unknown;

      if (header === undefined) {
        const properties = feature.properties ?? {};
        header = {
          geometryType: GeometryType.Unknown,
          columns: Object.keys(properties).map((key) => mapColumn(properties, key)),
          envelope: null,
          featuresCount: 0,
          indexNodeSize: DEFAULT_NODE_SIZE,
          crs: null,
          title: null,
          description: null,
          metadata: null,
        };
      }

      const properties = Object.fromEntries(
        (header.columns ?? []).map(({ name }) => [name, feature.properties?.[name] ?? null]),
      );
      const geometry =
        feature.geometry.type === "GeometryCollection"
          ? parseGC(feature.geometry)
          : parseGeometry(feature.geometry);
      const featureBytes = buildFeature(geometry, properties, header);
      leaves.push({ ...geometryBounds(feature.geometry), offset: bodyOffset });
      await bodyFile.write(featureBytes);
      bodyOffset += featureBytes.byteLength;
      featuresCount += 1;
    }
  } catch (error) {
    await bodyFile.close();
    await removeIfExists(bodyPath);
    throw error;
  }
  await bodyFile.close();

  if (header === undefined || geometryType === undefined) {
    await removeIfExists(bodyPath);
    throw new Error(`${sourcePath} contains no GeoJSON features`);
  }

  header.featuresCount = featuresCount;
  header.geometryType = geometryType;
  header.envelope = treeEnvelope(leaves);

  try {
    const outputFile = await open(temporaryPath, "w");
    try {
      await outputFile.write(magicbytes);
      await outputFile.write(buildIndexedHeader(header));
      await outputFile.write(buildPackedRTree(leaves, header.indexNodeSize));
    } finally {
      await outputFile.close();
    }
    await pipeline(createReadStream(bodyPath), createWriteStream(temporaryPath, { flags: "a" }));
    await rename(temporaryPath, cachePath);
  } finally {
    await removeIfExists(bodyPath);
  }
}

type TreeNode = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  offset: number;
};

function geometryBounds(geometry: Geometry): Omit<TreeNode, "offset"> {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const visit = (coordinates: Position | Position[] | Position[][] | Position[][][]) => {
    if (typeof coordinates[0] === "number") {
      const [x, y] = coordinates as Position;
      if (x !== undefined && y !== undefined) {
        bounds.minX = Math.min(bounds.minX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.maxY = Math.max(bounds.maxY, y);
      }
      return;
    }
    for (const child of coordinates as Position[][][]) visit(child);
  };
  if (geometry.type === "GeometryCollection") {
    const children = geometry.geometries.map(geometryBounds);
    return {
      minX: Math.min(...children.map((child) => child.minX)),
      minY: Math.min(...children.map((child) => child.minY)),
      maxX: Math.max(...children.map((child) => child.maxX)),
      maxY: Math.max(...children.map((child) => child.maxY)),
    };
  }
  visit(geometry.coordinates);
  return bounds;
}

function treeEnvelope(nodes: TreeNode[]): Float64Array {
  const bounds = treeBounds(nodes);
  return new Float64Array([bounds.minX, bounds.minY, bounds.maxX, bounds.maxY]);
}

function buildPackedRTree(leaves: TreeNode[], nodeSize: number): Uint8Array {
  const levels = generateLevelBounds(leaves.length, nodeSize);
  const nodeCount = levels.reduce((maximum, [, end]) => Math.max(maximum, end), 0);
  const bytes = new Uint8Array(nodeCount * 40);
  const view = new DataView(bytes.buffer);
  const leafStart = levels[0]?.[0] ?? 0;
  leaves.forEach((leaf, index) => writeTreeNode(view, leafStart + index, leaf));

  for (let level = 1; level < levels.length; level += 1) {
    const [childStart, childEnd] = levels[level - 1] ?? [0, 0];
    const [parentStart, parentEnd] = levels[level] ?? [0, 0];
    for (let parent = parentStart; parent < parentEnd; parent += 1) {
      const firstChild = childStart + (parent - parentStart) * nodeSize;
      const lastChild = Math.min(firstChild + nodeSize, childEnd);
      const children = Array.from({ length: lastChild - firstChild }, (_, index) =>
        readTreeNode(view, firstChild + index),
      );
      writeTreeNode(view, parent, { ...treeBounds(children), offset: firstChild });
    }
  }
  return bytes;
}

function treeBounds(nodes: TreeNode[]): Omit<TreeNode, "offset"> {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const node of nodes) {
    bounds.minX = Math.min(bounds.minX, node.minX);
    bounds.minY = Math.min(bounds.minY, node.minY);
    bounds.maxX = Math.max(bounds.maxX, node.maxX);
    bounds.maxY = Math.max(bounds.maxY, node.maxY);
  }
  return bounds;
}

function writeTreeNode(view: DataView, index: number, node: TreeNode): void {
  const position = index * 40;
  view.setFloat64(position, node.minX, true);
  view.setFloat64(position + 8, node.minY, true);
  view.setFloat64(position + 16, node.maxX, true);
  view.setFloat64(position + 24, node.maxY, true);
  view.setBigUint64(position + 32, BigInt(node.offset), true);
}

function readTreeNode(view: DataView, index: number): TreeNode {
  const position = index * 40;
  return {
    minX: view.getFloat64(position, true),
    minY: view.getFloat64(position + 8, true),
    maxX: view.getFloat64(position + 16, true),
    maxY: view.getFloat64(position + 24, true),
    offset: Number(view.getBigUint64(position + 32, true)),
  };
}

function buildIndexedHeader(header: HeaderMeta): Uint8Array {
  const builder = new flatbuffers.Builder();
  const columns = header.columns
    ? Header.createColumnsVector(
        builder,
        header.columns.map((column) => {
          const name = builder.createString(column.name);
          Column.startColumn(builder);
          Column.addName(builder, name);
          Column.addType(builder, column.type);
          return Column.endColumn(builder);
        }),
      )
    : 0;
  const name = builder.createString("L1");
  const envelope = Header.createEnvelopeVector(builder, header.envelope ?? []);
  Header.startHeader(builder);
  Header.addName(builder, name);
  Header.addEnvelope(builder, envelope);
  Header.addGeometryType(builder, header.geometryType);
  if (columns) Header.addColumns(builder, columns);
  Header.addFeaturesCount(builder, BigInt(header.featuresCount));
  Header.addIndexNodeSize(builder, header.indexNodeSize);
  const offset = Header.endHeader(builder);
  builder.finishSizePrefixed(offset);
  return builder.asUint8Array() as Uint8Array;
}

async function* streamFeatures(
  sourcePath: string,
  dictionaryPath: string,
): AsyncGenerator<Feature> {
  const decompressor = /\.zst$/i.test(sourcePath)
    ? spawn("zstd", ["-q", "-d", "-c", "-D", dictionaryPath, "--", sourcePath], {
        stdio: ["ignore", "pipe", "pipe"],
      })
    : undefined;
  const processResult = decompressor
    ? new Promise<Error | number>((resolveProcess) => {
        let stderr = "";
        decompressor.stderr.setEncoding("utf8");
        decompressor.stderr.on("data", (chunk: string) => {
          stderr += chunk;
        });
        decompressor.once("error", resolveProcess);
        decompressor.once("close", (code) => {
          resolveProcess(
            code === 0 ? 0 : new Error(stderr.trim() || `zstd exited with code ${code}`),
          );
        });
      })
    : undefined;
  decompressor?.stdout.setEncoding("utf8");
  const input = decompressor?.stdout ?? createReadStream(sourcePath, { encoding: "utf8" });
  const features = input
    .pipe(parserStream())
    .pipe(pick.asStream({ filter: "features" }))
    .pipe(streamArray.asStream());

  let streamCompleted = false;
  try {
    for await (const item of features) {
      const value = (item as { value?: unknown }).value;
      if (!isFeature(value)) {
        throw new Error(`${sourcePath} contains an invalid GeoJSON feature`);
      }
      yield value;
    }
    streamCompleted = true;
  } finally {
    if (!streamCompleted && decompressor !== undefined && decompressor.exitCode === null) {
      decompressor.kill();
    }
  }

  const result = await processResult;
  if (result instanceof Error) {
    throw new Error(`Failed to decompress ${sourcePath}: ${result.message}`, { cause: result });
  }
}

function isFeature(value: unknown): value is Feature {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "Feature" &&
    "geometry" in value &&
    "properties" in value
  );
}

async function removeIfExists(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
