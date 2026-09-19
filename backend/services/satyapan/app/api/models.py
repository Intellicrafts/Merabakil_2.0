from pydantic import BaseModel
from typing import Optional, Dict, Any

class VerificationRequest(BaseModel):
    enrollment_number: str
    state: str

class VerificationResponse(BaseModel):
    status: str
    message: str
    data: Optional[Dict[str, Any]] = None
