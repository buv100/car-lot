import type { ReactNode } from "react";

import { controlClass } from "./control";

export function Field(props: { label: string; children: ReactNode; error?: string | null }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{props.label}</span>
      {props.children}
      {props.error != null && props.error !== "" && (
        <span className="text-danger" role="alert">
          {props.error}
        </span>
      )}
    </label>
  );
}

export function TextInput(props: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <input
      type={props.type ?? "text"}
      value={props.value}
      disabled={props.disabled}
      aria-invalid={props.invalid === true ? true : undefined}
      onChange={(event) => {
        props.onChange(event.target.value);
      }}
      className={controlClass(props.invalid === true)}
    />
  );
}

export function PrimaryButton(props: {
  children: ReactNode;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      className="rounded-control bg-accent px-4 py-3 font-medium text-on-accent hover:bg-accent-pressed"
    >
      {props.children}
    </button>
  );
}

export function SecondaryButton(props: {
  children: ReactNode;
  onClick: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      className="rounded-control border border-ink px-4 py-3 font-medium text-ink"
    >
      {props.children}
    </button>
  );
}

export function Card(props: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-card p-4">
      <h2 className="mb-3 text-lg font-bold">{props.title}</h2>
      <div className="flex flex-col gap-3">{props.children}</div>
    </section>
  );
}

export function Notice(props: { tone: "danger" | "success"; children: ReactNode }) {
  const tone = props.tone === "danger" ? "text-danger" : "text-success";
  return <p className={tone}>{props.children}</p>;
}
