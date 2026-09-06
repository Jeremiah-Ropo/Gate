import { useEffect, useRef } from "react";
import QRCode from "qrcode";

// Renders client-side so a ticket's qrPayload never leaves the browser to a third-party
// QR-generation service — it's the credential the door scanner trusts.
export function QrCode({ value, size = 176 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, value, { width: size, margin: 1 }).catch(() => {
      // Nothing sensible to show inline if rendering fails; the raw payload text below
      // still lets the ticket be validated manually.
    });
  }, [value, size]);

  return <canvas ref={canvasRef} width={size} height={size} className="rounded-md" />;
}
