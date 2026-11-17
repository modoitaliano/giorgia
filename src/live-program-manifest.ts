import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';

export const PROGRAM_TEMPLATE_V2_KIND = 'alcantara.program-template';
export const PROGRAM_TEMPLATE_V2_CONTRACT_VERSION = 2;
export const PROGRAM_TEMPLATE_V2_SCHEMA_VERSION = 2;
export const PROGRAM_TEMPLATE_V2_PROTOCOL = 'alcantara.program.v2';
export const PROGRAM_TEMPLATE_V2_ID = 'modoitaliano.live-program';
export const PROGRAM_TEMPLATE_V2_NAME = 'Modo Italiano Live Program';
export const PROGRAM_TEMPLATE_V2_PACKAGE = '@modoitaliano/giorgia';
export const PROGRAM_TEMPLATE_V2_ENTRYPOINT = 'index.html';

export const ALL_V2_CAPABILITIES = [
  'audio.playback',
  'media.groups',
  'scene.configuration',
  'stinger.transitions',
  'audience.interaction',
  'data.chart-provider',
  'source.external-video',
  'source.webrtc-guest',
  'sequence.song',
  'sequence.chyron',
  'media.slideshow',
  'display.clock',
  'display.ticker',
  'display.scoreboard',
] as const;

export type ProgramTemplateCapability = (typeof ALL_V2_CAPABILITIES)[number];

export const ALL_V2_SIGNALS = [
  'audio_bus_update',
  'broadcast_settings_update',
  'heartbeat',
  'instant_play',
  'instant_stop_all',
  'program_media_groups_changed',
  'program_reload',
  'program_scenes_changed',
  'program_state_snapshot',
  'program_stingers_changed',
  'scene_change',
  'scene_cleared',
  'scene_instant_state',
  'scene_instant_stop',
  'scene_instant_take',
  'scene_staged',
  'scene_update',
  'song_off_air',
  'chyron_update',
  'fade_to_black',
  'song_playback_active',
  'song_playback_update',
  'song_queue_update',
  'audio_levels',
  'audience_interaction_draw_start',
  'audience_interaction_draw_end',
  'playing_track_update',
] as const;

export type ProgramTemplateSignal = (typeof ALL_V2_SIGNALS)[number];

export interface ManifestFileEntry {
  key: string;
  bytes: number;
  contentType: string;
  sha256: string;
}

export interface ProgramTemplateManifestV2 {
  kind: typeof PROGRAM_TEMPLATE_V2_KIND;
  contractVersion: typeof PROGRAM_TEMPLATE_V2_CONTRACT_VERSION;
  schemaVersion: typeof PROGRAM_TEMPLATE_V2_SCHEMA_VERSION;
  id: string;
  name: string;
  package: string;
  bundleVersion: string;
  entrypoint: string;
  capabilities: string[];
  control: {
    protocol: typeof PROGRAM_TEMPLATE_V2_PROTOCOL;
    transport: 'server-sent-events';
    snapshotPath: 'state';
    eventsPath: 'events';
    runtimeParameters: {
      programId: 'programId';
      apiBaseUrl: 'apiBaseUrl';
    };
    signals: string[];
  };
  files: ManifestFileEntry[];
}

export const COMMON_CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
};

export function resolveContentType(filePath: string): string {
  const dotIndex = filePath.lastIndexOf('.');
  if (dotIndex === -1) return 'application/octet-stream';
  const ext = filePath.slice(dotIndex).toLowerCase();
  return COMMON_CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

export function computeFileMetadata(filePath: string, relativeKey = filePath): ManifestFileEntry {
  const buffer = readFileSync(filePath);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const contentType = resolveContentType(relativeKey);
  return {
    key: relativeKey,
    bytes: buffer.byteLength,
    contentType,
    sha256,
  };
}

export function listDirectoryFiles(dir: string, prefix = ''): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const key = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        results.push(...listDirectoryFiles(join(dir, entry.name), key));
      } else {
        results.push(key);
      }
    }
  } catch {
    return [];
  }
  return results.sort((a, b) => a.localeCompare(b));
}

export function collectBundleFiles(outDir: string): ManifestFileEntry[] {
  const keys = listDirectoryFiles(outDir).filter(
    (key) => key !== 'live-program-manifest.json' && !key.endsWith('.DS_Store')
  );
  return keys.map((key) => computeFileMetadata(join(outDir, key), key));
}

/** Where the live-program components live; src/live-program holds only the app entry. */
export const LIVE_PROGRAM_COMPONENTS_DIR = 'src/components/live-program';

export function discoverLiveProgramComponents(
  patternOrDir = LIVE_PROGRAM_COMPONENTS_DIR,
  rootDir = process.cwd()
): string[] {
  const baseDir = patternOrDir.includes('*')
    ? patternOrDir.slice(0, patternOrDir.indexOf('*')).replace(/\/+$/, '')
    : patternOrDir;
  const fullPath = resolve(rootDir, baseDir);
  const files = listDirectoryFiles(fullPath);
  return files
    .filter(
      (file: string) =>
        (file.endsWith('.tsx') || file.endsWith('.ts')) &&
        !file.endsWith('.d.ts') &&
        !file.endsWith('.test.ts') &&
        !file.endsWith('.test.tsx')
    )
    .map((file: string) => `${baseDir}/${file}`)
    .sort((a: string, b: string) => a.localeCompare(b));
}

export interface CreateManifestOptions {
  packageVersion?: string;
  files?: ManifestFileEntry[];
  components?: string[];
  capabilities?: string[];
  signals?: string[];
}

export function createLiveProgramManifest(options: CreateManifestOptions = {}): ProgramTemplateManifestV2 {
  const bundleVersion = options.packageVersion ?? '0.1.106';
  const files = options.files ?? [];
  const capabilities = options.capabilities ? [...options.capabilities] : [...ALL_V2_CAPABILITIES];
  const signals = options.signals ? [...options.signals] : [...ALL_V2_SIGNALS];

  return {
    kind: PROGRAM_TEMPLATE_V2_KIND,
    contractVersion: PROGRAM_TEMPLATE_V2_CONTRACT_VERSION,
    schemaVersion: PROGRAM_TEMPLATE_V2_SCHEMA_VERSION,
    id: PROGRAM_TEMPLATE_V2_ID,
    name: PROGRAM_TEMPLATE_V2_NAME,
    package: PROGRAM_TEMPLATE_V2_PACKAGE,
    bundleVersion,
    entrypoint: PROGRAM_TEMPLATE_V2_ENTRYPOINT,
    capabilities,
    control: {
      protocol: PROGRAM_TEMPLATE_V2_PROTOCOL,
      transport: 'server-sent-events',
      snapshotPath: 'state',
      eventsPath: 'events',
      runtimeParameters: {
        programId: 'programId',
        apiBaseUrl: 'apiBaseUrl',
      },
      signals,
    },
    files,
  };
}

export function validateLiveProgramManifest(
  manifest: unknown,
  schemaPath = resolve(process.cwd(), 'docs/contracts/program-template-v2.schema.json')
): { valid: boolean; errors?: string[] } {
  try {
    const schemaContent = readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(schemaContent);
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    const valid = Boolean(validate(manifest));
    if (!valid && validate.errors) {
      return {
        valid: false,
        errors: validate.errors.map((err) => `${err.instancePath} ${err.message}`.trim()),
      };
    }
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }
}
