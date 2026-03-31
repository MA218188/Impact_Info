export type PatientAllergy = {
  name: string;
  severity: "Mild" | "Moderate" | "Severe";
  reaction: string;
};

export const patientAllergies: Record<number, PatientAllergy[]> = {
  0: [
    {
      name: "Penicillin",
      severity: "Severe",
      reaction: "Rash and shortness of breath",
    },
    {
      name: "Peanuts",
      severity: "Severe",
      reaction: "Anaphylactic reaction",
    },
    {
      name: "Latex",
      severity: "Moderate",
      reaction: "Skin irritation",
    },
    {
      name: "Ibuprofen",
      severity: "Mild",
      reaction: "Stomach pain",
    },
  ],
  1: [
    {
      name: "Shellfish",
      severity: "Moderate",
      reaction: "Hives",
    },
  ],
  2: [],
  3: [
    {
      name: "Pollen",
      severity: "Mild",
      reaction: "Sneezing and watery eyes",
    },
  ],
};