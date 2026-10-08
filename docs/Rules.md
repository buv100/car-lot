# SPEC בנייה — מגרש רכב

זה מסמך הבנייה. הוא אומר מה כותבים, באיזה קובץ, באיזה סדר, ואיך יודעים שנגמר. כללי המוצר נשארים ב-[SPEC.md](SPEC.md). אם שני המסמכים סותרים, עוצרים ומתקנים את שניהם באותו שינוי. לא בוחרים שקט באחד מהם.

אין מתחילים שלב בנייה לפני שהשלב הקודם עמד בתנאי היציאה שלו. אין מערבבים שני שלבים בענף אחד.

הסטאק נעול כך:

- לקוח: React, Vite, TypeScript, Tailwind CSS. אפליקציה אחת בדפדפן, בעברית מימין לשמאל.
- שרת: Node.js ו-Express. כל מחיר, זמינות והרשאה נבדקים כאן.
- הרשאות: JWT. טוקן לקוח וטוקן צוות חתומים בסודות נפרדים. בצוות התפקיד הוא עובד מגרש או מנהל, והבדיקה הסופית נעשית מול PostgreSQL.
- מסד: PostgreSQL. הטבלאות המרכזיות הן רכבים, לקוחות וצוות, השכרות ומכירות. Prisma ממפה אותן, ואינו מחליף את המסד.

## 1. מעמד המסמכים

| מסמך | תפקיד | מי משנה אותו |
| --- | --- | --- |
| [SPEC.md](SPEC.md) | מה המערכת עושה ללקוח ולעובד | רק כשהחלטת מוצר משתנה, ובאותו שינוי עם המסמך הזה |
| [Rules.md](Rules.md) | איך בונים, כולל ארכיטקטורה ושיטת עבודה | כשמשתנים מבנה, כלי, סדר שלבים, או חוזה קוד |
| [CHANGES.md](CHANGES.md) | מה השתנה בפועל, בשפה אנושית | בכל מיזוג ל-`main` |

קוד שלא מממש כלל מ-[SPEC.md](SPEC.md) לא נכתב. קוד שמממש כלל בלי שהכלל מופיע באפיון לא נכתב. קודם מעדכנים את האפיון.

## 2. סדר עבודה מחייב

1. קוראים את סעיף המוצר הרלוונטי ב-[SPEC.md](SPEC.md) ואת השלב הנוכחי כאן.
2. פותחים ענף אחד לשלב אחד, לפי סעיף 3.
3. כותבים קודם את בדיקת הדומיין שנכשלת, אחר כך את המימוש, ורק בסוף מסך.
4. מריצים את שער השלב: טיפוסים, לינט, ובדיקות היחידה של השלב.
5. מוסיפים רשומה בראש [CHANGES.md](CHANGES.md).
6. פותחים Pull Request. ממזגים ל-`main` רק אחרי שהשער ירוק.
7. לא מתחילים את השלב הבא מהענף הישן.

עבודה ישירה על `main` אסורה מרגע שהמאגר מחובר לגיטהאב. עד החיבור, השלב הראשון הוא דווקא יצירת המאגר, והיא השלב היחיד שמותר לעשות על `main`.

## 3. גיטהאב

### מאגר

- מאגר פרטי אחד. השם המוצע: `car-lot`.
- ענף ברירת המחדל: `main`.
- `main` מוגן: אין דחיפה ישירה, אין force push, מיזוג רק דרך Pull Request, והבדיקות של סעיף 19 חייבות לעבור.
- מיזוג ב-squash. הודעת המיזוג היא כותרת ה-PR.

### ענפים

`סוג/תיאור-קצר` באותיות קטנות ובאנגלית.

| סוג | מתי |
| --- | --- |
| `feat` | יכולת חדשה מתוך שלב |
| `fix` | תיקון מול אפיון או מול בדיקה שנכשלה |
| `docs` | אפיון, המסמך הזה, או היומן בלבד |
| `test` | בדיקות בלי שינוי התנהגות |
| `refactor` | הזזת קוד בלי שינוי התנהגות |
| `chore` | כלים, תלויות, סביבה |

דוגמה: `feat/rental-pricing`.

### הודעת commit

אנגלית. שורה ראשונה עד 72 תווים:

```text
feat(pricing): price each segment by its start date
```

הסוג הוא אחד מסוגי הענף. הסוגריים הם אזור: `pricing`, `calendar`, `auth`, `payments`, `staff`, `sale`, `jobs`, `docs`.

גוף ההודעה, אם צריך, עונה למה. לא חוזר על רשימת הקבצים.

### Pull Request

כותרת זהה לשורת ה-commit הראשית. הגוף, בעברית:

```text
## מה
## למה
## אפיון
סעיפים ב-SPEC.md שזה מממש.
## בדיקה
אילו פקודות רצו ומה התוצאה.
## יומן
רשומת CHANGES.md כלולה.
```

PR בלי רשומת יומן לא ממזגים, חוץ מתיקון הקלדה שנוגעת רק ביומן עצמו.

### מה לא נכנס לגיט

`.env`, מפתחות, תיקיית `uploads/`, `node_modules/`, `client/dist/`, קבצי מסד מקומיים. כן נכנסים: `.env.example` בלי ערכים סודיים, `pnpm-lock.yaml`, ומיגרציות Prisma.

סוד שמסתנן לקומיט מבטלים בהחלפת הסוד אצל הספק. לא מתקנים את זה רק במחיקת הקובץ בקומיט המשך.

## 4. מסמך CHANGES

כל רשומה נכנסת **מעל** הרשומה הקודמת, מתחת לכותרת «יומן».

```text
### YYYY-MM-DD — כותרת קצרה בעברית

- סוג: נוסף / שונה / תוקן / הוסר / תיעוד
- מה השתנה
- למה
- אילו מסמכים או שלבים הושפעו
- עדיין לא נעשה, או סיכון שנשאר
```

תאריך לפי ירושלים. כותרת אחת לכל PR. לא כותבים «עדכונים שונים». אם אי אפשר לסכם במשפט, ה-PR גדול מדי ומפצלים אותו.

היומן לא מחליף את היסטוריית הגיט. הגיט עונה מי שינה איזה שורה. היומן עונה מה השתנה למשתמש ולבנאי.

