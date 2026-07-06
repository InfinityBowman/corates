#!/usr/bin/env node
/**
 * Downloads a fixed pool of open-access PDFs into packages/web/public/dev-pdfs/
 * (git-ignored) for the dev "Create Project from template" tool to attach to
 * studies. Publisher PDFs (BMJ, OUP, etc.) block automated fetches, so the dev
 * importer pulls from this local pool instead of hitting the network per study.
 *
 * All entries are PLOS articles (CC-BY) served from the open article/file
 * endpoint, which reliably returns real PDF bytes. Run once:
 *
 *   pnpm --filter web dev:pdfs
 *
 * Re-running skips files already present. Delete the folder to refresh.
 */

import { mkdir, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'dev-pdfs');

// journal slug is derived from the DOI infix (pmed -> plosmedicine, etc.)
const JOURNAL_SLUGS = {
  pmed: 'plosmedicine',
  pone: 'plosone',
  pntd: 'plosntds',
  pbio: 'plosbiology',
  pcbi: 'ploscompbiol',
  pgen: 'plosgenetics',
};

const PAPERS = [
  {
    doi: '10.1371/journal.pmed.1000097',
    firstAuthor: 'Moher',
    year: 2009,
    title:
      'Preferred reporting items for systematic reviews and meta-analyses: the PRISMA statement',
  },
  {
    doi: '10.1371/journal.pmed.1000100',
    firstAuthor: 'Liberati',
    year: 2009,
    title:
      'The PRISMA statement for reporting systematic reviews and meta-analyses of studies that evaluate healthcare interventions',
  },
  {
    doi: '10.1371/journal.pmed.1001333',
    firstAuthor: 'Welch',
    year: 2012,
    title:
      'PRISMA-Equity 2012 extension: reporting guidelines for systematic reviews with a focus on health equity',
  },
  {
    doi: '10.1371/journal.pone.0159267',
    firstAuthor: 'Page',
    year: 2016,
    title: 'Empirical evidence of study design biases in randomized trials',
  },
  {
    doi: '10.1371/journal.pone.0028130',
    firstAuthor: 'Liu',
    year: 2011,
    title: 'Risk of bias tool in systematic reviews/meta-analyses of acupuncture',
  },
  {
    doi: '10.1371/journal.pone.0144125',
    firstAuthor: 'Cramer',
    year: 2015,
    title: 'Associated factors and consequences of risk of bias in randomized controlled trials',
  },
  {
    doi: '10.1371/journal.pmed.1001987',
    firstAuthor: 'Bilandzic',
    year: 2016,
    title:
      'Risk of bias in systematic reviews of non-randomized studies of adverse cardiovascular effects',
  },
  {
    doi: '10.1371/journal.pone.0285527',
    firstAuthor: 'Snigurska',
    year: 2023,
    title: 'Risk of bias in prognostic models of hospital-induced delirium',
  },
  {
    doi: '10.1371/journal.pone.0065442',
    firstAuthor: 'Grant',
    year: 2013,
    title: 'Reporting quality of social and psychological intervention trials',
  },
  {
    doi: '10.1371/journal.pone.0075122',
    firstAuthor: 'Burford',
    year: 2013,
    title: 'Testing the PRISMA-Equity 2012 reporting guideline',
  },
  {
    doi: '10.1371/journal.pone.0235535',
    firstAuthor: 'Rademaker',
    year: 2020,
    title: 'The effect of the CONSORT statement on reporting quality',
  },
  {
    doi: '10.1371/journal.pone.0138511',
    firstAuthor: 'Paradies',
    year: 2015,
    title: 'Racism as a determinant of health: a systematic review and meta-analysis',
  },
  {
    doi: '10.1371/journal.pone.0169548',
    firstAuthor: 'Beaudart',
    year: 2017,
    title: 'Health outcomes of sarcopenia: a systematic review and meta-analysis',
  },
  {
    doi: '10.1371/journal.pone.0164769',
    firstAuthor: 'Stallman',
    year: 2016,
    title: 'Prevalence of sleepwalking: a systematic review and meta-analysis',
  },
  {
    doi: '10.1371/journal.pone.0112414',
    firstAuthor: 'Cramer',
    year: 2014,
    title: 'Yoga for multiple sclerosis: a systematic review and meta-analysis',
  },
  {
    doi: '10.1371/journal.pone.0133858',
    firstAuthor: 'Usenbo',
    year: 2015,
    title: 'Prevalence of arthritis in Africa: a systematic review and meta-analysis',
  },
  {
    doi: '10.1371/journal.pone.0127019',
    firstAuthor: 'Zhao',
    year: 2015,
    title: 'Is acupuncture effective for hypertension? A systematic review and meta-analysis',
  },
  {
    doi: '10.1371/journal.pone.0050775',
    firstAuthor: 'Eijkemans',
    year: 2012,
    title: 'Physical activity and asthma: a systematic review and meta-analysis',
  },
  {
    doi: '10.1371/journal.pone.0052708',
    firstAuthor: 'Boillot',
    year: 2013,
    title: 'Obesity and the microvasculature: a systematic review and meta-analysis',
  },
  {
    doi: '10.1371/journal.pone.0241445',
    firstAuthor: 'Kussainova',
    year: 2020,
    title: 'Vitiligo and anxiety: a systematic review and meta-analysis',
  },
];

function journalSlug(doi) {
  const infix = doi.split('journal.')[1]?.split('.')[0];
  return JOURNAL_SLUGS[infix] ?? 'plosone';
}

function fileNameFor(doi) {
  return `${doi.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const manifest = [];
  let downloaded = 0;
  let skipped = 0;

  for (const paper of PAPERS) {
    const fileName = fileNameFor(paper.doi);
    const outPath = join(OUT_DIR, fileName);
    const entry = {
      fileName,
      title: paper.title,
      firstAuthor: paper.firstAuthor,
      year: paper.year,
    };

    if (await exists(outPath)) {
      manifest.push(entry);
      skipped++;
      continue;
    }

    const url = `https://journals.plos.org/${journalSlug(paper.doi)}/article/file?id=${paper.doi}&type=printable`;
    process.stdout.write(`Downloading ${paper.firstAuthor} ${paper.year}... `);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'CoRATES-dev/1.0 (mailto:support@corates.app)',
        Accept: 'application/pdf,*/*',
      },
    });

    const contentType = res.headers.get('content-type') ?? '';
    if (!res.ok || !contentType.includes('pdf')) {
      console.log(`SKIPPED (${res.status} ${contentType})`);
      continue;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    await writeFile(outPath, buffer);
    console.log(`ok (${(buffer.length / 1024).toFixed(0)} KB)`);
    manifest.push(entry);
    downloaded++;
  }

  await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`\nDone. ${downloaded} downloaded, ${skipped} already present.`);
  console.log(`Pool: ${manifest.length} PDFs in ${OUT_DIR}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
