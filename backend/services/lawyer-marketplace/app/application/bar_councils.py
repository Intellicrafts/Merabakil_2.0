"""Which State Bar Council checks an advocate's enrolment.

It is the council for the state the advocate's office is in (from the pincode).
Council names match Satyapan's BAR_COUNCILS table; Punjab, Haryana and
Chandigarh share one council. Mirrors frontend src/lib/bar-councils.ts.
"""

from __future__ import annotations

# First two digits of the pincodes in each council's states (India Post postal regions).
_PINCODE_PREFIXES: dict[str, tuple[str, ...]] = {
    "Delhi": ("11",),
    "Punjab & Haryana": ("12", "13", "14", "15", "16"),
    "Uttar Pradesh": tuple(str(n) for n in range(20, 29)),
    "Rajasthan": ("30", "31", "32", "33", "34"),
    "Andhra Pradesh": ("50", "51", "52", "53"),
}


def council_for_state(state: str | None) -> str | None:
    """The council Satyapan checks for an office in this state; None if it can't be checked automatically."""
    s = (state or "").lower()
    if "uttar pradesh" in s:
        return "Uttar Pradesh"
    if "delhi" in s:
        return "Delhi"
    if "andhra pradesh" in s:
        return "Andhra Pradesh"
    if "rajasthan" in s:
        return "Rajasthan"
    if "punjab" in s or "haryana" in s or "chandigarh" in s:
        return "Punjab & Haryana"
    return None


def pincode_in_council(pincode: str | None, council: str | None) -> bool:
    """Whether a pincode lies in the council's states. True when we can't tell."""
    prefixes = _PINCODE_PREFIXES.get(council or "")
    if not prefixes or not pincode:
        return True
    return pincode[:2] in prefixes


def same_council(used: str | None, state: str | None, *, used_state: str | None = None) -> bool:
    """Whether an office in `state` falls under the council `used` for verification.
    Councils we can't check automatically are told apart by state."""
    new = council_for_state(state)
    if used or new:
        return used == new
    return (used_state or "").strip().lower() == (state or "").strip().lower()
