import { useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api, failureText } from "../api/staff";
import { PrimaryButton, Notice, TextInput, Field } from "../components/Form";
import { copy } from "../copy";
import { usePreferences } from "../preferences-context";
import { blankLabels, fieldMark, listedMissing } from "../required-fields";

export function StaffLoginPage() {
  const navigate = useNavigate();
  usePreferences();
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
    const result = await api("/api/staff/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!result.ok) {
      setError(failureText(result));
      return;
    }
    await navigate("/staff");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <form
        onSubmit={(event) => void submit(event)}
        className="rounded-card border border-line bg-card p-6"
      >
        <h1 className="mb-4 text-2xl font-bold">{copy.loginTitle}</h1>
        <div className="flex flex-col gap-3">
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
          {missing.length === 0 && error !== null && <Notice tone="danger">{error}</Notice>}
          <PrimaryButton type="submit">{copy.loginSubmit}</PrimaryButton>
          <Link to="/" className="text-center text-sm font-medium">
            {copy.site.home}
          </Link>
        </div>
      </form>
    </main>
  );
}