## 5. שיטת תכנות

שפה: TypeScript במצב `strict`. `any` אסור. `ts-ignore` אסור. `as` מותר רק בגבול של ספרייה חיצונית, עם משפט הסבר מעליו.

מנהל חבילות: pnpm, בשני חבילות תחת workspace אחד. Node 22. לקוח: React, Vite, TypeScript, Tailwind CSS. שרת: Node.js, Express, TypeScript. הרשאות: JWT, עם הפרדה בין לקוח, עובד מגרש ומנהל. מסד: PostgreSQL 16. גישה למסד: Prisma 6, כשכבת מיפוי בלבד ולא כמוצר נפרד. ולידציה בגבול ה-HTTP: Zod. בדיקות: Vitest.

### שכבות

הדפדפן לא מחליט מחיר, זמינות, הרשאה, או מעבר סטטוס. הוא מציג ומגיש. השרת מחשב שוב לפני החזקה ולפני חיוב.

| שכבה | נתיב | מותר | אסור |
| --- | --- | --- | --- |
| דומיין | `server/src/domain` | פונקציות טהורות, טיפוסים, שגיאות עסקיות | Prisma, `fetch`, React, שעון אמיתי, קבצים |
| שירותים | `server/src/services` | טרנזקציות, הרשאות, קריאות ספקים | JSX, חישוב מחיר משלו |
| מאגר | `server/src/repositories` | שאילתות Prisma | כללי מוצר |
| קצה | `server/src/http` | Express, Zod, JWT, קריאה לשירות, מיפוי שגיאה לקוד | מתמטיקה של מחיר |
| מסך | `client/src` | React, Tailwind, קריאות ל-API | גישה למסד, חישוב מחיר סופי |

שעון נכנס לדומיין רק כארגומנט `now: Date`. מי שקורא לפונקציה מעביר `new Date()`. כך בדיקות קובעות את הזמן.

כסף הוא מספר שלם של אגורות. הטיפוס `Agorot` הוא branded type. אי אפשר להעביר אליו מספר רגיל בלי `agorot()`. שקלים שלמים שהעובד מזין הופכים לאגורות בכפל ב-100, ורק אם הם שלמים.

```ts
export type Agorot = number & { readonly __brand: "Agorot" };

export function agorot(wholeShekels: number): Agorot {
  if (!Number.isInteger(wholeShekels) || wholeShekels < 0) {
    throw new Error("Shekel input must be a non-negative integer");
  }
  return (wholeShekels * 100) as Agorot;
}
```

עיגול סכום מחושב: `Math.round` על מספר אי-שלילי. חצי אגורה עולה. אין עיגול בנקאי.

תאריכים נשמרים ב-UTC. כלל עסקי של יום, סופ״ש, חג או גיל עובר דרך `Asia/Jerusalem` ב-`server/src/domain/time.ts`. אסור להשתמש ב-`getDay()` של המחשב המקומי.

טקסט ללקוח יושב ב-`client/src/copy/he.ts`. השרת מחזיר קוד שגיאה באנגלית, והלקוח מתרגם אותו למשפט. המשפטים העבריים זהים לאפיון, סעיף 21, וגם לשאר המשפטים שננעלו שם. רכיב לא מרכיב משפט שגיאה בעצמו.

### תוצאות ושגיאות

כישלון עסקי צפוי מחזיר `Result`, לא זורק.

```ts
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: DomainError };

export type DomainError = { code: ErrorCode; message?: string };
```

`throw` שמור לבאג מתכנת: מצב בלתי אפשרי, ספק שהפר חוזה, או מסד שנפל. מטפל Express תופס את זה, רושם לוג, ומחזיר קוד `INTERNAL` בלי פרטי מסד.

כל תשובת API היא JSON:

```ts
type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ErrorCode };
```

הצלחה חוזרת 200. כישלון עסקי חוזר 400, חוץ מ-`FORBIDDEN` שהוא 403 ומ-`CAR_TAKEN` שהוא 409. תקלה לא צפויה חוזרת 500 עם `INTERNAL`.

## 6. הערות

הערות באנגלית. בעברית רק המחרוזות ב-`src/copy/he.ts`.

כותבים הערה כשהשורה הבאה מפתיעה, או כשיש שמורה מהאפיון שאסור «לשפר» בטעות. לא מספרים מה השורה עושה.

```ts
// A segment is priced by the Jerusalem date it starts on, not by the
// dates it crosses. A Thursday 22:00 segment stays a weekday even though
// most of those 24 hours are Friday. Product spec section 11.
const day = jerusalemDate(segment.start);
```

הערת מטלה (`TODO`, `FIXME`) מותרת רק עם מספר השלב שבו מותר לממש אותה, למשל `TODO(stage-7): send the outbox`. מטלה בלי שלב נחשבת קוד שבור ולא ממזגים אותה.

שמות:

- קבצים ופונקציות: `camelCase` לפונקציות, `kebab-case` לקבצי רכיב שלא מייצאים טיפוס, `PascalCase` לרכיבי React ולטיפוסים.
- בוליאני: `is`, `has`, או שם מצב ברור. לא `flag`.
- פונקציית דומיין אומרת את התוצאה: `refundPercent`, `deliveryFeeAgorot`, `isCarOfferable`.
- אין קיצורים חוץ מ-`id`, `km`, `url`.

גודל: פונקציית דומיין עושה חישוב אחד. שירות עושה מקרה שימוש אחד. קובץ שירות שעובר 250 שורות מפוצל לפי מקרה שימוש, לא לפי «עזרים».

## 7. מבנה הריפו

```text
docs/SPEC.md
docs/Rules.md
docs/CHANGES.md
client/                      React + Vite + Tailwind
  index.html                 lang=he dir=rtl
  src/main.tsx
  src/routes/                המסכים מאפיון סעיף 6
  src/components/
  src/copy/he.ts
  src/styles.css
server/                      Express
  prisma/schema.prisma
  prisma/migrations/
  src/domain/
  src/http/                  ראוטרים ו-middleware של JWT
  src/services/
  src/repositories/
  src/payments/
  src/geocoding/
  src/mail/
  src/storage/
  src/jobs/
uploads/                     gitignored
.env.example
pnpm-workspace.yaml
.github/workflows/ci.yml
```

