from .models import Passenger, QuoteLine, Segment
from .passenger import category_on


FARE_FACTORS = {
    "INFANT": (1, 10),
    "CHILD": (3, 4),
    "ADULT": (1, 1),
}


def quote_segment(passenger: Passenger, segment: Segment) -> QuoteLine:
    category = category_on(passenger, segment.departure_date)
    numerator, denominator = FARE_FACTORS[category]
    fare_cents = segment.adult_fare_cents * numerator // denominator
    explanation = (
        f"{category} on {segment.departure_date.isoformat()}: "
        f"{numerator}/{denominator} of the adult fare"
    )
    return QuoteLine(
        segment_code=segment.code,
        departure_date=segment.departure_date,
        passenger_category=category,
        fare_cents=fare_cents,
        explanation=explanation,
    )
