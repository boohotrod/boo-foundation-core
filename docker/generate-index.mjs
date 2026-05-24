// Generates a static dist/client/index.html for nginx to serve.
// TanStack Start is SSR-only and does not emit index.html; for the
// v0.1.0 client-only deploy we synthesize one from the built assets.
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const clientDir = process.argv[2] || "dist/client";
const assetsDir = join(clientDir, "assets");
const files = readdirSync(assetsDir);

const entryJs = files.find((f) => /^index-.*\.js$/.test(f));
const entryCss = files.find((f) => /^styles-.*\.css$/.test(f));

if (!entryJs) {
  console.error("generate-index: no index-*.js entry found in", assetsDir);
  process.exit(1);
}

const html = `<!doctype html>
<html lang="hu">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BBS Core</title>
${entryCss ? `    <link rel="stylesheet" href="/assets/${entryCss}" />\n` : ""}    <script type="module" crossorigin src="/assets/${entryJs}"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

writeFileSync(join(clientDir, "index.html"), html);
console.log("generate-index: wrote", join(clientDir, "index.html"));
