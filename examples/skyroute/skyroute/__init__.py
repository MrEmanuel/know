"""A tiny, intentionally domain-rich airline fare engine."""

from .models import Passenger, Segment
from .quote import quote_itinerary

__all__ = ["Passenger", "Segment", "quote_itinerary"]
