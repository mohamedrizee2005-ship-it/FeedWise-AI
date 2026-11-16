"""Construct separate student and private review URLs without carrying old query secrets."""
from urllib.parse import urlsplit, urlunsplit, urlencode


def make_link(base_url, kind, token):
    """Use only an HTTP(S) origin/path; never copy an existing review query into a student URL."""
    if kind not in ('s', 'r'):
        raise ValueError('Unknown link type.')
    parsed = urlsplit(base_url)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Use an http:// or https:// app address.')
    return urlunsplit((parsed.scheme,parsed.netloc,parsed.path or '/',urlencode({kind:token}),''))
