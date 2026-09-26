.PHONY: setup run test lint docker-build docker-run

setup:
	uv sync

run:
	.venv/bin/uvicorn app.main:app --reload --port 8000

test:
	.venv/bin/pytest

lint:
	.venv/bin/ruff check .
	.venv/bin/ruff format --check .

docker-build:
	docker build -t call-booking .

docker-run:
	docker run --rm -p 8000:8000 call-booking
