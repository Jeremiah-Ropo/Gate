export interface ISendMailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface IEmailProvider {
  send(options: ISendMailOptions): Promise<void>;
}
