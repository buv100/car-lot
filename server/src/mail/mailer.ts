import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/** Sends one plain-text letter. The business code never imports Resend itself. */
export interface Mailer {
  send(input: { to: string; subject: string; text: string }): Promise<void>;
}

/** Writes the letter under tmp/mail and does not contact a provider. */
export class LogMailer implements Mailer {
  constructor(private readonly directory: string) {}

  async send(input: { to: string; subject: string; text: string }): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const file = path.join(this.directory, `${String(Date.now())}-${randomUUID()}.txt`);
    await writeFile(file, `To: ${input.to}\nSubject: ${input.subject}\n\n${input.text}\n`, "utf8");
  }
}

/** Resend HTTPS API. A non-2xx response fails the letter without echoing the key. */
export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(input: { to: string; subject: string; text: string }): Promise<void> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
      }),
    });
    if (!response.ok) throw new Error(`Resend returned ${String(response.status)}`);
  }
}

/** Records letters in memory so tests can replace Resend. */
export class CollectingMailer implements Mailer {
  readonly sent: { to: string; subject: string; text: string }[] = [];

  send(input: { to: string; subject: string; text: string }): Promise<void> {
    this.sent.push({ to: input.to, subject: input.subject, text: input.text });
    return Promise.resolve();
  }
}

/** `log` is the default. `resend` is chosen only after boot has checked the key and from-address. */
export function mailerFromEnv(
  directory: string,
  env: { mailer: string | undefined; resendApiKey: string; mailFrom: string },
): Mailer {
  const mode = env.mailer === undefined || env.mailer === "" ? "log" : env.mailer;
  if (mode === "log") return new LogMailer(directory);
  if (mode === "resend") return new ResendMailer(env.resendApiKey, env.mailFrom);
  throw new Error("MAILER must be log or resend");
}
