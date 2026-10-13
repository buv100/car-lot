import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { api, failureText } from "../api/staff";
import type { SaleDetail } from "../api/catalog";
import { SaleDetailView } from "../components/CatalogCards";
import { Field, Notice, PrimaryButton, TextInput } from "../components/Form";
import { copy } from "../copy";
import { saveHold } from "../hold";

export function BuyCarPage() {
  const { carId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [financing, setFinancing] = useState(false);
  const [financingNote, setFinancingNote] = useState("");
  const [tradeIn, setTradeIn] = useState(false);
  const [tradeInNote, setTradeInNote] = useState("");

  useEffect(() => {
    if (carId === undefined) return;
    let active = true;
    void api<SaleDetail>(`/api/buy/cars/${carId}`).then((result) => {
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
      <Link to={`/buy/results?${searchParams.toString()}`} className="text-sm font-medium">
        {copy.back}
      </Link>
      {error !== null && <Notice tone="danger">{failureText({ ok: false, error })}</Notice>}
      {detail !== null && <SaleDetailView detail={detail} />}
      {detail !== null && (
        <section className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={financing}
              onChange={(event) => {
                setFinancing(event.target.checked);
              }}
            />
            {copy.site.financing}
          </label>
          {financing && (
            <Field label={copy.site.note}>
              <TextInput value={financingNote} onChange={setFinancingNote} />
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={tradeIn}
              onChange={(event) => {
                setTradeIn(event.target.checked);
              }}
            />
            {copy.site.tradeIn}
          </label>
          {tradeIn && (
            <Field label={copy.site.note}>
              <TextInput value={tradeInNote} onChange={setTradeInNote} />
            </Field>
          )}
          <PrimaryButton
            onClick={() => {
              if (carId === undefined) return;
              void api<{ orderId: string; holdToken: string }>("/api/buy/holds", {
                method: "POST",
                body: JSON.stringify({
                  carId,
                  wantsFinancing: financing,
                  financingNote,
                  wantsTradeIn: tradeIn,
                  tradeInNote,
                }),
              }).then(async (result) => {
                if (!result.ok) {
                  setError(result.error);
                  if (result.error === "CAR_TAKEN")
                    await navigate(`/buy/results?${searchParams.toString()}`);
                  return;
                }
                saveHold(result.data.orderId, result.data.holdToken);
                await navigate(`/buy/checkout?order=${result.data.orderId}`);
              });
            }}
          >
            {copy.site.buyCar}
          </PrimaryButton>
        </section>
      )}
    </div>
  );
}
