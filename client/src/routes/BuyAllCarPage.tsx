import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { loadFleetCar, type FleetDetail } from "../api/catalog";
import { failureText } from "../api/staff";
import { FleetDetailView } from "../components/CatalogCards";
import { Notice } from "../components/Form";
import { copy } from "../copy";

export function BuyAllCarPage() {
  const { carId } = useParams();
  const [detail, setDetail] = useState<FleetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (carId === undefined) return;
    let active = true;
    void loadFleetCar(carId).then((result) => {
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
  }, [carId]);

  return (
    <div className="flex flex-col gap-4">
      <Link to="/buy/all" className="text-sm font-medium">
        {copy.back}
      </Link>
      {error !== null && <Notice tone="danger">{failureText({ ok: false, error })}</Notice>}
      {detail !== null && <FleetDetailView detail={detail} />}
    </div>
  );
}
