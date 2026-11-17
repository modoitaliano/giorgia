// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ReactDOM from 'react-dom/client';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  PROGRAM_TEMPLATE_V2_KIND,
  PROGRAM_TEMPLATE_V2_CONTRACT_VERSION,
  PROGRAM_TEMPLATE_V2_SCHEMA_VERSION,
  PROGRAM_TEMPLATE_V2_PROTOCOL,
  PROGRAM_TEMPLATE_V2_ID,
  PROGRAM_TEMPLATE_V2_NAME,
  PROGRAM_TEMPLATE_V2_PACKAGE,
  PROGRAM_TEMPLATE_V2_ENTRYPOINT,
  ALL_V2_CAPABILITIES,
  ALL_V2_SIGNALS,
  resolveContentType,
  computeFileMetadata,
  listDirectoryFiles,
  collectBundleFiles,
  discoverLiveProgramComponents,
  LIVE_PROGRAM_COMPONENTS_DIR,
  createLiveProgramManifest,
  validateLiveProgramManifest,
} from './live-program-manifest.js';
import {
  parseRuntimeParameters,
  mountLiveProgram,
  discoveredComponents,
} from './live-program/main.js';

describe('live-program-manifest', () => {
  const schemaPath = resolve(process.cwd(), 'docs/contracts/program-template-v2.schema.json');

  // A byte-for-byte copy of gaulatti/alcantara cf7246f docs/contracts/program-template-v2.schema.json.
  it('verifies that the committed schema sha256 matches 62302dab…effb9c', () => {
    const content = readFileSync(schemaPath);
    const hash = createHash('sha256').update(content).digest('hex');
    expect(hash).toBe('62302dab52262f17671a5c8d8b55c587bc5f92ad5a016dfc368947d472effb9c');
  });

  describe('resolveContentType', () => {
    it('maps known extensions correctly', () => {
      expect(resolveContentType('page.html')).toBe('text/html; charset=utf-8');
      expect(resolveContentType('bundle.js')).toBe('application/javascript; charset=utf-8');
      expect(resolveContentType('style.css')).toBe('text/css; charset=utf-8');
      expect(resolveContentType('data.json')).toBe('application/json; charset=utf-8');
      expect(resolveContentType('logo.svg')).toBe('image/svg+xml');
      expect(resolveContentType('icon.png')).toBe('image/png');
      expect(resolveContentType('photo.jpg')).toBe('image/jpeg');
      expect(resolveContentType('photo.jpeg')).toBe('image/jpeg');
      expect(resolveContentType('banner.webp')).toBe('image/webp');
      expect(resolveContentType('font.woff2')).toBe('font/woff2');
      expect(resolveContentType('font.ttf')).toBe('font/ttf');
      expect(resolveContentType('audio.ogg')).toBe('audio/ogg');
      expect(resolveContentType('video.mp4')).toBe('video/mp4');
    });

    it('falls back to application/octet-stream for unknown or extensionless files', () => {
      expect(resolveContentType('blob.xyz')).toBe('application/octet-stream');
      expect(resolveContentType('LICENSE')).toBe('application/octet-stream');
    });
  });

  describe('file metadata and directory listing', () => {
    const testDir = resolve(process.cwd(), '.cache/test-manifest-files');

    beforeEach(() => {
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('computes file metadata accurately', () => {
      const file = join(testDir, 'sample.json');
      const payload = JSON.stringify({ hello: 'world' });
      writeFileSync(file, payload);

      const metadata = computeFileMetadata(file, 'sample.json');
      expect(metadata.key).toBe('sample.json');
      expect(metadata.bytes).toBe(Buffer.byteLength(payload));
      expect(metadata.contentType).toBe('application/json; charset=utf-8');
      expect(metadata.sha256).toBe(createHash('sha256').update(payload).digest('hex'));
    });

    it('lists directory files recursively and handles empty/nonexistent dirs', () => {
      const sub = join(testDir, 'sub');
      mkdirSync(sub, { recursive: true });
      writeFileSync(join(testDir, 'a.txt'), 'a');
      writeFileSync(join(sub, 'b.txt'), 'b');

      const files = listDirectoryFiles(testDir);
      expect(files).toEqual(['a.txt', 'sub/b.txt']);

      expect(listDirectoryFiles('/nonexistent/path/for/test')).toEqual([]);
    });

    it('collects bundle files ignoring manifest and ds_store', () => {
      writeFileSync(join(testDir, 'index.html'), '<html></html>');
      writeFileSync(join(testDir, 'live-program-manifest.json'), '{}');
      writeFileSync(join(testDir, '.DS_Store'), '');

      const collected = collectBundleFiles(testDir);
      expect(collected).toHaveLength(1);
      expect(collected[0]?.key).toBe('index.html');
    });
  });

  describe('discoverLiveProgramComponents', () => {
    const compDir = resolve(process.cwd(), 'src/live-program/components-test-fixture');

    afterEach(() => {
      if (existsSync(compDir)) {
        rmSync(compDir, { recursive: true, force: true });
      }
    });

    it('returns empty array when no components exist', () => {
      const found = discoverLiveProgramComponents('src/live-program/nonexistent-components/**/*.tsx');
      expect(found).toEqual([]);
    });

    it('discovers tsx/ts files and ignores test/d.ts files', () => {
      mkdirSync(compDir, { recursive: true });
      writeFileSync(join(compDir, 'WidgetA.tsx'), 'export const WidgetA = () => null;');
      writeFileSync(join(compDir, 'WidgetB.ts'), 'export const WidgetB = () => null;');
      writeFileSync(join(compDir, 'Widget.test.tsx'), 'test');
      writeFileSync(join(compDir, 'Widget.d.ts'), 'declare module');

      const found = discoverLiveProgramComponents('src/live-program/components-test-fixture/**/*.{tsx,ts}');
      expect(found).toContain('src/live-program/components-test-fixture/WidgetA.tsx');
      expect(found).toContain('src/live-program/components-test-fixture/WidgetB.ts');
      expect(found).not.toContain('src/live-program/components-test-fixture/Widget.test.tsx');
      expect(found).not.toContain('src/live-program/components-test-fixture/Widget.d.ts');
    });
  });

  describe('createLiveProgramManifest and validation', () => {
    it('creates a manifest with completely empty options hitting all defaults', () => {
      const manifest = createLiveProgramManifest();
      expect(manifest.kind).toBe(PROGRAM_TEMPLATE_V2_KIND);
      expect(manifest.bundleVersion).toBe('0.1.106');
      expect(manifest.files).toEqual([]);
      expect(manifest.capabilities).toEqual([...ALL_V2_CAPABILITIES]);
      expect(manifest.control.signals).toEqual([...ALL_V2_SIGNALS]);
    });

    it('creates a manifest with valid defaults matching schema', () => {
      const manifest = createLiveProgramManifest({
        packageVersion: '0.1.106',
        files: [
          {
            key: 'index.html',
            bytes: 100,
            contentType: 'text/html; charset=utf-8',
            sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          },
        ],
      });

      expect(manifest.kind).toBe(PROGRAM_TEMPLATE_V2_KIND);
      expect(manifest.contractVersion).toBe(PROGRAM_TEMPLATE_V2_CONTRACT_VERSION);
      expect(manifest.schemaVersion).toBe(PROGRAM_TEMPLATE_V2_SCHEMA_VERSION);
      expect(manifest.id).toBe(PROGRAM_TEMPLATE_V2_ID);
      expect(manifest.name).toBe(PROGRAM_TEMPLATE_V2_NAME);
      expect(manifest.package).toBe(PROGRAM_TEMPLATE_V2_PACKAGE);
      expect(manifest.entrypoint).toBe(PROGRAM_TEMPLATE_V2_ENTRYPOINT);
      expect(manifest.control.protocol).toBe(PROGRAM_TEMPLATE_V2_PROTOCOL);
      expect(manifest.control.snapshotPath).toBe('state');
      expect(manifest.control.eventsPath).toBe('events');
      expect(manifest.control.runtimeParameters).toEqual({
        programId: 'programId',
        apiBaseUrl: 'apiBaseUrl',
      });
      expect(manifest.capabilities).toEqual([...ALL_V2_CAPABILITIES]);
      expect(manifest.control.signals).toEqual([...ALL_V2_SIGNALS]);

      const validation = validateLiveProgramManifest(manifest, schemaPath);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toBeUndefined();
    });

    // Alcantara rejects a v2 manifest that lists any signal outside PROGRAM_TEMPLATE_V2_SIGNALS
    // (gaulatti/alcantara cf7246f, backend/src/program/program-template.service.ts:24-60 for the set,
    // :311-321 for the rejection). The set below is copied from that commit: PROGRAM_TEMPLATE_SIGNALS
    // followed by V2_ONLY_SIGNALS, which now ends with playing_track_update (alcantara#178).
    it("lists no signal outside Alcantara cf7246f's PROGRAM_TEMPLATE_V2_SIGNALS, and lists playing_track_update", () => {
      const ALCANTARA_CF7246F_V2_SIGNALS = new Set([
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
      ]);
      const manifest = createLiveProgramManifest({ files: [], components: discoverLiveProgramComponents(LIVE_PROGRAM_COMPONENTS_DIR) });
      expect(manifest.control.signals.filter((signal) => !ALCANTARA_CF7246F_V2_SIGNALS.has(signal))).toEqual([]);
      expect(manifest.control.signals).toContain('playing_track_update');
      expect(manifest.control.signals).toContain('program_state_snapshot');
    });

    it('allows custom capabilities and signals within schema bounds', () => {
      const manifest = createLiveProgramManifest({
        packageVersion: '1.0.0',
        capabilities: ['audio.playback', 'media.groups'],
        signals: ['program_state_snapshot', 'chyron_update'],
        files: [],
      });

      expect(manifest.capabilities).toEqual(['audio.playback', 'media.groups']);
      expect(manifest.control.signals).toEqual(['program_state_snapshot', 'chyron_update']);

      const validation = validateLiveProgramManifest(manifest, schemaPath);
      expect(validation.valid).toBe(true);
    });

    it('rejects invalid manifests against schema', () => {
      const invalid = {
        kind: 'wrong.kind',
        contractVersion: 99,
      };

      const validation = validateLiveProgramManifest(invalid, schemaPath);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toBeDefined();
      expect(validation.errors!.length).toBeGreaterThan(0);
    });

    it('handles missing schema path gracefully', () => {
      const result = validateLiveProgramManifest({}, '/nonexistent/path/schema.json');
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('ENOENT');
    });

    it('handles non-Error thrown exceptions during schema parsing', () => {
      const spy = vi.spyOn(JSON, 'parse').mockImplementationOnce(() => {
        throw 'non-error string exception';
      });
      const result = validateLiveProgramManifest({}, schemaPath);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toBe('non-error string exception');
      spy.mockRestore();
    });
  });

  describe('main.tsx runtime parameter parsing and component discovery', () => {
    it('exposes discoveredComponents mapping', () => {
      expect(typeof discoveredComponents).toBe('object');
    });

    it('discovers the real live-program components for the manifest and the bundle alike', () => {
      const manifestList = discoverLiveProgramComponents();
      expect(manifestList.length).toBeGreaterThan(0);
      expect(manifestList).toEqual(discoverLiveProgramComponents(LIVE_PROGRAM_COMPONENTS_DIR));
      expect(manifestList).toEqual(
        expect.arrayContaining([
          'src/components/live-program/LiveProgram.tsx',
          'src/components/live-program/radio/Earone.tsx',
          'src/components/live-program/radio/ModoItalianoPodcastPlayer.tsx',
          'src/components/live-program/radio/ModoItalianoGiorgiaPodcastPlayer.tsx',
        ])
      );
      expect(manifestList.some((file) => file.includes('.test.'))).toBe(false);
      const bundleList = Object.keys(discoveredComponents)
        .map((key) => key.replace(/^\.\.\//, 'src/'))
        .sort((a, b) => a.localeCompare(b));
      expect(bundleList).toEqual(manifestList);
    });

    it('parses runtime parameters from search query', () => {
      const parsed = parseRuntimeParameters('?programId=harbor-light-tv&apiBaseUrl=http://127.0.0.1:3000');
      expect(parsed.programId).toBe('harbor-light-tv');
      expect(parsed.apiBaseUrl).toBe('http://127.0.0.1:3000');
    });

    it('falls back to defaults when search is empty', () => {
      const parsed = parseRuntimeParameters('', 'http://fallback.api');
      expect(parsed.programId).toBe('modoitaliano');
      expect(parsed.apiBaseUrl).toBe('http://fallback.api');
    });

    it('falls back to modoitaliano and undefined when search has no params and no fallback', () => {
      const parsed = parseRuntimeParameters('');
      expect(parsed.programId).toBe('modoitaliano');
      expect(parsed.apiBaseUrl).toBeUndefined();
    });

    it('uses window.location.search when search parameter is omitted', () => {
      const parsed = parseRuntimeParameters();
      expect(parsed.programId).toBe('modoitaliano');
    });

    it('handles window configuration override if present', () => {
      (window as any).__MODOITALIANO_LIVE_PROGRAM_CONFIG__ = {
        programId: 'custom-program',
        apiBaseUrl: 'http://custom.api',
      };
      const parsed = parseRuntimeParameters('');
      expect(parsed.programId).toBe('custom-program');
      expect(parsed.apiBaseUrl).toBe('http://custom.api');
      delete (window as any).__MODOITALIANO_LIVE_PROGRAM_CONFIG__;
    });

    it('mountLiveProgram returns false when rootElement is null', () => {
      expect(mountLiveProgram(null)).toBe(false);
    });

    it('mountLiveProgram mounts into root container without errors', () => {
      const container = document.createElement('div');
      const renderMock = vi.fn();
      const spy = vi.spyOn(ReactDOM, 'createRoot').mockReturnValue({
        render: renderMock,
        unmount: vi.fn(),
      } as any);

      const result = mountLiveProgram(container, '?programId=test-id', 'http://test.api');
      expect(result).toBe(true);
      expect(spy).toHaveBeenCalledWith(container);
      expect(renderMock).toHaveBeenCalledTimes(1);

      spy.mockRestore();
    });
  });
});
