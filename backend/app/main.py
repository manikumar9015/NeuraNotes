"""
FastAPI Application Entry Point.
Configures CORS, lifespan, and includes all routers.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # ── Startup ─────────────────────────────────────────────
    print(f"🧠 {settings.app_name} starting up...")
    print(f"   Environment: {settings.app_env}")
    print(f"   AI Provider: {settings.ai_provider}")
    yield
    # ── Shutdown ────────────────────────────────────────────
    print(f"🧠 {settings.app_name} shutting down...")


app = FastAPI(
    title=settings.app_name,
    description="Personal Second Brain Agent — AI-powered knowledge capture & retrieval",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
)

# ── CORS Middleware ─────────────────────────────────────────
# In development, allow all origins so Expo web on any port can connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.is_development else settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health Check ────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint for monitoring and load balancers."""
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": "1.0.0",
        "environment": settings.app_env,
    }


# ── Include Routers ────────────────────────────────────────
from app.routers import auth, notes, chat

app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(notes.router, prefix="/notes", tags=["Notes"])
app.include_router(chat.router, prefix="/chat", tags=["Chat"])
