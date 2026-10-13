import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { api, failureText } from "../api/staff";
import { Notice } from "../components/Form";
import { copy } from "../copy";
import { formatShekels } from "../format";
import { holdHeaders } from "../hold";

type SaleOrder = {
  status: string;
  confirming: boolean;
  number: string | null;
  make: string;
  model: string;
  depositAgorot: number;
  holdExpiresAt: string | null;
};

/** Reservation page. A paid deposit has no countdown. */
export function BuyOrderPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<SaleOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orderId === undefined) return;
    const id = orderId;
    let active = true;
    async function load() {
      const result = await api<SaleOrder>(`/api/buy/orders/${id}`, { headers: holdHeaders(id) });
      if (!active) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOrder(result.data);
    }
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [orderId]);

  if (order === null) {
    return error === null ? (
      <p>{copy.loading}</p>
    ) : (
      <Notice tone="danger">{failureText({ ok: false, error })}</Notice>
    );
  }
  if (order.confirming) return <p className="text-xl font-bold">{copy.site.confirming}</p>;
  if (order.status === "expired")
    return <Notice tone="danger">{copy.customer.paymentFailed}</Notice>;

  return (
    <article className="flex flex-col gap-3 rounded-card border border-line bg-card p-4">
      <h1 className="text-2xl font-bold">
        {order.make} {order.model}
      </h1>
      {order.number !== null && (
        <p>
          {copy.site.orderNumber}: {order.number}
        </p>
      )}
      <p className="text-3xl font-bold">{formatShekels(order.depositAgorot)}</p>
      {order.holdExpiresAt === null && order.status === "reserved" && <p>{copy.site.saveCar}</p>}
    </article>
  );
}
