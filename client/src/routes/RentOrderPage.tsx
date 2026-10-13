import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { api, failureText } from "../api/staff";
import { Notice } from "../components/Form";
import { copy } from "../copy";
import { formatJerusalem, formatShekels } from "../format";
import { holdHeaders } from "../hold";

type RentalOrder = {
  status: string;
  confirming: boolean;
  number: string | null;
  plate: string | null;
  make: string;
  model: string;
  pickupAt: string;
  returnAt: string;
  lotAddress: string;
  returnAddress: string;
  rentalAgorot: number;
  insuranceAgorot: number;
  deliveryFeeAgorot: number;
  totalAgorot: number;
};

/** Shows the payment state. This page never marks the order paid. */
export function RentOrderPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<RentalOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orderId === undefined) return;
    const id = orderId;
    let active = true;
    async function load() {
      const result = await api<RentalOrder>(`/api/rent/orders/${id}`, {
        headers: holdHeaders(id),
      });
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
      {order.plate !== null && (
        <p>
          {copy.plate}: {order.plate}
        </p>
      )}
      <p>
        {copy.site.pickup}: {formatJerusalem(order.pickupAt)}
      </p>
      <p>{order.lotAddress}</p>
      <p>
        {copy.site.returnTime}: {formatJerusalem(order.returnAt)}
      </p>
      <p>{order.returnAddress}</p>
      <p>
        {copy.site.rentalFee}: {formatShekels(order.rentalAgorot)}
      </p>
      <p>
        {copy.site.baseInsurance}: {formatShekels(order.insuranceAgorot)}
      </p>
      <p>
        {copy.site.returnLot}: {formatShekels(order.deliveryFeeAgorot)}
      </p>
      <p className="text-3xl font-bold">{formatShekels(order.totalAgorot)}</p>
    </article>
  );
}
