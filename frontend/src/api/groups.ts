import type { GroupForm, SavedGroup } from "../types";

async function readError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string" && body.detail) return body.detail;
  } catch {
    // The server did not return JSON.
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error("Could not reach the local server. Start the API and try again.");
  }
  if (!response.ok) {
    throw new Error(await readError(response, "Something went wrong saving the group."));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function listGroups() {
  return request<SavedGroup[]>("/api/groups");
}

export function getGroup(id: string) {
  return request<SavedGroup>(`/api/groups/${id}`);
}

export function saveGroup(group: GroupForm) {
  const body = JSON.stringify({
    name: group.name,
    members: group.members,
  });
  if (group.id) return request<SavedGroup>(`/api/groups/${group.id}`, { method: "PUT", body });
  return request<SavedGroup>("/api/groups", { method: "POST", body });
}

export function deleteGroup(id: string) {
  return request<void>(`/api/groups/${id}`, { method: "DELETE" });
}
