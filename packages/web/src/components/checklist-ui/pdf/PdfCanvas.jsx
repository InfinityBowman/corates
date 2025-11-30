/**
 * PdfCanvas - Canvas component for rendering PDF pages
 * Displays the PDF content with a loading overlay during rendering
 */

import { Show } from 'solid-js';

export default function PdfCanvas(props) {
  // props.canvasRef - Ref setter for the canvas element
  // props.rendering - Whether a page is currently being rendered

  return (
    <div class='flex justify-center relative'>
      <Show when={props.rendering}>
        <div class='absolute inset-0 flex items-center justify-center bg-white/50'>
          <div class='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600'></div>
        </div>
      </Show>
      <canvas
        ref={props.canvasRef}
        class='shadow-lg bg-white'
        style={{ 'max-width': '100%', height: 'auto' }}
      />
    </div>
  );
}
