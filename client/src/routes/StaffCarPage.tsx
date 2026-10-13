import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";

import {
  api,
  failureText,
  type ApiResult,
  type StaffCar,
  type StaffSession,
  type Tag,
} from "../api/staff";
import { Card, Field, Notice, PrimaryButton, SecondaryButton, TextInput } from "../components/Form";
import { copy } from "../copy";
import {
  blankLabels,
  fieldMark,
  invalidField,
  listedMissing,
  problemText,
  wholeNumberIssue,
  type FieldIssue,
} from "../required-fields";

type BandDraft = {
  key: string;
  minAge: string;
  maxAge: string;
  weekday: string;
  weekend: string;
  holiday: string;
};

const types = ["mini", "family", "suv", "seven_seat", "luxury", "commercial"] as const;

function integer(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
}

type Attempt = "car" | "bands" | "km" | "photo";
type Issues = { missing: string[]; invalid: string[] };
const clearIssues: Issues = { missing: [], invalid: [] };

function remember(issues: Issues, label: string, issue: FieldIssue | null) {
  if (issue === "missing") issues.missing.push(label);
  if (issue === "invalid") issues.invalid.push(label);
}

function carIssues(input: {
  plate: string;
  make: string;
  model: string;
  year: string;
  color: string;
  seats: string;
  currentKm: string;
  purchasedAt: string;
  minAge: string;
}): Issues {
  const issues: Issues = {
    missing: blankLabels([
      { label: copy.plate, value: input.plate },
      { label: copy.make, value: input.make },
      { label: copy.model, value: input.model },
      { label: copy.year, value: input.year },
      { label: copy.color, value: input.color },
      { label: copy.seats, value: input.seats },
      { label: copy.km, value: input.currentKm },
      { label: copy.purchasedAt, value: input.purchasedAt },
    ]),
    invalid: [],
  };
  remember(issues, copy.year, wholeNumberIssue(input.year, true) === "invalid" ? "invalid" : null);
  remember(
    issues,
    copy.seats,
    wholeNumberIssue(input.seats, true) === "invalid" ? "invalid" : null,
  );
  remember(
    issues,
    copy.km,
    wholeNumberIssue(input.currentKm, true) === "invalid" ? "invalid" : null,
  );
  remember(issues, copy.minAge, wholeNumberIssue(input.minAge, false));
  return issues;
}

function kmIssues(nextKm: string, reason: string): Issues {
  const issues: Issues = {
    missing: blankLabels([
      { label: copy.km, value: nextKm },
      { label: copy.kmReason, value: reason },
    ]),
    invalid: [],
  };
  remember(issues, copy.km, wholeNumberIssue(nextKm, true) === "invalid" ? "invalid" : null);
  if (reason.trim() !== "" && reason.trim().length < 2) issues.invalid.push(copy.kmReason);
  return issues;
}

function bandIssues(minAge: string, bands: readonly BandDraft[]): Issues {
  const issues: Issues = { missing: [], invalid: [] };
  remember(issues, copy.minAge, wholeNumberIssue(minAge, true));
  for (const band of bands) {
    remember(issues, copy.fromAge, wholeNumberIssue(band.minAge, true));
    remember(issues, copy.toAge, wholeNumberIssue(band.maxAge, false));
    remember(issues, copy.weekday, wholeNumberIssue(band.weekday, true));
    remember(issues, copy.weekend, wholeNumberIssue(band.weekend, true));
    remember(issues, copy.holiday, wholeNumberIssue(band.holiday, true));
  }
  return issues;
}

function bandMark(
  attempt: Attempt | null,
  band: BandDraft,
  field: "minAge" | "maxAge" | "weekday" | "weekend" | "holiday",
): string | null {
  if (attempt !== "bands") return null;
  const label = {
    minAge: copy.fromAge,
    maxAge: copy.toAge,
    weekday: copy.weekday,
    weekend: copy.weekend,
    holiday: copy.holiday,
  }[field];
  const issue = wholeNumberIssue(band[field], field !== "maxAge");
  if (issue === "missing") return listedMissing([label]);
  if (issue === "invalid") return invalidField(label);
  return null;
}

