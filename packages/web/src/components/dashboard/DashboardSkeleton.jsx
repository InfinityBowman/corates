/**
 * DashboardSkeleton - Loading skeleton for dashboard
 */

/**
 * Pulsing skeleton bar
 */
function SkeletonBar(props) {
  return (
    <div class={`animate-pulse rounded bg-stone-200 ${props.class || ''}`} style={props.style} />
  );
}

/**
 * Skeleton for stat cards
 */
function StatCardSkeleton() {
  return (
    <div class='rounded-xl border border-stone-200/60 bg-white p-5'>
      <div class='flex items-start justify-between'>
        <div>
          <SkeletonBar class='mb-2 h-3 w-20' />
          <SkeletonBar class='h-8 w-16' />
        </div>
        <SkeletonBar class='h-10 w-10 rounded-xl' />
      </div>
      <SkeletonBar class='mt-3 h-3 w-24' />
    </div>
  );
}

/**
 * Skeleton for progress card
 */
function ProgressCardSkeleton() {
  return (
    <div class='flex flex-col items-center rounded-xl border border-stone-200/60 bg-white p-6'>
      <SkeletonBar class='mb-4 h-4 w-24' />
      <SkeletonBar class='mb-4 h-32 w-32 rounded-full' />
      <div class='flex gap-4'>
        <SkeletonBar class='h-3 w-16' />
        <SkeletonBar class='h-3 w-20' />
      </div>
    </div>
  );
}

/**
 * Skeleton for quick action card
 */
function QuickActionSkeleton() {
  return (
    <div class='flex items-center gap-4 rounded-xl border border-stone-200/60 bg-white p-4'>
      <SkeletonBar class='h-12 w-12 shrink-0 rounded-xl' />
      <div class='flex-1'>
        <SkeletonBar class='mb-2 h-4 w-24' />
        <SkeletonBar class='h-3 w-40' />
      </div>
    </div>
  );
}

/**
 * Skeleton for activity item
 */
function ActivityItemSkeleton() {
  return (
    <div class='flex items-start gap-3 py-3'>
      <SkeletonBar class='h-8 w-8 shrink-0 rounded-full' />
      <div class='flex-1'>
        <SkeletonBar class='mb-1 h-4 w-48' />
        <SkeletonBar class='h-3 w-16' />
      </div>
    </div>
  );
}

/**
 * Full dashboard skeleton
 */
export function DashboardSkeleton() {
  return (
    <div class='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
      {/* Header skeleton */}
      <div class='mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <SkeletonBar class='mb-2 h-8 w-48' />
          <SkeletonBar class='h-4 w-32' />
        </div>
        <SkeletonBar class='h-10 w-36 rounded-lg' />
      </div>

      {/* Stats row skeleton */}
      <div class='mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4'>
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Main content grid skeleton */}
      <div class='grid gap-6 lg:grid-cols-3'>
        {/* Left column */}
        <div class='space-y-6 lg:col-span-2'>
          {/* Projects section */}
          <div class='rounded-xl border border-stone-200/60 bg-white p-5'>
            <SkeletonBar class='mb-4 h-5 w-32' />
            <div class='space-y-3'>
              <SkeletonBar class='h-20 w-full rounded-lg' />
              <SkeletonBar class='h-20 w-full rounded-lg' />
              <SkeletonBar class='h-20 w-full rounded-lg' />
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div class='space-y-6'>
          <ProgressCardSkeleton />

          {/* Quick actions skeleton */}
          <div>
            <SkeletonBar class='mb-4 h-4 w-24' />
            <div class='space-y-3'>
              <QuickActionSkeleton />
              <QuickActionSkeleton />
              <QuickActionSkeleton />
            </div>
          </div>

          {/* Activity feed skeleton */}
          <div class='rounded-xl border border-stone-200/60 bg-white p-5'>
            <SkeletonBar class='mb-4 h-4 w-28' />
            <div class='divide-y divide-stone-100'>
              <ActivityItemSkeleton />
              <ActivityItemSkeleton />
              <ActivityItemSkeleton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardSkeleton;
