import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { api, failureText } from "../api/staff";
import type { RentDetail } from "../api/catalog";
import { readRentSearch, rentQueryString, type RentSearch } from "../catalog-query";
import { RentDetailView } from "../components/CatalogCards";
import { Notice, PrimaryButton } from "../components/Form";
import { copy } from "../copy";
import { saveHold } from "../hold";

export function RentCarPage() {
  const { carId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const search = readRentSearch(params);
  const [detail, setDetail] = useState<RentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryKey = params.toString();

  useEffect(() => {
    const current = readRentSearch(new URLSearchParams(queryKey));
    if (current === null || carId === undefined) {
      setDetail(null);
      setError("INVALID_INPUT");
      return;
    }
    let active = true;
    setError(null);
    void api<RentDetail>(`/api/rent/cars/${carId}?${rentQueryString(current)}`).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setDetail(null);
        setError(result.error);
        return;
      }
      setDetail(result.data);
    });
    return () => {
      active = false;
    };
  }, [carId, queryKey]);

  async function hold() {
    if (search === null || carId === undefined || detail === null) return;
    const result = await api<{ orderId: string; holdToken: string }>("/api/rent/holds", {
      method: "POST",
      body: JSON.stringify({
        carId,
        pickup: search.pickup,
        returnAt: search.returnAt,
        age: Number(search.age),
        primaryType: detail.primaryType,
        returnMode: search.returnMode,
        returnAddress: search.returnAddress,
        insurancePackageId: search.insurancePackageId === "" ? null : search.insurancePackageId,
      }),
    });
    if (!result.ok) {
      setError(result.error);
      if (result.error === "CAR_TAKEN") {
        await navigate(`/rent/results?${rentQueryString({ ...search, insurancePackageId: "" })}`);
      }
      return;
    }
    saveHold(result.data.orderId, result.data.holdToken);
    await navigate(`/rent/checkout?order=${result.data.orderId}`);
  }

  function onInsurance(packageId: string | null) {
    if (search === null) return;
    const next: RentSearch = { ...search, insurancePackageId: packageId ?? "" };
    setParams(new URLSearchParams(rentQueryString(next)));
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        to={
          search === null
            ? "/rent"
            : `/rent/results?${rentQueryString({ ...search, insurancePackageId: "" })}`
        }
        className="text-sm font-medium"
      >
        {copy.back}
      </Link>
      {error !== null && <Notice tone="danger">{failureText({ ok: false, error })}</Notice>}
      {detail !== null && <RentDetailView detail={detail} onInsurance={onInsurance} />}
      {detail !== null && search !== null && (
        <PrimaryButton
          onClick={() => {
            void hold();
          }}
        >
          {copy.site.continuePay}
        </PrimaryButton>
      )}
    </div>
  );
}
