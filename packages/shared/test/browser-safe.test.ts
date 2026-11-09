import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

describe("point d'entrée '@offshore/shared/schemas'", () => {
  it('se compile pour le navigateur sans embarquer de code serveur', async () => {
    const result = await build({
      entryPoints: [resolve(here, '../src/schemas.ts')],
      bundle: true,
      write: false,
      metafile: true,
      platform: 'browser', // échoue si un module Node (node:crypto, fs...) est importé
      format: 'esm',
    });
    const inputs = Object.keys(result.metafile.inputs);
    const forbidden = ['express', 'pino', 'http-proxy', 'jsonwebtoken', 'zod-to-openapi'];
    for (const name of forbidden) {
      expect(
        inputs.filter((i) => i.includes(`node_modules/${name}`)),
        name,
      ).toEqual([]);
    }
    expect(inputs.some((i) => i.includes('http.ts') || i.includes('logger.ts'))).toBe(false);
  });
});
