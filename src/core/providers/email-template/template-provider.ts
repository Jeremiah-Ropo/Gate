import {
  checkInAlertTemplate,
  emailVerificationTemplate,
  ticketIssuedTemplate,
} from "core/global/shared/templates/email";

const renderers: Record<string, (data: any) => string> = {
  "email-verification": emailVerificationTemplate,
  "ticket-issued": ticketIssuedTemplate,
  "check-in-alert": checkInAlertTemplate,
};

const subjects: Record<string, string> = {
  "email-verification": "Verify your email",
  "ticket-issued": "Your ticket is ready",
  "check-in-alert": "Check-in confirmed",
};

class EmailTemplateProvider {
  render(type: string, data: any): string {
    const renderer = renderers[type];
    if (!renderer) {
      throw new Error(`No email template registered for type: ${type}`);
    }
    return renderer(data);
  }

  subjectFor(type: string): string {
    return subjects[type] || "Notification from Gate";
  }
}

export default new EmailTemplateProvider();
