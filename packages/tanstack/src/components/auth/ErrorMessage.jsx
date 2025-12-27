import { AnimatedShow } from '../AnimatedShow.jsx'

export default function ErrorMessage(props) {
  return (
    <AnimatedShow when={!!props.displayError()}>
      <div class="mt-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 sm:text-sm">
        {props.displayError()}
      </div>
    </AnimatedShow>
  )
}
