import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteGroup, getGroup, listGroups, saveGroup } from "../api/groups";
import {
  DIETARY,
  INTERESTS,
  type CostPreference,
  type Crowd,
  type Dietary,
  type FoodStyle,
  type GroupForm,
  type Interest,
  type MemberProfile,
  type Pace,
  type SavedGroup,
  type Setting,
  type Transport,
  type Variety,
} from "../types";

const PACE_OPTIONS: { value: Pace; label: string }[] = [
  { value: "relaxed", label: "Relaxed" },
  { value: "balanced", label: "Balanced" },
  { value: "packed", label: "Packed" },
];

const FOOD_OPTIONS: { value: FoodStyle; label: string }[] = [
  { value: "local", label: "Neighborhood meals" },
  { value: "iconic", label: "Famous restaurants" },
];

const SETTING_OPTIONS: { value: Setting; label: string }[] = [
  { value: "indoors", label: "Mostly indoors" },
  { value: "outdoors", label: "Mostly outdoors" },
];

const CROWD_OPTIONS: { value: Crowd; label: string }[] = [
  { value: "popular", label: "Popular, highly rated spots" },
  { value: "quiet", label: "Quieter places" },
];

const VARIETY_OPTIONS: { value: Variety; label: string }[] = [
  { value: "focused", label: "Stick to a few kinds of stops" },
  { value: "mixed", label: "Mix the categories" },
];

const COST_OPTIONS: { value: CostPreference; label: string }[] = [
  { value: "cheapest", label: "Cheapest options" },
  { value: "balanced", label: "Balance cost and the plan" },
  { value: "flexible", label: "Room to spend more" },
];

const TRANSPORT_OPTIONS: { value: Transport; label: string }[] = [
  { value: "walk", label: "Mostly walking" },
  { value: "transit", label: "Public transit" },
  { value: "rideshare", label: "Rideshare" },
  { value: "flexible", label: "Whatever is easiest" },
];

function isoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function clean(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return hour * 60 + minute;
}

function blankProfile(name: string): MemberProfile {
  const start = new Date();
  const end = new Date();
  end.setDate(start.getDate() + 2);
  return {
    id: crypto.randomUUID(),
    name,
    destination: "",
    stops: [],
    startDate: isoDate(start),
    endDate: isoDate(end),
    budgetUsd: 250,
    dayStart: "09:30",
    dayEnd: "21:00",
    interests: [],
    dietary: [],
    exclusions: [],
    pace: "balanced",
    foodStyle: "local",
    setting: "outdoors",
    crowd: "popular",
    variety: "mixed",
    costPreference: "balanced",
    transport: "flexible",
    includeTicketed: false,
    openToSpontaneous: true,
  };
}

function emptyGroup(): GroupForm {
  return { id: null, name: "", members: [] };
}

function combinedInterests(members: MemberProfile[]) {
  const selected = new Set<Interest>(members.flatMap((member) => member.interests));
  return INTERESTS.filter((interest) => selected.has(interest));
}

function needsAnswers(member: MemberProfile) {
  return (
    !clean(member.destination) ||
    member.interests.length === 0 ||
    !Number.isInteger(member.budgetUsd) ||
    member.budgetUsd < 1 ||
    !member.startDate ||
    !member.endDate ||
    member.endDate < member.startDate ||
    minutes(member.dayEnd) - minutes(member.dayStart) < 60
  );
}

function validate(group: GroupForm) {
  if (!clean(group.name)) return { memberId: null, message: "Name the group." };
  if (group.members.length === 0) return { memberId: null, message: "Add at least one person." };
  const seen = new Set<string>();
  for (const member of group.members) {
    const person = clean(member.name);
    const key = person.toLocaleLowerCase();
    if (!person) return { memberId: member.id, message: "Every person needs a name." };
    if (seen.has(key)) return { memberId: member.id, message: `${person} is already in this group.` };
    seen.add(key);
    if (!clean(member.destination)) return { memberId: member.id, message: `Add a destination for ${person}.` };
    if (!member.startDate || !member.endDate || member.endDate < member.startDate) {
      return { memberId: member.id, message: `End date for ${person} has to be on or after the start date.` };
    }
    if (!Number.isInteger(member.budgetUsd) || member.budgetUsd < 1) {
      return { memberId: member.id, message: `Enter a budget for ${person}.` };
    }
    if (minutes(member.dayEnd) - minutes(member.dayStart) < 60) {
      return { memberId: member.id, message: `${person} needs at least an hour between the start and end of the day.` };
    }
    if (member.interests.length === 0) {
      return { memberId: member.id, message: `Pick at least one interest for ${person}.` };
    }
  }
  return null;
}

