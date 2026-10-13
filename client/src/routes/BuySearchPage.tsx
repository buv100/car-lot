import { useEffect, useState, type SubmitEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { api } from "../api/staff";
import type { SaleOffer } from "../api/catalog";
import { carTypes, readSaleSearch, saleKmCeiling, saleSearchParams } from "../catalog-query";
import { SaleCards } from "../components/CatalogCards";
import { Field, Notice, PrimaryButton, TextInput } from "../components/Form";
import { copy, errorText } from "../copy";

const control = "rounded-control border border-line bg-card px-3 py-2 text-ink disabled:text-muted";

const listed = `maxKm=${saleKmCeiling}&condition=any`;

export function BuySearchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [maxKm, setMaxKm] = useState(params.get("maxKm") ?? "");
  const [condition, setCondition] = useState(params.get("condition") ?? "");
  const [primaryType, setPrimaryType] = useState(params.get("primaryType") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [offers, setOffers] = useState<SaleOffer[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void api<SaleOffer[]>(`/api/buy/search?${listed}`).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setOffers([]);
        setError(result.error);
        setLoaded(true);
        return;
      }
      setOffers(result.data);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = saleSearchParams({ maxKm, condition, primaryType });
    if (readSaleSearch(next) === null) {
      setError("INVALID_INPUT");
      return;
    }
    setError(null);
    void navigate(`/buy/results?${next.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{copy.site.buy}</h1>
        {error !== null && <Notice tone="danger">{errorText(error)}</Notice>}
        <Field label={copy.site.kmUntil}>
          <TextInput value={maxKm} onChange={setMaxKm} type="number" />
        </Field>
        <Field label={copy.site.condition}>
          <select
            value={condition}
            onChange={(event) => {
              setCondition(event.target.value);
            }}
            className={control}
          >
            <option value="">{copy.site.condition}</option>
            <option value="excellent">{copy.site.conditions.excellent}</option>
            <option value="good">{copy.site.conditions.good}</option>
            <option value="fair">{copy.site.conditions.fair}</option>
            <option value="any">{copy.site.anyCondition}</option>
          </select>
        </Field>
        <Field label={copy.type}>
          <select
            value={primaryType}
            onChange={(event) => {
              setPrimaryType(event.target.value);
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
        </Field>
        <PrimaryButton type="submit">{copy.site.search}</PrimaryButton>
        <Link
          to="/buy/all"
          className="rounded-control border border-ink px-4 py-3 text-center font-medium text-ink"
        >
          {copy.site.allCars}
        </Link>
      </form>
      {!loaded && error === null && <p className="text-muted">{copy.loading}</p>}
      {loaded && error === null && offers.length === 0 && <p>{copy.site.noSaleCars}</p>}
      {error === null && offers.length > 0 && <SaleCards offers={offers} search={listed} />}
    </div>
  );
}
