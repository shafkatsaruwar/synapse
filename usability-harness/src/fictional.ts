import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export interface FictionalData {
  disclaimer: string;
  personaName: string;
  preferredName: string;
  medication: {
    name: string;
    dose: string;
    form: string;
    frequency: string;
    time: string;
    notes: string;
  };
  appointment: {
    title: string;
    doctor: string;
    specialty: string;
    location: string;
    notes: string;
  };
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  allergy: string;
  condition: string;
  accounts: { email: string; note: string };
}

export const fictional: FictionalData = JSON.parse(
  readFileSync(join(here, "../fixtures/fictional-data.json"), "utf8"),
) as FictionalData;
