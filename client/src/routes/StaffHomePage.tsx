import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, failureText, type StaffBoard } from "../api/staff";
import { Card, Notice, SecondaryButton } from "../components/Form";
import { copy } from "../copy";
import { formatJerusalem, formatKm, formatShekels } from "../format";

function RentalLines(props: { rows: StaffBoard["awaitingHandover"]; empty: string }) {
  if (props.rows.length === 0) return <p className="text-muted">{props.empty}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {props.rows.map((row) => (
        <li key={row.id}>
          <Link to={`/staff/rentals/${row.id}`} className="font-medium">
            {row.number} · {row.make} {row.model} · {row.plate}
          </Link>
          <p className="text-sm text-muted">
            {formatJerusalem(row.pickupAt)} · {formatShekels(row.totalAgorot)}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function StaffHomePage() {
  const [board, setBoard] = useState<StaffBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    void api<StaffBoard>("/api/staff/board").then((result) => {
      if (!result.ok) {
        setError(failureText(result));
        return;
      }
      setBoard(result.data);
    });
  }, [reload]);

  async function retry(id: string) {
    const result = await api<{ status: "sent" | "failed" }>(`/api/staff/outbox/${id}/retry`, {
      method: "POST",
    });
    if (!result.ok) {
      setError(failureText(result));
      return;
    }
    setError(result.data.status === "failed" ? copy.yard.mailStillFailed : null);
    setReload((count) => count + 1);
  }

  if (board === null && error !== null) return <Notice tone="danger">{error}</Notice>;
  if (board === null) return <p className="text-muted">{copy.loading}</p>;

  const failedMail = board.failedMail ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{copy.yard.board}</h1>
      {error !== null && <Notice tone="danger">{error}</Notice>}
      <Card title={copy.yard.awaiting}>
        <RentalLines rows={board.awaitingHandover} empty={copy.yard.empty} />
      </Card>
      <Card title={copy.yard.openChecks}>
        <RentalLines rows={board.openChecklists} empty={copy.yard.empty} />
      </Card>
      <Card title={copy.yard.cancellations}>
        <RentalLines rows={board.cancellations} empty={copy.yard.empty} />
      </Card>
      <Card title={copy.yard.threshold}>
        {board.saleThreshold.length === 0 ? (
          <p className="text-muted">{copy.yard.empty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {board.saleThreshold.map((car) => (
              <li key={car.id}>
                <Link to={`/staff/cars/${car.id}`} className="font-medium">
                  {car.plate} · {car.make} {car.model}
                </Link>
                <p className="text-sm text-muted">
                  {formatKm(car.currentKm)} {copy.site.kmUnit}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {failedMail.length > 0 && (
        <Card title={copy.yard.failedMail}>
          <ul className="flex flex-col gap-3">
            {failedMail.map((letter) => (
              <li key={letter.id} className="flex flex-col gap-2">
                <p className="font-medium">
                  {letter.subject} · {letter.to}
                </p>
                {letter.lastError !== "" && (
                  <p className="text-sm text-muted">{letter.lastError}</p>
                )}
                <SecondaryButton
                  onClick={() => {
                    void retry(letter.id);
                  }}
                >
                  {copy.yard.retrySend}
                </SecondaryButton>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
