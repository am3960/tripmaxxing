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

export const PACES = ["relaxed", "balanced", "packed"] as const;
export const FOOD_STYLES = ["local", "iconic"] as const;
export const SETTINGS = ["indoors", "outdoors"] as const;
export const CROWDS = ["popular", "quiet"] as const;
export const VARIETIES = ["focused", "mixed"] as const;
export const COST_PREFERENCES = ["cheapest", "balanced", "flexible"] as const;
export const TRANSPORTS = ["walk", "transit", "rideshare", "flexible"] as const;

export type Pace = (typeof PACES)[number];
export type FoodStyle = (typeof FOOD_STYLES)[number];
export type Setting = (typeof SETTINGS)[number];
export type Crowd = (typeof CROWDS)[number];
export type Variety = (typeof VARIETIES)[number];
export type CostPreference = (typeof COST_PREFERENCES)[number];
export type Transport = (typeof TRANSPORTS)[number];

/** Trip answers for one person in a group. */
export type MemberProfile = {
  id: string;
  name: string;
  destination: string;
  stops: string[];
  startDate: string;
  endDate: string;
  budgetUsd: number;
  dayStart: string;
  dayEnd: string;
  interests: Interest[];
  dietary: Dietary[];
  exclusions: string[];
  pace: Pace;
  foodStyle: FoodStyle;
  setting: Setting;
  crowd: Crowd;
  variety: Variety;
  costPreference: CostPreference;
  transport: Transport;
  includeTicketed: boolean;
  openToSpontaneous: boolean;
};

export type GroupForm = {
  id: string | null;
  name: string;
  members: MemberProfile[];
};

export type SavedGroup = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  groupInterests: Interest[];
  members: MemberProfile[];
};
