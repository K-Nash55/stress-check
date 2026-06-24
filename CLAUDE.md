# CLAUDE.md

## 重要：ファイルパス（最新）
リポジトリのルートは：
C:\Users\ken-n\Documents\stress-check-projects\stress-check

主要ファイルの正しいパス：
- LP：C:\Users\ken-n\Documents\stress-check-projects\stress-check\lp\index.html
- 受検画面：C:\Users\ken-n\Documents\stress-check-projects\stress-check\index57.html
- 結果画面：C:\Users\ken-n\Documents\stress-check-projects\stress-check\result.html
- ダッシュボード：C:\Users\ken-n\Documents\stress-check-projects\stress-check\admin\super_dashboard.html
- スーパーアドミン：C:\Users\ken-n\Documents\stress-check-projects\stress-check\admin\superadmin.html
- 採点エンジン：C:\Users\ken-n\Documents\stress-check-projects\stress-check\js\scoring.js

ファイル編集時は必ずこのパスを使用すること。
OLD フォルダは絶対に触らないこと。

確認してからpushすること。

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a single-file, no-build Japanese occupational stress survey web app (職業性ストレス簡易調査票). Everything — HTML, CSS, and JavaScript — lives in `index.html`. There are no dependencies, no package manager, and no build step. Open `index.html` directly in a browser to run it.

## Architecture

### Data layer (`QUESTIONS` array)
All 141 questions are embedded as a JSON array in `index.html`. Each entry has:
- `no`: 1-based question number (used as the key in the `answers` object)
- `category`: one of `1.ストレッサー`, `2-1.作業リソース`, `2-2.部署リソース`, `2-3.会社リソース`, `3-1.精神的ストレス`, `3-2.身体的ストレス`, `3-3.その他`
- `scale`: the measurement scale name (49 unique scales)
- `section`: groups questions into the 8 display sections (section header text shown to the user)
- `direction`: `"1234"` for forward scoring, `"4321"` for reverse scoring
- `avg` / `sd`: national average and standard deviation used to render the comparison marker on result bars

### Screen flow
Three `<div class="screen">` elements toggled by `showScreen(id)`:
1. `scStart` — landing card with Start and Test-mode buttons
2. `scQuestions` — paginated section view rendered into `#qContainer` by `renderSection()`
3. `scResult` — results built by `buildResult()` and injected into `#rContainer`

### State
- `answers` — plain object mapping question `no` → selected value (1–4)
- `curSec` — index into `SECTIONS` (derived by grouping `QUESTIONS` by `section` field)

### Scoring (`buildResult`)
1. Groups questions by `scale` → computes per-scale average
2. Rolls up into three domain totals: ストレッサー (category prefix `1.`), リソース (prefix `2`), アウトカム (everything else)
3. Stress level: `high` if `sPct > 0.6 AND rPct < 0.55`; `mid` if `sPct > 0.5`; else `low`

### Test mode
`btnTest` auto-fills `answers` with random values (1–4) for all 141 questions and jumps straight to the result screen — useful for quickly verifying result rendering without going through the survey.
