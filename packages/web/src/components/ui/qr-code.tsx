/**
 * QRCode component for generating QR codes.
 *
 * @example
 * // Basic usage
 * <QRCode value="https://example.com">
 *   <QRCodeFrame>
 *     <QRCodePattern />
 *   </QRCodeFrame>
 * </QRCode>
 *
 * @example
 * // With download button
 * <QRCode value={totpUri()} pixelSize={192}>
 *   <QRCodeFrame>
 *     <QRCodePattern />
 *   </QRCodeFrame>
 *   <QRCodeDownloadTrigger fileName="qr-code.png" mimeType="image/png">
 *     Download QR Code
 *   </QRCodeDownloadTrigger>
 * </QRCode>
 *
 * @example
 * // With overlay (logo in center)
 * <QRCode value="https://example.com">
 *   <QRCodeFrame>
 *     <QRCodePattern />
 *   </QRCodeFrame>
 *   <QRCodeOverlay>
 *     <img src="/logo.png" alt="Logo" />
 *   </QRCodeOverlay>
 * </QRCode>
 */
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { QrCode as QrCodePrimitive } from '@ark-ui/solid/qr-code';
import type {
  QrCodeRootProps as ArkQrCodeRootProps,
  QrCodeFrameProps as ArkQrCodeFrameProps,
  QrCodePatternProps as ArkQrCodePatternProps,
  QrCodeOverlayProps as ArkQrCodeOverlayProps,
  QrCodeDownloadTriggerProps as ArkQrCodeDownloadTriggerProps,
} from '@ark-ui/solid/qr-code';
import { cn } from './cn';

// Re-export primitives directly
const QRCodeContext = QrCodePrimitive.Context;

type QRCodeProps = ArkQrCodeRootProps & {
  class?: string;
  children?: JSX.Element;
};

const QRCode: Component<QRCodeProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <QrCodePrimitive.Root class={cn('inline-flex flex-col items-center', local.class)} {...others}>
      {local.children}
    </QrCodePrimitive.Root>
  );
};

type QRCodeFrameProps = ArkQrCodeFrameProps & {
  class?: string;
  children?: JSX.Element;
};

const QRCodeFrame: Component<QRCodeFrameProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <QrCodePrimitive.Frame class={cn('', local.class)} {...others}>
      {local.children}
    </QrCodePrimitive.Frame>
  );
};

type QRCodePatternProps = ArkQrCodePatternProps & {
  class?: string;
};

const QRCodePattern: Component<QRCodePatternProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return <QrCodePrimitive.Pattern class={cn('', local.class)} {...others} />;
};

type QRCodeOverlayProps = ArkQrCodeOverlayProps & {
  class?: string;
  children?: JSX.Element;
};

const QRCodeOverlay: Component<QRCodeOverlayProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <QrCodePrimitive.Overlay
      class={cn('absolute inset-0 flex items-center justify-center', local.class)}
      {...others}
    >
      {local.children}
    </QrCodePrimitive.Overlay>
  );
};

type QRCodeDownloadTriggerProps = ArkQrCodeDownloadTriggerProps & {
  class?: string;
  children?: JSX.Element;
};

const QRCodeDownloadTrigger: Component<QRCodeDownloadTriggerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <QrCodePrimitive.DownloadTrigger
      class={cn(
        'bg-secondary text-secondary-foreground mt-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
        'hover:bg-secondary/80 focus:ring-primary focus:ring-2 focus:outline-none',
        local.class,
      )}
      {...others}
    >
      {local.children}
    </QrCodePrimitive.DownloadTrigger>
  );
};

export { QRCode, QRCodeFrame, QRCodePattern, QRCodeOverlay, QRCodeDownloadTrigger, QRCodeContext };