function emptyBand(): BandDraft {
  return {
    key: crypto.randomUUID(),
    minAge: "",
    maxAge: "",
    weekday: "",
    weekend: "",
    holiday: "",
  };
}

function show(
  result: ApiResult<unknown>,
  setError: (value: string | null) => void,
  setSaved: (value: boolean) => void,
): boolean {
  if (!result.ok) {
    setSaved(false);
    setError(failureText(result));
    return false;
  }
  setError(null);
  setSaved(true);
  return true;
}

export function StaffCarPage() {
  const typeLabels: Record<string, string> = { ...copy.types };
  const statusLabels: Record<string, string> = { ...copy.statuses };
  const careLabels: Record<string, string> = { ...copy.care };
  const session = useOutletContext<StaffSession>();
  const params = useParams();
  const navigate = useNavigate();
  const carId = params.carId;
  const [tags, setTags] = useState<Tag[]>([]);
  const [car, setCar] = useState<StaffCar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [plate, setPlate] = useState("");
  const [vin, setVin] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");
  const [primaryType, setPrimaryType] = useState("family");
  const [seats, setSeats] = useState("5");
  const [currentKm, setCurrentKm] = useState("0");
  const [purchasedAt, setPurchasedAt] = useState("");
  const [minAge, setMinAge] = useState("");
  const [notes, setNotes] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [bands, setBands] = useState<BandDraft[]>([emptyBand()]);
  const [alt, setAlt] = useState("");
  const [nextKm, setNextKm] = useState("");
  const [kmReason, setKmReason] = useState("");

  useEffect(() => {
    void api<Tag[]>("/api/staff/tags").then((result) => {
      if (result.ok) setTags(result.data);
    });
  }, []);

  useEffect(() => {
    if (carId === undefined) return;
    void api<StaffCar>(`/api/staff/cars/${carId}`).then((result) => {
      if (!result.ok) {
        setError(failureText(result));
        return;
      }
      const loaded = result.data;
      setCar(loaded);
      setPlate(loaded.plate);
      setVin(loaded.vin ?? "");
      setMake(loaded.make);
      setModel(loaded.model);
      setYear(String(loaded.year));
      setColor(loaded.color);
      setPrimaryType(loaded.primaryType);
      setSeats(String(loaded.seats));
      setCurrentKm(String(loaded.currentKm));
      setPurchasedAt(loaded.purchasedAt);
      setMinAge(loaded.minAge === null ? "" : String(loaded.minAge));
      setNotes(loaded.internalNotes);
      setTagIds(loaded.tags.map((tag) => tag.id));
      if (loaded.ageBands.length > 0) {
        setBands(
          loaded.ageBands.map((band) => ({
            key: band.id,
            minAge: String(band.minAge),
            maxAge: band.maxAge === null ? "" : String(band.maxAge),
            weekday: String(band.weekdayDailyAgorot / 100),
            weekend: String(band.weekendDailyAgorot / 100),
            holiday: String(band.holidayDailyAgorot / 100),
          })),
        );
      }
    });
  }, [carId]);

  function payload() {
    const yearNumber = integer(year);
    const seatsNumber = integer(seats);
    const kmNumber = integer(currentKm);
    const ageNumber = minAge.trim().length === 0 ? null : integer(minAge);
    if (
      yearNumber === null ||
      seatsNumber === null ||
      kmNumber === null ||
      (minAge.trim().length > 0 && ageNumber === null)
    ) {
      return null;
    }
    return {
      plate,
      vin: vin.trim().length === 0 ? null : vin,
      make,
      model,
      year: yearNumber,
      color,
      primaryType,
      seats: seatsNumber,
      currentKm: kmNumber,
      purchasedAt,
      minAge: ageNumber,
      internalNotes: notes,
      tagIds,
    };
  }

  async function saveCar() {
    setSaved(false);
    setError(null);
    setAttempt("car");
    const issues = carIssues({
      plate,
      make,
      model,
      year,
      color,
      seats,
      currentKm,
      purchasedAt,
      minAge,
    });
    if (problemText(issues.missing, issues.invalid) !== null) return;
    const body = payload();
    if (body === null) {
      setError(copy.errors.INVALID_INPUT);
      return;
    }
    const result =
      carId === undefined
        ? await api<StaffCar>("/api/staff/cars", { method: "POST", body: JSON.stringify(body) })
        : await api<StaffCar>(`/api/staff/cars/${carId}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          });
    if (!show(result, setError, setSaved) || !result.ok) return;
    setCar(result.data);
    if (carId === undefined) await navigate(`/staff/cars/${result.data.id}`);
  }

  async function saveBands() {
    if (car === null) return;
    setSaved(false);
    setError(null);
    setAttempt("bands");
    const issues = bandIssues(minAge, bands);
    if (problemText(issues.missing, issues.invalid) !== null) return;
    const ageNumber = integer(minAge);
    if (ageNumber === null) {
      setError(copy.errors.INVALID_INPUT);
      return;
    }
    const parsed = bands.map((band) => {
      const from = integer(band.minAge);
      const weekday = integer(band.weekday);
      const weekend = integer(band.weekend);
      const holiday = integer(band.holiday);
      const max = band.maxAge.trim().length === 0 ? null : integer(band.maxAge);
      if (
        from === null ||
        weekday === null ||
        weekend === null ||
        holiday === null ||
        (band.maxAge.trim().length > 0 && max === null)
      ) {
        return null;
      }
      return {
        minAge: from,
        maxAge: max,
        weekdayShekels: weekday,
        weekendShekels: weekend,
        holidayShekels: holiday,
      };
    });
    if (parsed.some((band) => band === null)) {
      setError(copy.errors.INVALID_INPUT);
      return;
    }
    const result = await api<StaffCar>(`/api/staff/cars/${car.id}/age-bands`, {
      method: "PUT",
      body: JSON.stringify({ minAge: ageNumber, bands: parsed }),
    });
    if (!show(result, setError, setSaved) || !result.ok) return;
    setCar(result.data);
  }

  async function addPhoto(file: File) {
    if (car === null) return;
    setSaved(false);
    setError(null);
    setAttempt("photo");
    if (alt.trim() === "" || alt.trim().length > 120) return;
    let base64: string;
    try {
      base64 = await readBase64(file);
    } catch {
      setError(copy.errors.INVALID_PHOTO);
      return;
    }
    const result = await api<StaffCar>(`/api/staff/cars/${car.id}/photos`, {
      method: "POST",
      body: JSON.stringify({ alt, contentBase64: base64 }),
    });
    if (!show(result, setError, setSaved) || !result.ok) return;
    setCar(result.data);
    setAttempt(null);
    setAlt("");
  }

  async function removePhoto(photoId: string) {
    if (car === null) return;
    const result = await api<StaffCar>(`/api/staff/cars/${car.id}/photos/${photoId}`, {
      method: "DELETE",
    });
    if (!show(result, setError, setSaved) || !result.ok) return;
    setCar(result.data);
  }

  async function correctKm() {
    if (car === null) return;
    setSaved(false);
    setError(null);
    setAttempt("km");
    const issues = kmIssues(nextKm, kmReason);
    if (problemText(issues.missing, issues.invalid) !== null) return;
    const km = integer(nextKm);
    if (km === null || kmReason.trim().length < 2) {
      setError(copy.errors.INVALID_INPUT);
      return;
    }
    const result = await api<StaffCar>(`/api/staff/cars/${car.id}/km`, {
      method: "POST",
      body: JSON.stringify({ nextKm: km, reason: kmReason }),
    });
    if (!show(result, setError, setSaved) || !result.ok) return;
    setCar(result.data);
    setCurrentKm(String(result.data.currentKm));
    setAttempt(null);
    setNextKm("");
    setKmReason("");
  }

  async function move(
    to: "available" | "in_care" | "deep_treatment",
    careReason?: "wash" | "treatment" | "other",
  ) {
    if (car === null) return;
    const result = await api<StaffCar>(`/api/staff/cars/${car.id}/status`, {
      method: "POST",
      body: JSON.stringify(careReason === undefined ? { to } : { to, careReason }),
    });
    if (!show(result, setError, setSaved) || !result.ok) return;
    setCar(result.data);
  }

  const kmLocked = car !== null;
  const canCorrectKm = session.permissions.includes("settings.write");
  const visibleTags = tags.filter((tag) => tag.active || tagIds.includes(tag.id));
  const carGroup =
    attempt === "car"
      ? carIssues({ plate, make, model, year, color, seats, currentKm, purchasedAt, minAge })
      : clearIssues;
  const priceGroup = attempt === "bands" ? bandIssues(minAge, bands) : clearIssues;
  const kmGroup = attempt === "km" ? kmIssues(nextKm, kmReason) : clearIssues;
  const photoGroup: Issues =
    attempt === "photo"
      ? {
          missing: alt.trim() === "" ? [copy.photoAlt] : [],
          invalid: alt.trim().length > 120 ? [copy.photoAlt] : [],
        }
      : clearIssues;
  const activeGroup =
    attempt === "car"
      ? carGroup
      : attempt === "bands"
        ? priceGroup
        : attempt === "km"
          ? kmGroup
          : attempt === "photo"
            ? photoGroup
            : clearIssues;
  const formNotice = problemText(activeGroup.missing, activeGroup.invalid);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {car === null ? copy.newCar : `${car.make} ${car.model}`}
        </h1>
        <Link to="/staff/cars" className="text-sm font-medium">
          {copy.back}
        </Link>
      </div>
      {formNotice !== null && <Notice tone="danger">{formNotice}</Notice>}
      {error !== null && formNotice === null && <Notice tone="danger">{error}</Notice>}
      {saved && error === null && formNotice === null && (
        <Notice tone="success">{copy.saved}</Notice>
      )}

      <Card title={copy.identity}>
        <Field label={copy.plate} error={fieldMark(copy.plate, carGroup.missing, carGroup.invalid)}>
          <TextInput
            value={plate}
            onChange={setPlate}
            invalid={fieldMark(copy.plate, carGroup.missing, carGroup.invalid) !== null}
          />
        </Field>
        <Field label={copy.vin}>
          <TextInput value={vin} onChange={setVin} />
        </Field>
        <Field label={copy.make} error={fieldMark(copy.make, carGroup.missing, carGroup.invalid)}>
          <TextInput
            value={make}
            onChange={setMake}
            invalid={fieldMark(copy.make, carGroup.missing, carGroup.invalid) !== null}
          />
        </Field>
        <Field label={copy.model} error={fieldMark(copy.model, carGroup.missing, carGroup.invalid)}>
          <TextInput
            value={model}
            onChange={setModel}
            invalid={fieldMark(copy.model, carGroup.missing, carGroup.invalid) !== null}
          />
        </Field>
        <Field label={copy.year} error={fieldMark(copy.year, carGroup.missing, carGroup.invalid)}>
          <TextInput
            value={year}
            onChange={setYear}
            invalid={fieldMark(copy.year, carGroup.missing, carGroup.invalid) !== null}
          />
        </Field>
        <Field label={copy.color} error={fieldMark(copy.color, carGroup.missing, carGroup.invalid)}>
          <TextInput
            value={color}
            onChange={setColor}
            invalid={fieldMark(copy.color, carGroup.missing, carGroup.invalid) !== null}
          />
        </Field>
      </Card>

      <Card title={copy.classification}>
        <Field label={copy.type}>
          <select
            value={primaryType}
            onChange={(event) => {
              setPrimaryType(event.target.value);
            }}
            className="rounded-control border border-line bg-card px-3 py-2"
          >
            {types.map((type) => (
              <option key={type} value={type}>
                {typeLabels[type] ?? type}
              </option>
            ))}
          </select>
        </Field>
        <Field label={copy.seats} error={fieldMark(copy.seats, carGroup.missing, carGroup.invalid)}>
          <TextInput
            value={seats}
            onChange={setSeats}
            invalid={fieldMark(copy.seats, carGroup.missing, carGroup.invalid) !== null}
          />
        </Field>
        <Field
          label={copy.minAge}
          error={
            fieldMark(copy.minAge, carGroup.missing, carGroup.invalid) ??
            fieldMark(copy.minAge, priceGroup.missing, priceGroup.invalid)
          }
        >
          <TextInput
            value={minAge}
            onChange={setMinAge}
            invalid={
              fieldMark(copy.minAge, carGroup.missing, carGroup.invalid) !== null ||
              fieldMark(copy.minAge, priceGroup.missing, priceGroup.invalid) !== null
            }
          />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{copy.tags}</legend>
          {visibleTags.map((tag) => (
            <label key={tag.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={tagIds.includes(tag.id)}
                onChange={(event) => {
                  setTagIds((current) =>
                    event.target.checked
                      ? [...current, tag.id]
                      : current.filter((id) => id !== tag.id),
                  );
                }}
              />
              {tag.name}
            </label>
          ))}
        </fieldset>
      </Card>

      <Card title={copy.purchase}>
        <Field label={copy.km} error={fieldMark(copy.km, carGroup.missing, carGroup.invalid)}>
          <TextInput
            value={currentKm}
            onChange={setCurrentKm}
            disabled={kmLocked}
            invalid={fieldMark(copy.km, carGroup.missing, carGroup.invalid) !== null}
          />
        </Field>
        {kmLocked && !canCorrectKm && <p className="text-sm text-muted">{copy.kmLocked}</p>}
        {kmLocked && canCorrectKm && (
          <>
            <Field label={copy.km} error={fieldMark(copy.km, kmGroup.missing, kmGroup.invalid)}>
              <TextInput
                value={nextKm}
                onChange={setNextKm}
                invalid={fieldMark(copy.km, kmGroup.missing, kmGroup.invalid) !== null}
              />
            </Field>
            <Field
              label={copy.kmReason}
              error={fieldMark(copy.kmReason, kmGroup.missing, kmGroup.invalid)}
            >
              <TextInput
                value={kmReason}
                onChange={setKmReason}
                invalid={fieldMark(copy.kmReason, kmGroup.missing, kmGroup.invalid) !== null}
              />
            </Field>
            <SecondaryButton
              onClick={() => {
                void correctKm();
              }}
            >
              {copy.correctKm}
            </SecondaryButton>
          </>
        )}
        <Field
          label={copy.purchasedAt}
          error={fieldMark(copy.purchasedAt, carGroup.missing, carGroup.invalid)}
        >
          <TextInput
            value={purchasedAt}
            onChange={setPurchasedAt}
            type="date"
            invalid={fieldMark(copy.purchasedAt, carGroup.missing, carGroup.invalid) !== null}
          />
        </Field>
        <Field label={copy.notes}>
          <TextInput value={notes} onChange={setNotes} />
        </Field>
        <PrimaryButton
          onClick={() => {
            void saveCar();
          }}
        >
          {copy.save}
        </PrimaryButton>
      </Card>

      {car !== null && (
        <Card title={copy.prices}>
          {bands.map((band) => (
            <div key={band.key} className="grid gap-2 border-b border-line pb-3 sm:grid-cols-2">
              <Field label={copy.fromAge} error={bandMark(attempt, band, "minAge")}>
                <TextInput
                  value={band.minAge}
                  invalid={bandMark(attempt, band, "minAge") !== null}
                  onChange={(value) => {
                    setBands((current) =>
                      current.map((item) =>
                        item.key === band.key ? { ...item, minAge: value } : item,
                      ),
                    );
                  }}
                />
              </Field>
              <Field label={copy.toAge} error={bandMark(attempt, band, "maxAge")}>
                <TextInput
                  value={band.maxAge}
                  invalid={bandMark(attempt, band, "maxAge") !== null}
                  onChange={(value) => {
                    setBands((current) =>
                      current.map((item) =>
                        item.key === band.key ? { ...item, maxAge: value } : item,
                      ),
                    );
                  }}
                />
              </Field>
              <Field label={copy.weekday} error={bandMark(attempt, band, "weekday")}>
                <TextInput
                  value={band.weekday}
                  invalid={bandMark(attempt, band, "weekday") !== null}
                  onChange={(value) => {
                    setBands((current) =>
                      current.map((item) =>
                        item.key === band.key ? { ...item, weekday: value } : item,
                      ),
                    );
                  }}
                />
              </Field>
              <Field label={copy.weekend} error={bandMark(attempt, band, "weekend")}>
                <TextInput
                  value={band.weekend}
                  invalid={bandMark(attempt, band, "weekend") !== null}
                  onChange={(value) => {
                    setBands((current) =>
                      current.map((item) =>
                        item.key === band.key ? { ...item, weekend: value } : item,
                      ),
                    );
                  }}
                />
              </Field>
              <Field label={copy.holiday} error={bandMark(attempt, band, "holiday")}>
                <TextInput
                  value={band.holiday}
                  invalid={bandMark(attempt, band, "holiday") !== null}
                  onChange={(value) => {
                    setBands((current) =>
                      current.map((item) =>
                        item.key === band.key ? { ...item, holiday: value } : item,
                      ),
                    );
                  }}
                />
              </Field>
              <SecondaryButton
                onClick={() => {
                  setBands((current) => current.filter((item) => item.key !== band.key));
                }}
              >
                {copy.removeBand}
              </SecondaryButton>
            </div>
          ))}
          <SecondaryButton
            onClick={() => {
              setBands((current) => [...current, emptyBand()]);
            }}
          >
            {copy.addBand}
          </SecondaryButton>
          <PrimaryButton
            onClick={() => {
              void saveBands();
            }}
          >
            {copy.save}
          </PrimaryButton>
        </Card>
      )}

      {car !== null && (
        <Card title={copy.photos}>
          <ul className="flex flex-col gap-3">
            {car.photos.map((photo) => (
              <li key={photo.id} className="flex items-center gap-3">
                <img
                  src={`/media/cars/${car.id}/${photo.id}`}
                  alt={photo.alt}
                  className="h-20 w-28 rounded-control object-cover"
                />
                <span className="flex-1 text-sm">{photo.alt}</span>
                <SecondaryButton
                  onClick={() => {
                    void removePhoto(photo.id);
                  }}
                >
                  {copy.removePhoto}
                </SecondaryButton>
              </li>
            ))}
          </ul>
          <Field
            label={copy.photoAlt}
            error={fieldMark(copy.photoAlt, photoGroup.missing, photoGroup.invalid)}
          >
            <TextInput
              value={alt}
              onChange={setAlt}
              invalid={fieldMark(copy.photoAlt, photoGroup.missing, photoGroup.invalid) !== null}
            />
          </Field>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void addPhoto(file);
            }}
          />
        </Card>
      )}

      {car !== null && (
        <Card title={copy.status}>
          <p className="font-medium">
            {statusLabels[car.status] ?? car.status}
            {car.careReason !== null ? ` · ${careLabels[car.careReason] ?? car.careReason}` : ""}
          </p>
          {car.status === "preparing" && (
            <PrimaryButton
              onClick={() => {
                void move("available");
              }}
            >
              {copy.publish}
            </PrimaryButton>
          )}
          {car.status === "available" && (
            <div className="flex flex-wrap gap-2">
              <SecondaryButton
                onClick={() => {
                  void move("in_care", "wash");
                }}
              >
                {copy.wash}
              </SecondaryButton>
              <SecondaryButton
                onClick={() => {
                  void move("in_care", "treatment");
                }}
              >
                {copy.treatment}
              </SecondaryButton>
              <SecondaryButton
                onClick={() => {
                  void move("in_care", "other");
                }}
              >
                {copy.otherCare}
              </SecondaryButton>
              <SecondaryButton
                onClick={() => {
                  void move("deep_treatment");
                }}
              >
                {copy.deepTreatment}
              </SecondaryButton>
            </div>
          )}
          {car.status === "deep_treatment" && (
            <DeepTreatmentForm
              carId={car.id}
              onDone={(next) => {
                setCar(next);
                setSaved(true);
              }}
              onError={setError}
            />
          )}
          {car.status === "in_care" && (
            <PrimaryButton
              onClick={() => {
                void move("available");
              }}
            >
              {copy.backToAvailable}
            </PrimaryButton>
          )}
        </Card>
      )}
    </div>
  );
}

function DeepTreatmentForm(props: {
  carId: string;
  onDone: (car: StaffCar) => void;
  onError: (value: string | null) => void;
}) {
  const [owners, setOwners] = useState("1");
  const [accidentsNone, setAccidentsNone] = useState(true);
  const [accidents, setAccidents] = useState("");
  const [grade, setGrade] = useState("good");
  const [price, setPrice] = useState("");
  const [completedAt, setCompletedAt] = useState("");
  const [tried, setTried] = useState(false);

  function saleIssues(): Issues {
    const issues: Issues = { missing: [], invalid: [] };
    const ownersIssue = wholeNumberIssue(owners, true);
    if (ownersIssue !== null) remember(issues, copy.yard.owners, ownersIssue);
    else if (Number(owners) < 1) remember(issues, copy.yard.owners, "invalid");
    if (!accidentsNone && accidents.trim() === "") issues.missing.push(copy.yard.accidentsText);
    if (grade.trim() === "") issues.missing.push(copy.yard.grade);
    else if (grade !== "excellent" && grade !== "good" && grade !== "fair") {
      issues.invalid.push(copy.yard.grade);
    }
    const priceIssue = wholeNumberIssue(price, true);
    if (priceIssue !== null) remember(issues, copy.yard.salePrice, priceIssue);
    else if (Number(price) < 1) remember(issues, copy.yard.salePrice, "invalid");
    if (completedAt.trim() === "") issues.missing.push(copy.yard.treatmentDate);
    return issues;
  }

  const saleGroup = tried ? saleIssues() : clearIssues;

  async function finish() {
    setTried(true);
    const issues = saleIssues();
    const text = problemText(issues.missing, issues.invalid);
    if (text !== null) {
      props.onError(text);
      return;
    }
    const ownersCount = integer(owners);
    const salePriceShekels = integer(price);
    if (ownersCount === null || salePriceShekels === null || completedAt === "") {
      props.onError(copy.errors.INVALID_INPUT);
      return;
    }
    const result = await api<StaffCar>(`/api/staff/cars/${props.carId}/deep-treatment`, {
      method: "POST",
      body: JSON.stringify({
        ownersCount,
        knownAccidents: accidentsNone ? null : accidents,
        accidentsNone,
        conditionGrade: grade,
        salePriceShekels,
        completedAt,
      }),
    });
    if (!result.ok) {
      props.onError(failureText(result));
      return;
    }
    props.onError(null);
    props.onDone(result.data);
  }

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      <p className="font-medium">{copy.yard.completeTreatment}</p>
      <Field
        label={copy.yard.owners}
        error={fieldMark(copy.yard.owners, saleGroup.missing, saleGroup.invalid)}
      >
        <TextInput
          value={owners}
          onChange={setOwners}
          invalid={fieldMark(copy.yard.owners, saleGroup.missing, saleGroup.invalid) !== null}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={accidentsNone}
          onChange={(event) => {
            setAccidentsNone(event.target.checked);
          }}
        />
        {copy.yard.noAccidents}
      </label>
      {!accidentsNone && (
        <Field
          label={copy.yard.accidentsText}
          error={fieldMark(copy.yard.accidentsText, saleGroup.missing, saleGroup.invalid)}
        >
          <TextInput
            value={accidents}
            onChange={setAccidents}
            invalid={
              fieldMark(copy.yard.accidentsText, saleGroup.missing, saleGroup.invalid) !== null
            }
          />
        </Field>
      )}
      <Field
        label={copy.yard.grade}
        error={fieldMark(copy.yard.grade, saleGroup.missing, saleGroup.invalid)}
      >
        <TextInput
          value={grade}
          onChange={setGrade}
          invalid={fieldMark(copy.yard.grade, saleGroup.missing, saleGroup.invalid) !== null}
        />
      </Field>
      <Field
        label={copy.yard.salePrice}
        error={fieldMark(copy.yard.salePrice, saleGroup.missing, saleGroup.invalid)}
      >
        <TextInput
          value={price}
          onChange={setPrice}
          invalid={fieldMark(copy.yard.salePrice, saleGroup.missing, saleGroup.invalid) !== null}
        />
      </Field>
      <Field
        label={copy.yard.treatmentDate}
        error={fieldMark(copy.yard.treatmentDate, saleGroup.missing, saleGroup.invalid)}
      >
        <TextInput
          value={completedAt}
          onChange={setCompletedAt}
          type="date"
          invalid={
            fieldMark(copy.yard.treatmentDate, saleGroup.missing, saleGroup.invalid) !== null
          }
        />
      </Field>
      <PrimaryButton
        onClick={() => {
          void finish();
        }}
      >
        {copy.yard.completeTreatment}
      </PrimaryButton>
    </div>
  );
}

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
