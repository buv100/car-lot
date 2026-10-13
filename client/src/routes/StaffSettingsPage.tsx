import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";

import {
  api,
  failureText,
  type Holiday,
  type InsurancePackage,
  type LotSettings,
  type SettingChange,
  type StaffAccount,
  type StaffSession,
  type Tag,
} from "../api/staff";
import { Card, Field, Notice, PrimaryButton, SecondaryButton, TextInput } from "../components/Form";
import { copy } from "../copy";
import { fieldMark, listedMissing, problemText, type FieldIssue } from "../required-fields";
import { formatJerusalem } from "../format";

function integer(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
}

type Issues = { missing: string[]; invalid: string[] };
const clearIssues: Issues = { missing: [], invalid: [] };

function remember(issues: Issues, label: string, issue: FieldIssue | null) {
  if (issue === "missing") issues.missing.push(label);
  if (issue === "invalid") issues.invalid.push(label);
}

function emailIssue(value: string): FieldIssue | null {
  const text = value.trim();
  if (text === "") return null;
  if (text.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return "invalid";
  return null;
}

function nameIssue(label: string, value: string, min: number): Issues {
  if (value.trim() === "") return { missing: [label], invalid: [] };
  if (value.trim().length < min) return { missing: [], invalid: [label] };
  return { missing: [], invalid: [] };
}

function passwordAccepted(password: string): boolean {
  return password.length >= 8 && /\p{L}/u.test(password) && /\d/u.test(password);
}

function lotIssues(lot: LotSettings): Issues {
  const issues: Issues = { missing: [], invalid: [] };
  if (lot.latitude === null && lot.longitude !== null) issues.missing.push(copy.latitude);
  if (lot.longitude === null && lot.latitude !== null) issues.missing.push(copy.longitude);
  if (
    lot.latitude !== null &&
    (!Number.isFinite(lot.latitude) || lot.latitude < -90 || lot.latitude > 90)
  ) {
    issues.invalid.push(copy.latitude);
  }
  if (
    lot.longitude !== null &&
    (!Number.isFinite(lot.longitude) || lot.longitude < -180 || lot.longitude > 180)
  ) {
    issues.invalid.push(copy.longitude);
  }
  remember(issues, copy.publicEmail, emailIssue(lot.publicEmail));
  remember(issues, copy.staffEmail, emailIssue(lot.staffAlertEmail));
  return issues;
}

function holidayIssues(name: string, date: string): Issues {
  const issues = nameIssue(copy.holidayName, name, 2);
  if (date.trim() === "") issues.missing.push(copy.holidayDate);
  return issues;
}

function staffIssues(name: string, email: string, password: string): Issues {
  const issues = nameIssue(copy.fullName, name, 2);
  if (email.trim() === "") issues.missing.push(copy.email);
  else remember(issues, copy.email, emailIssue(email));
  if (password.trim() === "") issues.missing.push(copy.password);
  else if (!passwordAccepted(password)) issues.invalid.push(copy.password);
  return issues;
}

function historyLine(value: SettingChange["previous"]): string {
  const parts: string[] = [];
  if (typeof value.kmPerDay === "number") parts.push(`${copy.kmPerDay} ${value.kmPerDay}`);
  if (typeof value.excessKmShekels === "number")
    parts.push(`${copy.excess} ${value.excessKmShekels}`);
  if (typeof value.fuelShekels === "number") parts.push(`${copy.fuel} ${value.fuelShekels}`);
  if (typeof value.name === "string" && value.name.length > 0) parts.push(value.name);
  if (typeof value.dailyShekels === "number")
    parts.push(`${copy.dailyPrice} ${value.dailyShekels}`);
  if (value.active === true) parts.push(copy.active);
  return parts.join(" · ");
}

export function StaffSettingsPage() {
  const session = useOutletContext<StaffSession>();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState<"lot" | "holiday" | "tag" | "staff" | null>(null);
  const [lot, setLot] = useState<LotSettings | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [packages, setPackages] = useState<InsurancePackage[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [history, setHistory] = useState<SettingChange[]>([]);
  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [tagName, setTagName] = useState("");
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [personPassword, setPersonPassword] = useState("");
  const [personRole, setPersonRole] = useState<"yard" | "manager">("yard");

  useEffect(() => {
    if (!session.permissions.includes("settings.write")) {
      setError(copy.forbidden);
      return;
    }
    void load();
  }, [session]);

  async function load() {
    const settings = await api<{
      lot: {
        name: string;
        address: string;
        latitude: number | null;
        longitude: number | null;
        phone: string;
        publicEmail: string;
        staffAlertEmail: string;
        kmPerDay: number;
        excessKmPriceAgorot: number;
        fuelShortagePricePerLiterAgorot: number;
      };
      holidays: Holiday[];
      insurance: {
        id: string;
        name: string;
        description: string;
        dailyPriceAgorot: number;
        includedInBase: boolean;
        active: boolean;
        sortOrder: number;
      }[];
      tags: Tag[];
      history: {
        id: string;
        staffId: string;
        staffName: string;
        createdAt: string;
        scope: string;
        entityId: string | null;
        previous: SettingChange["previous"];
        next: SettingChange["next"];
      }[];
    }>("/api/staff/settings");
    if (!settings.ok) {
      setError(failureText(settings));
      return;
    }
    const row = settings.data.lot;
    setLot({
      name: row.name,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      phone: row.phone,
      publicEmail: row.publicEmail,
      staffAlertEmail: row.staffAlertEmail,
      kmPerDay: row.kmPerDay,
      excessKmShekels: row.excessKmPriceAgorot / 100,
      fuelShekels: row.fuelShortagePricePerLiterAgorot / 100,
    });
    setHolidays(settings.data.holidays);
    setPackages(
      settings.data.insurance.map((pack) => ({
        id: pack.id,
        name: pack.name,
        description: pack.description,
        dailyShekels: pack.dailyPriceAgorot / 100,
        includedInBase: pack.includedInBase,
        active: pack.active,
        sortOrder: pack.sortOrder,
      })),
    );
    setTags(settings.data.tags);
    setHistory(
      settings.data.history.map((change) => ({
        id: change.id,
        staffId: change.staffId,
        createdAt: change.createdAt,
        scope: change.scope,
        entityId: change.entityId,
        previous: change.previous,
        next: change.next,
        staffName: change.staffName,
      })),
    );
    const people = await api<StaffAccount[]>("/api/staff/employees");
    if (people.ok) setStaff(people.data);
  }

  function fail(result: { ok: false; error: string }) {
    setSaved(false);
    setError(failureText(result));
  }

  async function saveLot() {
    if (lot === null) return;
    setSaved(false);
    setError(null);
    setAttempt("lot");
    const issues = lotIssues(lot);
    if (problemText(issues.missing, issues.invalid) !== null) return;
    const result = await api<LotSettings>("/api/staff/settings", {
      method: "PATCH",
      body: JSON.stringify(lot),
    });
    if (!result.ok) {
      fail(result);
      return;
    }
    setError(null);
    setSaved(true);
    await load();
  }

  if (error === copy.forbidden || error === copy.errors.FORBIDDEN) {
    return <Notice tone="danger">{copy.forbidden}</Notice>;
  }

  if (lot === null) {
    return error === null ? (
      <p className="text-muted">{copy.loading}</p>
    ) : (
      <Notice tone="danger">{error}</Notice>
    );
  }

  const lotGroup = attempt === "lot" ? lotIssues(lot) : clearIssues;
  const holidayGroup =
    attempt === "holiday" ? holidayIssues(holidayName, holidayDate) : clearIssues;
  const tagGroup = attempt === "tag" ? nameIssue(copy.tagName, tagName, 2) : clearIssues;
  const peopleGroup =
    attempt === "staff" ? staffIssues(personName, personEmail, personPassword) : clearIssues;
  const passwordHint = peopleGroup.invalid.includes(copy.password);
  const active =
    attempt === "lot"
      ? lotGroup
      : attempt === "holiday"
        ? holidayGroup
        : attempt === "tag"
          ? tagGroup
          : attempt === "staff"
            ? {
                missing: peopleGroup.missing,
                invalid: peopleGroup.invalid.filter((label) => label !== copy.password),
              }
            : clearIssues;
  const formNotice = problemText(
    active.missing,
    active.invalid,
    passwordHint ? [copy.site.registerHint] : [],
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{copy.settings}</h1>
      {formNotice !== null && <Notice tone="danger">{formNotice}</Notice>}
      {error !== null && formNotice === null && <Notice tone="danger">{error}</Notice>}
      {saved && error === null && formNotice === null && (
        <Notice tone="success">{copy.saved}</Notice>
      )}

      <Card title={copy.lot}>
        <Field label={copy.lotName}>
          <TextInput
            value={lot.name}
            onChange={(name) => {
              setLot({ ...lot, name });
            }}
          />
        </Field>
        <Field label={copy.address}>
          <TextInput
            value={lot.address}
            onChange={(address) => {
              setLot({ ...lot, address });
            }}
          />
        </Field>
        <p className="text-sm text-muted">{copy.addressHint}</p>
        <Field
          label={copy.latitude}
          error={fieldMark(copy.latitude, lotGroup.missing, lotGroup.invalid)}
        >
          <TextInput
            value={lot.latitude === null ? "" : String(lot.latitude)}
            invalid={fieldMark(copy.latitude, lotGroup.missing, lotGroup.invalid) !== null}
            onChange={(value) => {
              setLot({ ...lot, latitude: value.trim() === "" ? null : Number(value) });
            }}
          />
        </Field>
        <Field
          label={copy.longitude}
          error={fieldMark(copy.longitude, lotGroup.missing, lotGroup.invalid)}
        >
          <TextInput
            value={lot.longitude === null ? "" : String(lot.longitude)}
            invalid={fieldMark(copy.longitude, lotGroup.missing, lotGroup.invalid) !== null}
            onChange={(value) => {
              setLot({ ...lot, longitude: value.trim() === "" ? null : Number(value) });
            }}
          />
        </Field>
        <Field label={copy.phone}>
          <TextInput
            value={lot.phone}
            onChange={(phone) => {
              setLot({ ...lot, phone });
            }}
          />
        </Field>
        <Field
          label={copy.publicEmail}
          error={fieldMark(copy.publicEmail, lotGroup.missing, lotGroup.invalid)}
        >
          <TextInput
            value={lot.publicEmail}
            invalid={fieldMark(copy.publicEmail, lotGroup.missing, lotGroup.invalid) !== null}
            onChange={(publicEmail) => {
              setLot({ ...lot, publicEmail });
            }}
          />
        </Field>
        <Field
          label={copy.staffEmail}
          error={fieldMark(copy.staffEmail, lotGroup.missing, lotGroup.invalid)}
        >
          <TextInput
            value={lot.staffAlertEmail}
            invalid={fieldMark(copy.staffEmail, lotGroup.missing, lotGroup.invalid) !== null}
            onChange={(staffAlertEmail) => {
              setLot({ ...lot, staffAlertEmail });
            }}
          />
        </Field>
        <Field label={copy.kmPerDay}>
          <TextInput
            value={String(lot.kmPerDay)}
            onChange={(value) => {
              const kmPerDay = integer(value);
              if (kmPerDay !== null) setLot({ ...lot, kmPerDay });
            }}
          />
        </Field>
        <Field label={copy.excess}>
          <TextInput
            value={String(lot.excessKmShekels)}
            onChange={(value) => {
              const excessKmShekels = integer(value);
              if (excessKmShekels !== null) setLot({ ...lot, excessKmShekels });
            }}
          />
        </Field>
        <Field label={copy.fuel}>
          <TextInput
            value={String(lot.fuelShekels)}
            onChange={(value) => {
              const fuelShekels = integer(value);
              if (fuelShekels !== null) setLot({ ...lot, fuelShekels });
            }}
          />
        </Field>
        <PrimaryButton onClick={() => void saveLot()}>{copy.save}</PrimaryButton>
      </Card>

      <Card title={copy.holidays}>
        <ul className="flex flex-col gap-2">
          {holidays.map((holiday) => (
            <li key={holiday.id} className="flex items-center justify-between gap-2">
              <span>
                {holiday.date} · {holiday.name}
              </span>
              <SecondaryButton
                onClick={() => {
                  void api(`/api/staff/holidays/${holiday.id}`, { method: "DELETE" }).then(
                    (result) => {
                      if (!result.ok) fail(result);
                      else void load();
                    },
                  );
                }}
              >
                {copy.remove}
              </SecondaryButton>
            </li>
          ))}
        </ul>
        <Field
          label={copy.holidayName}
          error={fieldMark(copy.holidayName, holidayGroup.missing, holidayGroup.invalid)}
        >
          <TextInput
            value={holidayName}
            onChange={setHolidayName}
            invalid={
              fieldMark(copy.holidayName, holidayGroup.missing, holidayGroup.invalid) !== null
            }
          />
        </Field>
        <Field
          label={copy.holidayDate}
          error={fieldMark(copy.holidayDate, holidayGroup.missing, holidayGroup.invalid)}
        >
          <TextInput
            value={holidayDate}
            onChange={setHolidayDate}
            type="date"
            invalid={
              fieldMark(copy.holidayDate, holidayGroup.missing, holidayGroup.invalid) !== null
            }
          />
        </Field>
        <PrimaryButton
          onClick={() => {
            setSaved(false);
            setError(null);
            setAttempt("holiday");
            if (
              problemText(
                holidayIssues(holidayName, holidayDate).missing,
                holidayIssues(holidayName, holidayDate).invalid,
              ) !== null
            ) {
              return;
            }
            void api("/api/staff/holidays", {
              method: "POST",
              body: JSON.stringify({ name: holidayName, date: holidayDate }),
            }).then((result) => {
              if (!result.ok) fail(result);
              else {
                setAttempt(null);
                setHolidayName("");
                setHolidayDate("");
                void load();
              }
            });
          }}
        >
          {copy.addHoliday}
        </PrimaryButton>
      </Card>

      <Card title={copy.insurance}>
        {packages.map((pack) => (
          <InsuranceEditor
            key={`${pack.id}-${String(pack.includedInBase)}-${String(pack.active)}`}
            pack={pack}
            onSaved={() => void load()}
            onError={fail}
          />
        ))}
        <InsuranceEditor
          pack={{
            id: "",
            name: "",
            description: "",
            dailyShekels: 0,
            includedInBase: false,
            active: true,
            sortOrder: packages.length,
          }}
          onSaved={() => void load()}
          onError={fail}
        />
      </Card>

      <Card title={copy.tags}>
        {tags.map((tag) => (
          <div key={tag.id} className="flex flex-wrap items-center gap-2">
            <span>{tag.name}</span>
            <span className="text-sm text-muted">{tag.active ? copy.active : ""}</span>
            <SecondaryButton
              onClick={() => {
                void api(`/api/staff/tags/${tag.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ name: tag.name, active: !tag.active }),
                }).then((result) => {
                  if (!result.ok) fail(result);
                  else void load();
                });
              }}
            >
              {tag.active ? copy.remove : copy.active}
            </SecondaryButton>
          </div>
        ))}
        <Field
          label={copy.tagName}
          error={fieldMark(copy.tagName, tagGroup.missing, tagGroup.invalid)}
        >
          <TextInput
            value={tagName}
            onChange={setTagName}
            invalid={fieldMark(copy.tagName, tagGroup.missing, tagGroup.invalid) !== null}
          />
        </Field>
        <PrimaryButton
          onClick={() => {
            setSaved(false);
            setError(null);
            setAttempt("tag");
            const issues = nameIssue(copy.tagName, tagName, 2);
            if (problemText(issues.missing, issues.invalid) !== null) return;
            void api("/api/staff/tags", {
              method: "POST",
              body: JSON.stringify({ name: tagName, active: true }),
            }).then((result) => {
              if (!result.ok) fail(result);
              else {
                setAttempt(null);
                setTagName("");
                void load();
              }
            });
          }}
        >
          {copy.addTag}
        </PrimaryButton>
      </Card>

      <Card title={copy.staff}>
        {staff.map((person) => (
          <div key={person.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {person.fullName} · {person.email} ·{" "}
              {person.role === "manager" ? copy.manager : copy.yardRole}
            </span>
            <SecondaryButton
              onClick={() => {
                void api(`/api/staff/employees/${person.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({
                    fullName: person.fullName,
                    email: person.email,
                    role: person.role,
                    active: !person.active,
                    password: null,
                  }),
                }).then((result) => {
                  if (!result.ok) fail(result);
                  else void load();
                });
              }}
            >
              {person.active ? copy.remove : copy.active}
            </SecondaryButton>
          </div>
        ))}
        <Field
          label={copy.fullName}
          error={fieldMark(copy.fullName, peopleGroup.missing, peopleGroup.invalid)}
        >
          <TextInput
            value={personName}
            onChange={setPersonName}
            invalid={fieldMark(copy.fullName, peopleGroup.missing, peopleGroup.invalid) !== null}
          />
        </Field>
        <Field
          label={copy.email}
          error={fieldMark(copy.email, peopleGroup.missing, peopleGroup.invalid)}
        >
          <TextInput
            value={personEmail}
            onChange={setPersonEmail}
            invalid={fieldMark(copy.email, peopleGroup.missing, peopleGroup.invalid) !== null}
          />
        </Field>
        <Field
          label={copy.password}
          error={
            peopleGroup.missing.includes(copy.password)
              ? fieldMark(copy.password, peopleGroup.missing)
              : passwordHint
                ? copy.site.registerHint
                : null
          }
        >
          <TextInput
            value={personPassword}
            onChange={setPersonPassword}
            type="password"
            invalid={peopleGroup.missing.includes(copy.password) || passwordHint}
          />
        </Field>
        <Field label={copy.role}>
          <select
            value={personRole}
            onChange={(event) => {
              setPersonRole(event.target.value === "manager" ? "manager" : "yard");
            }}
            className="rounded-control border border-line bg-card px-3 py-2"
          >
            <option value="yard">{copy.yardRole}</option>
            <option value="manager">{copy.manager}</option>
          </select>
        </Field>
        <PrimaryButton
          onClick={() => {
            setSaved(false);
            setError(null);
            setAttempt("staff");
            const issues = staffIssues(personName, personEmail, personPassword);
            const hint = issues.invalid.includes(copy.password) ? [copy.site.registerHint] : [];
            const invalid = issues.invalid.filter((label) => label !== copy.password);
            if (problemText(issues.missing, invalid, hint) !== null) return;
            void api("/api/staff/employees", {
              method: "POST",
              body: JSON.stringify({
                fullName: personName,
                email: personEmail,
                password: personPassword,
                role: personRole,
              }),
            }).then((result) => {
              if (!result.ok) fail(result);
              else {
                setAttempt(null);
                setPersonName("");
                setPersonEmail("");
                setPersonPassword("");
                void load();
              }
            });
          }}
        >
          {copy.addStaff}
        </PrimaryButton>
      </Card>

      <Card title={copy.history}>
        {history.length === 0 && <p>{copy.noHistory}</p>}
        <ul className="flex flex-col gap-3">
          {history.map((change) => (
            <li key={change.id} className="text-sm">
              <p className="font-medium">
                {change.scope === "fleet_prices" ? copy.fleetPrices : copy.insurance}
                {change.staffName ? ` · ${change.staffName}` : ""} ·{" "}
                {formatJerusalem(change.createdAt)}
              </p>
              <p>
                {copy.previous}: {historyLine(change.previous)}
              </p>
              <p>
                {copy.next}: {historyLine(change.next)}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function InsuranceEditor(props: {
  pack: InsurancePackage;
  onSaved: () => void;
  onError: (result: { ok: false; error: string }) => void;
}) {
  const [pack, setPack] = useState(props.pack);
  const [tried, setTried] = useState(false);
  const creating = props.pack.id.length === 0;
  const missing = tried && pack.name.trim() === "" ? [copy.packageName] : [];
  return (
    <div className="flex flex-col gap-2 border-b border-line pb-3">
      {missing.length > 0 && <Notice tone="danger">{listedMissing(missing)}</Notice>}
      <Field label={copy.packageName} error={fieldMark(copy.packageName, missing)}>
        <TextInput
          value={pack.name}
          invalid={missing.length > 0}
          onChange={(name) => {
            setPack({ ...pack, name });
          }}
        />
      </Field>
      <Field label={copy.description}>
        <TextInput
          value={pack.description}
          onChange={(description) => {
            setPack({ ...pack, description });
          }}
        />
      </Field>
      <Field label={copy.dailyPrice}>
        <TextInput
          value={String(pack.dailyShekels)}
          onChange={(value) => {
            const dailyShekels = integer(value);
            if (dailyShekels !== null) setPack({ ...pack, dailyShekels });
          }}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={pack.includedInBase}
          onChange={(event) => {
            setPack({ ...pack, includedInBase: event.target.checked });
          }}
        />
        {copy.basePackage}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={pack.active}
          onChange={(event) => {
            setPack({ ...pack, active: event.target.checked });
          }}
        />
        {copy.active}
      </label>
      <PrimaryButton
        onClick={() => {
          setTried(true);
          if (pack.name.trim() === "") return;
          const path = creating ? "/api/staff/insurance" : `/api/staff/insurance/${pack.id}`;
          void api(path, {
            method: creating ? "POST" : "PATCH",
            body: JSON.stringify(pack),
          }).then((result) => {
            if (!result.ok) props.onError(result);
            else props.onSaved();
          });
        }}
      >
        {creating ? copy.addPackage : copy.save}
      </PrimaryButton>
    </div>
  );
}