מסך ב-React קורא ל-API ומציג את מה שהשרת החזיר. הוא לא מרכיב שאילתה ולא מחשב מחיר סופי. בפיתוח Vite רץ על פורט 5173 ומתווך את `/api` ואת `/media` אל Express בפורט 4000.

## 8. ארכיטקטורה

```mermaid
flowchart TB
  browser[React Vite Tailwind]
  api[Express HTTP and JWT]
  services[services]
  domain[domain]
  repo[repositories]
  db[(PostgreSQL)]
  pay[PaymentProvider]
  geo[Geocoder]
  mail[Mailer]
  files[FileStore]

  browser -->|JSON /api| api
  api --> services
  services --> domain
  services --> repo
  services --> pay
  services --> geo
  services --> mail
  services --> files
  repo --> db
```

הלקוח הוא Single Page Application. השרת לא מרנדר HTML של מסכים. הוא מגיש JSON, קבצי מדיה, ו-webhook.

ספקי הקצה הם ממשקים. הבדיקות מחליפות אותם בכפולים. הקוד העסקי לא מייבא את Stripe, את Google, או את Resend ישירות.

```ts
export interface PaymentProvider {
  readonly name: "stripe";
  createCheckout(input: {
    orderId: string;
    amount: Agorot;
    currency: "ILS";
    customerEmail: string;
    description: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ redirectUrl: string; providerRef: string }>;
  refund(input: { providerRef: string; amount: Agorot }): Promise<{ refundRef: string }>;
  parseWebhook(rawBody: string, signature: string): Promise<PaymentEvent>;
}

export interface Geocoder {
  geocode(address: string): Promise<{
    lat: number;
    lng: number;
    formattedAddress: string;
    countryCode: string;
  } | null>;
}

export interface Mailer {
  send(input: { to: string; subject: string; text: string }): Promise<void>;
}

export interface FileStore {
  saveCarPhoto(carId: string, photoId: string, bytes: Uint8Array): Promise<void>;
  readCarPhoto(carId: string, photoId: string): Promise<Uint8Array>;
}
```

מימוש ראשון: Stripe בסביבת בדיקות בלבד (`sk_test_`, `whsec_` של בדיקות). מפתח חי (`sk_live_`) נדחה בהפעלה. גיאוקודינג: Google Geocoding כש-`GEOCODER=google`. אימייל: Resend כש-`MAILER=resend`. קבצים: דיסק מקומי תחת `uploads/`.

החלפת סליקה ישראלית בעתיד היא מחלקה חדשה של `PaymentProvider` ושדה `paymentProvider` על ההזמנה. החזר הולך לספק שחייב את ההזמנה המקורית.

## 9. סביבה

קובץ `.env.example` מכיל את המפתחות בלי ערכים סודיים:

```text
DATABASE_URL=postgresql://lot:lot@localhost:5432/lot
CUSTOMER_JWT_SECRET=
STAFF_JWT_SECRET=
CLIENT_ORIGIN=http://localhost:5173
JOB_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
GEOCODER=fake
GOOGLE_MAPS_API_KEY=
MAILER=log
RESEND_API_KEY=
MAIL_FROM=
BOOTSTRAP_MANAGER_EMAIL=
BOOTSTRAP_MANAGER_PASSWORD=
APP_URL=http://localhost:5173
API_URL=http://localhost:4000
```

שני סודות ה-JWT הם מחרוזות אקראיות של 32 בתים לפחות, נפרדות. אסור לחתום לקוח וצוות באותו סוד. `CLIENT_ORIGIN` הוא המקור היחיד ש-CORS מרשה, עם `credentials`. `JOB_SECRET` מגן על `POST /api/jobs/tick`.

`GEOCODER=fake` מקבל רק כתובת בצורה `lat,lng` לשימוש בבדיקות ובפיתוח. `GEOCODER=google` חובה לפני שימוש אמיתי בכתובות. `MAILER=log` כותב את המכתב ל-`tmp/mail/` ולא שולח.

סיסמת המנהל הראשון נקראת פעם אחת ב-seed, נשמרת כגיבוב, ולא נכתבת ללוג.

## 10. סכמת מסד

הסכמה הבאה היא החוזה. אינדקסים ייחודיים חלקיים נכתבים ב-SQL של המיגרציה, כי Prisma לא מבטא אותם במודל. אחרי יצירת המיגרציה לא עורכים אותה ביד. שינוי סכמה הוא מיגרציה חדשה.

