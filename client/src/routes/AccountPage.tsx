import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, failureText } from "../api/staff";
import { Notice } from "../components/Form";
import { copy } from "../copy";
import { formatShekels } from "../format";

type Account = {
  fullName: string;
  phone: string;
  email: string;
  birthDate: string;
  rentals: {
    id: string;
    status: string;
    number: string | null;
    make: string;
    model: string;
    totalAgorot: number;
  }[];
  sales: {
    id: string;
    status: string;
    number: string | null;
    make: string;
    model: string;
    depositAgorot: number;
  }[];
};

/** Signed-in details. Block reasons are not part of this payload. */
export function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<Account>("/api/account").then((result) => {
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAccount(result.data);
    });
  }, []);

  if (error === "UNAUTHENTICATED") {
    return (
      <div className="flex flex-col gap-2">
        <Link to="/login" className="font-medium">
          {copy.site.loginTitle}
        </Link>
        <Link to="/register" className="font-medium">
          {copy.site.register}
        </Link>
      </div>
    );
  }

  return (
    <article className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{copy.site.account}</h1>
      {error !== null && <Notice tone="danger">{failureText({ ok: false, error })}</Notice>}
      {account !== null && (
        <>
          <section className="rounded-card border border-line bg-card p-4">
            <h2 className="mb-2 font-bold">{copy.site.details}</h2>
            <p>{account.fullName}</p>
            <p>{account.phone}</p>
            <p>{account.email}</p>
            <p>{account.birthDate}</p>
          </section>
          <section className="rounded-card border border-line bg-card p-4">
            <h2 className="mb-2 font-bold">{copy.site.rentals}</h2>
            <ul className="flex flex-col gap-2">
              {account.rentals.map((rental) => (
                <li key={rental.id}>
                  <Link to={`/rent/orders/${rental.id}`}>
                    {rental.make} {rental.model}
                    {rental.number !== null ? ` · ${rental.number}` : ""} ·{" "}
                    {formatShekels(rental.totalAgorot)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-card border border-line bg-card p-4">
            <h2 className="mb-2 font-bold">{copy.site.purchases}</h2>
            <ul className="flex flex-col gap-2">
              {account.sales.map((sale) => (
                <li key={sale.id}>
                  <Link to={`/buy/orders/${sale.id}`}>
                    {sale.make} {sale.model}
                    {sale.number !== null ? ` · ${sale.number}` : ""} ·{" "}
                    {formatShekels(sale.depositAgorot)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </article>
  );
}
