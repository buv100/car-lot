import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { api, failureText, type SaleDesk, type StaffSession } from "../api/staff";
import { Notice, PrimaryButton, SecondaryButton } from "../components/Form";
import { copy } from "../copy";
import { formatShekels } from "../format";

export function StaffSalesPage() {
  const session = useOutletContext<StaffSession>();
  const [rows, setRows] = useState<SaleDesk[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canRefund = session.permissions.includes("sales.refund");

  async function load() {
    const result = await api<SaleDesk[]>("/api/staff/sales");
    if (!result.ok) {
      setError(failureText(result));
      return;
    }
    setRows(result.data);
  }

  useEffect(() => {
    void load();
  }, []);

  async function handover(id: string) {
    setError(null);
    const result = await api<SaleDesk>(`/api/staff/sales/${id}/handover`, { method: "POST" });
    if (!result.ok) {
      setError(failureText(result));
      return;
    }
    setNotice(copy.saved);
    await load();
  }

  async function refund(id: string, approved: boolean) {
    setError(null);
    const result = await api(`/api/staff/sales/${id}/refund`, {
      method: "POST",
      body: JSON.stringify({ approved }),
    });
    if (!result.ok) {
      setError(failureText(result));
      return;
    }
    setNotice(copy.saved);
    await load();
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{copy.yard.sales}</h1>
      {error !== null && <Notice tone="danger">{error}</Notice>}
      {notice !== null && <Notice tone="success">{notice}</Notice>}
      {rows === null ? (
        <p className="text-muted">{copy.loading}</p>
      ) : rows.length === 0 ? (
        <p className="text-muted">{copy.yard.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-card border border-line bg-card p-4">
              <p className="font-bold">{row.number}</p>
              <p>
                {row.make} {row.model} · {row.plate}
              </p>
              <p className="text-sm text-muted">
                {copy.yard.saleStatuses[row.status as keyof typeof copy.yard.saleStatuses]} ·{" "}
                {formatShekels(row.listPriceAgorot)} · {formatShekels(row.depositAgorot)}
              </p>
              {row.status === "reserved" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <PrimaryButton
                    onClick={() => {
                      void handover(row.id);
                    }}
                  >
                    {copy.yard.saleHandover}
                  </PrimaryButton>
                  {canRefund && (
                    <>
                      <SecondaryButton
                        onClick={() => {
                          void refund(row.id, true);
                        }}
                      >
                        {copy.yard.approveRefund}
                      </SecondaryButton>
                      <SecondaryButton
                        onClick={() => {
                          void refund(row.id, false);
                        }}
                      >
                        {copy.yard.rejectRefund}
                      </SecondaryButton>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
