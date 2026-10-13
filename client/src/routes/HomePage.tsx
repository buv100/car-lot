import { Link } from "react-router-dom";

import { copy } from "../copy";

const choice =
  "flex h-28 items-center justify-center rounded-card px-6 text-center text-2xl font-bold leading-tight transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:h-32 sm:text-3xl";

export function HomePage() {
  const whyBuy = [
    copy.site.whyBuyPrice,
    copy.site.whyBuyFacts,
    copy.site.whyBuyTreatment,
    copy.site.whyBuyRequest,
  ];
  const moreReasons = [
    copy.site.trustInsurance,
    copy.site.trustPrice,
    copy.site.trustPickup,
    copy.site.reasonTank,
    copy.site.reasonReturn,
    copy.site.reasonAccount,
  ];

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
        <h1 className="text-center text-2xl font-bold leading-tight sm:text-3xl">
          {copy.site.question}
        </h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link to="/rent" className={`${choice} bg-accent text-on-accent hover:bg-accent-pressed`}>
            {copy.site.rent}
          </Link>
          <Link to="/buy" className={`${choice} border-2 border-ink bg-card hover:bg-page`}>
            {copy.site.buy}
          </Link>
        </div>
      </div>
      <section className="flex-1 border-y border-line bg-card px-4 py-6 sm:px-8 sm:py-10">
        <h2 className="text-2xl font-bold">{copy.site.whyBuy}</h2>
        <ReasonList lines={whyBuy} columns="lg:grid-cols-4" />
        <h2 className="mt-10 text-2xl font-bold">{copy.site.moreReasons}</h2>
        <ReasonList lines={moreReasons} columns="lg:grid-cols-3" />
      </section>
    </div>
  );
}

function ReasonList(props: { lines: readonly string[]; columns: string }) {
  return (
    <ul className={`mt-5 grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2 ${props.columns}`}>
      {props.lines.map((line) => (
        <li key={line} className="flex items-start gap-3 border-t border-line pt-4">
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
          <p className="text-base font-medium leading-7">{line}</p>
        </li>
      ))}
    </ul>
  );
}
