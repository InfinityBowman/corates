/**
 * Tour component - Keeping Zag.js implementation for now
 * Ark UI Tour has a different API structure that requires significant refactoring.
 * This component is not currently used in the codebase, so migration can be deferred.
 */

import * as tour from '@zag-js/tour';
import { Portal } from 'solid-js/web';
import { normalizeProps, useMachine } from '@zag-js/solid';
import {
  createMemo,
  createUniqueId,
  For,
  Show,
  splitProps,
  createContext,
  useContext,
} from 'solid-js';
import { FiX } from 'solid-icons/fi';
import { Z_INDEX } from '../constants/zIndex.js';

// Context for providing tour API to children
const TourContext = createContext();

/**
 * useTour - Hook to access tour API from TourProvider context
 */
export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}

/**
 * TourProvider - Provides tour functionality to children
 *
 * Props:
 * - steps: Array<StepDetails> - Tour steps configuration
 * - onStepChange: (details: StepChangeDetails) => void - Callback when step changes
 * - onStatusChange: (details: StatusChangeDetails) => void - Callback when tour status changes
 * - closeOnInteractOutside: boolean - Close on outside click (default: true)
 * - closeOnEscape: boolean - Close on escape key (default: true)
 * - keyboardNavigation: boolean - Allow arrow key navigation (default: true)
 * - preventInteraction: boolean - Prevent page interaction during tour
 * - spotlightOffset: { x: number, y: number } - Spotlight padding offset
 * - spotlightRadius: number - Spotlight border radius
 * - children: JSX.Element - Child components
 *
 * StepDetails:
 * - id: string - Unique step identifier
 * - type: 'tooltip' | 'dialog' | 'floating' | 'wait' - Step type
 * - title: string - Step title
 * - description: string - Step description
 * - target: () => Element - Target element for tooltip steps
 * - placement: Placement - Tooltip placement
 * - actions: Array<{ label: string, action: 'next' | 'prev' | 'dismiss' }> - Step actions
 * - backdrop: boolean - Show backdrop (default: true)
 * - arrow: boolean - Show arrow for tooltips (default: true)
 * - effect: (ctx: { next, show, update }) => void | (() => void) - Side effect before showing step
 */
export function TourProvider(props) {
  const [local, machineProps] = splitProps(props, ['children']);

  const service = useMachine(tour.machine, () => ({
    id: createUniqueId(),
    closeOnInteractOutside: true,
    closeOnEscape: true,
    keyboardNavigation: true,
    ...machineProps,
  }));

  const api = createMemo(() => tour.connect(service, normalizeProps));

  return (
    <TourContext.Provider value={api}>
      {local.children}

      <Show when={api().open && api().step}>
        <Portal>
          <Show when={api().step.backdrop !== false}>
            <div
              {...api().getBackdropProps()}
              class={`fixed inset-0 ${Z_INDEX.TOUR_BACKDROP} bg-black/50 transition-opacity`}
            />
          </Show>

          <Show when={api().step.type === 'tooltip' && api().step.target}>
            <div {...api().getSpotlightProps()} class={Z_INDEX.TOUR_SPOTLIGHT} />
          </Show>

          <div
            {...api().getPositionerProps()}
            class={`${Z_INDEX.TOUR_CONTENT} ${api().step.type === 'dialog' ? 'fixed inset-0 flex items-center justify-center p-4' : ''}`}
          >
            <div
              {...api().getContentProps()}
              class={`rounded-lg bg-white shadow-xl ${api().step.type === 'dialog' ? 'w-full max-w-md' : 'max-w-sm'}`}
            >
              <Show when={api().step.arrow !== false && api().step.type === 'tooltip'}>
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
                    {api().step.title}
                  </h3>
                  <button
                    {...api().getCloseTriggerProps()}
                    class='-mt-1 -mr-1 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500'
                  >
                    <FiX class='h-4 w-4' />
                  </button>
                </div>

                <div {...api().getDescriptionProps()} class='mb-4 text-sm text-gray-600'>
                  {api().step.description}
                </div>

                <div class='flex items-center justify-between'>
                  <span {...api().getProgressTextProps()} class='text-xs text-gray-500'>
                    {api().getProgressText()}
                  </span>

                  <div class='flex items-center gap-2'>
                    <For each={api().step.actions}>
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
}

/**
 * Tour - Standalone tour component (alternative to TourProvider)
 *
 * Props:
 * - Same as TourProvider
 * - renderTrigger: (api: TourApi) => JSX.Element - Render function for trigger
 */
export default function TourComponent(props) {
  const [local, rest] = splitProps(props, ['renderTrigger']);

  return (
    <TourProvider {...rest}>
      <TourContent renderTrigger={local.renderTrigger} />
    </TourProvider>
  );
}

function TourContent(props) {
  const api = useTour();

  return <Show when={props.renderTrigger}>{props.renderTrigger(api)}</Show>;
}

export { TourComponent as Tour };