```prisma
model LotSettings {
  id                                String   @id @default("default")
  name                              String   @default("")
  address                           String   @default("")
  latitude                          Float?
  longitude                         Float?
  phone                             String   @default("")
  publicEmail                       String   @default("")
  staffAlertEmail                   String   @default("")
  kmPerDay                          Int      @default(250)
  excessKmPriceAgorot               Int      @default(200)
  fuelShortagePricePerLiterAgorot   Int      @default(800)
}

model SettingChange {
  id           String   @id @default(uuid())
  staffId      String
  createdAt    DateTime @default(now())
  scope        String
  entityId     String?
  previousJson Json
  nextJson     Json
}

model Holiday {
  id   String   @id @default(uuid())
  date DateTime @db.Date
  name String
  @@unique([date])
}

model Tag {
  id     String   @id @default(uuid())
  name   String   @unique
  active Boolean  @default(true)
  cars   CarTag[]
}

model InsurancePackage {
  id               String  @id @default(uuid())
  name             String
  description      String  @default("")
  dailyPriceAgorot Int
  includedInBase   Boolean @default(false)
  active           Boolean @default(true)
  sortOrder        Int
}

model Car {
  id                         String    @id @default(uuid())
  plate                      String    @unique
  vin                        String?
  make                       String
  model                      String
  year                       Int
  color                      String
  primaryType                String
  seats                      Int
  currentKm                  Int
  purchasedAt                DateTime  @db.Date
  minAge                     Int?
  ownersCount                Int?
  knownAccidents             String?
  accidentsNone              Boolean   @default(false)
  conditionGrade             String?
  salePriceAgorot            Int?
  deepTreatmentCompletedAt   DateTime?
  status                     String
  careReason                 String?
  internalNotes              String    @default("")
  saleAlertSentAt            DateTime?
  tags                       CarTag[]
  photos                     CarPhoto[]
  ageBands                   AgeBand[]
  rentals                    RentalOrder[]
  sales                      SaleOrder[]
}

model CarTag {
  carId String
  tagId String
  car   Car    @relation(fields: [carId], references: [id])
  tag   Tag    @relation(fields: [tagId], references: [id])
  @@id([carId, tagId])
}

model CarPhoto {
  id        String @id @default(uuid())
  carId     String
  alt       String
  sortOrder Int
  car       Car    @relation(fields: [carId], references: [id])
}

model AgeBand {
  id                   String @id @default(uuid())
  carId                String
  minAge               Int
  maxAge               Int?
  weekdayDailyAgorot   Int
  weekendDailyAgorot   Int
  holidayDailyAgorot   Int
  car                  Car    @relation(fields: [carId], references: [id])
}

model Customer {
  id               String    @id @default(uuid())
  fullName         String
  phone            String
  email            String    @unique
  birthDate        DateTime  @db.Date
  passwordHash     String
  blocked          Boolean   @default(false)
  blockReason      String?
  blockNote        String    @default("")
  blockedAt        DateTime?
  blockedByStaffId String?
  unblockedAt      DateTime?
  unblockedByStaffId String?
}

model Staff {
  id           String  @id @default(uuid())
  fullName     String
  email        String  @unique
  passwordHash String
  role         String
  active       Boolean @default(true)
}

model RentalOrder {
  id                String    @id @default(uuid())
  number            String    @unique
  carId             String
  customerId        String?
  holderTokenHash   String?   @unique
  pickupAt          DateTime
  returnAt          DateTime
  searchAge         Int
  ageAtPickup       Int
  returnMode        String
  returnAddress     String    @default("")
  returnLat         Float?
  returnLng         Float?
  straightLineKm    Float     @default(0)
  billedKm          Float     @default(0)
  deliveryFeeAgorot Int
  insurancePackageId String
  rentalAgorot      Int
  insuranceAgorot   Int
  totalAgorot       Int
  priceLines        Json
  kmAllowance       Int
  status            String
  holdExpiresAt     DateTime?
  paymentProvider   String    @default("stripe")
  paymentRef        String?
  startKm           Int?
  noShow            Boolean   @default(false)
  cancelledBy       String?
  yardCancelNote    String    @default("")
  refundPercent     Int?
  refundAgorot      Int?
  reminderSentAt    DateTime?
  car               Car       @relation(fields: [carId], references: [id])
  checklist         Checklist?
}

model Checklist {
  id                  String    @id @default(uuid())
  rentalOrderId       String    @unique
  endKm               Int?
  fuelLitersShort     Decimal?  @db.Decimal(6, 1)
  fuelChargeAgorot    Int?
  kmExcess            Int?
  kmChargeAgorot      Int?
  washNeeded          Boolean   @default(false)
  washDone            Boolean   @default(false)
  treatmentNeeded     Boolean   @default(false)
  treatmentDone       Boolean   @default(false)
  treatmentNote       String    @default("")
  priceDecision       String?
  completedAt         DateTime?
  completedByStaffId  String?
  rentalOrder         RentalOrder @relation(fields: [rentalOrderId], references: [id])
  damages             Damage[]
  photos              ChecklistPhoto[]
}

model Damage {
  id                 String @id @default(uuid())
  checklistId        String
  description        String
  estimatedAgorot    Int
  checklist          Checklist @relation(fields: [checklistId], references: [id])
  photos             DamagePhoto[]
}

model DamagePhoto {
  id       String @id @default(uuid())
  damageId String
  damage   Damage @relation(fields: [damageId], references: [id])
}

model ChecklistPhoto {
  id          String @id @default(uuid())
  checklistId String
  checklist   Checklist @relation(fields: [checklistId], references: [id])
}

model SaleOrder {
  id                 String    @id @default(uuid())
  number             String    @unique
  carId              String
  customerId         String?
  holderTokenHash    String?   @unique
  listPriceAgorot    Int
  depositAgorot      Int
  status             String
  wantsFinancing     Boolean   @default(false)
  financingNote      String    @default("")
  wantsTradeIn       Boolean   @default(false)
  tradeInNote        String    @default("")
  holdExpiresAt      DateTime?
  paymentProvider    String    @default("stripe")
  paymentRef         String?
  refundDecidedAt    DateTime?
  refundApproved     Boolean?
  refundByStaffId    String?
  handoverAt         DateTime?
  handoverByStaffId  String?
  car                Car       @relation(fields: [carId], references: [id])
}

model PaymentEvent {
  id              String   @id @default(uuid())
  provider        String
  providerEventId String
  orderKind       String
  orderId         String
  receivedAt      DateTime @default(now())
  @@unique([provider, providerEventId])
}

model EmailOutbox {
  id          String    @id @default(uuid())
  to          String
  subject     String
  body        String
  status      String
  attempts    Int       @default(0)
  lastError   String    @default("")
  createdAt   DateTime  @default(now())
  sentAt      DateTime?
}

model JobCheckpoint {
  name     String    @id
  ranAt    DateTime
}

model KmAdjustment {
  id         String   @id @default(uuid())
  carId      String
  staffId    String
  previousKm Int
  nextKm     Int
  reason     String
  createdAt  DateTime @default(now())
}

model OrderSequence {
  kind String
  year Int
  last Int
  @@id([kind, year])
}
```

במיגרציה הראשונה, אחרי הטבלאות:

```sql
CREATE UNIQUE INDEX rental_one_open_per_car
ON "RentalOrder" ("carId")
WHERE status IN ('pending_payment', 'confirmed', 'active', 'checklist');

CREATE UNIQUE INDEX sale_one_open_per_car
ON "SaleOrder" ("carId")
WHERE status IN ('pending_payment', 'reserved');

CREATE UNIQUE INDEX one_active_base_insurance
ON "InsurancePackage" ("includedInBase")
WHERE "includedInBase" = true AND active = true;
```

התנגשות באינדקס ההשכרה או המכירה חוזרת ללקוח כ-`CAR_TAKEN`. לא כשגיאת מסד.

