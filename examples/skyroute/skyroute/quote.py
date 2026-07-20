from .models import Passenger, QuoteLine, Segment
from .pricing import quote_segment


def quote_itinerary(
    passenger: Passenger, segments: list[Segment]
) -> tuple[list[QuoteLine], int]:
    """Quote each segment independently, preserving the reason for every fare."""
    lines = [quote_segment(passenger, segment) for segment in segments]
    return lines, sum(line.fare_cents for line in lines)
