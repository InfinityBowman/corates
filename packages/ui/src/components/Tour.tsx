/**
 * Tour component - Keeping Zag.js implementation for now
 * Ark UI Tour has a different API structure that requires significant refactoring.
 * This component is not currently used in the codebase, so migration can be deferred.
 */

import * as tour from '@zag-js/tour';
import { Portal } from 'solid-js/web';
import { normalizeProps, useMachine } from '@zag-js/solid';
import {
  Component,
  createMemo,
  createUniqueId,
  For,
  Show,
  splitProps,
  createContext,
  useContext,
  Accessor,
  JSX,
} from 'solid-js';
import { FiX } from 'solid-icons/fi';
import { Z_INDEX } from '../constants/zIndex';

export type Placement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end'
  | 'right'
  | 'right-start'
  | 'right-end';

export interface TourStepAction {
  label: string;
  action: 'next' | 'prev' | 'dismiss';
}

export interface TourStep {
  /** Unique step identifier */
  id: string;
  /** Step type */
  type: 'tooltip' | 'dialog' | 'floating' | 'wait';
  /** Step title */
  title: string;
  /** Step description */
  description: string;
  /** Target element for tooltip steps */
  target?: () => Element | null;
  /** Tooltip placement */
  placement?: Placement;
  /** Step actions */
  actions?: TourStepAction[];
  /** Show backdrop (default: true) */
  backdrop?: boolean;
  /** Show arrow for tooltips (default: true) */
  arrow?: boolean;
  /** Side effect before showing step */
  effect?: (_ctx: {
    next: () => void;
    show: () => void;
    update: () => void;
  }) => void | (() => void);
}

export interface TourApi {
  /** Whether tour is open */
  open: boolean;
  /** Current step */
  step: TourStep | null;
  /** Start the tour */
  start: () => void;
  /** Stop the tour */
  stop: () => void;
  /** Go to next step */
  next: () => void;
  /** Go to previous step */
  prev: () => void;
  /** Get progress text */
  getProgressText: () => string;
  /** Get backdrop props */
  getBackdropProps: () => Record<string, unknown>;
  /** Get spotlight props */
  getSpotlightProps: () => Record<string, unknown>;
  /** Get positioner props */
  getPositionerProps: () => Record<string, unknown>;
  /** Get content props */
  getContentProps: () => Record<string, unknown>;
  /** Get arrow props */
  getArrowProps: () => Record<string, unknown>;
  /** Get arrow tip props */
  getArrowTipProps: () => Record<string, unknown>;
  /** Get title props */
  getTitleProps: () => Record<string, unknown>;
  /** Get description props */
  getDescriptionProps: () => Record<string, unknown>;
  /** Get progress text props */
  getProgressTextProps: () => Record<string, unknown>;
  /** Get action trigger props */
  getActionTriggerProps: (_options: { action: TourStepAction }) => Record<string, unknown>;
  /** Get close trigger props */
  getCloseTriggerProps: () => Record<string, unknown>;
}

// Context for providing tour API to children
const TourContext = createContext<Accessor<TourApi>>();

/**
 * useTour - Hook to access tour API from TourProvider context
 */
export function useTour(): Accessor<TourApi> {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}

export interface TourProviderProps {
  /** Tour steps configuration */
  steps: TourStep[];
  /** Callback when step changes */
  onStepChange?: (_details: { stepId: string; stepIndex: number }) => void;
  /** Callback when tour status changes */
  onStatusChange?: (_details: { status: 'started' | 'stopped' | 'completed' | 'skipped' }) => void;
  /** Close on outside click (default: true) */
  closeOnInteractOutside?: boolean;
  /** Close on escape key (default: true) */
  closeOnEscape?: boolean;
  /** Allow arrow key navigation (default: true) */
  keyboardNavigation?: boolean;
  /** Prevent page interaction during tour */
  preventInteraction?: boolean;
  /** Spotlight padding offset */
  spotlightOffset?: { x: number; y: number };
  /** Spotlight border radius */
  spotlightRadius?: number;
  /** Child components */
  children: JSX.Element;
}

