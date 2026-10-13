import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, type StaffCar } from "../api/staff";
import { copy } from "../copy";

function statusLabel(status: string, careReason: string | null): string {
  const base = Object.hasOwn(copy.statuses, status)
    ? copy.statuses[status as keyof typeof copy.statuses]
    : status;
  if (status !== "in_care" || careReason === null || !Object.hasOwn(copy.care, careReason)) {
    return base;
  }
  return `${base} · ${copy.care[careReason as keyof typeof copy.care]}`;
}

export function StaffCarsPage() {
  const [cars, setCars] = useState<StaffCar[] | null>(null);

  useEffect(() => {
    void api<StaffCar[]>("/api/staff/cars").then((result) => {
      if (result.ok) setCars(result.data);
    });
  }, []);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{copy.cars}</h1>
        <Link
          to="/staff/cars/new"
          className="rounded-control bg-accent px-4 py-3 font-medium text-on-accent"
        >
          {copy.newCar}
        </Link>
      </div>
      {cars === null && <p className="text-muted">{copy.loading}</p>}
      {cars !== null && cars.length === 0 && <p>{copy.noCars}</p>}
      {cars !== null && cars.length > 0 && (
        <ul className="flex flex-col gap-3">
          {cars.map((car) => (
            <li key={car.id}>
              <Link
                to={`/staff/cars/${car.id}`}
                className="block rounded-card border border-line bg-card p-4"
              >
                <p className="font-bold">
                  {car.make} {car.model} · {car.year}
                </p>
                <p className="text-sm text-muted">
                  {car.plate} · {statusLabel(car.status, car.careReason)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
