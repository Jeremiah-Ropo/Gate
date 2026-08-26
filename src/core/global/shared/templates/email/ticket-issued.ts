export const ticketIssuedTemplate = (data: { name: string; eventName: string; qrCodeUrl: string }): string => `
  <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
    <h2>You're in, ${data.name}!</h2>
    <p>Your ticket for <strong>${data.eventName}</strong> is ready. Show this QR code at the door.</p>
    <img src="${data.qrCodeUrl}" alt="Ticket QR code" width="220" height="220" />
  </div>
`;
