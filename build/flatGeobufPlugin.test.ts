import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { geojson } from "flatgeobuf";
import { describe, expect, it } from "vitest";
import { buildFlatGeobufFiles } from "./flatGeobufPlugin";

const featureCollection = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: { name: "test" },
      geometry: { type: "Point" as const, coordinates: [139, 35] },
    },
  ],
};

const execFileAsync = promisify(execFile);

describe("buildFlatGeobufFiles", () => {
  it("converts GeoJSON files into the output root", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "flatgeobuf-plugin-"));
    const dataDir = resolve(root, "data");
    const outDir = resolve(root, "dist");
    await mkdir(dataDir);
    await writeFile(resolve(dataDir, "area.geojson"), JSON.stringify(featureCollection));

    await buildFlatGeobufFiles(dataDir, outDir, resolve(root, "cache"));

    const output = new Uint8Array(await readFile(resolve(outDir, "area.fgb")));
    await expect(Array.fromAsync(geojson.deserialize(output))).resolves.toHaveLength(1);
    await expect(
      Array.fromAsync(
        geojson.deserialize(output, { minX: 138.9, minY: 34.9, maxX: 139.1, maxY: 35.1 }),
      ),
    ).resolves.toHaveLength(1);
    await expect(
      Array.fromAsync(geojson.deserialize(output, { minX: 0, minY: 0, maxX: 1, maxY: 1 })),
    ).resolves.toHaveLength(0);
  });

  it("decompresses dictionary-compressed GeoJSON files before conversion", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "flatgeobuf-plugin-"));
    const dataDir = resolve(root, "data");
    const outDir = resolve(root, "dist");
    const sourcePath = resolve(dataDir, "area.geojson");
    const dictionaryPath = resolve(dataDir, "geojson.zdict");
    await mkdir(dataDir);
    await writeFile(sourcePath, JSON.stringify(featureCollection));
    await writeFile(dictionaryPath, JSON.stringify(featureCollection).repeat(4));
    await execFileAsync("zstd", ["-q", "-D", dictionaryPath, sourcePath]);
    await unlink(sourcePath);

    await buildFlatGeobufFiles(dataDir, outDir, resolve(root, "cache"));

    const output = new Uint8Array(await readFile(resolve(outDir, "area.fgb")));
    await expect(Array.fromAsync(geojson.deserialize(output))).resolves.toHaveLength(1);
  });

  it("skips conversion while the source is unchanged", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "flatgeobuf-plugin-"));
    const dataDir = resolve(root, "data");
    const cacheDir = resolve(root, "cache");
    const sourcePath = resolve(dataDir, "area.geojson");
    const cachePath = resolve(cacheDir, "files/area.fgb");
    await mkdir(dataDir);
    await writeFile(sourcePath, JSON.stringify(featureCollection));
    await buildFlatGeobufFiles(dataDir, resolve(root, "dist-1"), cacheDir);
    const firstMtime = (await stat(cachePath)).mtimeMs;

    await buildFlatGeobufFiles(dataDir, resolve(root, "dist-2"), cacheDir);

    expect((await stat(cachePath)).mtimeMs).toBe(firstMtime);
    expect(await readFile(resolve(root, "dist-2/area.fgb"))).toEqual(await readFile(cachePath));
  });
});
