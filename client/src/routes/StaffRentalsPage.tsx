import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, failureText, type RentalDesk } from "../api/staff";
import { Notice } from "../components/Form";
import { copy } from "../copy";
import { formatJerusalem, formatShekels } from "../format";

const filters = ["", "confirmed", "active", "checklist", "completed", "cancelled"] as const;

export function StaffRentalsPage() {
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<RentalDesk[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = status === "" ? "" : `?status=${status}`;
    void api<RentalDesk[]>(`/api/staff/rentals${query}`).then((result) => {
      if (!result.ok) {
        setError(failureText(result));
        return;
      }
      setError(null);
      setRows(result.data);
    });
  }, [status]);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{copy.yard.rentals}</h1>
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <button
            key={filter || "all"}
            type="button"
            className={
              filter === status
                ? "rounded-control bg-accent px-3 py-2 text-sm font-medium text-on-accent"
                : "rounded-control border border-ink px-3 py-2 text-sm font-medium"
            }
            onClick={() => {
              setRows(null);
              setStatus(filter);
            }}
          >
            {filter === "" ? copy.yard.allStatuses : copy.yard.rentalStatuses[filter]}
          </button>
        ))}
      </div>
      {error !== null && <Notice tone="danger">{error}</Notice>}
      {rows === null ? (
        <p className="text-muted">{copy.loading}</p>
      ) : rows.length === 0 ? (
        <p className="text-muted">{copy.yard.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-card border border-line bg-card p-4">
              <Link to={`/staff/rentals/${row.id}`} className="font-bold">
                {row.number}
              </Link>
              <p>
                {row.make} {row.model} · {row.plate}
              </p>
              <p className="text-sm text-muted">
                {copy.yard.rentalStatuses[row.status as keyof typeof copy.yard.rentalStatuses]} ·{" "}
                {formatJerusalem(row.pickupAt)} · {formatShekels(row.totalAgorot)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
