import { Link } from "react-router-dom";

import {
  photoUrl,
  type FleetCar,
  type FleetDetail,
  type RentDetail,
  type RentOffer,
  type SaleDetail,
  type SaleOffer,
} from "../api/catalog";
import { copy } from "../copy";
import { formatHours, formatJerusalem, formatKm, formatShekels } from "../format";

function Cover(props: { carId: string; photo: { id: string; alt: string } | null }) {
  if (props.photo === null) {
    return <div className="aspect-[16/10] rounded-card bg-line" />;
  }
  return (
    <img
      src={photoUrl(props.carId, props.photo.id)}
      alt={props.photo.alt}
      className="aspect-[16/10] w-full rounded-card object-cover"
    />
  );
}

function typeName(primaryType: string): string {
  switch (primaryType) {
    case "mini":
    case "family":
    case "suv":
    case "seven_seat":
    case "luxury":
    case "commercial":
      return copy.types[primaryType];
    default:
      return primaryType;
  }
}

/** Rental result cards. The price is the server total, including the return tier. */
export function RentCards(props: { offers: RentOffer[]; search: string }) {
  return (
    <ul className="flex flex-col gap-4">
      {props.offers.map((offer) => (
        <li key={offer.id}>
          <Link
            to={`/rent/cars/${offer.id}?${props.search}`}
            className="block rounded-card border border-line bg-card p-4"
          >
            <Cover carId={offer.id} photo={offer.photo} />
            <h2 className="mt-3 text-xl font-bold">
              {offer.make} {offer.model}
            </h2>
            <p className="text-muted">
              {offer.year} · {typeName(offer.primaryType)} · {offer.seats} {copy.site.seatsShort}
            </p>
            <p className="text-sm text-muted">
              {copy.site.minAgeShort} {offer.minAge}
            </p>
            {offer.tags.length > 0 && (
              <p className="text-sm">{offer.tags.map((tag) => tag.name).join(" · ")}</p>
            )}
            <p className="mt-3 text-sm text-muted">{copy.site.periodTotal}</p>
            <p className="text-2xl font-bold">{formatShekels(offer.totalAgorot)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** One rental car: day lines, included insurance, and the kilometre allowance. */
export function RentDetailView(props: {
  detail: RentDetail;
  onInsurance: (packageId: string | null) => void;
}) {
  const detail = props.detail;
  const base = detail.packages.find((pack) => pack.includedInBase);
  const upgrades = detail.packages.filter((pack) => !pack.includedInBase);
  const selected = detail.packages.find((pack) => pack.id === detail.selectedPackageId);
  return (
    <article className="flex flex-col gap-4">
      <Cover carId={detail.id} photo={detail.photo} />
      {detail.photos.length > 1 && (
        <ul className="grid grid-cols-2 gap-2">
          {detail.photos.slice(1).map((photo) => (
            <li key={photo.id}>
              <img
                src={photoUrl(detail.id, photo.id)}
                alt={photo.alt}
                className="aspect-[16/10] w-full rounded-card object-cover"
              />
            </li>
          ))}
        </ul>
      )}
      <h1 className="text-2xl font-bold">
        {detail.make} {detail.model}
      </h1>
      <p className="text-muted">
        {detail.year} · {detail.color} · {typeName(detail.primaryType)}
      </p>
      <section className="rounded-card border border-line bg-card p-4">
        <h2 className="font-bold">{copy.site.rentalFee}</h2>
        <ul className="mt-2 flex flex-col gap-1">
          {detail.lines.map((line) => (
            <li key={line.start} className="flex justify-between gap-3 text-sm">
              <span>
                {formatJerusalem(line.start)} · {copy.site.dayKinds[line.dayKind]} ·{" "}
                {formatHours(line.hours)} {copy.site.hours}
              </span>
              <span>{formatShekels(line.agorot)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          {selected?.includedInBase === true || selected === undefined
            ? `${base?.name ?? copy.site.baseInsurance} · ${copy.site.included}`
            : `${selected.name} · ${formatShekels(detail.insuranceAgorot)}`}
        </p>
        {selected !== undefined && selected.description !== "" && (
          <p className="text-sm text-muted">{selected.description}</p>
        )}
        {upgrades.length > 0 && (
          <fieldset className="mt-3 flex flex-col gap-2">
            <legend className="text-sm font-medium">{copy.site.upgrade}</legend>
            {upgrades.map((pack) => (
              <label key={pack.id} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="insurance"
                  checked={detail.selectedPackageId === pack.id}
                  onChange={() => {
                    props.onInsurance(pack.id);
                  }}
                />
                <span>
                  {pack.name}
                  {pack.description !== "" ? ` — ${pack.description}` : ""}
                </span>
              </label>
            ))}
            <button
              type="button"
              className="self-start text-sm font-medium"
              onClick={() => {
                props.onInsurance(null);
              }}
            >
              {copy.site.included}
            </button>
          </fieldset>
        )}
        <p className="mt-3 text-sm">
          {detail.returnMode === "lot"
            ? `${copy.site.returnLot} · ${formatShekels(detail.deliveryFeeAgorot)}`
            : `${detail.returnAddress} · ${formatShekels(detail.deliveryFeeAgorot)}`}
        </p>
        <p className="mt-3 text-sm text-muted">{copy.site.periodTotal}</p>
        <p className="text-3xl font-bold">{formatShekels(detail.totalAgorot)}</p>
        <p className="mt-3">
          {copy.site.kmAllowance}: {formatKm(detail.kmAllowance)} {copy.site.kmUnit}
        </p>
        <p>{copy.site.fullTank}</p>
      </section>
    </article>
  );
}

/** Sale result cards. The deposit amount is the server's 10 percent. */
export function SaleCards(props: { offers: SaleOffer[]; search: string }) {
  return (
    <ul className="flex flex-col gap-4">
      {props.offers.map((offer) => (
        <li key={offer.id}>
          <Link
            to={`/buy/cars/${offer.id}?${props.search}`}
            className="block rounded-card border border-line bg-card p-4"
          >
            <Cover carId={offer.id} photo={offer.photo} />
            <h2 className="mt-3 text-xl font-bold">
              {offer.make} {offer.model}
            </h2>
            <p className="text-muted">
              {offer.year} · {formatKm(offer.currentKm)} {copy.site.kmUnit} ·{" "}
              {copy.site.conditions[offer.conditionGrade]}
            </p>
            <p className="text-sm">{typeName(offer.primaryType)}</p>
            {offer.tags.length > 0 && (
              <p className="text-sm">{offer.tags.map((tag) => tag.name).join(" · ")}</p>
            )}
            <p className="mt-3 text-sm text-muted">{copy.site.carPrice}</p>
            <p className="text-2xl font-bold">{formatShekels(offer.salePriceAgorot)}</p>
            <p className="text-sm">
              {copy.site.depositCard} {formatShekels(offer.depositAgorot)}
            </p>
            <span className="mt-4 block rounded-control bg-accent px-4 py-3 text-center font-bold text-on-accent">
              {copy.site.buyCar}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Sale page facts. Financing and the deposit payment are a later step. */
export function SaleDetailView(props: { detail: SaleDetail }) {
  const detail = props.detail;
  const accidents = detail.accidentsNone ? copy.site.noAccidents : (detail.knownAccidents ?? "");
  return (
    <article className="flex flex-col gap-4">
      <Cover carId={detail.id} photo={detail.photo} />
      {detail.photos.length > 1 && (
        <ul className="grid grid-cols-2 gap-2">
          {detail.photos.slice(1).map((photo) => (
            <li key={photo.id}>
              <img
                src={photoUrl(detail.id, photo.id)}
                alt={photo.alt}
                className="aspect-[16/10] w-full rounded-card object-cover"
              />
            </li>
          ))}
        </ul>
      )}
      <h1 className="text-2xl font-bold">
        {detail.make} {detail.model}
      </h1>
      <dl className="grid grid-cols-2 gap-3 rounded-card border border-line bg-card p-4">
        <div>
          <dt className="text-sm text-muted">{copy.site.condition}</dt>
          <dd>{copy.site.conditions[detail.conditionGrade]}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">{copy.year}</dt>
          <dd>{detail.year}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">{copy.km}</dt>
          <dd>
            {formatKm(detail.currentKm)} {copy.site.kmUnit}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">{copy.site.hand}</dt>
          <dd>{detail.ownersCount}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-sm text-muted">{copy.site.accidents}</dt>
          <dd>{accidents}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-sm text-muted">{copy.site.treatmentDone}</dt>
          <dd>
            {detail.deepTreatmentCompletedAt === null
              ? ""
              : formatJerusalem(detail.deepTreatmentCompletedAt)}
          </dd>
        </div>
      </dl>
      <section className="rounded-card border border-line bg-card p-4">
        <p className="text-sm text-muted">{copy.site.carPrice}</p>
        <p className="text-3xl font-bold">{formatShekels(detail.salePriceAgorot)}</p>
        <p className="mt-2 text-sm text-muted">{copy.site.depositLine}</p>
        <p className="text-xl font-bold">{formatShekels(detail.depositAgorot)}</p>
      </section>
    </article>
  );
}

/** Every car in the lot, with its cover photo. This list has no sale price. */
export function FleetCards(props: { cars: FleetCar[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {props.cars.map((car) => (
        <li key={car.id}>
          <Link
            to={`/buy/all/${car.id}`}
            className="block rounded-card border border-line bg-card p-4"
          >
            <Cover carId={car.id} photo={car.photo} />
            <h2 className="mt-3 text-xl font-bold">
              {car.make} {car.model}
            </h2>
            <p className="text-muted">
              {car.year} · {car.color} · {formatKm(car.currentKm)} {copy.site.kmUnit}
            </p>
            <p className="text-sm">
              {typeName(car.primaryType)} · {car.seats} {copy.seats}
            </p>
            {car.tags.length > 0 && (
              <p className="text-sm">{car.tags.map((tag) => tag.name).join(" · ")}</p>
            )}
            <p className="mt-2 text-sm text-muted">
              {car.photoCount} {copy.photos}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** All photos of one car. Plate and sale price stay off this page. */
export function FleetDetailView(props: { detail: FleetDetail }) {
  const detail = props.detail;
  return (
    <article className="flex flex-col gap-4">
      <ul className="grid grid-cols-2 gap-2">
        {detail.photos.map((photo) => (
          <li key={photo.id}>
            <img
              src={photoUrl(detail.id, photo.id)}
              alt={photo.alt}
              className="aspect-[16/10] w-full rounded-card object-cover"
            />
          </li>
        ))}
      </ul>
      <h1 className="text-2xl font-bold">
        {detail.make} {detail.model}
      </h1>
      <p className="text-muted">
        {detail.year} · {detail.color} · {typeName(detail.primaryType)} · {detail.seats}{" "}
        {copy.seats}
      </p>
      <p>
        {formatKm(detail.currentKm)} {copy.site.kmUnit}
      </p>
      {detail.tags.length > 0 && (
        <p className="text-sm">{detail.tags.map((tag) => tag.name).join(" · ")}</p>
      )}
    </article>
  );
}
