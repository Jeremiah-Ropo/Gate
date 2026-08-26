import nodemailer, { Transporter } from "nodemailer";

import { mailer } from "core/global/config";
import logger from "core/global/utils/logger";
import { IEmailProvider, ISendMailOptions } from "./interface";

class NodemailerProvider implements IEmailProvider {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: mailer.SERVICE,
      host: mailer.HOST,
      port: Number(mailer.PORT),
      secure: mailer.SECURE,
      auth: {
        user: mailer.GATE_NOREPLY,
        pass: mailer.GATE_NOREPLY_PASSWORD,
      },
    });
  }

  async send(options: ISendMailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: mailer.GATE_NOREPLY,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
    } catch (error) {
      logger.error(`[Mailer] Failed to send email to ${options.to}: ${error}`);
      throw error;
    }
  }
}

export default new NodemailerProvider();
