from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    JWT_ALGORITHM: str = "RS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    PRIVATE_KEY: str = ""
    PUBLIC_KEY: str = ""
    
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "changeme"
    HEADLESS: bool = True

    URLS: dict = {}

    def load_urls(self):
        import yaml
        try:
            with open("app/core/urls.yaml", "r") as f:
                data = yaml.safe_load(f)
                self.URLS = data.get("scrapers", {})
        except Exception as e:
            print(f"Error loading urls.yaml: {e}")

    def load_keys(self):
        with open("certs/private.pem", "r") as f:
            self.PRIVATE_KEY = f.read()
        with open("certs/public.pem", "r") as f:
            self.PUBLIC_KEY = f.read()

    class Config:
        env_file = ".env"

settings = Settings()
settings.load_keys()
settings.load_urls()
