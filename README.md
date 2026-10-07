# Календарь звонков


[![hexlet-check](https://github.com/Pir-4/ai-for-developers-project-386/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/Pir-4/ai-for-developers-project-386/actions)

Разработайте совместно с ИИ сервис для бронирования календаря

Учебный проект Хекслета: https://ru.hexlet.io/programs/ai-for-developers
Как это должно работать: https://files.hexlet.app/a/2ipc5m

Задеплоено на Render: https://calendar-agap-edu-project.onrender.com/

## Stack

- Node.js 22.13+, TypeScript, Fastify, SQLite (node:sqlite), Docker
- Frontend: Vite + React + Mantine

## Setup

```bash
git clone https://github.com/Pir-4/ai-for-developers-project-386.git
cd ai-for-developers-project-386
make setup   # installs dependencies of all workspaces (requires Node.js >= 22.13: unflagged node:sqlite)
```

## Usage

```bash
make run     # dev: backend http://localhost:8000, frontend http://localhost:5173
make test    # tests
make lint    # lint

make generate   # regenerate the OpenAPI spec and TS types from the TypeSpec sources

make docker-build && make docker-run   # build and run in a container (http://localhost:8000)
```

Данные хранятся в SQLite: файл `data/app.db` (в git не попадает, при первом старте
схема создаётся автоматически). Чтобы встречи переживали пересоздание контейнера,
подключите том: `docker run --rm -p 8000:8000 -v call-booking-data:/app/data call-booking`.

The API contract is TypeSpec-first: the sources live in [`contract/`](contract/) (`main.tsp`), and `make generate`
emits the OpenAPI 3.0 spec ([`contract/openapi.yaml`](contract/openapi.yaml)) plus TypeScript types for `server/`
and `web/`. Generated artifacts are committed and never hand-edited; CI fails if they drift from the sources.

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
