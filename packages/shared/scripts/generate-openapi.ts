import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { buildAuthRegistry, buildDocument, buildStockRegistry } from '../src/openapi';

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../docs/api');
mkdirSync(outDir, { recursive: true });

const docs = {
  'auth.openapi.yaml': buildDocument(
    buildAuthRegistry(),
    'Offshore Ops – auth-service',
    'Authentification, sociétés, utilisateurs et rôles. Généré depuis les schémas zod de @offshore/shared : ne pas éditer à la main.',
    4001,
  ),
  'stock.openapi.yaml': buildDocument(
    buildStockRegistry(),
    'Offshore Ops – stock-service',
    'Articles, entrepôts, mouvements et niveaux de stock. Généré depuis les schémas zod de @offshore/shared : ne pas éditer à la main.',
    4002,
  ),
};

for (const [file, doc] of Object.entries(docs)) {
  writeFileSync(resolve(outDir, file), stringify(doc));
  console.log(`✔ docs/api/${file}`);
}
