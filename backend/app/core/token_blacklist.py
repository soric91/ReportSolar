import redis
from app.core.config import get_settings
from datetime import timedelta

settings = get_settings()

redis_client = redis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=0,
    decode_responses=True,
    socket_connect_timeout=5,
    socket_keepalive=True,
)


def blacklist_token(token: str, ttl: int = None):
    """Add token to blacklist with TTL (time-to-live)"""
    try:
        if ttl is None:
            ttl = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        redis_client.setex(f"token_blacklist:{token}", ttl, "revoked")
    except Exception as e:
        # Log error but don't fail - token validation still works
        print(f"Error blacklisting token: {e}")


def is_token_blacklisted(token: str) -> bool:
    """Check if token is blacklisted"""
    try:
        result = redis_client.get(f"token_blacklist:{token}")
        return result is not None
    except Exception as e:
        # If Redis is down, don't block access - security tradeoff
        print(f"Error checking blacklist: {e}")
        return False


def check_redis_connection():
    """Test Redis connection"""
    try:
        redis_client.ping()
        return True
    except Exception:
        return False
