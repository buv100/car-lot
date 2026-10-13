import { useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api, failureText } from "../api/staff";
import { Field, Notice, PrimaryButton, TextInput } from "../components/Form";
import { copy } from "../copy";
import { accountFormatHint, accountIssues, fieldMark, problemText } from "../required-fields";

type AccountForm = {
  fullName: string;
  phone: string;
  email: string;
  birthDate: string;
  password: string;
};

const emptyForm: AccountForm = { fullName: "", phone: "", email: "", birthDate: "", password: "" };

/** A customer can open an account before any payment. */
export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  function setField(key: keyof AccountForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function formIssues() {
    return accountIssues({
      creating: true,
      fullName: form.fullName,
      phone: form.phone,
      birthDate: form.birthDate,
      email: form.email,
      password: form.password,
    });
  }

  const issues = tried ? formIssues() : { missing: [], invalid: [] };
  const problem = problemText(issues.missing, issues.invalid, accountFormatHint(issues));

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    setError(null);
    const next = formIssues();
    if (problemText(next.missing, next.invalid) !== null) return;
    const result = await api<{ id: string }>("/api/account/register", {
      method: "POST",
      body: JSON.stringify(form),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await navigate("/account");
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-card border border-line bg-card p-6"
    >
      <h1 className="text-2xl font-bold">{copy.site.register}</h1>
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
            issues.missing.includes(copy.site.phone) || issues.invalid.includes(copy.site.phone)
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
      <Field label={copy.password} error={fieldMark(copy.password, issues.missing, issues.invalid)}>
        <TextInput
          value={form.password}
          invalid={issues.missing.includes(copy.password) || issues.invalid.includes(copy.password)}
          onChange={(value) => {
            setField("password", value);
          }}
          type="password"
        />
      </Field>
      {problem !== null && <Notice tone="danger">{problem}</Notice>}
      {problem === null && error !== null && (
        <Notice tone="danger">
          {error === "INVALID_INPUT" ? copy.site.registerHint : failureText({ ok: false, error })}
        </Notice>
      )}
      <PrimaryButton type="submit">{copy.site.register}</PrimaryButton>
      <Link to="/login" className="text-sm font-medium">
        {copy.site.existingAccount}
      </Link>
    </form>
  );
}
