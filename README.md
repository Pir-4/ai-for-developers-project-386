# Календарь звонков


[![hexlet-check](https://github.com/Pir-4/ai-for-developers-project-386/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/Pir-4/ai-for-developers-project-386/actions)

Разработайте совместно с ИИ сервис для бронирования календаря

Учебный проект Хекслета: https://ru.hexlet.io/programs/ai-for-developers
Как это должно работать: https://files.hexlet.app/a/2ipc5m

## Стек

- Python 3.11+, FastAPI, SQLite, Docker

## Установка

```bash
git clone https://github.com/Pir-4/ai-for-developers-project-386.git
cd ai-for-developers-project-386
make setup   # создаёт .venv и ставит зависимости (нужен uv)
```

## Использование

```bash
make run     # dev-сервер: http://localhost:8000 (Swagger UI — /docs)
make test    # тесты
make lint    # линт

make docker-build && make docker-run   # сборка и запуск в контейнере
```

Контракт API — в [docs/api.md](docs/api.md).

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
