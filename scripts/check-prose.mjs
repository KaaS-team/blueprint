import { finish, proseFiles, readText, rootFromArgs, vendoredFiles } from './lib.mjs';

const EM_DASH = String.fromCharCode(0x2014);
const root = rootFromArgs();
const vendored = vendoredFiles(root);
const problems = proseFiles(root)
  .filter((f) => !vendored.has(f) && readText(root, f).includes(EM_DASH))
  .map((f) => `${f}: contains an em dash (U+2014)`);

finish('prose', problems);
