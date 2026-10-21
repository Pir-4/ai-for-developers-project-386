.PHONY: setup run generate test test-e2e lint docker-build docker-run

setup:
	npm ci

run:
	npm run dev

generate:
	npm run generate

test:
	npm test

test-e2e:
	npm run test:e2e

lint:
	npm run lint

docker-build:
	docker build -t call-booking .

docker-run:
	docker run --rm -p 8000:8000 call-booking
