import os
import base64
from aiohttp_session import setup as setup_session
from aiohttp_session.cookie_storage import EncryptedCookieStorage

key_str = os.getenv('SESSION_KEY')
if not key_str:
    raise RuntimeError("SESSION_KEY not set in environment")

SECRET_KEY = base64.urlsafe_b64decode(key_str.encode())

def setup_sessions(app):
    setup_session(app, EncryptedCookieStorage(SECRET_KEY))
