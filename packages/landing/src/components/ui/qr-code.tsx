/**
 * QRCode component for generating QR codes (@ark-ui/react)
 *
 * @example
 * <QRCode value="https://example.com">
 *   <QRCodeFrame>
 *     <QRCodePattern />
 *   </QRCodeFrame>
 * </QRCode>
 *
 * @example
 * <QRCode value={totpUri} pixelSize={192}>
 *   <QRCodeFrame><QRCodePattern /></QRCodeFrame>
 *   <QRCodeDownloadTrigger fileName="qr-code.png" mimeType="image/png">
 *     Download QR Code
 *   </QRCodeDownloadTrigger>
 * </QRCode>
 */

import * as React from "react"
import { QrCode as QrCodePrimitive } from "@ark-ui/react/qr-code"
import { cn } from "@/lib/utils"

const QRCodeContext = QrCodePrimitive.Context

function QRCode({ className, ...props }: React.ComponentProps<typeof QrCodePrimitive.Root>) {
  return (
    <QrCodePrimitive.Root className={cn("inline-flex flex-col items-center", className)} {...props} />
  )
}

function QRCodeFrame({ className, ...props }: React.ComponentProps<typeof QrCodePrimitive.Frame>) {
  return <QrCodePrimitive.Frame className={className} {...props} />
}

function QRCodePattern({ className, ...props }: React.ComponentProps<typeof QrCodePrimitive.Pattern>) {
  return <QrCodePrimitive.Pattern className={className} {...props} />
}

function QRCodeOverlay({ className, ...props }: React.ComponentProps<typeof QrCodePrimitive.Overlay>) {
  return (
    <QrCodePrimitive.Overlay
      className={cn("absolute inset-0 flex items-center justify-center", className)}
      {...props}
    />
  )
}

function QRCodeDownloadTrigger({
  className,
  ...props
}: React.ComponentProps<typeof QrCodePrimitive.DownloadTrigger>) {
  return (
    <QrCodePrimitive.DownloadTrigger
      className={cn(
        "mt-2 rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground transition-colors",
        "hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring",
        className,
      )}
      {...props}
    />
  )
}

export { QRCode, QRCodeFrame, QRCodePattern, QRCodeOverlay, QRCodeDownloadTrigger, QRCodeContext }
