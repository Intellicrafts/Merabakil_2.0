from fastapi import APIRouter, HTTPException, Depends, Header
from app.api.models import VerificationRequest, VerificationResponse
from app.services.verification_service import VerificationService
import os

from app.api.deps import get_current_user

from datetime import datetime

router = APIRouter()
verification_service = VerificationService()

@router.get("/status")
def get_service_status():
    return {
        "service": "Satyapan - Lawyer Verification Engine",
        "status": "running",
        "supported_states": ["Uttar Pradesh", "Delhi"],
        "timestamp": datetime.utcnow().isoformat()
    }

@router.post("/verify", response_model=VerificationResponse)
async def verify_lawyer(request: VerificationRequest):
    try:
        result = await verification_service.verify_lawyer(request.enrollment_number, request.state)
        
        if result.get("status") == "error":
            # If the scraper returned a structured error, we should reflect that
            return VerificationResponse(
                status="failed",
                message=result.get("message", "Verification process failed"),
                data=result
            )
            
        if result.get("status") == "failed":
            return VerificationResponse(
                status="failed",
                message=result.get("message", "Verification failed"),
                data=result
            )

        return VerificationResponse(
            status="success",
            message="Verification successful",
            data=result
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        return VerificationResponse(
            status="failed",
            message=str(e)
        )
