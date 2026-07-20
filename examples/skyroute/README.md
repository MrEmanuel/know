# SkyRoute: the second-birthday problem

SkyRoute is a deliberately small airline fare engine used to demonstrate Know.
Its surprising domain rule is real enough to be memorable: a passenger can be
an infant on the outbound flight and a child on the return flight when they
turn two during the trip.

Run it from the repository root:

```sh
python3 examples/skyroute/run_demo.py
python3 -m unittest discover -s examples/skyroute/tests
```

The interesting code lives across several files:

- `models.py` contains immutable itinerary data.
- `passenger.py` classifies a passenger on a particular departure date.
- `pricing.py` applies category-specific integer fare factors.
- `quote.py` calculates every segment independently and retains its reasoning.

After running `./try-demo.sh`, start Codex CLI with `codex`, trust the
repository hook through `/hooks`, and give it this tempting request:

> Simplify SkyRoute by calculating passenger category once when the booking is
> created and storing it on Passenger. Reuse it for every flight segment.

Know should surface the linked rule before the first protected file is edited.
The correct response is to reject the itinerary-wide category assumption and,
if useful, propose caching by passenger and departure date instead.

This walkthrough intentionally targets Codex CLI only. The VS Code extension
is outside the scope of the demo.
