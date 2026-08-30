# PlayForFun — аудит 2026-08-12 (сессия 2)

## Выполнено

### Инфраструктура
- Восстановлены из `main`: `package.json`, полный `apps/web/src`, `apps/ws/dist` (все ~50+ движков), `infra/nginx-games-443.conf`
- `npm run build:web` — OK
- `pm2 reload games-ws`, `games-api` — OK
- nginx — OK (починен broken symlink на `nginx-games-443.conf`)

### P0/P1 исправления
| Баг | Fix |
|-----|-----|
| Alias `p.disconnected` | → `isOnline !== false` |
| Crocodile `p.disconnected` | → `isOnline !== false` |
| Crocodile слово в turn-started | маска `wordPattern` + `wordLength` в handler |
| Крокодил «Кто угадал» не кликается | `CrocodileLuxeChrome` portal + skip GameLayoutWrapper в luxe |
| Sync offline блокирует ready | `playerOnline.js` + SyncEngine |
| Password offline ведущий | nextClueGiver skip offline |
| Mafia offline спикер | nextSpeaker skip + handlePlayerDisconnect |

### Инвентаризация
- **65 игр** — все имеют WS-движок в `apps/ws/dist/games/`
- **4 custom UI**: mafia2, bunker, melody, crocodile/sketch
- **61 generic** GameLayout

## TOP-10 рисков (актуально)

| # | P | Риск | Статус |
|---|---|------|--------|
| 1 | P0 | Git partial — только 3 файла tracked | open — нужен push full tree |
| 2 | P1 | teamwords/reaction/colors `allReady` без offline filter | backlog |
| 3 | P1 | wordbomb/escalation nextTurn без sync isOnline | backlog |
| 4 | P1 | game:state-sync — нет handler на фронте | backlog |
| 5 | P2 | Canvas stroke resync на reconnect | backlog |
| 6 | P2 | Visual regression — 4 snapshot из 65 | backlog |
| 7 | P2 | Main bundle 573KB > 500KB budget | warn |
| 8 | P1 | PR #1 alias fix — отдельная ветка, main локально полнее | merge needed |
| 9 | P2 | Score/timer animations не на всех generic | polish |
| 10 | P2 | E2E smoke 65 игр не прогнан | backlog |

## Фазы 1–2 (кратко)

| Критерий | Статус |
|----------|--------|
| gameSkinTokens 65/65 | ✓ |
| Mobile safe-area | ✓ CSS |
| Crocodile luxe portal | ✓ fixed |
| Offline rotation flagship | ✓ |
| Framer Motion | ✓ chunk |
| Timer urgent CSS | ✓ `.gx-hero__timer--urgent` |

## Следующие шаги
1. E2E smoke по theme-groups (8 прогонов Playwright)
2. Offline filter для teamwords/reaction/colors/wordbomb
3. `game:state-sync` handler в RoomPage
4. Commit full tree в git

*Обновлено: 2026-08-12 12:35 UTC+3*
