.PHONY: setup run generate test lint docker-build docker-run

setup:
	npm ci

run:
	npm run dev

generate:
	npm run generate

test:
	npm test

lint:
	npm run lint

docker-build:
	docker build -t call-booking .

docker-run:
	docker run --rm -p 8000:8000 call-booking
