import { useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api, failureText } from "../api/staff";
import { Field, Notice, PrimaryButton, TextInput } from "../components/Form";
import { copy } from "../copy";
import { blankLabels, fieldMark, listedMissing } from "../required-fields";

/** Returning customers. A new account can also be opened before payment. */
export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const missing = tried
    ? blankLabels([
        { label: copy.email, value: email },
        { label: copy.password, value: password },
      ])
    : [];

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    setError(null);
    if (
      blankLabels([
        { label: copy.email, value: email },
        { label: copy.password, value: password },
      ]).length > 0
    ) {
      return;
    }
    const result = await api<{ id: string }>("/api/account/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
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
      <h1 className="text-2xl font-bold">{copy.site.loginTitle}</h1>
      <Link to="/register" className="text-sm font-medium">
        {copy.site.register}
      </Link>
      <Field label={copy.email} error={fieldMark(copy.email, missing)}>
        <TextInput
          value={email}
          onChange={setEmail}
          type="email"
          invalid={missing.includes(copy.email)}
        />
      </Field>
      <Field label={copy.password} error={fieldMark(copy.password, missing)}>
        <TextInput
          value={password}
          onChange={setPassword}
          type="password"
          invalid={missing.includes(copy.password)}
        />
      </Field>
      {missing.length > 0 && <Notice tone="danger">{listedMissing(missing)}</Notice>}
      {missing.length === 0 && error !== null && (
        <Notice tone="danger">{failureText({ ok: false, error })}</Notice>
      )}
      <PrimaryButton type="submit">{copy.loginSubmit}</PrimaryButton>
    </form>
  );
}
