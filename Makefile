.PHONY: setup run test lint docker-build docker-run

setup:
	npm ci

run:
	npm run dev

test:
	npm test

lint:
	npm run lint

docker-build:
	docker build -t call-booking .

docker-run:
	docker run --rm -p 8000:8000 call-booking
