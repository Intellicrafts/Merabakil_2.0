#!/usr/bin/env python3
"""Read-only report: verified advocates whose Bar Council record name doesn't
match their profile name. Nothing is changed — an admin decides what to do.

Advocates verified before name matching existed were verified on the enrolment
number alone, so someone could have claimed another advocate's number.

    python scripts/report_name_mismatches.py          # from backend/services/lawyer-marketplace
"""

from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.application.name_match import names_match  # noqa: E402
from app.infrastructure.appointment_repo import MarketplaceRepository  # noqa: E402
from app.infrastructure.db import get_engine  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402


async def main() -> None:
    async with AsyncSession(get_engine()) as session:  # closed without commit: read-only
        lawyers = await MarketplaceRepository(session).list_all_lawyers()
    verified = [l for l in lawyers if l.is_verified]
    rows = []
    for lawyer in verified:
        data = lawyer.verification_data or {}
        record_name = data.get("record_name") or (data.get("data") or {}).get("name")
        if (data.get("review") or {}).get("decision") == "approve":
            continue  # an admin already confirmed it by hand
        if not record_name:
            rows.append((lawyer, "(no record name stored)"))
        elif not names_match(lawyer.full_name, record_name):
            rows.append((lawyer, record_name))
    print(f"{len(verified)} verified advocates checked, {len(rows)} to look at:\n")
    for lawyer, record_name in rows:
        print(f"{lawyer.id}  {lawyer.bar_council_id or '-':18}  profile: {lawyer.full_name!r:32}  record: {record_name!r}")


if __name__ == "__main__":
    asyncio.run(main())
