# Changelog

## [0.2.0](https://github.com/Pir-4/ai-for-developers-project-386/compare/call-booking-v0.1.0...call-booking-v0.2.0) (2026-10-07)


### ⚠ BREAKING CHANGES

* **web:** the guest catalog page and /book/:email/:id are removed; the guest link is now /book/:email.
* **contract,server:** event types are removed. The per-event-type slots and bookings routes are gone, bookings carry durationMinutes instead of an event type, and the event_types table is dropped.

### Features

* app skeleton — Fastify backend and Vite + Mantine frontend ([b2d7d85](https://github.com/Pir-4/ai-for-developers-project-386/commit/b2d7d8539933307f96744ded93274e9b03c529ae))
* app skeleton on Node.js + TypeScript (Fastify, Vite, Mantine) ([6b01b75](https://github.com/Pir-4/ai-for-developers-project-386/commit/6b01b75a64ff8463dd89c3f64b0fa79f9f3ba821))
* **contract,server,web:** guest books a slot ([a1b1346](https://github.com/Pir-4/ai-for-developers-project-386/commit/a1b13460edf9c1bd81fcd495a879bf3e4e0d0fd4))
* **contract,server,web:** guest books a slot ([b2219e1](https://github.com/Pir-4/ai-for-developers-project-386/commit/b2219e10959ef1250bbd90df4a0e8e91214957e8)), closes [#23](https://github.com/Pir-4/ai-for-developers-project-386/issues/23)
* **contract,server,web:** owner views upcoming meetings ([69c89a2](https://github.com/Pir-4/ai-for-developers-project-386/commit/69c89a22cfa999c8ce8a4ca252d8d84c7650054d))
* **contract,server,web:** owner views upcoming meetings ([d25fdab](https://github.com/Pir-4/ai-for-developers-project-386/commit/d25fdab44bbb45b38e44e475d44ddc400dc619b1)), closes [#24](https://github.com/Pir-4/ai-for-developers-project-386/issues/24)
* **contract,server:** owner availability calendar and guest-chosen duration ([bf8edfc](https://github.com/Pir-4/ai-for-developers-project-386/commit/bf8edfc6f37b23268c28b7b61056e7493c58a9cd))
* **contract:** add owner event type endpoints ([c1d9a6c](https://github.com/Pir-4/ai-for-developers-project-386/commit/c1d9a6c37c52961ec9eee250aed6d3622da4b10b))
* **contract:** add typespec-first api pipeline with spec-driven server ([7365bd4](https://github.com/Pir-4/ai-for-developers-project-386/commit/7365bd4a3635dd5ac07c9e4119589ca07321d093))
* **contract:** add typespec-first api pipeline with spec-driven server ([9ebfe36](https://github.com/Pir-4/ai-for-developers-project-386/commit/9ebfe364edc7ef7eaba53c9df1aecec56bd773e2)), closes [#19](https://github.com/Pir-4/ai-for-developers-project-386/issues/19)
* owner creates an event type and gets a guest link ([7208ed5](https://github.com/Pir-4/ai-for-developers-project-386/commit/7208ed5197ee9b28d2c49263024d5152a972cd56))
* **server:** persist event types in sqlite ([456803d](https://github.com/Pir-4/ai-for-developers-project-386/commit/456803deb9bf89a00ef2b0cd31e9df39ff02200c))
* **web,server:** guest picks a day and sees free slots ([23a2bd7](https://github.com/Pir-4/ai-for-developers-project-386/commit/23a2bd764fae6cc829c3d0c7d545147daac897a4))
* **web,server:** guest picks a day and sees free slots ([f390170](https://github.com/Pir-4/ai-for-developers-project-386/commit/f3901707f7c275451d4f321af94856cca0bd8661)), closes [#22](https://github.com/Pir-4/ai-for-developers-project-386/issues/22)
* **web:** add RU/EN language switcher with persistence ([4f62024](https://github.com/Pir-4/ai-for-developers-project-386/commit/4f620247b4102947a40f45dacf0b3ec8ba81c635))
* **web:** build landing page from spec ([0761de0](https://github.com/Pir-4/ai-for-developers-project-386/commit/0761de06f76ad845d6295e08164095a597a9dd2a))
* **web:** build landing page from spec ([62831e6](https://github.com/Pir-4/ai-for-developers-project-386/commit/62831e62f90c04afc9a5c0982c20691ab98cdfb2))
* **web:** guest views the owner's booking types ([353ef64](https://github.com/Pir-4/ai-for-developers-project-386/commit/353ef64996726a692c362510c824ac517ead0ad3))
* **web:** guest views the owner's booking types catalog ([16f3f31](https://github.com/Pir-4/ai-for-developers-project-386/commit/16f3f31daf0f554a4f771b78afe457616a4e0083)), closes [#21](https://github.com/Pir-4/ai-for-developers-project-386/issues/21)
* **web:** owner area with event type creation and guest links ([c9653c0](https://github.com/Pir-4/ai-for-developers-project-386/commit/c9653c07d839cca03a322e1868a19fb553612a0e))
* **web:** owner availability calendar and single guest link ([e222354](https://github.com/Pir-4/ai-for-developers-project-386/commit/e2223549085cf446de3b6d38dd4ccd66f93f6418))


### Bug Fixes

* **web:** keep landing header single-line on small screens ([e56940d](https://github.com/Pir-4/ai-for-developers-project-386/commit/e56940dea9dd5b01849b01d5cc4fcbb2aeb1f340))
* **web:** mark owner calendar days that hold a meeting ([af9892f](https://github.com/Pir-4/ai-for-developers-project-386/commit/af9892fce70fd0c60f427a6ba8fdd6f0846fc5e8))
* **web:** mark owner calendar days that hold a meeting ([773de38](https://github.com/Pir-4/ai-for-developers-project-386/commit/773de38716713f4df8fd5354fa0a7cec711c1291))
* **web:** route 404 page through links.ts, require Node &gt;=22.13 ([6265701](https://github.com/Pir-4/ai-for-developers-project-386/commit/6265701a9362bad336a92ac3afef1fb6deb65291))
* **web:** visual polish of calendar day cells and slot ladder ([29b2395](https://github.com/Pir-4/ai-for-developers-project-386/commit/29b2395f80f1d53ef0ff4bb5610bab0b9c9227ee))
* **web:** visual polish of calendar day cells and slot ladder ([b2de0d8](https://github.com/Pir-4/ai-for-developers-project-386/commit/b2de0d88998c5292eaa4cb18cb2e658563c0cdec)), closes [#43](https://github.com/Pir-4/ai-for-developers-project-386/issues/43)
