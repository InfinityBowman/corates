import { createSignal, onCleanup, onMount } from 'solid-js';

/**
 * Primitive to detect when files are being dragged over the window
 * Useful for showing a global drop indicator when dragging from external sources (like Finder)
 *
 * @returns {{ isDraggingOverWindow: () => boolean }}
 */
export function useWindowDrag() {
  const [isDraggingOverWindow, setIsDraggingOverWindow] = createSignal(false);
  let dragCounter = 0;

  onMount(() => {
    const handleDragEnter = e => {
      // Only respond to file drags
      if (e.dataTransfer?.types?.includes('Files')) {
        dragCounter++;
        setIsDraggingOverWindow(true);
      }
    };

    const handleDragLeave = () => {
      dragCounter--;
      if (dragCounter === 0) {
        setIsDraggingOverWindow(false);
      }
    };

    const handleDrop = () => {
      dragCounter = 0;
      // Delay state update to avoid interfering with drop handlers
      setTimeout(() => setIsDraggingOverWindow(false), 50);
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop, true);

    onCleanup(() => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop, true);
    });
  });

  return { isDraggingOverWindow };
}
