from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class Passenger:
    name: str
    birth_date: date


@dataclass(frozen=True)
class Segment:
    code: str
    departure_date: date
    adult_fare_cents: int


@dataclass(frozen=True)
class QuoteLine:
    segment_code: str
    departure_date: date
    passenger_category: str
    fare_cents: int
    explanation: str
