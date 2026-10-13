import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, failureText, type ChargePreview, type RentalDesk } from "../api/staff";
import { Card, Field, Notice, PrimaryButton, SecondaryButton, TextInput } from "../components/Form";
import { copy } from "../copy";
import {
  fieldMark,
  invalidField,
  listedMissing,
  problemText,
  wholeNumberIssue,
} from "../required-fields";
import { formatKm, formatShekels } from "../format";

type DamageDraft = { key: string; description: string; shekels: string; photos: string[] };

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Photo could not be read"));
        return;
      }
      const comma = reader.result.indexOf(",");
      resolve(comma < 0 ? reader.result : reader.result.slice(comma + 1));
    };
    reader.onerror = () => {
      reject(new Error("Photo could not be read"));
    };
    reader.readAsDataURL(file);
  });
}

export function StaffRentalPage() {
  const { orderId } = useParams();
  const [rental, setRental] = useState<RentalDesk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [startKm, setStartKm] = useState("");
  const [note, setNote] = useState("");
  const [washNeeded, setWashNeeded] = useState(false);
  const [treatmentNeeded, setTreatmentNeeded] = useState(false);
  const [endKm, setEndKm] = useState("");
  const [fuel, setFuel] = useState("");
  const [wash, setWash] = useState<"no" | "needed" | "done">("no");
  const [treatment, setTreatment] = useState<"no" | "needed" | "done">("no");
  const [treatmentNote, setTreatmentNote] = useState("");
  const [price, setPrice] = useState<"keep" | "update">("keep");
  const [minAge, setMinAge] = useState("");
  const [weekday, setWeekday] = useState("");
  const [weekend, setWeekend] = useState("");
  const [holiday, setHoliday] = useState("");
  const [returnPhotos, setReturnPhotos] = useState<string[]>([]);
  const [damages, setDamages] = useState<DamageDraft[]>([]);
  const [preview, setPreview] = useState<ChargePreview | null>(null);
  const [attempt, setAttempt] = useState<"handover" | "cancel" | "checklist" | null>(null);

  async function load() {
    if (orderId === undefined) return;
    const result = await api<RentalDesk>(`/api/staff/rentals/${orderId}`);
    if (!result.ok) {
      setError(failureText(result));
      return;
    }
    setRental(result.data);
    if (result.data.noShow && result.data.startKm !== null) {
      setEndKm(String(result.data.startKm));
      setFuel("0");
    }
  }

  useEffect(() => {
    if (orderId === undefined) return;
    void api<RentalDesk>(`/api/staff/rentals/${orderId}`).then((result) => {
      if (!result.ok) {
        setError(failureText(result));
        return;
      }
      setRental(result.data);
      if (result.data.noShow && result.data.startKm !== null) {
        setEndKm(String(result.data.startKm));
        setFuel("0");
      }
    });
  }, [orderId]);

  async function post(path: string, body?: unknown) {
    setError(null);
    setNotice(null);
    const result = await api<RentalDesk>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!result.ok) {
      setError(failureText(result));
      return;
    }
    setNotice(copy.saved);
    setRental(result.data);
  }

  function checklistProblems(): { missing: string[]; invalid: string[]; extra: string[] } {
    const missing: string[] = [];
    const invalid: string[] = [];
    const extra: string[] = [];
    const endIssue = wholeNumberIssue(endKm, true);
    if (endIssue === "missing") missing.push(copy.yard.endKm);
    if (endIssue === "invalid") invalid.push(copy.yard.endKm);
    if (
      rental !== null &&
      !rental.noShow &&
      rental.startKm !== null &&
      endIssue === null &&
      Number(endKm) <= rental.startKm
    ) {
      invalid.push(copy.yard.endKm);
    }
    const fuelIssue = wholeNumberIssue(fuel, true);
    if (fuel.trim() !== "" && !/^\d+(\.\d)?$/.test(fuel.trim())) invalid.push(copy.yard.fuelShort);
    else if (fuelIssue === "missing") missing.push(copy.yard.fuelShort);
    if (price === "update") {
      for (const [label, value] of [
        [copy.minAge, minAge],
        [copy.weekday, weekday],
        [copy.weekend, weekend],
        [copy.holiday, holiday],
      ] as const) {
        const issue = wholeNumberIssue(value, true);
        if (issue === "missing") missing.push(label);
        if (issue === "invalid") invalid.push(label);
      }
    }
    if (wash === "needed") extra.push(copy.yard.washOpen);
    if (treatment === "needed") extra.push(copy.yard.treatmentOpen);
    for (const damage of damages) {
      if (damage.description.trim() === "") missing.push(copy.yard.damageText);
      const money = wholeNumberIssue(damage.shekels, true);
      if (money === "missing") missing.push(copy.yard.damageShekels);
      if (money === "invalid") invalid.push(copy.yard.damageShekels);
    }
    return { missing, invalid, extra };
  }

  async function previewCharges() {
    if (orderId === undefined) return;
    setAttempt("checklist");
    const problems = checklistProblems();
    if (problemText(problems.missing, problems.invalid, problems.extra) !== null) return;
    const end = Number(endKm);
    const liters = Number(fuel);
    if (!Number.isInteger(end) || !Number.isFinite(liters)) return;
    const result = await api<ChargePreview>(`/api/staff/rentals/${orderId}/checklist/preview`, {
      method: "POST",
      body: JSON.stringify({ endKm: end, fuelLitersShort: liters }),
    });
    if (!result.ok) {
      setError(failureText(result));
      return;
    }
    setPreview(result.data);
  }

  async function finish() {
    if (orderId === undefined) return;
    setAttempt("checklist");
    setError(null);
    const problems = checklistProblems();
    if (problemText(problems.missing, problems.invalid, problems.extra) !== null) return;
    const result = await api<{ status: string; currentKm: number }>(
      `/api/staff/rentals/${orderId}/checklist`,
      {
        method: "POST",
        body: JSON.stringify({
          endKm: endKm === "" ? null : Number(endKm),
          fuelLitersShort: fuel === "" ? null : Number(fuel),
          washNeeded: wash !== "no",
          washDone: wash === "done",
          treatmentNeeded: treatment !== "no",
          treatmentDone: treatment === "done",
          treatmentNote,
          priceDecision: price,
          minAge: price === "update" ? Number(minAge) : null,
          bands:
            price === "update"
              ? [
                  {
                    minAge: Number(minAge),
                    maxAge: null,
                    weekdayShekels: Number(weekday),
                    weekendShekels: Number(weekend),
                    holidayShekels: Number(holiday),
                  },
                ]
              : null,
          returnPhotos,
          damages: damages.map((damage) => ({
            description: damage.description,
            estimatedShekels: Number(damage.shekels),
            photos: damage.photos,
          })),
        }),
      },
    );
    if (!result.ok) {
      setError(failureText(result));
      return;
    }
    setNotice(copy.saved);
    await load();
  }

  if (rental === null && error === null) return <p className="text-muted">{copy.loading}</p>;

  const handoverIssue = attempt === "handover" ? wholeNumberIssue(startKm, true) : null;
  const cancelMissing = attempt === "cancel" && note.trim() === "" ? [copy.yard.cancelNote] : [];
  const check =
    attempt === "checklist"
      ? checklistProblems()
      : { missing: [] as string[], invalid: [] as string[], extra: [] as string[] };
  const formNotice =
    handoverIssue === "missing"
      ? listedMissing([copy.yard.startKm])
      : handoverIssue === "invalid"
        ? invalidField(copy.yard.startKm)
        : cancelMissing.length > 0
          ? listedMissing(cancelMissing)
          : null;
  const fuelError =
    attempt === "checklist" && fuel.trim() === ""
      ? listedMissing([copy.yard.fuelShort])
      : attempt === "checklist" && fuel.trim() !== "" && !/^\d+(\.\d)?$/.test(fuel.trim())
        ? invalidField(copy.yard.fuelShort)
        : null;
  const endReading = wholeNumberIssue(endKm, true);
  const endKmError =
    attempt !== "checklist"
      ? null
      : endReading === "missing"
        ? listedMissing([copy.yard.endKm])
        : endReading === "invalid"
          ? invalidField(copy.yard.endKm)
          : rental !== null &&
              !rental.noShow &&
              rental.startKm !== null &&
              Number(endKm) < rental.startKm
            ? copy.errors.END_KM_BEFORE_START
            : rental !== null &&
                !rental.noShow &&
                rental.startKm !== null &&
                Number(endKm) === rental.startKm
              ? copy.yard.endKmNotHigher
              : null;

  return (
    <div className="flex flex-col gap-4">
      <Link to="/staff/rentals" className="text-sm font-medium">
        {copy.back}
      </Link>
      {formNotice !== null && <Notice tone="danger">{formNotice}</Notice>}
      {error !== null && formNotice === null && <Notice tone="danger">{error}</Notice>}
      {notice !== null && <Notice tone="success">{notice}</Notice>}
      {rental !== null && (
        <Card title={rental.number}>
          <p>
            {rental.make} {rental.model} · {rental.plate}
          </p>
          <p className="text-sm text-muted">
            {copy.yard.rentalStatuses[rental.status as keyof typeof copy.yard.rentalStatuses]} ·{" "}
            {formatShekels(rental.totalAgorot)}
          </p>
          {rental.status === "confirmed" && (
            <>
              <Field
                label={copy.yard.startKm}
                error={
                  handoverIssue === "missing"
                    ? listedMissing([copy.yard.startKm])
                    : handoverIssue === "invalid"
                      ? invalidField(copy.yard.startKm)
                      : null
                }
              >
                <TextInput value={startKm} onChange={setStartKm} invalid={handoverIssue !== null} />
              </Field>
              <PrimaryButton
                onClick={() => {
                  setAttempt("handover");
                  if (wholeNumberIssue(startKm, true) !== null) return;
                  void post(`/api/staff/rentals/${rental.id}/handover`, {
                    startKm: Number(startKm),
                  });
                }}
              >
                {copy.yard.handover}
              </PrimaryButton>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={washNeeded}
                  onChange={(event) => {
                    setWashNeeded(event.target.checked);
                  }}
                />
                {copy.yard.washChoice}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={treatmentNeeded}
                  onChange={(event) => {
                    setTreatmentNeeded(event.target.checked);
                  }}
                />
                {copy.yard.treatmentChoice}
              </label>
              <SecondaryButton
                onClick={() => {
                  void post(`/api/staff/rentals/${rental.id}/no-show`, {
                    washNeeded,
                    treatmentNeeded,
                  });
                }}
              >
                {copy.yard.noShow}
              </SecondaryButton>
              <Field
                label={copy.yard.cancelNote}
                error={fieldMark(copy.yard.cancelNote, cancelMissing)}
              >
                <TextInput value={note} onChange={setNote} invalid={cancelMissing.length > 0} />
              </Field>
              <SecondaryButton
                onClick={() => {
                  setAttempt("cancel");
                  if (note.trim() === "") return;
                  void post(`/api/staff/rentals/${rental.id}/cancel`, { note });
                }}
              >
                {copy.yard.yardCancel}
              </SecondaryButton>
            </>
          )}
          {rental.status === "active" && (
            <PrimaryButton
              onClick={() => {
                void post(`/api/staff/rentals/${rental.id}/returned`);
              }}
            >
              {copy.yard.returned}
            </PrimaryButton>
          )}
        </Card>
      )}
      {rental?.status === "checklist" && (
        <Card title={copy.yard.checklist}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{copy.yard.startKm}</span>
              <span className="rounded-control border border-line bg-page px-3 py-2 text-ink">
                {rental.startKm === null ? "—" : formatKm(rental.startKm)}
              </span>
            </div>
            <Field label={copy.yard.endKm} error={endKmError}>
              <TextInput
                value={endKm}
                onChange={setEndKm}
                disabled={rental.noShow}
                invalid={endKmError !== null}
              />
            </Field>
          </div>
          <Field label={copy.yard.fuelShort} error={fuelError}>
            <TextInput
              value={fuel}
              onChange={setFuel}
              disabled={rental.noShow}
              invalid={fuelError !== null}
            />
          </Field>
          <SecondaryButton
            onClick={() => {
              void previewCharges();
            }}
          >
            {copy.yard.charges}
          </SecondaryButton>
          {preview !== null && (
            <p className="text-sm">
              {copy.yard.excessKm}: {preview.kmExcess} · {formatShekels(preview.kmChargeAgorot)} ·{" "}
              {formatShekels(preview.fuelChargeAgorot)}
            </p>
          )}
          <p className="font-medium">{copy.yard.damages}</p>
          {damages.map((damage) => (
            <div key={damage.key} className="flex flex-col gap-2">
              <Field
                label={copy.yard.damageText}
                error={
                  attempt === "checklist" && damage.description.trim() === ""
                    ? listedMissing([copy.yard.damageText])
                    : null
                }
              >
                <TextInput
                  value={damage.description}
                  invalid={attempt === "checklist" && damage.description.trim() === ""}
                  onChange={(value) => {
                    setDamages((current) =>
                      current.map((item) =>
                        item.key === damage.key ? { ...item, description: value } : item,
                      ),
                    );
                  }}
                />
              </Field>
              <Field
                label={copy.yard.damageShekels}
                error={
                  attempt === "checklist"
                    ? fieldMark(
                        copy.yard.damageShekels,
                        damage.shekels.trim() === "" ? [copy.yard.damageShekels] : [],
                        wholeNumberIssue(damage.shekels, true) === "invalid"
                          ? [copy.yard.damageShekels]
                          : [],
                      )
                    : null
                }
              >
                <TextInput
                  value={damage.shekels}
                  invalid={
                    attempt === "checklist" && wholeNumberIssue(damage.shekels, true) !== null
                  }
                  onChange={(value) => {
                    setDamages((current) =>
                      current.map((item) =>
                        item.key === damage.key ? { ...item, shekels: value } : item,
                      ),
                    );
                  }}
                />
              </Field>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void readBase64(file).then((photo) => {
                    setDamages((current) =>
                      current.map((item) =>
                        item.key === damage.key
                          ? { ...item, photos: [...item.photos, photo] }
                          : item,
                      ),
                    );
                  });
                }}
              />
              <SecondaryButton
                onClick={() => {
                  setDamages((current) => current.filter((item) => item.key !== damage.key));
                }}
              >
                {copy.yard.removeDamage}
              </SecondaryButton>
            </div>
          ))}
          <SecondaryButton
            onClick={() => {
              setDamages((current) => [
                ...current,
                { key: crypto.randomUUID(), description: "", shekels: "", photos: [] },
              ]);
            }}
          >
            {copy.yard.addDamage}
          </SecondaryButton>
          <Choice
            label={copy.yard.washChoice}
            value={wash}
            onChange={setWash}
            error={attempt === "checklist" && wash === "needed" ? copy.yard.washOpen : null}
          />
          <Choice
            label={copy.yard.treatmentChoice}
            value={treatment}
            onChange={setTreatment}
            error={
              attempt === "checklist" && treatment === "needed" ? copy.yard.treatmentOpen : null
            }
          />
          <Field label={copy.yard.treatmentNote}>
            <TextInput value={treatmentNote} onChange={setTreatmentNote} />
          </Field>
          {!rental.noShow && (
            <>
              <p className="font-medium">{copy.yard.returnPhotos}</p>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void readBase64(file).then((photo) => {
                    setReturnPhotos((current) => [...current, photo]);
                  });
                }}
              />
            </>
          )}
          <p className="font-medium">{copy.yard.priceDecision}</p>
          <div className="flex gap-2">
            <SecondaryButton
              onClick={() => {
                setPrice("keep");
              }}
            >
              {copy.yard.keepPrice}
            </SecondaryButton>
            <SecondaryButton
              onClick={() => {
                setPrice("update");
              }}
            >
              {copy.yard.updatePrice}
            </SecondaryButton>
          </div>
          {price === "update" && (
            <>
              <Field
                label={copy.minAge}
                error={fieldMark(copy.minAge, check.missing, check.invalid)}
              >
                <TextInput
                  value={minAge}
                  onChange={setMinAge}
                  invalid={fieldMark(copy.minAge, check.missing, check.invalid) !== null}
                />
              </Field>
              <Field
                label={copy.weekday}
                error={fieldMark(copy.weekday, check.missing, check.invalid)}
              >
                <TextInput
                  value={weekday}
                  onChange={setWeekday}
                  invalid={fieldMark(copy.weekday, check.missing, check.invalid) !== null}
                />
              </Field>
              <Field
                label={copy.weekend}
                error={fieldMark(copy.weekend, check.missing, check.invalid)}
              >
                <TextInput
                  value={weekend}
                  onChange={setWeekend}
                  invalid={fieldMark(copy.weekend, check.missing, check.invalid) !== null}
                />
              </Field>
              <Field
                label={copy.holiday}
                error={fieldMark(copy.holiday, check.missing, check.invalid)}
              >
                <TextInput
                  value={holiday}
                  onChange={setHoliday}
                  invalid={fieldMark(copy.holiday, check.missing, check.invalid) !== null}
                />
              </Field>
            </>
          )}
          <PrimaryButton
            onClick={() => {
              void finish();
            }}
          >
            {copy.yard.finish}
          </PrimaryButton>
        </Card>
      )}
    </div>
  );
}

function Choice(props: {
  label: string;
  value: "no" | "needed" | "done";
  onChange: (value: "no" | "needed" | "done") => void;
  error?: string | null;
}) {
  const options = [
    ["no", copy.yard.notNeeded],
    ["needed", copy.yard.needed],
    ["done", copy.yard.done],
  ] as const;
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-medium">{props.label}</legend>
      {options.map(([value, label]) => (
        <label key={value} className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={props.label}
            checked={props.value === value}
            onChange={() => {
              props.onChange(value);
            }}
          />
          {label}
        </label>
      ))}
      {props.error != null && props.error !== "" && (
        <span className="text-danger" role="alert">
          {props.error}
        </span>
      )}
    </fieldset>
  );
}
