export const checkInAlertTemplate = (data: { name: string; eventName: string; scannedAt: string }): string => `
  <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
    <h2>Checked in!</h2>
    <p>${data.name} was checked in to <strong>${data.eventName}</strong> at ${data.scannedAt}.</p>
  </div>
`;