Seed חובה, בלי רכבי דמו:

- רשומת `LotSettings` אחת עם ברירות המחדל של האפיון: 250 ק״מ ליום, 2 ₪ חריגה, 8 ₪ לליטר.
- תגיות פעילות: «חשמלי», «אוטומטי».
- חבילת ביטוח אחת: «ביטוח בסיסי», תיאור קצר, מחיר 0, `includedInBase`, פעילה.
- מנהל אחד מ-`BOOTSTRAP_MANAGER_EMAIL` וסיסמה מהסביבה, אם עדיין אין מנהל.

מחיקת רכב שיש לו הזמנה אסורה בשירות, לא רק בממשק. אין `onDelete: Cascade` מהזמנה לרכב.

## 11. דומיין — חוזים

כל הפונקציות כאן טהורות. הבדיקות שלהן הן שער שלבים 1 ואילך. שעון וחגים נכנסים כארגומנטים.

### זמן וגיל

`jerusalemDate(instant)` מחזיר תאריך לוח ושדה `weekday` שבו 5 הוא שישי ו-6 הוא שבת.

`ageOn(birthDate, onDate)` הוא שנים מלאות. יום ההולדת עצמו כבר נספר.

`rentalDurationHours(pickup, returnAt)` הוא `(returnAt - pickup) / 3600000`. פחות מ-24 שעות: שגיאה `RENTAL_TOO_SHORT`. איסוף שמוקדם מ-`now` בפחות מ-60 דקות: `PICKUP_TOO_SOON`.

### קטעי מחיר

`splitRental(pickup, returnAt)` חותך ליממות של 24 שעות מהרגע `pickup`, ואז שארית. שארית של אפס לא מייצרת קטע. שעת השארית יכולה להיות שבר.

`dayKind(start, holidays)`:

1. תאריך ירושלים של `start` נמצא בקבוצת החגים → `holiday`
2. אחרת שישי או שבת → `weekend`
3. אחרת → `weekday`

חג מנצח גם בשישי ושבת. קטע שנפתח בחמישי נשאר weekday גם אם הוא נשפך לשישי.

`quoteRental(input)` בוחר מדרגה אחת שמכילה את `ageAtPickup`. אין מדרגה, או שהגיל קטן מ-`minAge`: `AGE_NOT_OFFERED`. מדרגות חופפות: `BANDS_OVERLAP`, וזו שגיאת נתונים שלא אמורה להגיע מהשירות כי השירות דוחה אותן בשמירה.

לכל קטע מלא: מחיר היום של הסוג. לקטע חלקי: `hours * daily / 24`. כל קטע מעוגל לאגורה, ואז סכום. זו `rentalAgorot`.

ביטוח: `round(dailyPriceAgorot * totalHours / 24)`. בסיס הוא 0. הלקוח בוחר חבילה אחת, לא סכום של חבילות.

מכסה: `round(kmPerDay * totalHours / 24)` לק״מ שלם.

הדוגמה באפיון סעיף 11 היא בדיקה קבועה: חמישי 10:00 עד שבת 15:00, 240 ו-360, בלי חג, בסיס, החזרה במגרש → 675 ₪ ו-53 שעות. עם מכסה 250 → 552 ק״מ. אם השבת חג, רק קטע השארית עובר למחיר חג.

### מרחק

`haversineKm` עם רדיוס 6371. `billedKm = straightLineKm * 1.1`.

`deliveryFeeAgorot(mode, billedKm)`:

| תנאי | תוצאה |
| --- | --- |
| `lot` | 0, ושני המרחקים 0 |
| `billedKm <= 5` | 6000 אגורות |
| `billedKm <= 15` | 12000 |
| `billedKm <= 30` | 20000 |
| אחרת | `TOO_FAR` |

5.0 → 60 ₪. 5.1 → 120 ₪. 30.0 → 200 ₪. 30.1 → `TOO_FAR`.

השירות מוסיף «, ישראל» לכתובת אם אין בה «ישראל». `countryCode !== "IL"` או `null` → `ADDRESS_NOT_FOUND`.

### ביטול

`refundPercent(hoursUntilPickup)`:

| שעות | אחוז |
| --- | --- |
| `> 48` | 100 |
| `>= 24` | 50 |
| `>= 18` | 25 |
| `>= 12` | 10 |
| אחרת, כולל שלילי | 0 |

בדיוק 48 הוא 50. בדיוק 24 הוא 50. בדיוק 18 הוא 25. בדיוק 12 הוא 10. 47 שעות הן 50, וזו בדיקת קבלה.

`refundAgorot(total, percent)` = `round(total * percent / 100)`.

ביטול מגרש לא קורא לפונקציה הזו. הוא תמיד 100% מסכום ששולם.

### מכירה וסף

`depositAgorot(listPrice)` = `round(listPrice * 0.10)`.

`saleThresholdReached(purchasedAt, currentKm, today)` אמת אם עברו שלוש שנים קלנדריות, או `currentKm >= 100000`. שלוש שנים: אותו יום בחודש, ושנה + 3. אם היום לא קיים, היום האחרון של החודש. 29 בפברואר ועוד שלוש שנים נופל על 28 בפברואר.

### הרשאות

מפה קבועה ב-`server/src/domain/permissions.ts`. השירות שואל `can(role, key)`. אסור לבדוק `role === "manager"` מחוץ לקובץ הזה.

המפתחות והטבלה הם אלה שבאפיון סעיף 17, בלי הוספה ובלי השמטה.

### מדרגות ומעברי רכב

`validateAgeBands(minAge, bands)` נכשל אם המדרגה הנמוכה ביותר לא מתחילה ב-`minAge`, אם יש חפיפה, או אם מחיר שלילי. חור בין מדרגות מותר.

`assertCarTransition(from, to, actor)` מכיל רק את המעברים שבאפיון סעיף 13. כל מעבר אחר הוא `ILLEGAL_TRANSITION`. `for_sale` מ-`available` דורש הרשאת `sales.early_move`. חזרה מ-`deep_treatment` או מ-`for_sale` אל `available` דורשת אותה הרשאה. `deep_treatment` מעובד דורש `cars.status` ואין השכרה פתוחה.

