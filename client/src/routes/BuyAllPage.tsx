import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { loadFleet, type FleetCar } from "../api/catalog";
import { failureText } from "../api/staff";
import { carTypes } from "../catalog-query";
import { FleetCards } from "../components/CatalogCards";
import { Notice } from "../components/Form";
import { copy } from "../copy";

const control = "rounded-control border border-line bg-card px-3 py-2 text-ink";

export function BuyAllPage() {
  const [params, setParams] = useSearchParams();
  const primaryType = params.get("primaryType") ?? "";
  const [cars, setCars] = useState<FleetCar[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void loadFleet().then((result) => {
      if (!active) return;
      if (!result.ok) {
        setCars([]);
        setError(result.error);
        setLoaded(true);
        return;
      }
      setCars(result.data);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const visible = primaryType === "" ? cars : cars.filter((car) => car.primaryType === primaryType);

  function setType(nextType: string) {
    const next = new URLSearchParams(params);
    if (nextType === "") next.delete("primaryType");
    else next.set("primaryType", nextType);
    setParams(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{copy.site.allCars}</h1>
        <Link to="/buy" className="text-sm font-medium">
          {copy.site.buy}
        </Link>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{copy.type}</span>
        <select
          value={primaryType}
          onChange={(event) => {
            setType(event.target.value);
          }}
          className={control}
        >
          <option value="">{copy.site.anyType}</option>
          {carTypes.map((type) => (
            <option key={type} value={type}>
              {copy.types[type]}
            </option>
          ))}
        </select>
      </label>
      {error !== null && <Notice tone="danger">{failureText({ ok: false, error })}</Notice>}
      {!loaded && error === null && <p className="text-muted">{copy.loading}</p>}
      {loaded && error === null && visible.length === 0 && <p>{copy.site.noFleetCars}</p>}
      {error === null && visible.length > 0 && <FleetCards cars={visible} />}
    </div>
  );
}
