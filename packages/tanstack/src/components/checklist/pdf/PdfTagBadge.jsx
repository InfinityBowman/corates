/**
 * PdfTagBadge - Visual badge indicating PDF tag type
 *
 * Tags:
 * - primary: Blue badge with star icon - main publication
 * - protocol: Purple badge with document icon - study protocol
 * - secondary: No badge displayed (implied default)
 */

import { Show } from 'solid-js'
import { AiFillStar } from 'solid-icons/ai'
import { HiOutlineDocumentText } from 'solid-icons/hi'

export default function PdfTagBadge(props) {
  // props.tag: 'primary' | 'protocol' | 'secondary'

  return (
    <Show when={props.tag === 'primary' || props.tag === 'protocol'}>
      <span
        class={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
          props.tag === 'primary'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-purple-100 text-purple-700'
        }`}
      >
        <Show when={props.tag === 'primary'}>
          <AiFillStar class="h-3 w-3" />
          <span>Primary</span>
        </Show>
        <Show when={props.tag === 'protocol'}>
          <HiOutlineDocumentText class="h-3 w-3" />
          <span>Protocol</span>
        </Show>
      </span>
    </Show>
  )
}
