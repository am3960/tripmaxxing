import os
import sqlite3
import tempfile
import unittest
from pathlib import Path

ROOT = Path(tempfile.mkdtemp(prefix="tripmaxxing-groups-"))
os.environ["TRIPMAXXING_DB"] = str(ROOT / "tripmaxxing.db")

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402


def member(name: str, **overrides) -> dict:
    profile = {
        "id": None,
        "name": name,
        "destination": "New York City",
        "stops": ["Brooklyn"],
        "startDate": "2026-11-14",
        "endDate": "2026-11-16",
        "budgetUsd": 250,
        "dayStart": "09:30",
        "dayEnd": "21:00",
        "interests": ["Food", "Art"],
        "dietary": ["Vegetarian"],
        "exclusions": ["night clubs"],
        "pace": "balanced",
        "foodStyle": "local",
        "setting": "outdoors",
        "crowd": "quiet",
        "variety": "mixed",
        "costPreference": "cheapest",
        "transport": "transit",
        "includeTicketed": True,
        "openToSpontaneous": False,
    }
    profile.update(overrides)
    return profile


class GroupApiTests(unittest.TestCase):
    def setUp(self):
        with TestClient(app) as client:
            for group in client.get("/api/groups").json():
                client.delete(f"/api/groups/{group['id']}")

    def test_profiles_round_trip_through_sqlite(self):
        with TestClient(app) as client:
            created = client.post(
                "/api/groups",
                json={"name": "  NYC weekend  ", "members": [member("Maya"), member("Jordan", interests=["Outdoors"])]},
            )
            self.assertEqual(created.status_code, 201, created.text)
            body = created.json()
            self.assertEqual(body["name"], "NYC weekend")
            self.assertEqual(body["groupInterests"], ["Art", "Food", "Outdoors"])
            self.assertEqual([person["name"] for person in body["members"]], ["Maya", "Jordan"])
            maya = body["members"][0]
            self.assertEqual(maya["destination"], "New York City")
            self.assertEqual(maya["stops"], ["Brooklyn"])
            self.assertEqual(maya["budgetUsd"], 250)
            self.assertEqual(maya["dayStart"], "09:30")
            self.assertEqual(maya["dietary"], ["Vegetarian"])
            self.assertEqual(maya["exclusions"], ["night clubs"])
            self.assertEqual(maya["costPreference"], "cheapest")
            self.assertEqual(maya["transport"], "transit")
            self.assertTrue(maya["includeTicketed"])
            self.assertFalse(maya["openToSpontaneous"])

            conn = sqlite3.connect(os.environ["TRIPMAXXING_DB"])
            try:
                stored = conn.execute(
                    "SELECT name, destination, budget_usd FROM profiles ORDER BY position"
                ).fetchall()
            finally:
                conn.close()
            self.assertEqual(stored, [("Maya", "New York City", 250), ("Jordan", "New York City", 250)])

            listed = client.get("/api/groups")
            self.assertEqual(listed.status_code, 200)
            self.assertEqual(listed.json()[0]["id"], body["id"])

            updated = client.put(
                f"/api/groups/{body['id']}",
                json={
                    "name": "NYC weekend",
                    "members": [member("Maya", budgetUsd=180, interests=["Food"])],
                },
            )
            self.assertEqual(updated.status_code, 200, updated.text)
            self.assertEqual(len(updated.json()["members"]), 1)
            self.assertEqual(updated.json()["members"][0]["budgetUsd"], 180)
            self.assertEqual(updated.json()["groupInterests"], ["Food"])

            removed = client.delete(f"/api/groups/{body['id']}")
            self.assertEqual(removed.status_code, 204)
            missing = client.get(f"/api/groups/{body['id']}")
            self.assertEqual(missing.status_code, 404)
            conn = sqlite3.connect(os.environ["TRIPMAXXING_DB"])
            try:
                remaining = conn.execute("SELECT COUNT(*) FROM profiles").fetchone()[0]
            finally:
                conn.close()
            self.assertEqual(remaining, 0)

    def test_rejects_incomplete_profiles(self):
        with TestClient(app) as client:
            duplicate = client.post(
                "/api/groups",
                json={"name": "Friends", "members": [member("Maya"), member("maya")]},
            )
            self.assertEqual(duplicate.status_code, 400)
            self.assertIn("already", duplicate.json()["detail"])

            bad_dates = client.post(
                "/api/groups",
                json={"name": "Friends", "members": [member("Maya", endDate="2026-11-01")]},
            )
            self.assertEqual(bad_dates.status_code, 400)

            no_interest = client.post(
                "/api/groups",
                json={"name": "Friends", "members": [member("Maya", interests=[])]},
            )
            self.assertEqual(no_interest.status_code, 400)

            short_day = client.post(
                "/api/groups",
                json={"name": "Friends", "members": [member("Maya", dayStart="10:00", dayEnd="10:30")]},
            )
            self.assertEqual(short_day.status_code, 400)


if __name__ == "__main__":
    unittest.main()
