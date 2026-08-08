import { ok as okEngine } from "./engine.test.mjs";
import { ok as okImport } from "./importFubles.test.mjs";

process.exit(okEngine && okImport ? 0 : 1);