`canOfferForRent` אמת רק אם `status === "available"` ואין הזמנה במצבים `pending_payment` (שעוד לא פג), `confirmed`, `active`, `checklist`.

`canOfferForSale` אמת רק אם `status === "for_sale"` ואין הזמנת מכירה ב-`pending_payment` שלא פג או ב-`reserved`.

## 12. שירותים

כל פונקציה כאן היא מקרה שימוש אחד, בטרנזקציה כשהיא כותבת יותר משורה, ואחרי בדיקת הרשאה.

| שירות | מה הוא עושה | הרשאה |
| --- | --- | --- |
| `searchRentals` | גיאוקודינג אם צריך, סינון לפי `canOfferForRent`, הצעת מחיר בלי שדרוג | ציבורי |
| `quoteRentalCar` | אותו חישוב לדף רכב, כולל חבילות פעילות | ציבורי |
| `holdRental` | טרנזקציה: נועל את הרכב, בודק שוב הצעה, כותב `pending_payment` ל-15 דקות עם צילום מחיר. עדיין בלי לקוח. הטוקן נשמר כגיבוב, והערך הגולמי חוזר ב-JSON. הלקוח שומר אותו ב-`sessionStorage` ושולח בכותרת `X-Hold-Token` | ציבורי |
| `payRental` | דורש את כותרת ההחזקה. מחבר לקוח לפי ה-JWT. אם חסום: `CUSTOMER_BLOCKED` ומשחרר. אם הגיל לא תואם: `AGE_MISMATCH` ומשחרר. אם המחיר השתנה: `PRICE_CHANGED` בלי סליקה ובלי שחרור. אחרת checkout | בעל טוקן ההחזקה |
| `confirmPayment` | רק מאירוע חתום וייחודי. מעביר ל-`confirmed` או `reserved`, כותב לתיבת דואר | מערכת |
| `cancelRentalByCustomer` | רק `confirmed`. אחוז לפי הסולם. החזר אצל הספק. תיבת דואר | בעל ההזמנה |
| `cancelRentalByYard` | רק `confirmed`. 100%. הערה פנימית חובה | `rentals.cancel_yard` |
| `handOverRental` | `confirmed` → `active`, `startKm` חובה | `rentals.handover` |
| `markReturned` | `active` → `checklist`, יוצר צ׳קליסט ריק | `rentals.handover` |
| `markNoShow` | אחרי `pickupAt`, מ-`confirmed` בלבד. קובע ק״מ התחלה וסוף ל-`currentKm`, מחשב החזר, עובר ל-`checklist` עם `noShow` | `rentals.handover` |
| `completeChecklist` | הכללים בסעיף 13 כאן. בהחזרה רגילה → `completed` ומעדכן `currentKm`. באי-הגעה → `cancelled` והק״מ של הרכב לא זז | `checklist.complete` |
| `searchSales` | `canOfferForSale` לפי ק״מ, מצב וסוג | ציבורי |
| `holdSale` | כמו `holdRental`, עם כותרת `X-Hold-Token` נפרדת למכירה, מקדמה 10% מצילום המחיר | ציבורי |
| `paySale` | דורש את כותרת ההחזקה ו-JWT של לקוח. חסום משחרר עם `CUSTOMER_BLOCKED`. אחרת checkout על סכום המקדמה בלבד | בעל טוקן ההחזקה |
| `decideSaleRefund` | אישור: החזר 100% ו-`for_sale`. דחייה: נשאר `reserved` | `sales.refund` |
| `handOverSale` | `reserved` → `completed`, הרכב `sold` | `sales.handover` |
| `changeCarStatus` | רק מעברים חוקיים, ובלי השכרה פתוחה כשהאפיון דורש זאת | לפי המעבר |
| `completeDeepTreatment` | דורש יד, תאונות או «אין», ציון, מחיר, ארבע תמונות, ותאריך סיום | `cars.status` |
| `saveAgeBands` | `validateAgeBands` בתוך הטרנזקציה | `cars.price` |
| `adjustKm` | מנהל בלבד, סיבה חובה, רשומת `KmAdjustment`. מותר גם כלפי מטה, כי זה תיקון | `settings.write` |
| `blockCustomer` / `unblockCustomer` | סיבה מהקבוצה `debt`, `damage`, `other` | `customers.block` |
| `expireHolds` | `pending_payment` שפג → `expired` | מערכת |

צילום המחיר על ההזמנה לא מחושב מחדש אחרי `confirmed` או `reserved`. שינוי מחירון צי או מדרגות לא נוגע בהזמנה ששולמה.

`completeChecklist` נכשל בלי: `endKm`, ליטרים חסרים, `priceDecision`, וגם `washDone` אם `washNeeded`, ו-`treatmentDone` אם `treatmentNeeded`. בהחזרה רגילה `endKm > startKm` ולפחות תמונת החזרה אחת. אם יש נזק: תיאור, סכום, ותמונה אחת לפחות. ב-`priceDecision = update` המדרגות החדשות כבר שמורות לפני הקריאה. נזק, חריגת ק״מ ודלק נשמרים ולא נשלחים לסליקה.

מספר הזמנה נוצר באותה טרנזקציה מ-`OrderSequence`: `R-YYYY-#####` או `S-YYYY-#####`, חמש ספרות.

חשבון נוצר במסך התשלום, אחרי ההחזקה. לכן `customerId` ריק עד `payRental` או תשלום המקדמה. בלי כותרת `X-Hold-Token` אי אפשר להמשיך לאותה הזמנה. טוקן החזקה אינו JWT.

לקוח חסום נעצר ב-`payRental` ובתשלום המקדמה, לא בחיפוש. ההחזקה עוברת ל-`expired`.

גיל: `payRental` מחשב `ageOn` מתאריך הלידה ביום האיסוף. אם הוא שונה מ-`searchAge` שנשמר בהחזקה, השגיאה `AGE_MISMATCH` וההחזקה עוברת ל-`expired`.

## 13. צ׳קליסט בקוד

סדר השדות בטופס העובד, ולא אחר:

1. ק״מ סיום
2. ליטרים חסרים
3. נזקים ותמונותיהם
4. שטיפה: לא נדרש / נדרש / בוצע
5. טיפול: לא נדרש / נדרש / בוצע, והערת טיפול
6. תמונות החזרה
7. החלטת מחיר: להשאיר או לעדכן

