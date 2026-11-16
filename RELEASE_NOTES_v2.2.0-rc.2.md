# 🎭 Voices of the Court v2.2.0-rc.2 — "The Court Chronicles" Release Notes

*All changes since **v2.2.0-rc.1** (tag `e2096a74`)*

---

## ✨ Features

### 📜 Court Chronicle (P2)
- **f4b107de** — Add campaign-scoped Court Historian (P2)
- **a73f1dd5** — Add Chronicle next-generation UI and "Show Chronicle" button
- **96e46586** — Add next Chronicle generation date display to Chronicle window

### 🌍 Localization & Internationalization
- **08e22b2c** — Add Russian translation for incoming letters
- **35a29e39** — Add Portuguese translation for incoming letters prompts
- **20861b82** — Add Portuguese translation for incoming letter prompts
- **0383d249** — Add French translation for incoming letters prompt config
- **3b870290** — Add German translation for incoming letter prompts
- **7978360b** — Add Polish translation for incoming letter prompts
- **f7799c3d** — Add Spanish translation for incoming letters prompts
- **6c4dcca2** — Add Japanese translation for incoming letters
- **1d850156** — Synchronize Polish (pl.json) localization keys with English

### 🎯 Character Targeting & Letters
- **e80cad59** — Add target character selection and quick model connection strings
- **432e22ac** — Add character titles and relationships to targeting prompt
- **2d40b2e7** — Add per-type default prompts for incoming letters
- **00bfaad9** — Lowercase "Clear target after send" label and add dev plan
- **628eb1b4** — Remove text-generation parameters box from quick model section

### 📖 Documentation & Platform
- **41d5ecf7** — Add macOS Gatekeeper bypass instructions to README.md

---

## 🐛 Bug Fixes

### 📜 Chronicle Fixes
- **0c80080a** — Localize default historian prompts for all interface languages
- **40615f8a** — Accept manager log transport while clipboard is enabled

### ⚙️ Settings Fixes
- **bfdb1a34** — Load chronicle prompt editor and initialize frequency
- **08905c8b** — Restore missing Chinese labels and letter approval binding

### 📨 Letter System Fixes
- **d4d6e7e6** — Guard delayed run payloads by campaign and player
- **d22f3909** — Include all tied targets in `determineTargetedCharacters`
- **f3d03c3a** — Add per-type reason template editor and fix categorized prompt persistence bugs
- **cb00babb** — Load categorized incoming letter prompts from per-locale files
- **a1b12b3b** — Fix JSON syntax error in `public/locales/en.json`

### 🎯 Character Targeting Fixes
- **3f74d620** — Correct `relationsToPlayer` direction and opinion breakdown gating
- **816b8adc** — Rebind character target listeners to live DOM nodes
- **58f514f5** — Rebind character target selection listeners to live cloned DOM nodes
- **2257fc92** — Add definite assignment assertions in ParametersBox
- **b3c7b742** — Resolve duplicate functions and TypeScript errors in `chronicleIpc.ts`

---

## 🔧 Refactoring

- **32fc3e49** — Externalize incoming letter prompts to per-locale JSON files
- **2be7f707** — Deprecate `src/shared/locales/index.ts` and inline i18n logic
- **f56a59db** — Remove duplicate locale files, import from `public/locales`
- **b254c65f** — Dedupe `buildLetterHistoryRecord` and rename input type

---

## 🧹 Chores & Maintenance

### 🌐 Locale Synchronization Scripts
- **e8ccef1f** — Synchronize `ru.json` with `en.json` using English fallback values
- **f0bd1757** — Add scripts to sync missing `ja.json` keys from `en.json`
- **903ceb62** — Update locale comparison and synchronization scripts
- **d2986dd7** — Add `sync_pt.py` script to synchronize Portuguese locale with English
- **cd7bbfee** — Add locale comparison and `ru.json` sync scripts
- **ec1c06fa** — Add scripts to sync `es.json` locale with `en.json`
- **012c6711** — Add `verify_locales.py` for locale key parity verification
- **775c7ea3** — Sync missing Turkish locale keys from English locale
- **c693019b** — Add prompt translation validation scripts

---

## 🎨 Style & Polish

- **363474b5** — Normalize line endings in `chronicle.html`
- **0cd3e760** — Position target character tooltip below wrapper element

---

## 📚 Documentation

- **c605d45f** — Clarify incoming letter prompt precedence and add guide

---

## ⚙️ CI/CD

- **0c785322** — Make macOS code signing optional when signing secrets absent

---

## 🏷️ Other / Uncategorized

- **747b448f** — votc-212: aligned localization
- **a3a386e5** — votc-212: migration localization
- **46f140f2** — votc-211: update
- **36725233** — votc-210: court chronicle updates
- **50e73f03** — votc-209: commited
- **a2d0d7eb** — votc-205: targeted bug
- **5eab04f7** — votc-205: added targeted character fixes
- **8fc674b3** — votc-205: update
- **fa303ecd** — merge
- **e2096a74** — v2.2.0 (tag)
- **19dad59e** — update
- **07a67655** — (no commit message provided)
- **9205f539** — (no commit message provided)
- **1c542447** — (no commit message provided)
- **f29b6a9c** — (no commit message provided)
- **621dcbb8** — (no commit message provided)
- **5d4dfcea** — (no commit message provided)
- **57fccbd8** — (no commit message provided)
- **b443cc1b** — (no commit message provided)

---

## 📊 Summary Statistics

| Category | Count |
|----------|-------|
| ✨ Features | 17 |
| 🐛 Bug Fixes | 16 |
| 🔧 Refactoring | 4 |
| 🧹 Chores | 9 |
| 🎨 Style | 2 |
| 📚 Documentation | 1 |
| ⚙️ CI/CD | 1 |
| 🏷️ Other | 18 |
| **Total** | **68** |

---

> **Note**: This release introduces the **Court Chronicle (P2)** — a campaign-scoped historian system with next-gen UI, alongside massive localization expansion (9 new languages for incoming letters), robust character targeting fixes, and a complete overhaul of the locale synchronization tooling.

**Full commit range**: `v2.2.0-rc.1..v2.2.0-rc.2`
**Compare on GitHub**: https://github.com/szmania/Voices_of_the_Court/compare/v2.2.0-rc.1...v2.2.0-rc.2