//
// Vercel serverless entry.
//
// The project is ESM ("type": "module"), and Vercel compiles api/*.ts per-file
// WITHOUT bundling relative imports. Extensionless ESM imports
// ('../server/app') then fail at runtime with ERR_MODULE_NOT_FOUND.
//
// Fix: `npm run build` bundles this whole entry (server/app + routes + engines)
// into dist/api-bundle.cjs (CJS, node_modules kept external), and vercel.json
// ships that file via functions.includeFiles. Here we simply load it.
//
// CJS-compatible load: Vercel compiles api/index.ts as ESM ("type": "module"),
// so `require` is NOT available. Use a dynamic import of the CJS bundle —
// Node's ESM-CJS interop gives us module.exports as the default export.
const mod: any = await import('../dist/api-bundle.cjs');

const createApp = mod.createApp ?? mod.default?.createApp ?? mod;
const app = createApp();

export default app;

