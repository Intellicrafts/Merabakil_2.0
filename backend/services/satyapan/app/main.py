from fastapi import FastAPI
from app.api.router import router as api_router
from app.api.auth import router as auth_router
from dotenv import load_dotenv

import logging
import sys

# Configure logging to output to stdout (for CloudWatch)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI(title="Satyapan - Lawyer Verification Engine")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def health_check():
    return {"status": "ok", "service": "Satyapan"}

@app.get("/")
def read_root():
    return {"message": "Lawyer Verification Microservice is running"}
