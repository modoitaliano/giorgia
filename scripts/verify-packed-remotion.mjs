import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { bundle } from "@remotion/bundler";

const execFileAsync = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = await mkdtemp(join(tmpdir(), "giorgia-packed-remotion-"));
const packageDirectory = join(workspace, "package");
const consumerDirectory = join(workspace, "consumer");

try {
  await mkdir(packageDirectory);
  await mkdir(consumerDirectory);
  const { stdout } = await execFileAsync(
    "npm",
    [
      "pack",
      "--json",
      "--ignore-scripts",
      "--pack-destination",
      packageDirectory,
    ],
    { cwd: root },
  );
  const [{ filename }] = JSON.parse(stdout);
  const archive = join(packageDirectory, filename);

  await writeFile(
    join(consumerDirectory, "package.json"),
    JSON.stringify({ name: "giorgia-remotion-consumer", private: true }),
  );
  await execFileAsync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
      "--no-save",
      archive,
    ],
    { cwd: consumerDirectory },
  );

  const consumerRequire = createRequire(join(consumerDirectory, "index.cjs"));
  const manifestPath = consumerRequire.resolve(
    "@modoitaliano/giorgia/cronkite-manifest.json",
  );
  const installedManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const packageRoot = dirname(dirname(manifestPath));
  const installedRenderer = await import(
    pathToFileURL(join(packageRoot, "dist", "renderer.js")).href
  );
  const fontFiles = installedRenderer.fontFiles();
  const assetFiles = installedRenderer.assetFiles();
  const keys = [...fontFiles, ...assetFiles].map((file) => file.key);
  if (
    fontFiles.length === 0 ||
    assetFiles.length === 0 ||
    new Set(keys).size !== keys.length ||
    fontFiles.some((file) => !file.key.startsWith("content/fonts/")) ||
    assetFiles.some((file) => !file.key.startsWith("assets/"))
  ) {
    throw new Error(
      "packed basement capabilities have missing or duplicate keys",
    );
  }
  if (
    fontFiles.filter((file) => file.key === "content/fonts/fonts.css").length !==
    1
  ) {
    throw new Error("packed font capability must contain one stylesheet");
  }

  const video = installedManifest.renderables?.["short-video"];
  if (video?.engine !== "remotion" || typeof video.entry !== "string") {
    throw new Error("packed manifest has no Remotion short-video entry");
  }

  const entryPoint = join(packageRoot, video.entry);
  await bundle({
    entryPoint,
    outDir: join(workspace, "bundle"),
    onProgress: () => undefined,
  });
  console.log(`Bundled packed ${installedManifest.package} short-video entry.`);
} finally {
  await rm(workspace, { recursive: true, force: true });
}
