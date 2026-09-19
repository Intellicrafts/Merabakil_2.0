from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from app.core import security
from app.core.config import settings
from pydantic import BaseModel

router = APIRouter()

class Token(BaseModel):
    access_token: str
    token_type: str
    refresh_token: str

@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    # Mock user verification - in production verify against DB
    if form_data.username != settings.ADMIN_USERNAME or form_data.password != settings.ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = security.create_access_token(data={"sub": form_data.username})
    refresh_token = security.create_refresh_token(data={"sub": form_data.username})
    
    return {"access_token": access_token, "token_type": "bearer", "refresh_token": refresh_token}

@router.post("/refresh", response_model=Token)
async def refresh_token(refresh_token: str):
    payload = security.decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    username = payload.get("sub")
    new_access_token = security.create_access_token(data={"sub": username})
    
    # Optional: Rotate refresh token
    new_refresh_token = security.create_refresh_token(data={"sub": username})
    
    return {"access_token": new_access_token, "token_type": "bearer", "refresh_token": new_refresh_token}

@router.get("/.well-known/jwks.json")
def get_jwks():
    return {"keys": [settings.PUBLIC_KEY]}
