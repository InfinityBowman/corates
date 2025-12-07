import { createMemo, createUniqueId, createEffect } from 'solid-js';
import * as qrCode from '@zag-js/qr-code';
import { useMachine, normalizeProps } from '@zag-js/solid';

/**
 * QR Code component using Zag.js
 * Renders an SVG-based QR code with customizable error correction and styling.
 *
 * @param {Object} props
 * @param {string} props.data - The data to encode in the QR code (e.g., URL, text)
 * @param {number} [props.size=200] - Size of the QR code in pixels
 * @param {string} [props.class] - Additional CSS classes
 * @param {string} [props.alt='QR Code'] - Alt text for accessibility
 * @param {'L'|'M'|'Q'|'H'} [props.ecc='M'] - Error correction level (L=7%, M=15%, Q=25%, H=30%)
 */
export default function QRCode(props) {
  const data = () => props.data;
  const ecc = () => props.ecc;
  const size = () => props.size;
  const classValue = () => props.class;
  const alt = () => props.alt;

  const service = useMachine(qrCode.machine, {
    id: createUniqueId(),
    // eslint-disable-next-line solid/reactivity
    value: data(),
    encoding: {
      // eslint-disable-next-line solid/reactivity
      ecc: ecc() || 'M',
    },
  });

  const api = createMemo(() => qrCode.connect(service, normalizeProps));

  createEffect(() => {
    const currentData = data();
    if (currentData) {
      api().setValue(currentData);
    }
  });

  const containerSize = () => size() || 200;

  return (
    <div
      {...api().getRootProps()}
      class={classValue()}
      style={{
        width: `${containerSize()}px`,
        height: `${containerSize()}px`,
      }}
      role='img'
      aria-label={alt() || 'QR Code'}
    >
      <svg {...api().getFrameProps()}>
        <path {...api().getPatternProps()} />
      </svg>
    </div>
  );
}