הטופס מציג את הסכומים המחושבים לפני השמירה: חריגה ודלק. הם לקריאה בלבד. העובד לא מקליד אותם.

שטיפה או טיפול באמצע החיים, בלי הזמנה, הם `available` → `in_care` עם `careReason` של `wash`, `treatment` או `other`. זה לא צ׳קליסט.

## 14. מסכים, JWT וקצה

נתיבי המסך הם אלה שבאפיון סעיף 6, ב-React Router. כל קריאת נתונים הולכת ל-Express תחת `/api`, פונקציה אחת לכל שירות מסעיף 12.

### JWT

שני קהלים, שני סודות, שתי עוגיות `httpOnly`:

| מי | עוגייה | `aud` | סוד |
| --- | --- | --- | --- |
| לקוח | `customer_token` | `customer` | `CUSTOMER_JWT_SECRET` |
| עובד מגרש או מנהל | `staff_token` | `staff` | `STAFF_JWT_SECRET` |

העוגיות: `sameSite=lax`, `secure` בייצור, תוקף 12 שעות. המטען של לקוח הוא `{ sub, aud: "customer" }`. המטען של צוות הוא `{ sub, aud: "staff", role: "yard" | "manager" }`. אין טבלת סשנים.

כל בקשה מאומתת בודקת את החתימה מול הסוד של הקהל המתאים, ואז קוראת את השורה מ-PostgreSQL. לקוח חסום נשאר מחובר אבל נעצר בתשלום. עובד עם `active = false` מקבל 401. אם `role` במסד שונה מהמטען, המסד מנצח. הרשאה נבדקת עם `can(role, key)` על התפקיד מהמסד, לא על המחרוזת שבטוקן בלבד.

`/api/staff` דוחה טוקן לקוח. `/api/account` ופעולות תשלום של לקוח דוחות טוקן צוות. עובד מגרש שמגיע לפעולת מנהל מקבל `FORBIDDEN` גם כשהממשק הסתיר את הכפתור.

ה-SPA שולח `credentials: "include"`. אסור לשמור JWT ב-`localStorage` או ב-`sessionStorage`.

סיסמה: bcrypt בעלות 12. מדיניות הסיסמה: לפחות 8 תווים, אות אחת וספרה אחת. אימייל נשמר באותיות קטנות. טלפון ישראלי נייד נשמר כ-`+9725XXXXXXXX`.

תמונות רכב ציבוריות נקראות מ-`GET /media/cars/:carId/:photoId` בלי JWT. תמונות צ׳קליסט ונזק נקראות רק תחת `/api/staff` ועם `checklist.complete` או `rentals.read`. מספר רישוי לא נכנס ל-URL ולא ל-JSON של קטלוג ציבורי. הוא נכנס לאובייקט האישור אחרי תשלום, ולמסכי עובד.

`POST /api/payments/webhook` קורא גוף גולמי, מאמת חתימה, וקורא ל-`confirmPayment`. דף ההצלחה לא משנה סטטוס. הוא קורא `GET /api/rent/orders/:id` או את מקבילת המכירה, ומציג «מאשרים את התשלום» כל עוד הסטטוס `pending_payment`.

פעולה בלי הרשאה לא מרונדרת. אם היא נשלחת בכל זאת, השירות מחזיר `FORBIDDEN`. זה מכסה את תרחיש הקבלה 16.

עיצוב: Tailwind. הצבעים, הרדיוסים והפונט Heebo שבאפיון סעיף 5 מוגדרים פעם אחת ב-`client/tailwind.config.ts`. רכיב לא ממציא צבע חדש. `dir="rtl"` ו-`lang="he"` על ה-`html` ב-`client/index.html`.

## 15. תיבת דואר ותהליכי רקע

שינוי מצב שדורש מכתב כותב שורת `EmailOutbox` באותה טרנזקציה. השליחה עצמה אחרי ה-commit. כישלון מעדכן `failed` ולא מחזיר את ההזמנה לאחור. בלוח העובדים יש «נסה שוב» שקורא שוב ל-`Mailer`.

המכתבים הם הרשימה באפיון סעיף 18, ותו לא. תזכורת נשלחת פעם אחת, 24 שעות לפני איסוף, רק ל-`confirmed`, ומסמנת `reminderSentAt`. התראת סף נשלחת פעם אחת ומסמנת `saleAlertSentAt`.

`POST /api/jobs/tick` עם כותרת `Authorization: Bearer JOB_SECRET`:

- בכל קריאה: `expireHolds`, ושליחת שורות `pending` בתיבה
- אם עברה שעה מ-`JobCheckpoint.reminders`: תזכורות
- אם עברו 24 שעות מ-`JobCheckpoint.saleThreshold`: סריקת סף

בנוסף, כל עדכון `currentKm` קורא לבדיקת הסף של הרכב הזה מיד. cron חיצוני קורא ל-tick כל דקה. בלי זה החזקות יפוגו רק בניסיון התפיסה הבא, וזה מכוסה גם בקוד של `holdRental`, אבל התזכורות יחכו.

## 16. אבטחה

- סודות רק בסביבה. לוג לא מדפיס גוף webhook, סיסמה, או מפתח.
- webhook בלי חתימה תקינה מחזיר 400 ולא נוגע בהזמנה.
- אירוע תשלום כפול נעצר באינדקס של `PaymentEvent` ולא שולח מכתב שני.
- העלאה: JPEG, PNG, WEBP, עד 8MB, עד 20 תמונות לרכב. סוג הקובץ נבדק לפי התוכן, לא לפי הסיומת בלבד.
- שדות פנימיים (`internalNotes`, `blockReason`, `blockNote`, VIN) לא נבחרים בשאילתת קטלוג.
- עדכון סטטוס רגיש כותב מי ביצע, בשדה שכבר קיים או ב-`SettingChange` / `KmAdjustment`.
- אי אפשר לכבות את המנהל הפעיל האחרון. הבדיקה בתוך הטרנזקציה.
- אין מחיקת עובד. רק `active = false`.

## 17. בדיקות

