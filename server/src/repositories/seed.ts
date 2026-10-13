import { hash } from "bcryptjs";

import { isAcceptedPassword } from "../domain/password.js";
import { database } from "./database.js";

// Locked catalog values from the build spec, section 10. These are stored
// data, not sentences assembled for a screen.
const TAG_NAMES = ["חשמלי", "אוטומטי"] as const;
const BASE_INSURANCE_NAME = "ביטוח בסיסי";
const BASE_INSURANCE_DESCRIPTION = "כלול במחיר ההשכרה";

/** Inserts the lot, tags, base insurance, and first manager. A second run adds nothing. */
export async function seedLot(): Promise<void> {
  await database.lotSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      kmPerDay: 250,
      excessKmPriceAgorot: 200,
      fuelShortagePricePerLiterAgorot: 800,
    },
  });

  for (const name of TAG_NAMES) {
    await database.tag.upsert({
      where: { name },
      update: {},
      create: { name, active: true },
    });
  }

  const baseInsurance = await database.insurancePackage.findFirst({
    where: {
      OR: [{ name: BASE_INSURANCE_NAME }, { includedInBase: true, active: true }],
    },
  });
  if (baseInsurance === null) {
    await database.insurancePackage.create({
      data: {
        name: BASE_INSURANCE_NAME,
        description: BASE_INSURANCE_DESCRIPTION,
        dailyPriceAgorot: 0,
        includedInBase: true,
        active: true,
        sortOrder: 0,
      },
    });
  }

  const manager = await database.staff.findFirst({ where: { role: "manager" } });
  if (manager !== null) return;

  const email = process.env.BOOTSTRAP_MANAGER_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_MANAGER_PASSWORD ?? "";
  if (email === undefined || email.length === 0 || password.length === 0) {
    throw new Error(
      "BOOTSTRAP_MANAGER_EMAIL and BOOTSTRAP_MANAGER_PASSWORD are required to create the first manager",
    );
  }
  if (!isAcceptedPassword(password)) {
    throw new Error(
      "Bootstrap password must be at least 8 characters and include a letter and a digit",
    );
  }

  const localPart = email.split("@")[0];
  await database.staff.create({
    data: {
      fullName: localPart !== undefined && localPart.length > 0 ? localPart : "manager",
      email,
      passwordHash: await hash(password, 12),
      role: "manager",
      active: true,
    },
  });
}

try {
  await seedLot();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : "Seed failed");
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
