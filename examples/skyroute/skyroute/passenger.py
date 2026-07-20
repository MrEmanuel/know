from datetime import date

from .models import Passenger


def age_on(birth_date: date, on_date: date) -> int:
    """Return the passenger's completed years on a calendar date."""
    birthday_has_passed = (on_date.month, on_date.day) >= (
        birth_date.month,
        birth_date.day,
    )
    return on_date.year - birth_date.year - (not birthday_has_passed)


def category_on(passenger: Passenger, departure_date: date) -> str:
    """Classify one passenger for one segment's local departure date."""
    age = age_on(passenger.birth_date, departure_date)
    if age < 2:
        return "INFANT"
    if age < 12:
        return "CHILD"
    return "ADULT"