Vitest. בדיקות דומיין לא נוגעות במסד. בדיקות שירות רצות על PostgreSQL מקומי, או נדחות לשלב שבו יש מסד, ומסומנות `integration`.

כל תרחיש קבלה מהאפיון סעיף 22 מקבל בדיקה:

| תרחיש | איפה |
| --- | --- |
| 1 חיפוש חסר | פעולת `searchRentals` עם Zod |
| 2 רכב פנוי ומחיר עם מדרגת מרחק | `searchRentals` אינטגרציה |
| 3 הזמנה פתוחה מסתירה גם תאריך אחר | `canOfferForRent` |
| 4 חמישי עד שבת, וחג באמצע | `quoteRental` |
| 5 סולם 5.0 / 5.1 / 30.1 | `deliveryFeeAgorot` |
| 6 תשלום בדיקה שומר צילום ומכתב, רישוי רק אחרי אישור | `confirmPayment` |
| 7 כישלון משחרר | webhook כישלון ו-`expireHolds` |
| 8 גיל לא תואם | `holdRental` |
| 9 חסום לא משלם השכרה ולא מקדמה | שני ה-hold |
| 10 47 שעות 50%, מגרש 100% | `refundPercent` והשירותים |
| 11 צ׳קליסט חסר נכשל | `completeChecklist` |
| 12 אחרי צ׳קליסט הרכב והק״מ מתעדכנים | אינטגרציה |
| 13 סף לא מוריד מהשכרה, ומכתב אחד | `saleThresholdReached` והשירות |
| 14 טיפול בלי שדות נכשל, ואיתם עובר למכירה | `completeDeepTreatment` |
| 15 מקדמה בלי שעון, החזר רק מנהל | `holdSale` ו-`decideSaleRefund` |
| 16 עובד מגרש נדחה בשרת | `can` על ארבעת המפתחות |

בדיקת הדוגמה המספרית של 675 ₪ לא מוחלפת בקירוב. שוויון מדויק באגורות.

## 18. שלבי בנייה

כל שלב הוא ענף אחד ו-PR אחד. תנאי כניסה: השלב הקודם ממוזג ל-`main` והשער שלו ירוק.

### שלב 0 — מאגר וכלים

יוצרים את מאגר הגיטהאב הפרטי, מגנים על `main`, ומוסיפים את קבצי הכלי: `package.json`, `tsconfig` עם `strict`, ESLint, Prettier, Vitest, `.gitignore`, `.env.example`, `.github/workflows/ci.yml`, ו-`README.md` של עד 30 שורות שמפנה לשלושת המסמכים ולפקודות `pnpm test`, `pnpm typecheck`, `pnpm lint`.

יציאה: CI ירוק על PR ריק מקוד מוצר. רשומת יומן.

### שלב 1 — דומיין

כל `server/src/domain` ובדיקות התרחישים שאפשר בלי מסד: 4, 5, 10 (האחוז), 13 (החישוב), גיל, מדרגות, מעברים, הרשאות.

יציאה: `pnpm test` ירוק. אין ייבוא מ-`server/src/http` או מ-`client` אל `server/src/domain`.

### שלב 2 — מסד

Prisma, המיגרציה עם שלושת האינדקסים, seed, ומאגר בלי שירותי מוצר.

יציאה: `pnpm db:migrate` על מסד ריק מסיים, וה-seed רץ פעמיים בלי כפילות מנהל או ביטוח בסיס.

### שלב 3 — עובדים ורכבים

כניסת צוות ב-JWT, רכבים, מדרגות, תמונות, תגיות, הגדרות, חגים, ביטוח, היסטוריית הגדרות. בלי מסכי לקוח.

יציאה: אי אפשר להעביר ל-`available` בלי תמונה, גיל מינימום ומדרגה. עובד מגרש לא פותח הגדרות, גם בקריאה ישירה.

### שלב 4 — קטלוג ציבורי

בית, חיפושי השכרה וקנייה, דפי רכב, עיצוב סעיף 5. בלי תשלום.

יציאה: תרחישים 1, 2, 3, 5 מול מסד. מספר רישוי לא מופיע ב-HTML של הקטלוג.

### שלב 5 — חשבון ותשלום בדיקות

JWT ללקוח, החזקות, Stripe test, webhook, דפי אישור.

יציאה: תרחישים 6, 7, 8, 9, 15. מפתח `sk_live_` מפיל את ההפעלה.

### שלב 6 — מסירה, צ׳קליסט, מחזור מכירה

יציאה: תרחישים 11, 12, 14, וביטולים של תרחיש 10 כולל החזר בדיקה ב-Stripe.

### שלב 7 — דואר ותהליכים

תיבת דואר, tick, תזכורת, התראת סף.

יציאה: תרחיש 13. כישלון `Mailer` משאיר הזמנה מאושרת ושורת `failed`.

### שלב 8 — קבלה

מעבר ידני על 16 התרחישים בסביבת בדיקות, ותיעוד התוצאה ביומן. רק אחריו מותר לדבר על חיבור סליקה ישראלית, וגם אז כשלב נפרד שמחליף את `PaymentProvider` ולא נוגע בדומיין.

## 19. שער לכל PR

הזרימה ב-`.github/workflows/ci.yml` מריצה, על Node 22:

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
```

`typecheck` הוא `tsc --noEmit`. כישלון באחד מהם חוסם מיזוג.

לפני פתיחת PR מריצים את אותו שער מקומית. לא מסמנים את הבדיקה ביומן אם היא לא רצה.

## 20. אסור

- לחשב מחיר סופי בתוך רכיב React.
- לקבוע זמינות לפי סטטוס הרכב בלבד, בלי לבדוק הזמנה פתוחה.
- לסגור הזמנה מדף ההצלחה של הדפדפן.
- לגבות באתר נזק, דלק, חריגת ק״מ, או את יתרת המכירה.
- להציג סיבת חסימה, VIN, או הערה פנימית ללקוח.
- להוסיף שפה, SMS, מימון מחושב, הארכת השכרה, או סניף נוסף בתוך שלב קיים.
- לערוך מיגרציה שכבר מוזגה.
- לדחוף סוד, או לדחוף force אל `main`.
- למזג בלי רשומה ב-[CHANGES.md](CHANGES.md).
