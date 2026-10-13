import { useEffect, useState, type SubmitEvent } from "react";
import { useSearchParams } from "react-router-dom";

import { api, failureText } from "../api/staff";
import { Field, Notice, PrimaryButton, SecondaryButton, TextInput } from "../components/Form";
import { copy } from "../copy";
import { accountFormatHint, accountIssues, fieldMark, problemText } from "../required-fields";
import { formatShekels } from "../format";
import { holdHeaders } from "../hold";

type RentalOrder = {
  id: string;
  confirming: boolean;
  status: string;
  make: string;
  model: string;
  totalAgorot: number;
  liveTotalAgorot: number;
  priceChanged: boolean;
  rentalAgorot: number;
  insuranceAgorot: number;
  deliveryFeeAgorot: number;
};

type AccountForm = {
  fullName: string;
  phone: string;
  email: string;
  birthDate: string;
  password: string;
};

const emptyForm: AccountForm = { fullName: "", phone: "", email: "", birthDate: "", password: "" };

/** Account, price snapshot, and the handoff to the test checkout. The browser does not price the rental. */
export function RentCheckoutPage() {
  const [params] = useSearchParams();
  const orderId = params.get("order") ?? "";
  const [order, setOrder] = useState<RentalOrder | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [creating, setCreating] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (orderId === "") return;
    void api<RentalOrder>(`/api/rent/orders/${orderId}`, { headers: holdHeaders(orderId) }).then(
      (result) => {
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setOrder(result.data);
      },
    );
    void api<{ phone: string }>("/api/catalog/lot").then((result) => {
      if (result.ok) setPhone(result.data.phone);
    });
    void api("/api/account").then((result) => {
      setSignedIn(result.ok);
    });
  }, [orderId]);

  function setField(key: keyof AccountForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function formIssues() {
    return accountIssues({
      creating,
      fullName: form.fullName,
      phone: form.phone,
      birthDate: form.birthDate,
      email: form.email,
      password: form.password,
    });
  }

  const issues = signedIn || !tried ? { missing: [], invalid: [] } : formIssues();
  const problem = problemText(issues.missing, issues.invalid, accountFormatHint(issues));

  async function ensureAccount() {
    if (signedIn) return true;
    setTried(true);
    const next = formIssues();
    if (problemText(next.missing, next.invalid) !== null) return false;
    const path = creating ? "/api/account/register" : "/api/account/login";
    const body = creating ? form : { email: form.email, password: form.password };
    const result = await api(path, { method: "POST", body: JSON.stringify(body) });
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setSignedIn(true);
    return true;
  }

  async function pay(acceptPrice: boolean) {
    setError(null);
    if (!(await ensureAccount())) return;
    const result = await api<{ redirectUrl: string }>(`/api/rent/orders/${orderId}/pay`, {
      method: "POST",
      headers: holdHeaders(orderId),
      body: JSON.stringify({ acceptPrice }),
    });
    if (!result.ok) {
      setError(result.error);
      const refreshed = await api<RentalOrder>(`/api/rent/orders/${orderId}`, {
        headers: holdHeaders(orderId),
      });
      if (refreshed.ok) setOrder(refreshed.data);
      return;
    }
    window.location.assign(result.data.redirectUrl);
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    await pay(false);
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{copy.site.pay}</h1>
      {order !== null && (
        <section className="rounded-card border border-line bg-card p-4">
          <h2 className="font-bold">
            {order.make} {order.model}
          </h2>
          <p className="mt-2 text-sm text-muted">{copy.site.periodTotal}</p>
          <p className="text-3xl font-bold">
            {formatShekels(order.priceChanged ? order.liveTotalAgorot : order.totalAgorot)}
          </p>
        </section>
      )}
      {!signedIn && (
        <section className="flex flex-col gap-3 rounded-card border border-line bg-card p-4">
          <div className="flex gap-2">
            <SecondaryButton
              onClick={() => {
                setCreating(true);
              }}
            >
              {copy.site.newAccount}
            </SecondaryButton>
            <SecondaryButton
              onClick={() => {
                setCreating(false);
              }}
            >
              {copy.site.existingAccount}
            </SecondaryButton>
          </div>
          {creating && (
            <>
              <p className="text-sm text-muted">{copy.site.registerHint}</p>
              <Field
                label={copy.site.fullName}
                error={fieldMark(copy.site.fullName, issues.missing, issues.invalid)}
              >
                <TextInput
                  value={form.fullName}
                  invalid={
                    issues.missing.includes(copy.site.fullName) ||
                    issues.invalid.includes(copy.site.fullName)
                  }
                  onChange={(value) => {
                    setField("fullName", value);
                  }}
                />
              </Field>
              <Field
                label={copy.site.phone}
                error={fieldMark(copy.site.phone, issues.missing, issues.invalid)}
              >
                <TextInput
                  value={form.phone}
                  invalid={
                    issues.missing.includes(copy.site.phone) ||
                    issues.invalid.includes(copy.site.phone)
                  }
                  onChange={(value) => {
                    setField("phone", value);
                  }}
                />
              </Field>
              <Field
                label={copy.site.birthDate}
                error={fieldMark(copy.site.birthDate, issues.missing, issues.invalid)}
              >
                <TextInput
                  value={form.birthDate}
                  invalid={
                    issues.missing.includes(copy.site.birthDate) ||
                    issues.invalid.includes(copy.site.birthDate)
                  }
                  onChange={(value) => {
                    setField("birthDate", value);
                  }}
                  type="date"
                />
              </Field>
            </>
          )}
          <Field label={copy.email} error={fieldMark(copy.email, issues.missing, issues.invalid)}>
            <TextInput
              value={form.email}
              invalid={issues.missing.includes(copy.email) || issues.invalid.includes(copy.email)}
              onChange={(value) => {
                setField("email", value);
              }}
              type="email"
            />
          </Field>
          <Field
            label={copy.password}
            error={fieldMark(copy.password, issues.missing, issues.invalid)}
          >
            <TextInput
              value={form.password}
              invalid={
                issues.missing.includes(copy.password) || issues.invalid.includes(copy.password)
              }
              onChange={(value) => {
                setField("password", value);
              }}
              type="password"
            />
          </Field>
        </section>
      )}
      {problem !== null && <Notice tone="danger">{problem}</Notice>}
      {problem === null && error !== null && (
        <Notice tone="danger">
          {error === "INVALID_INPUT" ? copy.site.registerHint : failureText({ ok: false, error })}
          {error === "CUSTOMER_BLOCKED" && phone !== "" ? ` ${phone}` : ""}
        </Notice>
      )}
      {order?.priceChanged === true ? (
        <PrimaryButton
          onClick={() => {
            void pay(true);
          }}
        >
          {copy.site.acceptPrice}
        </PrimaryButton>
      ) : (
        <PrimaryButton type="submit">{copy.site.pay}</PrimaryButton>
      )}
    </form>
  );
}
