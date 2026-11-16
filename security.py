"""PBKDF2 password storage compatible with the original prototype."""
import hashlib
import hmac
import secrets

ITERATIONS = 600_000


def password_hash(password: str) -> str:
    if not 12 <= len(password) or len(password.encode('utf-8')) > 1024:
        raise ValueError('Password must be at least 12 characters and at most 1024 UTF-8 bytes.')
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, ITERATIONS)
    return f'pbkdf2_sha256${ITERATIONS}${salt.hex()}${digest.hex()}'


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, rounds_text, salt_hex, digest_hex = stored.split('$')
        rounds = int(rounds_text)
        salt, expected = bytes.fromhex(salt_hex), bytes.fromhex(digest_hex)
        if algorithm != 'pbkdf2_sha256' or not 100_000 <= rounds <= 2_000_000:
            return False
        if len(salt) != 16 or len(expected) != 32 or len(password.encode('utf-8')) > 1024:
            return False
        calculated = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, rounds)
        return hmac.compare_digest(calculated, expected)
    except (ValueError, TypeError, AttributeError, OverflowError):
        return False
