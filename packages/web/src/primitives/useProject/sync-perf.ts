const ENABLED = import.meta.env.DEV;

let cycleStart = 0;
const counts: Record<string, number> = {
  handleReviewsEvents: 0,
  buildStudy: 0,
  serialize: 0,
  serializeCacheHit: 0,
  doSync: 0,
  atomFired: 0,
  atomSuppressed: 0,
};
let buildStudyMs = 0;

let flushScheduled = false;

function flush(): void {
  const elapsed = performance.now() - cycleStart;
  const parts = [
    `handleReviewsEvents=${counts.handleReviewsEvents}`,
    `buildStudy=${counts.buildStudy}(${buildStudyMs.toFixed(1)}ms)`,
    `serialize=${counts.serialize}(hit=${counts.serializeCacheHit})`,
    `doSync=${counts.doSync}`,
    `atomFired=${counts.atomFired}`,
    `atomSuppressed=${counts.atomSuppressed}`,
  ];
  console.log(`[perf] edit cycle: ${parts.join(' ')} (${elapsed.toFixed(1)}ms)`);

  for (const key of Object.keys(counts)) {
    counts[key] = 0;
  }
  buildStudyMs = 0;
  flushScheduled = false;
}

function scheduleFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;
  requestAnimationFrame(() => {
    requestAnimationFrame(flush);
  });
}

export function markCycleStart(): void {
  if (!ENABLED) return;
  if (!flushScheduled) {
    cycleStart = performance.now();
  }
  scheduleFlush();
}

export function countProbe(name: keyof typeof counts): void {
  if (!ENABLED) return;
  counts[name] += 1;
}

export function addBuildStudyTime(ms: number): void {
  if (!ENABLED) return;
  buildStudyMs += ms;
}
