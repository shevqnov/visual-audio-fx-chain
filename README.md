# Visual Audio FX Chain 🎛️

Веб-приложение для визуального редактирования аудио-цепочек прямо в браузере. Загружаешь трек, настраиваешь эффекты, слушаешь результат в реальном времени.

## Что умеет

- Загрузка аудио-файлов (MP3, WAV, OGG, FLAC)
- Цепочка эффектов: Source → Gain → Compressor → Reverb → Output
- Осциллограмма
- Bypass эффектов (отключение обработки)
- Play / Pause / Stop

## Как запустить

```bash
npm install
npm run dev
```

Откроется на http://localhost:5173

## Roadmap (что планируется)

- [ ] Добавить больше эффектов (EQ, Delay, Filter)
- [ ] Перемотка (seek bar)
- [ ] Drag-n-drop ноды (ReactFlow)
- [ ] Сохранение пресетов
- [ ] Экспорт в WAV
- [ ] WASM для кастомных эффектов ???
- [ ] Визуализация спектра (frequency analyzer)

## Технологии

- React 18 + TypeScript
- Vite
- Web Audio API
