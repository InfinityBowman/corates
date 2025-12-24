/**
 * QR Code component using Ark UI
 */

import { QrCode } from '@ark-ui/solid/qr-code';
import { Component } from 'solid-js';

export interface QRCodeProps {
  /** The data to encode in the QR code (e.g., URL, text) */
  data: string;
  /** Size of the QR code in pixels (default: 200) */
  size?: number;
  /** Additional CSS classes */
  class?: string;
  /** Alt text for accessibility (default: 'QR Code') */
  alt?: string;
  /** Error correction level (L=7%, M=15%, Q=25%, H=30%) (default: 'M') */
  ecc?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * QR Code component
 * Renders an SVG-based QR code with customizable error correction and styling.
 */
const QRCodeComponent: Component<QRCodeProps> = (props) => {
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
};

export { QRCodeComponent as QRCode };
export default QRCodeComponent;
