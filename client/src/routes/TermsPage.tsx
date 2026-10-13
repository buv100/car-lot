import { activeTerms, copy } from "../copy";

export function TermsPage() {
  return (
    <article className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{copy.site.terms}</h1>
      {activeTerms().map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </article>
  );
}
