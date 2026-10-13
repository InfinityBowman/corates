/**
 * ProjectSyncingScreen - what fills the project view while the workspace syncs.
 * A grid of appraisal domains builds in, then a crest runs down the diagonal it
 * filled on and keeps running until the project is ready. Motion is CSS only;
 * the keyframes live in styles.css next to the reduced-motion rule.
 */

const ROWS = 5;
const COLUMNS = 5;

/** Per-column tints off the monochrome blue ramp, so the grid reads as a set of
 *  domains rather than one gradient. The crest lifts every column to --chart-1. */
const TINT = [
  'var(--chart-4)',
  'var(--chart-3)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-2)',
];

/** The grid fills on the diagonal, so a cell's build and its place in the wave
 *  both key off row-plus-column. */
const BUILD_STAGGER_MS = 80;
const BUILD_START_MS = 70;
/** Long enough that the grid is visibly settled before the first crest. */
const WAVE_START_MS = 1500;
/** The crest crosses the grid in half a hold. */
const WAVE_SWEEP_MS = 1600;
const MAX_DIAGONAL = ROWS + COLUMNS - 2;

export function ProjectSyncingScreen() {
  return (
    <div
      className='flex min-h-[70vh] flex-col items-center justify-center gap-9'
      role='status'
      aria-live='polite'
    >
      <div className='grid w-52 grid-cols-5 gap-2' aria-hidden='true'>
        {Array.from({ length: ROWS * COLUMNS }, (_, i) => {
          const row = Math.floor(i / COLUMNS);
          const column = i % COLUMNS;
          const diagonal = row + column;
          return (
            <span
              key={i}
              className='sync-cell bg-muted aspect-square rounded-[3px]'
              style={
                {
                  '--sync-tint': TINT[column],
                  '--sync-build-delay': `${BUILD_START_MS + diagonal * BUILD_STAGGER_MS}ms`,
                  '--sync-wave-delay': `${WAVE_START_MS + (diagonal / MAX_DIAGONAL) * WAVE_SWEEP_MS}ms`,
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>

      <p className='text-muted-foreground flex items-center gap-2 text-sm'>
        Syncing your project
        <span className='flex items-center gap-1' aria-hidden='true'>
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className='sync-dot size-[3px] rounded-full bg-current'
              style={{ '--sync-dot-delay': `${i * 200}ms` } as React.CSSProperties}
            />
          ))}
        </span>
      </p>
    </div>
  );
}
