export const INTERESTS = ["Food", "Art", "Outdoors", "History", "Nightlife", "Shopping"] as const;
export const DIETARY = ["Vegetarian", "Vegan", "Gluten-free", "Halal", "No seafood"] as const;

export type Interest = (typeof INTERESTS)[number];
export type Dietary = (typeof DIETARY)[number];

export type TripDetails = {
  destination: string;
  stops: string[];
  startDate: string;
  endDate: string;
  budget: number;
  interests: Interest[];
  dietary: Dietary[];
};

export type Preferences = {
  food: "local" | "iconic";
  pace: "relaxed" | "packed";
  setting: "indoors" | "outdoors";
  crowd: "popular" | "quiet";
};

export type TripRequest = TripDetails & {
  preferences: Preferences;
};

export type Draft = {
  details?: TripDetails;
  preferences?: Preferences;
};