/**
 * TourProvider - Provides tour functionality to children
 */
export const TourProvider: Component<TourProviderProps> = props => {
  const [local, machineProps] = splitProps(props, ['children']);

  const service = useMachine(tour.machine, () => ({
    id: createUniqueId(),
    closeOnInteractOutside: true,
    closeOnEscape: true,
    keyboardNavigation: true,
    ...machineProps,
  }) as Parameters<typeof useMachine<typeof tour.machine>>[1] extends (..._args: any[]) => infer R ? R : never);

  const api = createMemo(() => tour.connect(service, normalizeProps) as unknown as TourApi);

  return (
    <TourContext.Provider value={api}>
      {local.children}

      <Show when={api().open && api().step}>
        <Portal>
          <Show when={api().step?.backdrop !== false}>
            <div
              {...api().getBackdropProps()}
              class={`fixed inset-0 ${Z_INDEX.TOUR_BACKDROP} bg-black/50 transition-opacity`}
            />
          </Show>

          <Show when={api().step?.type === 'tooltip' && api().step?.target}>
            <div {...api().getSpotlightProps()} class={Z_INDEX.TOUR_SPOTLIGHT} />
          </Show>

          <div
            {...api().getPositionerProps()}
            class={`${Z_INDEX.TOUR_CONTENT} ${api().step?.type === 'dialog' ? 'fixed inset-0 flex items-center justify-center p-4' : ''}`}
          >
            <div
              {...api().getContentProps()}
              class={`rounded-lg bg-white shadow-xl ${api().step?.type === 'dialog' ? 'w-full max-w-md' : 'max-w-sm'}`}
            >
              <Show when={api().step?.arrow !== false && api().step?.type === 'tooltip'}>
                <div
                  {...api().getArrowProps()}
                  class='[--arrow-background:white] [--arrow-size:8px]'
                >
                  <div {...api().getArrowTipProps()} />
                </div>
              </Show>

              <div class='p-4'>
                <div class='mb-2 flex items-start justify-between'>
                  <h3 {...api().getTitleProps()} class='text-lg font-semibold text-gray-900'>
                    {api().step?.title}
                  </h3>
                  <button
                    {...api().getCloseTriggerProps()}
                    class='-mt-1 -mr-1 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500'
                  >
                    <FiX class='h-4 w-4' />
                  </button>
                </div>

                <div {...api().getDescriptionProps()} class='mb-4 text-sm text-gray-600'>
                  {api().step?.description}
                </div>

                <div class='flex items-center justify-between'>
                  <span {...api().getProgressTextProps()} class='text-xs text-gray-500'>
                    {api().getProgressText()}
                  </span>

                  <div class='flex items-center gap-2'>
                    <For each={api().step?.actions}>
                      {action => (
                        <button
                          {...api().getActionTriggerProps({ action })}
                          class={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                            action.action === 'next' || action.action === 'dismiss' ?
                              'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {action.label}
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      </Show>
    </TourContext.Provider>
  );
};

export interface TourProps extends Omit<TourProviderProps, 'children'> {
  /** Render function for trigger */
  renderTrigger?: (_api: Accessor<TourApi>) => JSX.Element;
}

/**
 * Tour - Standalone tour component (alternative to TourProvider)
 */
const TourComponent: Component<TourProps> = props => {
  const [local, rest] = splitProps(props, ['renderTrigger']);

  return (
    <TourProvider {...rest}>
      <TourContent renderTrigger={local.renderTrigger} />
    </TourProvider>
  );
};

function TourContent(props: { renderTrigger?: (_api: Accessor<TourApi>) => JSX.Element }) {
  const api = useTour();

  return <Show when={props.renderTrigger}>{props.renderTrigger?.(api)}</Show>;
}

export { TourComponent as Tour };
