import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { RentDetail, RentOffer, SaleDetail } from "./api/catalog";
import { RentCards, RentDetailView, SaleDetailView } from "./components/CatalogCards";
import { HomePage } from "./routes/HomePage";
import { PublicShell } from "./routes/PublicShell";
import { RegisterPage } from "./routes/RegisterPage";

const plate = "12-345-67";

const offer: RentOffer = {
  id: "44444444-4444-4444-8444-444444444444",
  make: "יונדאי",
  model: "i10",
  year: 2024,
  color: "לבן",
  primaryType: "mini",
  seats: 5,
  minAge: 21,
  tags: [{ id: "tag", name: "אוטומטי" }],
  photo: null,
  totalAgorot: 16000,
  rentalAgorot: 10000,
  insuranceAgorot: 0,
  deliveryFeeAgorot: 6000,
  kmAllowance: 250,
};

const detail: RentDetail = {
  ...offer,
  photos: [],
  lines: [{ start: "2026-10-09T11:00:00.000Z", hours: 24, dayKind: "weekday", agorot: 10000 }],
  packages: [
    {
      id: "base",
      name: "ביטוח בסיסי",
      description: "כלול במחיר",
      dailyPriceAgorot: 0,
      includedInBase: true,
    },
  ],
  selectedPackageId: "base",
  returnMode: "address",
  returnAddress: "רחוב הדקל 1",
  straightLineKm: 4,
  billedKm: 4.4,
};

const sale: SaleDetail = {
  id: "77777777-7777-4777-8777-777777777777",
  make: "מאזדה",
  model: "3",
  year: 2018,
  currentKm: 80000,
  conditionGrade: "good",
  primaryType: "family",
  tags: [],
  photo: null,
  salePriceAgorot: 5000000,
  depositAgorot: 500000,
  color: "אפור",
  seats: 5,
  ownersCount: 2,
  accidentsNone: true,
  knownAccidents: null,
  deepTreatmentCompletedAt: "2026-09-01T09:00:00.000Z",
  photos: [],
};

describe("catalog html", () => {
  it("does not print a licence plate on the public screens", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <HomePage />
        <RentCards offers={[offer]} search="age=30" />
        <RentDetailView
          detail={detail}
          onInsurance={() => {
            return undefined;
          }}
        />
        <SaleDetailView detail={sale} />
      </MemoryRouter>,
    );
    expect(html).toContain("מה מתאים לכם היום?");
    expect(html).toContain("ביטוח בסיסי כלול במחיר ההשכרה");
    expect(html).toContain("סה״כ לתקופה");
    expect(html).toContain("לא דווחו תאונות");
    expect(html).not.toContain(plate);
    expect(html).not.toContain("plate");
  });

  it("uses the same lot name and one menu on every public page", () => {
    function shell(path: string, page: ReactNode) {
      return renderToStaticMarkup(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<PublicShell />}>
              <Route path={path} element={page} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    }

    const home = shell("/", <HomePage />);
    const rent = shell("/rent", <p>חיפוש</p>);
    for (const html of [home, rent]) {
      expect(html).toContain("ניווט");
      expect(html).toContain("הגדרות");
      expect(html).not.toContain("בהיר");
      expect(html).toContain("lot-logo");
      expect(html).toContain("header-lot.jpg");
      expect(html).not.toContain(">הגדרות<");
      expect(html).not.toContain(">אזור אישי<");
    }
    expect(rent).not.toContain("האזור שלי");
  });

  it("offers registration before payment", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );
    expect(html).toContain("הרשמה");
    expect(html).toContain("שם מלא");
    expect(html).toContain("תאריך לידה");
    expect(html).toContain("יש לי חשבון");
  });
});
