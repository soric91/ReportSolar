import redis
import logging
from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

redis_client = redis.from_url(
    settings.REDIS_URL,
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
        logger.error(f"Error blacklisting token: {e}")


def is_token_blacklisted(token: str) -> bool:
    """Check if token is blacklisted"""
    try:
        result = redis_client.get(f"token_blacklist:{token}")
        return result is not None
    except Exception as e:
        logger.warning(f"Redis blacklist check failed: {e}")
        return False


def check_redis_connection():
    """Test Redis connection"""
    try:
        redis_client.ping()
        return True
    except Exception:
        return False
