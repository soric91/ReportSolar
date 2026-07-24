import time
import threading
from app.core.config import get_settings

settings = get_settings()

_blacklist: dict[str, float] = {}
_lock = threading.Lock()


def _cleanup_expired():
    now = time.time()
    expired = [token for token, expires_at in _blacklist.items() if expires_at <= now]
    for token in expired:
        _blacklist.pop(token, None)


def blacklist_token(token: str, ttl: int = None):
    """Add token to in-memory blacklist with TTL (time-to-live)"""
    if ttl is None:
        ttl = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    with _lock:
        _cleanup_expired()
        _blacklist[token] = time.time() + ttl


def is_token_blacklisted(token: str) -> bool:
    """Check if token is blacklisted"""
    with _lock:
        expires_at = _blacklist.get(token)
        if expires_at is None:
            return False
        if expires_at <= time.time():
            _blacklist.pop(token, None)
            return False
        return True
