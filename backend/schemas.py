"""Request shapes for group trip profiles."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, Field

INTERESTS = ("Food", "Art", "Outdoors", "History", "Nightlife", "Shopping")
DIETARY = ("Vegetarian", "Vegan", "Gluten-free", "Halal", "No seafood")
PACES = {"relaxed", "balanced", "packed"}
FOOD_STYLES = {"local", "iconic"}
SETTINGS = {"indoors", "outdoors"}
CROWDS = {"popular", "quiet"}
VARIETIES = {"focused", "mixed"}
COST_PREFERENCES = {"cheapest", "balanced", "flexible"}
TRANSPORTS = {"walk", "transit", "rideshare", "flexible"}

MAX_MEMBERS = 12
MAX_BUDGET = 100_000


class ProfileError(ValueError):
    """A group or profile answer cannot be stored as submitted."""


class ProfileIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = None
    name: str
    destination: str
    stops: list[str] = Field(default_factory=list)
    startDate: str
    endDate: str
    budgetUsd: int
    dayStart: str
    dayEnd: str
    interests: list[str] = Field(default_factory=list)
    dietary: list[str] = Field(default_factory=list)
    exclusions: list[str] = Field(default_factory=list)
    pace: str
    foodStyle: str
    setting: str
    crowd: str
    variety: str
    costPreference: str
    transport: str
    includeTicketed: bool
    openToSpontaneous: bool


class GroupIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    members: list[ProfileIn]


def _clean_text(value: str, *, label: str, limit: int, required: bool) -> str:
    text = " ".join(value.split())
    if not text:
        if required:
            raise ProfileError(f"{label} is required.")
        return ""
    if any(ord(char) < 32 for char in text):
        raise ProfileError(f"{label} has an unsupported character.")
    if len(text) > limit:
        raise ProfileError(f"{label} must be {limit} characters or fewer.")
    return text


def _clean_items(items: list[str], *, label: str, limit: int, item_limit: int) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for item in items:
        text = _clean_text(item, label=label, limit=item_limit, required=False)
        if not text:
            continue
        key = text.casefold()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(text)
    if len(cleaned) > limit:
        raise ProfileError(f"Add at most {limit} {label}.")
    return cleaned


def _choice(value: str, allowed: set[str], label: str, person: str) -> str:
    if value not in allowed:
        raise ProfileError(f"Choose {label} for {person}.")
    return value


def _clock(value: str, label: str, person: str) -> str:
    if len(value) != 5 or value[2] != ":":
        raise ProfileError(f"{label} for {person} must use HH:MM.")
    hour_text, minute_text = value[:2], value[3:]
    if not (hour_text.isdigit() and minute_text.isdigit()):
        raise ProfileError(f"{label} for {person} must use HH:MM.")
    hour, minute = int(hour_text), int(minute_text)
    if hour > 23 or minute > 59:
        raise ProfileError(f"{label} for {person} must be a real time.")
    return f"{hour:02d}:{minute:02d}"


def _minutes(value: str) -> int:
    hour, minute = value.split(":")
    return int(hour) * 60 + int(minute)


def _known(items: list[str], allowed: tuple[str, ...], label: str, person: str, required: bool) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for item in items:
        if item not in allowed:
            raise ProfileError(f"{person} has an unknown {label}.")
        if item in seen:
            continue
        seen.add(item)
        cleaned.append(item)
    if required and not cleaned:
        raise ProfileError(f"Pick at least one {label} for {person}.")
    return cleaned


def _date(value: str, label: str, person: str) -> str:
    try:
        parsed = date.fromisoformat(value)
    except ValueError as exc:
        raise ProfileError(f"{label} for {person} must be a real date.") from exc
    return parsed.isoformat()


def normalize_group(body: GroupIn) -> dict:
    name = _clean_text(body.name, label="Group name", limit=80, required=True)
    if not body.members:
        raise ProfileError("Add at least one person.")
    if len(body.members) > MAX_MEMBERS:
        raise ProfileError(f"A group can have at most {MAX_MEMBERS} people.")

    members: list[dict] = []
    seen_names: set[str] = set()
    for profile in body.members:
        person = _clean_text(profile.name, label="Name", limit=60, required=True)
        key = person.casefold()
        if key in seen_names:
            raise ProfileError(f"{person} is already in this group.")
        seen_names.add(key)

        start = _date(profile.startDate, "Start date", person)
        end = _date(profile.endDate, "End date", person)
        if end < start:
            raise ProfileError(f"End date for {person} has to be on or after the start date.")
        day_start = _clock(profile.dayStart, "Day start", person)
        day_end = _clock(profile.dayEnd, "Day end", person)
        if _minutes(day_end) - _minutes(day_start) < 60:
            raise ProfileError(f"{person} needs at least an hour between the start and end of the day.")
        if isinstance(profile.budgetUsd, bool) or not 1 <= profile.budgetUsd <= MAX_BUDGET:
            raise ProfileError(f"Enter a budget from 1 to {MAX_BUDGET} USD for {person}.")

        members.append(
            {
                "id": profile.id,
                "name": person,
                "destination": _clean_text(profile.destination, label=f"Destination for {person}", limit=80, required=True),
                "stops": _clean_items(profile.stops, label="stops", limit=8, item_limit=80),
                "startDate": start,
                "endDate": end,
                "budgetUsd": profile.budgetUsd,
                "dayStart": day_start,
                "dayEnd": day_end,
                "interests": _known(profile.interests, INTERESTS, "interest", person, required=True),
                "dietary": _known(profile.dietary, DIETARY, "dietary requirement", person, required=False),
                "exclusions": _clean_items(profile.exclusions, label="exclusions", limit=12, item_limit=80),
                "pace": _choice(profile.pace, PACES, "a pace", person),
                "foodStyle": _choice(profile.foodStyle, FOOD_STYLES, "a meal style", person),
                "setting": _choice(profile.setting, SETTINGS, "an indoor or outdoor preference", person),
                "crowd": _choice(profile.crowd, CROWDS, "a popularity preference", person),
                "variety": _choice(profile.variety, VARIETIES, "a variety preference", person),
                "costPreference": _choice(profile.costPreference, COST_PREFERENCES, "a cost preference", person),
                "transport": _choice(profile.transport, TRANSPORTS, "a way of getting around", person),
                "includeTicketed": profile.includeTicketed,
                "openToSpontaneous": profile.openToSpontaneous,
            }
        )
    return {"name": name, "members": members}
