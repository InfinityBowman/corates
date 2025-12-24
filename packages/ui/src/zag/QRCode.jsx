/**
 * QR Code component using Ark UI
 */

import { QrCode } from '@ark-ui/solid/qr-code';

/**
 * QR Code component
 * Renders an SVG-based QR code with customizable error correction and styling.
 *
 * @param {Object} props
 * @param {string} props.data - The data to encode in the QR code (e.g., URL, text)
 * @param {number} [props.size=200] - Size of the QR code in pixels
 * @param {string} [props.class] - Additional CSS classes
 * @param {string} [props.alt='QR Code'] - Alt text for accessibility
 * @param {'L'|'M'|'Q'|'H'} [props.ecc='M'] - Error correction level (L=7%, M=15%, Q=25%, H=30%)
 */
export default function QRCodeComponent(props) {
  const data = () => props.data;
  const ecc = () => props.ecc;
  const size = () => props.size;
  const classValue = () => props.class;
  const alt = () => props.alt;

  // Map data to value for Ark UI compatibility
  const value = () => data();
  const pixelSize = () => size() || 200;

  const containerSize = () => size() || 200;

  return (
    <QrCode.Root
      value={value()}
      pixelSize={pixelSize()}
      encoding={{
        ecc: ecc() || 'M',
      }}
      class={classValue()}
      style={{
        width: `${containerSize()}px`,
        height: `${containerSize()}px`,
      }}
      role='img'
      aria-label={alt() || 'QR Code'}
    >
      <QrCode.Frame>
        <QrCode.Pattern />
      </QrCode.Frame>
    </QrCode.Root>
  );
}