function ChoiceChips<T extends string>({
  legend,
  hint,
  value,
  options,
  onChange,
}: {
  legend: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      {hint ? <p className="hint">{hint}</p> : null}
      <div className="chips">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? "chip selected" : "chip"}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function ItemList({
  legend,
  hint,
  items,
  placeholder,
  addLabel,
  onChange,
}: {
  legend: string;
  hint: string;
  items: string[];
  placeholder: string;
  addLabel: string;
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const next = clean(draft);
    if (!next) return;
    if (items.some((item) => item.toLocaleLowerCase() === next.toLocaleLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...items, next]);
    setDraft("");
  }

  return (
    <fieldset>
      <legend>{legend}</legend>
      <p className="hint">{hint}</p>
      <div className="inline">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          aria-label={legend}
          maxLength={80}
        />
        <button type="button" className="button secondary" onClick={add}>
          {addLabel}
        </button>
      </div>
      {items.length > 0 && (
        <ul className="stops">
          {items.map((item) => (
            <li key={item}>
              <span>{item}</span>
              <button
                type="button"
                className="text-button"
                onClick={() => onChange(items.filter((entry) => entry !== item))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

export default function Group() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState<GroupForm>(emptyGroup);
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>([]);
  const [nameDraft, setNameDraft] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingGroup, setLoadingGroup] = useState(Boolean(groupId));
  const loadedId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    listGroups()
      .then((groups) => {
        if (active) setSavedGroups(groups);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Could not load saved groups.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!groupId || loadedId.current === groupId) return;
    let active = true;
    setLoadingGroup(true);
    getGroup(groupId)
      .then((saved) => {
        if (!active) return;
        loadedId.current = saved.id;
        setGroup({ id: saved.id, name: saved.name, members: saved.members });
        setSelectedId((current) =>
          saved.members.some((member) => member.id === current) ? current : (saved.members[0]?.id ?? null),
        );
        setError("");
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Could not load that group.");
      })
      .finally(() => {
        if (active) setLoadingGroup(false);
      });
    return () => {
      active = false;
    };
  }, [groupId]);

  const selected = group.members.find((member) => member.id === selectedId) ?? null;

  function updateMember(id: string, patch: Partial<MemberProfile>) {
    setGroup((current) => ({
      ...current,
      members: current.members.map((member) => (member.id === id ? { ...member, ...patch } : member)),
    }));
    setStatus("");
    setError("");
  }

  function addPerson() {
    const name = clean(nameDraft);
    if (!name) {
      setError("Enter a name.");
      setStatus("");
      return;
    }
    if (group.members.some((member) => member.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setError(`${name} is already in this group.`);
      setStatus("");
      return;
    }
    const member = blankProfile(name);
    setGroup((current) => ({ ...current, members: [...current.members, member] }));
    setSelectedId(member.id);
    setNameDraft("");
    setError("");
    setStatus("");
  }

  function removePerson(id: string) {
    const remaining = group.members.filter((member) => member.id !== id);
    setGroup((current) => ({ ...current, members: remaining }));
    setSelectedId((current) => {
      if (current !== id) return current;
      return remaining[0]?.id ?? null;
    });
    setStatus("");
  }

  function startNew() {
    loadedId.current = null;
    setGroup(emptyGroup());
    setSelectedId(null);
    setNameDraft("");
    setError("");
    setStatus("");
    navigate("/group");
  }

  async function refreshSaved() {
    setSavedGroups(await listGroups());
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const problem = validate(group);
    if (problem) {
      setStatus("");
      setError(problem.message);
      if (problem.memberId) setSelectedId(problem.memberId);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await saveGroup({
        ...group,
        name: clean(group.name),
        members: group.members.map((member) => ({
          ...member,
          name: clean(member.name),
          destination: clean(member.destination),
        })),
      });
      loadedId.current = saved.id;
      setGroup({ id: saved.id, name: saved.name, members: saved.members });
      setSelectedId((current) =>
        saved.members.some((member) => member.id === current) ? current : (saved.members[0]?.id ?? null),
      );
      setStatus(`Saved profiles for ${saved.members.map((member) => member.name).join(", ")}.`);
      if (saved.id !== groupId) navigate(`/group/${saved.id}`, { replace: true });
      await refreshSaved();
    } catch (reason: unknown) {
      const message = reason instanceof Error ? reason.message : "Could not save the group.";
      setError(message);
      const match = [...group.members]
        .sort((left, right) => right.name.length - left.name.length)
        .find((member) => message.includes(member.name));
      if (match) setSelectedId(match.id);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!group.id) return;
    if (!window.confirm(`Delete ${group.name || "this group"}?`)) return;
    setSaving(true);
    setError("");
    try {
      await deleteGroup(group.id);
      await refreshSaved();
      setSaving(false);
      startNew();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Could not delete the group.");
      setSaving(false);
    }
  }

  return (
    <div className="group-screen">
      <section className="panel">
        <p className="eyebrow">Group</p>
        <h1>Who's going?</h1>
        <p className="lede">
          Add each person by name. Then answer that person's trip questions. Every profile is stored in the local
          database.
        </p>
      </section>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="status" role="status">
          {status}
        </p>
      ) : null}

      <div className="group-layout">
        <section className="panel people-panel">
          <h2>People</h2>
          <label>
            Group name
            <input
              value={group.name}
              onChange={(event) => {
                setGroup((current) => ({ ...current, name: event.target.value }));
                setStatus("");
                setError("");
              }}
              placeholder="NYC weekend"
              maxLength={80}
            />
          </label>
          <div className="field">
            <span>Add a person</span>
            <div className="inline">
              <input
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addPerson();
                  }
                }}
                placeholder="Name"
                aria-label="Person's name"
                maxLength={60}
              />
              <button type="button" className="button secondary" onClick={addPerson}>
                Add
              </button>
            </div>
          </div>
          <p className="hint">Names only. Trip questions open for whoever you select.</p>

          {group.members.length === 0 ? (
            <p className="hint">Nobody is in this group yet.</p>
          ) : (
            <ul className="member-list">
              {group.members.map((member) => (
                <li key={member.id} className="member-row">
                  <button
                    type="button"
                    className={member.id === selectedId ? "member selected" : "member"}
                    aria-current={member.id === selectedId ? "true" : undefined}
                    onClick={() => setSelectedId(member.id)}
                  >
                    <span>{member.name}</span>
                    {needsAnswers(member) ? <small className="pending">Needs answers</small> : <small>Ready</small>}
                  </button>
                  <button type="button" className="text-button" onClick={() => removePerson(member.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {combinedInterests(group.members).length > 0 ? (
            <p className="hint">Group interests: {combinedInterests(group.members).join(", ")}</p>
          ) : null}

          <div className="saved-groups">
            <h2>Saved groups</h2>
            {savedGroups.length === 0 ? (
              <p className="hint">Groups you save show up here.</p>
            ) : (
              <ul className="saved-group-list">
                {savedGroups.map((saved) => (
                  <li key={saved.id}>
                    <Link to={`/group/${saved.id}`} aria-current={saved.id === group.id ? "page" : undefined}>
                      <span>{saved.name}</span>
                      <small>{saved.members.map((member) => member.name).join(", ")}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {group.id ? (
              <button type="button" className="text-button" onClick={startNew}>
                Start a new group
              </button>
            ) : null}
          </div>
        </section>

        <section className="panel">
          {loadingGroup ? (
            <p className="lede">Loading this group…</p>
          ) : selected ? (
            <form key={selected.id} className="form questions" onSubmit={onSave}>
              <h2>{selected.name}'s trip</h2>
              <p className="hint">These answers are saved on {selected.name}'s profile.</p>
              <fieldset className="question-fields" disabled={saving}>
                <label>
                  Destination
                  <input
                    value={selected.destination}
                    onChange={(event) => updateMember(selected.id, { destination: event.target.value })}
                    placeholder="New York City"
                    maxLength={80}
                    required
                  />
                </label>

                <ItemList
                  legend="Extra stops"
                  hint="Other places to include on this multi-stop trip."
                  items={selected.stops}
                  placeholder="Brooklyn, a museum neighborhood..."
                  addLabel="Add stop"
                  onChange={(stops) => updateMember(selected.id, { stops })}
                />

                <div className="split">
                  <label>
                    Start date
                    <input
                      type="date"
                      value={selected.startDate}
                      onChange={(event) => updateMember(selected.id, { startDate: event.target.value })}
                      required
                    />
                  </label>
                  <label>
                    End date
                    <input
                      type="date"
                      value={selected.endDate}
                      min={selected.startDate}
                      onChange={(event) => updateMember(selected.id, { endDate: event.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Budget (USD)
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      step={1}
                      value={selected.budgetUsd || ""}
                      onChange={(event) =>
                        updateMember(selected.id, {
                          budgetUsd: event.target.value === "" ? 0 : Math.round(Number(event.target.value)),
                        })
                      }
                      required
                    />
                  </label>
                </div>
                <p className="hint">Budget is the estimated activity and food spending for this person.</p>

                <div className="split-2">
                  <label>
                    Day starts
                    <input
                      type="time"
                      value={selected.dayStart}
                      onChange={(event) => updateMember(selected.id, { dayStart: event.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Day ends
                    <input
                      type="time"
                      value={selected.dayEnd}
                      onChange={(event) => updateMember(selected.id, { dayEnd: event.target.value })}
                      required
                    />
                  </label>
                </div>

                <ChoiceChips
                  legend="How full should the days be?"
                  value={selected.pace}
                  options={PACE_OPTIONS}
                  onChange={(pace) => updateMember(selected.id, { pace })}
                />

                <fieldset>
                  <legend>Interests</legend>
                  <div className="chips">
                    {INTERESTS.map((interest) => {
                      const pressed = selected.interests.includes(interest);
                      return (
                        <button
                          key={interest}
                          type="button"
                          className={pressed ? "chip selected" : "chip"}
                          aria-pressed={pressed}
                          onClick={() =>
                            updateMember(selected.id, {
                              interests: pressed
                                ? selected.interests.filter((item) => item !== interest)
                                : [...selected.interests, interest],
                            })
                          }
                        >
                          {interest}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset>
                  <legend>Dietary requirements</legend>
                  <div className="chips">
                    {DIETARY.map((need) => {
                      const pressed = selected.dietary.includes(need);
                      return (
                        <button
                          key={need}
                          type="button"
                          className={pressed ? "chip selected" : "chip"}
                          aria-pressed={pressed}
                          onClick={() =>
                            updateMember(selected.id, {
                              dietary: pressed
                                ? selected.dietary.filter((item) => item !== need)
                                : [...selected.dietary, need as Dietary],
                            })
                          }
                        >
                          {need}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <ItemList
                  legend="Exclusions"
                  hint="Activities, foods, or places this person wants left out."
                  items={selected.exclusions}
                  placeholder="Night clubs, seafood..."
                  addLabel="Add exclusion"
                  onChange={(exclusions) => updateMember(selected.id, { exclusions })}
                />

                <ChoiceChips
                  legend="What should meals lean toward?"
                  value={selected.foodStyle}
                  options={FOOD_OPTIONS}
                  onChange={(foodStyle) => updateMember(selected.id, { foodStyle })}
                />
                <ChoiceChips
                  legend="Where should the trip spend time?"
                  value={selected.setting}
                  options={SETTING_OPTIONS}
                  onChange={(setting) => updateMember(selected.id, { setting })}
                />
                <ChoiceChips
                  legend="Ratings and popularity"
                  hint="Which places should rank higher."
                  value={selected.crowd}
                  options={CROWD_OPTIONS}
                  onChange={(crowd) => updateMember(selected.id, { crowd })}
                />
                <ChoiceChips
                  legend="Category variety"
                  value={selected.variety}
                  options={VARIETY_OPTIONS}
                  onChange={(variety) => updateMember(selected.id, { variety })}
                />
                <ChoiceChips
                  legend="Cost"
                  hint="How the cheaper options should weigh against the rest of the plan."
                  value={selected.costPreference}
                  options={COST_OPTIONS}
                  onChange={(costPreference) => updateMember(selected.id, { costPreference })}
                />
                <ChoiceChips
                  legend="Transportation"
                  value={selected.transport}
                  options={TRANSPORT_OPTIONS}
                  onChange={(transport) => updateMember(selected.id, { transport })}
                />
                <ChoiceChips
                  legend="Ticket purchases"
                  value={selected.includeTicketed ? "yes" : "no"}
                  options={[
                    { value: "yes", label: "Include events that need tickets" },
                    { value: "no", label: "Skip ticketed events" },
                  ]}
                  onChange={(value) => updateMember(selected.id, { includeTicketed: value === "yes" })}
                />
                <ChoiceChips
                  legend="On-the-go changes"
                  value={selected.openToSpontaneous ? "yes" : "no"}
                  options={[
                    { value: "yes", label: "Open to spontaneous changes" },
                    { value: "no", label: "Stick to the plan" },
                  ]}
                  onChange={(value) => updateMember(selected.id, { openToSpontaneous: value === "yes" })}
                />
              </fieldset>
              <div className="row-actions">
                <button className="button" type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save profiles"}
                </button>
                {group.id ? (
                  <button type="button" className="text-button" onClick={() => void onDelete()} disabled={saving}>
                    Delete group
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <>
              <h2>Trip questions</h2>
              <p className="lede">Add a person by name. Their destination, dates, budget, and preferences show up here.</p>
              <p className="hint">
                Planning one trip instead? <Link to="/plan">Use the single-traveler form</Link>
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
