"""Rejects URLs that lead to this machine or a private network (SSRF protection)."""

import asyncio
import ipaddress
import socket
from typing import Awaitable, Callable
from urllib.parse import urlsplit

BLOCKED_NAMES = {"localhost", "metadata.google.internal"}
BLOCKED_SUFFIXES = (".localhost", ".local", ".internal", ".intranet", ".lan", ".home", ".corp")

UrlPolicy = Callable[[str], Awaitable[None]]


class UnsafeUrl(Exception):
    pass


def validate_shape(url: str) -> str:
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https"):
        raise UnsafeUrl("Only http and https are allowed.")
    if parts.username or parts.password:
        raise UnsafeUrl("URLs with credentials are not allowed.")
    host = (parts.hostname or "").lower().rstrip(".")
    if not host:
        raise UnsafeUrl("URL without a host.")
    if host in BLOCKED_NAMES or host.endswith(BLOCKED_SUFFIXES):
        raise UnsafeUrl("Local addresses are not allowed.")
    return host


def is_public_ip(address: str) -> bool:
    ip = ipaddress.ip_address(address.split("%", 1)[0])
    mapped = getattr(ip, "ipv4_mapped", None)
    target = mapped or ip
    return target.is_global and not target.is_multicast


async def check_public_url(url: str) -> None:
    host = validate_shape(url)
    try:
        resolved = await asyncio.to_thread(socket.getaddrinfo, host, None, type=socket.SOCK_STREAM)
    except socket.gaierror as error:
        raise UnsafeUrl("The domain name does not resolve.") from error
    addresses = {item[4][0] for item in resolved}
    if not addresses or not all(is_public_ip(address) for address in addresses):
        raise UnsafeUrl("The address leads to a private network.")


def cached_policy(policy: UrlPolicy) -> UrlPolicy:
    """One page makes hundreds of requests to a few hosts, so verdicts are kept per origin."""
    verdicts: dict[str, UnsafeUrl | None] = {}

    async def checked(url: str) -> None:
        parts = urlsplit(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        if origin not in verdicts:
            try:
                await policy(url)
                verdicts[origin] = None
            except UnsafeUrl as error:
                verdicts[origin] = error
        if verdicts[origin]:
            raise verdicts[origin]

    return checked
