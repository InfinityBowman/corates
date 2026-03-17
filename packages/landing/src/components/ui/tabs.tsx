'use client';

import * as React from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot='tabs' className={className} {...props} />;
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot='tabs-list'
      className={cn('flex items-center', className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot='tabs-trigger'
      className={cn(
        'inline-flex items-center px-4 py-3 text-sm font-medium whitespace-nowrap',
        'transition-colors',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

function TabsIndicator({ className }: { className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const indicator = ref.current;
    if (!indicator) return;
    const list = indicator.closest('[data-slot="tabs-list"]');
    if (!list) return;

    function update() {
      const active = list!.querySelector<HTMLElement>('[data-state="active"]');
      if (!active || !indicator) return;
      const listRect = list!.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      indicator.style.left = `${activeRect.left - listRect.left}px`;
      indicator.style.width = `${activeRect.width}px`;
    }

    update();

    const observer = new MutationObserver(update);
    observer.observe(list, { attributes: true, subtree: true, attributeFilter: ['data-state'] });

    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn('absolute bottom-0', className)}
      style={{ transition: 'left 200ms ease-out, width 200ms ease-out' }}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot='tabs-content'
      className={cn(
        'mt-2',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsIndicator, TabsContent };
