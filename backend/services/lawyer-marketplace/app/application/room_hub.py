"""In-process pub/sub for appointment-room SSE."""

from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any

_subscribers: dict[str, set[asyncio.Queue[dict[str, Any]]]] = defaultdict(set)


def subscribe(appointment_id: str) -> asyncio.Queue[dict[str, Any]]:
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=256)
    _subscribers[str(appointment_id)].add(queue)
    return queue


def unsubscribe(appointment_id: str, queue: asyncio.Queue[dict[str, Any]]) -> None:
    rooms = _subscribers.get(str(appointment_id))
    if not rooms:
        return
    rooms.discard(queue)
    if not rooms:
        _subscribers.pop(str(appointment_id), None)


async def publish(appointment_id: str, event: dict[str, Any]) -> None:
    rooms = list(_subscribers.get(str(appointment_id), ()))
    for queue in rooms:
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            try:
                queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass


def subscriber_count(appointment_id: str) -> int:
    return len(_subscribers.get(str(appointment_id), ()))


_admin_subscribers: set[asyncio.Queue[dict[str, Any]]] = set()


def subscribe_admin() -> asyncio.Queue[dict[str, Any]]:
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=256)
    _admin_subscribers.add(queue)
    return queue


def unsubscribe_admin(queue: asyncio.Queue[dict[str, Any]]) -> None:
    _admin_subscribers.discard(queue)


async def publish_admin(event: dict[str, Any]) -> None:
    for queue in list(_admin_subscribers):
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            try:
                queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass


_user_subscribers: dict[str, set[asyncio.Queue[dict[str, Any]]]] = defaultdict(set)


def subscribe_user(user_id: str) -> asyncio.Queue[dict[str, Any]]:
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=256)
    _user_subscribers[str(user_id)].add(queue)
    return queue


def unsubscribe_user(user_id: str, queue: asyncio.Queue[dict[str, Any]]) -> None:
    rooms = _user_subscribers.get(str(user_id))
    if not rooms:
        return
    rooms.discard(queue)
    if not rooms:
        _user_subscribers.pop(str(user_id), None)


async def publish_user(user_id: str, event: dict[str, Any]) -> None:
    for queue in list(_user_subscribers.get(str(user_id), ())):
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            try:
                queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass
