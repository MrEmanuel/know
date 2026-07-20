import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from skyroute import Passenger, Segment, quote_itinerary


class QuoteTest(unittest.TestCase):
    def test_passenger_can_change_category_between_segments(self) -> None:
        passenger = Passenger("Maya", date(2024, 6, 10))
        segments = [
            Segment("OUT", date(2026, 6, 8), 20_000),
            Segment("BACK", date(2026, 6, 15), 20_000),
        ]

        lines, total = quote_itinerary(passenger, segments)

        self.assertEqual(["INFANT", "CHILD"], [line.passenger_category for line in lines])
        self.assertEqual([2_000, 15_000], [line.fare_cents for line in lines])
        self.assertEqual(17_000, total)

    def test_quote_keeps_a_segment_explanation(self) -> None:
        passenger = Passenger("Alex", date(1990, 1, 1))
        segment = Segment("ONE", date(2026, 6, 8), 12_345)

        lines, _ = quote_itinerary(passenger, [segment])

        self.assertIn("ADULT on 2026-06-08", lines[0].explanation)
        self.assertEqual(12_345, lines[0].fare_cents)


if __name__ == "__main__":
    unittest.main()
