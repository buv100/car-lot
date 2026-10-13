import { activeCancellationNotes, activeCancellationRows, copy } from "../copy";

export function CancellationPage() {
  return (
    <article className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{copy.site.cancellation}</h1>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {activeCancellationRows().map((row) => (
            <tr key={row.hours} className="border-b border-line">
              <td className="py-2">{row.hours}</td>
              <td className="py-2 text-end font-medium">{row.refund}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {activeCancellationNotes().map((note) => (
        <p key={note}>{note}</p>
      ))}
    </article>
  );
}
