import { createRequire } from "node:module";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { cronkiteManifest } from "./cronkite-manifest.js";
import { addContractFormats } from "./json-schema-formats.js";
import { layoutFiles } from "./layouts.js";
import { assertManifestAlignment } from "./manifest-validation.js";
import { outletConfig } from "./outlet-config.js";
import * as renderer from "./renderer.js";
import type { CronkiteCLSManifest } from "./types/cronkite-manifest.generated.js";
import { version } from "./version.js";

const require = createRequire(import.meta.url);
const schema = require("./schemas/cronkite-manifest.schema.json") as object;
const packageJson = require("../package.json") as {
  name: string;
  version: string;
};

function sources() {
  return {
    layouts: Object.keys(layoutFiles),
    languages: outletConfig.supportedLanguages,
    defaultLanguage: outletConfig.defaultLanguage,
    packageName: packageJson.name,
    packageVersion: packageJson.version,
    exportedVersion: version,
  };
}

describe("Cronkite manifest", () => {
  it("validates against the CPS-02 JSON Schema", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addContractFormats(ajv);
    const validate = ajv.compile(schema);

    expect(validate(cronkiteManifest), JSON.stringify(validate.errors)).toBe(
      true,
    );
  });

  it("declares the authoritative layouts, languages, identity, and exports", () => {
    expect(() =>
      assertManifestAlignment(cronkiteManifest, sources()),
    ).not.toThrow();
    expect(cronkiteManifest.languages).toEqual(["es", "en", "it"]);
    expect(outletConfig.defaultLanguage).toBe("es");
    expect(cronkiteManifest.layouts).toContain("link-in-bio");
    expect(cronkiteManifest.capabilities).toEqual({
      fonts: { export: "fontFiles" },
      assets: { export: "assetFiles" },
    });

    for (const descriptor of Object.values(cronkiteManifest.renderables)) {
      if ("export" in descriptor && descriptor.export) {
        expect(
          typeof renderer[descriptor.export as keyof typeof renderer],
        ).toBe("function");
      }
    }
  });

  it("makes every drift boundary fail closed", () => {
    const layouts = structuredClone(
      cronkiteManifest,
    ) as unknown as CronkiteCLSManifest;
    layouts.layouts = ["homepage"];
    expect(() => assertManifestAlignment(layouts, sources())).toThrow(
      "layout drift",
    );

    const languages = structuredClone(
      cronkiteManifest,
    ) as unknown as CronkiteCLSManifest;
    languages.languages = ["es"];
    expect(() => assertManifestAlignment(languages, sources())).toThrow(
      "language drift",
    );

    const identity = structuredClone(
      cronkiteManifest,
    ) as unknown as CronkiteCLSManifest;
    identity.version = "9.9.9";
    expect(() => assertManifestAlignment(identity, sources())).toThrow(
      "package identity drift",
    );
  });

  it("owns localized system copy and the exact current Spanish coming-soon copy", () => {
    for (const page of cronkiteManifest.systemPages) {
      expect(Object.keys(page.copy).sort()).toEqual(["en", "es", "it"]);
      expect(cronkiteManifest.layouts).toContain(page.layout);
    }

    const comingSoon = cronkiteManifest.systemPages.find(
      (page) => page.layout === "coming-soon",
    );
    expect(comingSoon?.copy.es).toEqual({
      title: "Próximamente",
      description:
        "Estamos preparando algo especial. Vuelve pronto para descubrirlo.",
    });
  });

  it("declares the browser search dependency and no unsupported program contract", () => {
    expect(
      cronkiteManifest.renderables["search-page"].resources?.[
        "search-manifest"
      ],
    ).toEqual({
      key: "search-manifest-{language}.json",
      schema: "dist/schemas/search-manifest.schema.json",
      contentType: "application/json",
      perLanguage: true,
    });
    expect(cronkiteManifest.renderables).not.toHaveProperty("live-program");
  });
});
