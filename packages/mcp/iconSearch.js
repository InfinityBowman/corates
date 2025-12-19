import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = 4001;

let manifestCache = null;
async function loadManifest() {
  if (!manifestCache) {
    const manifestPath = path.resolve('./icon-manifest.json');
    manifestCache = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  }
  return manifestCache;
}

app.get('/search', async (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  const limit = Number.parseInt(req.query.limit || '20', 10);
  const manifest = await loadManifest();

  const results = [];
  for (const [lib, icons] of Object.entries(manifest)) {
    for (const icon of icons) {
      if (icon.toLowerCase().includes(q)) {
        results.push({ lib, icon });
        if (results.length >= limit) break;
      }
    }
    if (results.length >= limit) break;
  }

  res.json(results);
});

app.listen(PORT, () => {
  console.log(`Icon MCP server running at http://localhost:${PORT}`);
});
