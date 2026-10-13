import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { api, failureText } from "../api/staff";
import type { PublicTag, SaleOffer } from "../api/catalog";
import { carTypes, readSaleSearch, saleQueryString } from "../catalog-query";
import { SaleCards } from "../components/CatalogCards";
import { Notice } from "../components/Form";
import { copy } from "../copy";

const control = "rounded-control border border-line bg-card px-3 py-2 text-ink";

export function BuyResultsPage() {
  const [params, setParams] = useSearchParams();
  const search = readSaleSearch(params);
  const [offers, setOffers] = useState<SaleOffer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(search === null);
  const [tags, setTags] = useState<PublicTag[]>([]);
  const queryKey = params.toString();

  useEffect(() => {
    void api<PublicTag[]>("/api/catalog/tags").then((result) => {
      if (result.ok) setTags(result.data);
    });
  }, []);

  useEffect(() => {
    const current = readSaleSearch(new URLSearchParams(queryKey));
    if (current === null) {
      setOffers([]);
      setError(null);
      setLoaded(true);
      return;
    }
    let active = true;
    setError(null);
    setLoaded(false);
    void api<SaleOffer[]>(`/api/buy/search?${saleQueryString(current)}`).then((result) => {
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
  }, [queryKey]);

  function setType(primaryType: string) {
    const next = new URLSearchParams(params);
    if (primaryType === "") next.delete("primaryType");
    else next.set("primaryType", primaryType);
    setParams(next);
  }

  function setTag(tagId: string) {
    const next = new URLSearchParams(params);
    if (tagId === "") next.delete("tagId");
    else next.set("tagId", tagId);
    setParams(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{copy.site.buy}</h1>
        <Link to={`/buy?${queryKey}`} className="text-sm font-medium">
          {copy.site.changeSearch}
        </Link>
      </div>
      {search !== null && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{copy.type}</span>
          <select
            value={search.primaryType}
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
      )}
      {search !== null && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{copy.site.tagFilter}</span>
          <select
            value={search.tagId}
            onChange={(event) => {
              setTag(event.target.value);
            }}
            className={control}
          >
            <option value="">{copy.site.anyTag}</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {error !== null && <Notice tone="danger">{failureText({ ok: false, error })}</Notice>}
      {!loaded && error === null && <p className="text-muted">{copy.loading}</p>}
      {loaded && error === null && offers.length === 0 && <p>{copy.site.noSaleCars}</p>}
      {error === null && offers.length > 0 && search !== null && (
        <SaleCards offers={offers} search={saleQueryString(search)} />
      )}
    </div>
  );
}
