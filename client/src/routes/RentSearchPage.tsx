import { useState, type SubmitEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { carTypes, readRentSearch } from "../catalog-query";
import { controlClass } from "../components/control";
import { Field, Notice, PrimaryButton, TextInput } from "../components/Form";
import { RentalDatesField } from "../components/RentalDatesField";
import { copy, errorText } from "../copy";
import { dayOf } from "../rental-dates";
import { listedMissing } from "../required-fields";

type RentGaps = {
  dates: string | null;
  age: string | null;
  address: string | null;
  notice: string | null;
};

function rentGaps(input: {
  tried: boolean;
  pickup: string;
  returnAt: string;
  age: string;
  returnMode: string;
  returnAddress: string;
}): RentGaps {
  if (!input.tried) return { dates: null, age: null, address: null, notice: null };
  const parts: string[] = [];
  const minute = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  let dates: string | null = null;
  if (dayOf(input.pickup) === "" && dayOf(input.returnAt) === "") dates = copy.site.pickBothDates;
  else if (dayOf(input.pickup) === "" || !minute.test(input.pickup)) dates = copy.site.pickPickup;
  else if (dayOf(input.returnAt) === "" || !minute.test(input.returnAt))
    dates = copy.site.pickReturn;
  if (dates !== null) parts.push(dates);

  let age: string | null = null;
  const ageText = input.age.trim();
  if (ageText === "") age = listedMissing([copy.site.age]);
  else if (!/^\d+$/.test(ageText) || Number(ageText) < 16 || Number(ageText) > 99) {
    age = copy.site.ageRange;
  }
  if (age !== null) parts.push(age);

  let address: string | null = null;
  if (input.returnMode === "address" && input.returnAddress.trim() === "") {
    address = listedMissing([copy.site.returnAddressField]);
    parts.push(address);
  }
  return { dates, age, address, notice: parts.length > 0 ? parts.join(" · ") : null };
}

export function RentSearchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [pickup, setPickup] = useState(params.get("pickup") ?? "");
  const [returnAt, setReturnAt] = useState(params.get("returnAt") ?? "");
  const [age, setAge] = useState(params.get("age") ?? "");
  const [primaryType, setPrimaryType] = useState(params.get("primaryType") ?? "");
  const [returnMode, setReturnMode] = useState(
    params.get("returnMode") === "address" ? "address" : "lot",
  );
  const [returnAddress, setReturnAddress] = useState(params.get("returnAddress") ?? "");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gaps = rentGaps({ tried, pickup, returnAt, age, returnMode, returnAddress });

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    setError(null);
    const current = rentGaps({
      tried: true,
      pickup,
      returnAt,
      age,
      returnMode,
      returnAddress,
    });
    if (current.notice !== null) return;
    const next = new URLSearchParams({
      pickup,
      returnAt,
      age,
      primaryType,
      returnMode,
    });
    if (returnMode === "address") next.set("returnAddress", returnAddress);
    if (readRentSearch(next) === null) {
      setError("INVALID_INPUT");
      return;
    }
    void navigate(`/rent/results?${next.toString()}`);
  }

  return (
    <div>
      <div
        className="pointer-events-none relative -mx-4 -mt-6 h-56 overflow-hidden sm:h-72"
        aria-hidden="true"
      >
        <img
          src="/rent-search-bg.jpg"
          alt=""
          className="h-full w-full object-cover object-[center_30%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/15 via-transparent to-page" />
      </div>
      <form
        onSubmit={submit}
        className="relative z-10 -mt-16 flex flex-col gap-4 rounded-card border border-line bg-card p-4 shadow-sm sm:p-5"
      >
        <h1 className="text-2xl font-bold">{copy.site.rent}</h1>
        {gaps.notice !== null && <Notice tone="danger">{gaps.notice}</Notice>}
        {gaps.notice === null && error !== null && (
          <Notice tone="danger">{errorText(error)}</Notice>
        )}
        <RentalDatesField
          pickup={pickup}
          returnAt={returnAt}
          error={gaps.dates}
          onChange={(nextPickup, nextReturn) => {
            setPickup(nextPickup);
            setReturnAt(nextReturn);
          }}
        />
        <Field label={copy.site.age} error={gaps.age}>
          <TextInput value={age} onChange={setAge} type="number" invalid={gaps.age !== null} />
        </Field>
        <Field label={copy.type}>
          <select
            value={primaryType}
            onChange={(event) => {
              setPrimaryType(event.target.value);
            }}
            className={controlClass()}
          >
            <option value="">{copy.site.anyType}</option>
            {carTypes.map((type) => (
              <option key={type} value={type}>
                {copy.types[type]}
              </option>
            ))}
          </select>
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{copy.site.returnPlace}</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="returnMode"
              checked={returnMode === "lot"}
              onChange={() => {
                setReturnMode("lot");
              }}
            />
            {copy.site.returnLot}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="returnMode"
              checked={returnMode === "address"}
              onChange={() => {
                setReturnMode("address");
              }}
            />
            {copy.site.returnAddress}
          </label>
        </fieldset>
        {returnMode === "address" && (
          <Field label={copy.site.returnAddressField} error={gaps.address}>
            <TextInput
              value={returnAddress}
              onChange={setReturnAddress}
              invalid={gaps.address !== null}
            />
          </Field>
        )}
        <PrimaryButton type="submit">{copy.site.search}</PrimaryButton>
      </form>
    </div>
  );
}
