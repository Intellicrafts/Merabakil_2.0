from pydantic import BaseModel
from typing import Optional, Dict, Any

class VerificationRequest(BaseModel):
    enrollment_number: str
    # Optional: the council is detected from the enrolment number's prefix. A
    # caller may still pass `state` as a fallback for unrecognised prefixes.
    state: Optional[str] = None

class VerificationResponse(BaseModel):
    status: str
    message: str
    data: Optional[Dict[str, Any]] = None
