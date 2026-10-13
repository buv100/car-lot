function shekels(agorot: number): string {
  return new Intl.NumberFormat("he-IL", {
    minimumFractionDigits: agorot % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(agorot / 100);
}

function when(instant: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "short",
    timeStyle: "short",
  }).format(instant);
}

/** Customer and staff letters for a paid rental. The plate is included only here, after payment. */
export function rentalConfirmedLetters(input: {
  number: string;
  plate: string;
  make: string;
  model: string;
  pickupAt: Date;
  returnAt: Date;
  lotAddress: string;
  returnAddress: string;
  rentalAgorot: number;
  insuranceAgorot: number;
  deliveryFeeAgorot: number;
  totalAgorot: number;
  customerEmail: string;
  staffEmail: string;
}): { to: string; subject: string; body: string }[] {
  const body = [
    `ההשכרה אושרה. מספר הזמנה ${input.number}.`,
    `${input.make} ${input.model}. מספר רישוי ${input.plate}.`,
    `איסוף ${when(input.pickupAt)} מ-${input.lotAddress}.`,
    `החזרה ${when(input.returnAt)} אל ${input.returnAddress}.`,
    `שכר דירה ₪${shekels(input.rentalAgorot)}. ביטוח ₪${shekels(input.insuranceAgorot)}. החזרה ₪${shekels(input.deliveryFeeAgorot)}.`,
    `סה״כ ₪${shekels(input.totalAgorot)}.`,
  ].join("\n");
  return [
    { to: input.customerEmail, subject: "ההשכרה אושרה", body },
    {
      to: input.staffEmail,
      subject: "השכרה שולמה",
      body: `הזמנת השכרה ${input.number} שולמה. ${input.make} ${input.model}.`,
    },
  ];
}

/** The deposit is paid and the car stays reserved with no end time. */
export function saleReservedLetters(input: {
  number: string;
  make: string;
  model: string;
  depositAgorot: number;
  customerEmail: string;
  staffEmail: string;
}): { to: string; subject: string; body: string }[] {
  const body = `המקדמה התקבלה והרכב שמור. מספר הזמנה ${input.number}. ${input.make} ${input.model}. מקדמה ₪${shekels(input.depositAgorot)}.`;
  return [
    { to: input.customerEmail, subject: "הרכב שמור", body },
    { to: input.staffEmail, subject: "מקדמה שולמה", body },
  ];
}

/** A manager already decided. Approval returns the deposit; refusal keeps the reservation. */
export function saleRefundLetter(input: {
  approved: boolean;
  number: string;
  customerEmail: string;
}): { to: string; subject: string; body: string } {
  if (input.approved) {
    return {
      to: input.customerEmail,
      subject: "המקדמה הוחזרה",
      body: `המקדמה של הזמנה ${input.number} הוחזרה, והרכב חזר למכירה.`,
    };
  }
  return {
    to: input.customerEmail,
    subject: "הבקשה להחזר נדחתה",
    body: `הבקשה להחזר על הזמנה ${input.number} נדחתה. הרכב נשאר שמור.`,
  };
}

/** Customer and staff letters for a cancelled rental, including the refund percent and amount. */
export function rentalCancelledLetters(input: {
  number: string;
  percent: number;
  refundAgorot: number;
  customerEmail: string;
  staffEmail: string;
}): { to: string; subject: string; body: string }[] {
  const amount = `₪${shekels(input.refundAgorot)}`;
  const letters = [
    {
      to: input.customerEmail,
      subject: "ההשכרה בוטלה",
      body: `ההשכרה בוטלה. מספר הזמנה ${input.number}.\nהחזר ${String(input.percent)}% בסך ${amount}.`,
    },
    {
      to: input.staffEmail,
      subject: "השכרה בוטלה",
      body: `הזמנת השכרה ${input.number} בוטלה. החזר ${String(input.percent)}% בסך ${amount}.`,
    },
  ];
  return letters.filter((letter) => letter.to !== "");
}

/** One reminder, sent only while the rental is still confirmed. */
export function rentalReminderLetter(input: {
  number: string;
  plate: string;
  make: string;
  model: string;
  pickupAt: Date;
  lotAddress: string;
  customerEmail: string;
}): { to: string; subject: string; body: string } {
  return {
    to: input.customerEmail,
    subject: "תזכורת לאיסוף",
    body: [
      "תזכורת: האיסוף בעוד פחות מ-24 שעות.",
      `מספר הזמנה ${input.number}.`,
      `${input.make} ${input.model}. מספר רישוי ${input.plate}.`,
      `איסוף ${when(input.pickupAt)} מ-${input.lotAddress}.`,
    ].join("\n"),
  };
}

/** One staff letter when a rental-fleet car reaches the sale threshold. Status stays unchanged. */
export function saleThresholdLetter(input: {
  plate: string;
  make: string;
  model: string;
  currentKm: number;
  staffEmail: string;
}): { to: string; subject: string; body: string } {
  const km = new Intl.NumberFormat("he-IL").format(input.currentKm);
  return {
    to: input.staffEmail,
    subject: "רכב בסף מכירה",
    body: `הרכב ${input.plate} ${input.make} ${input.model} הגיע לסף המכירה (${km} ק״מ). הוא נשאר בצי ההשכרה.`,
  };
}
