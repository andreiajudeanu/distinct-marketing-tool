"""Phase 4: every address that must never be fetched."""

import asyncio
import socket

import pytest

from app.url_safety import UnsafeUrl, cached_policy, check_public_url, is_public_ip, validate_shape


@pytest.mark.parametrize("url", [
    "file:///etc/passwd",
    "ftp://example.com/",
    "javascript:alert(1)",
    "http://user:pass@example.com/",
    "http://localhost:8787/",
    "http://LOCALHOST/",
    "http://printer.local/",
    "http://metadata.google.internal/",
    "http://",
])
def test_shapes_that_are_always_refused(url):
    with pytest.raises(UnsafeUrl):
        validate_shape(url)


@pytest.mark.parametrize("address", [
    "127.0.0.1", "10.0.0.5", "172.16.0.1", "192.168.1.1", "169.254.169.254",
    "0.0.0.0", "100.64.0.1", "::1", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "224.0.0.1",
])
def test_private_addresses_are_not_public(address):
    assert not is_public_ip(address)


@pytest.mark.parametrize("address", ["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])
def test_public_addresses_are_public(address):
    assert is_public_ip(address)


def resolver(*addresses):
    def getaddrinfo(host, port, type=0):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 0)) for address in addresses]
    return getaddrinfo


def test_a_public_name_resolving_to_a_private_address_is_refused(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", resolver("93.184.216.34", "10.0.0.1"))
    with pytest.raises(UnsafeUrl):
        asyncio.run(check_public_url("https://sneaky.example/"))


def test_a_numeric_host_is_checked_after_resolution(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", resolver("127.0.0.1"))
    with pytest.raises(UnsafeUrl):
        asyncio.run(check_public_url("http://2130706433/"))


def test_a_public_site_passes(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", resolver("93.184.216.34"))
    asyncio.run(check_public_url("https://example.com/page"))


def test_an_unresolvable_name_is_refused(monkeypatch):
    def fail(*args, **kwargs):
        raise socket.gaierror()
    monkeypatch.setattr(socket, "getaddrinfo", fail)
    with pytest.raises(UnsafeUrl):
        asyncio.run(check_public_url("https://nope.example/"))


def test_the_cache_keeps_refusals_and_asks_once_per_origin():
    calls = []

    async def policy(url):
        calls.append(url)
        if "bad" in url:
            raise UnsafeUrl("nu")

    async def scenario():
        checked = cached_policy(policy)
        await checked("https://good.example/a")
        await checked("https://good.example/b")
        for _ in range(2):
            with pytest.raises(UnsafeUrl):
                await checked("https://bad.example/a")

    asyncio.run(scenario())
    assert calls == ["https://good.example/a", "https://bad.example/a"]
