import QRCode from "qrcode";

export const generateQrCodeDataUrl = async (payload: string): Promise<string> => {
  return QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 2 });
};
