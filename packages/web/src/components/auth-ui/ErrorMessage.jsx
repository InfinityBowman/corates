import { AnimatedShow } from '../AnimatedShow.jsx';

export default function ErrorMessage(props) {
  return (
    <AnimatedShow when={!!props.displayError()}>
      <div class='py-1 px-2 mt-1 text-red-600 text-xs sm:text-sm bg-red-50 border border-red-200 rounded-lg'>
        {props.displayError()}
      </div>
    </AnimatedShow>
  );
}
