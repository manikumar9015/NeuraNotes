"""
Rate Limiter Middleware — protects the API from abuse using Upstash Redis.
"""

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from upstash_redis import Redis
from app.core.config import settings
import time
import logging

logger = logging.getLogger(__name__)

# Initialize Upstash Redis client
redis = None
if settings.upstash_redis_rest_url and settings.upstash_redis_rest_token:
    try:
        redis = Redis(
            url=settings.upstash_redis_rest_url,
            token=settings.upstash_redis_rest_token
        )
        logger.info("Upstash Redis initialized for rate limiting.")
    except Exception as e:
        logger.error(f"Failed to initialize Upstash Redis: {e}")


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """
    Simple Rate Limiter using Fixed Window algorithm.
    Allows a fixed number of requests per IP address per minute.
    """
    
    def __init__(self, app, max_requests: int = 60, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting if Redis isn't configured
        if not redis:
            return await call_next(request)

        # Get client IP (fallback to 127.0.0.1 for local dev without proxies)
        client_ip = request.client.host if request.client else "127.0.0.1"
        
        # We might want to rate-limit authenticated endpoints by user ID instead
        if hasattr(request.state, "user") and request.state.user:
            identifier = f"user:{request.state.user['id']}"
        else:
            identifier = f"ip:{client_ip}"

        current_minute = int(time.time() // self.window_seconds)
        redis_key = f"rate_limit:{identifier}:{current_minute}"

        try:
            # Increment request count
            count = redis.incr(redis_key)
            
            # Set expiry on the first request of the window
            if count == 1:
                redis.expire(redis_key, self.window_seconds + 5)

            if count > self.max_requests:
                return self._rate_limit_response()

        except Exception as e:
            logger.error(f"Rate Limiter Redis Error: {e}")
            # Fail open if Redis is down
            pass

        response = await call_next(request)
        return response

    def _rate_limit_response(self):
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Rate limit exceeded. Please try again later."},
        )
