#!/usr/bin/env python3
from datetime import date

from skyroute import Passenger, Segment, quote_itinerary


def money(cents: int) -> str:
    return f"${cents // 100}.{cents % 100:02d}"


def main() -> None:
    passenger = Passenger("Maya", date(2024, 6, 10))
    segments = [
        Segment("SK100 OUTBOUND", date(2026, 6, 8), 20_000),
        Segment("SK101 RETURN", date(2026, 6, 15), 20_000),
    ]
    lines, total = quote_itinerary(passenger, segments)

    print("SKYROUTE — THE SECOND-BIRTHDAY ITINERARY")
    print(f"{passenger.name} turns two between these two flights.\n")
    for line in lines:
        seat = "lap fare" if line.passenger_category == "INFANT" else "seat required"
        print(
            f"{line.segment_code:<15} {line.departure_date}  "
            f"{line.passenger_category:<6}  {money(line.fare_cents):>7}  {seat}"
        )
    print(f"\nItinerary total: {money(total)}")
    print("The category changes because it is evaluated at each departure.")


if __name__ == "__main__":
    main()
