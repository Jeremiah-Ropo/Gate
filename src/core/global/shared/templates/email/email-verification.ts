export const emailVerificationTemplate = (data: { name: string; link: string }): string => `
  <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
    <h2>Hi ${data.name},</h2>
    <p>Confirm your email to start using Gate.</p>
    <p><a href="${data.link}" style="background:#111;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Verify email</a></p>
  </div>
`;
