/** Why the process must stop before it listens. Null means the environment can start. */
export function bootProblem(env: {
  databaseUrl: string | undefined;
  staffJwtSecret: string;
  customerJwtSecret: string;
  stripeSecretKey: string;
  mailer?: string;
  resendApiKey?: string;
  mailFrom?: string;
}): string | null {
  if (env.databaseUrl === undefined || env.databaseUrl.trim() === "")
    return "DATABASE_URL is required";
  if (env.staffJwtSecret.length < 32) return "STAFF_JWT_SECRET must be at least 32 characters";
  if (env.customerJwtSecret.length < 32)
    return "CUSTOMER_JWT_SECRET must be at least 32 characters";
  if (env.staffJwtSecret === env.customerJwtSecret) {
    return "CUSTOMER_JWT_SECRET must differ from STAFF_JWT_SECRET";
  }
  // A live key would charge real cards. Only the Stripe test key may boot this version.
  if (env.stripeSecretKey.startsWith("sk_live_")) return "STRIPE_SECRET_KEY must not be a live key";
  if (env.stripeSecretKey !== "" && !env.stripeSecretKey.startsWith("sk_test_")) {
    return "STRIPE_SECRET_KEY must be a test key";
  }
  const mailer = env.mailer === undefined || env.mailer === "" ? "log" : env.mailer;
  if (mailer !== "log" && mailer !== "resend") return "MAILER must be log or resend";
  if (mailer === "resend" && ((env.resendApiKey ?? "") === "" || (env.mailFrom ?? "") === "")) {
    return "RESEND_API_KEY and MAIL_FROM are required when MAILER=resend";
  }
  return null;
}
