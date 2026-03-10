# Voices of the Court 2.0 - Community Edition (VOTC-CE) - Голоса Двора

ИИ-компаньон для Crusader Kings III, который помогает отслеживать персонажей, заговоры и сюжетные линии. Voices of the Court 2.0 - Community Edition интегрирует большие языковые модели в игру, позволяя вести естественные диалоги с персонажами и динамически влиять на состояние игры.

Документация: https://docs.voicesofthecourt.app

[Страница в Steam](https://steamcommunity.com/sharedfiles/filedetails/?id=3654567139)

Присоединяйтесь к нашему Discord:

[![Discord Server](https://discord.com/api/guilds/1066522056243564585/widget.png?style=banner2)](https://discord.gg/UQpE4mJSqZ)

# Трейлер 
[![link to](https://img.youtube.com/vi/E2GmlNsK-J8/0.jpg)](https://www.youtube.com/watch?v=E2GmlNsK-J8)

# Геймплейное видео от DaFloove
[![link to](https://img.youtube.com/vi/3lhHkXPmis0/0.jpg)](https://www.youtube.com/watch?v=3lhHkXPmis0)

### 🌟 Особенности

### 🎮 Интерфейс конфигурации
- **🤖 Множество моделей ИИ**: Поддержка моделей OpenAI GPT, Anthropic Claude, Player2 и локальных моделей.
- **🧠 Память персонажей**: Система постоянной памяти, отслеживающая отношения и историю персонажей.
- **📚 Управление контекстом**: Настраиваемое окно контекста и параметры истории диалогов.
- **🎯 Пользовательские промпты**: Персонализированные системные инструкции для различных типов персонажей.
- **🔄 Сброс настроек**: Восстановление стандартных промптов и настроек одним кликом.

### 💬 Интерфейс чата
- **⚡ Разговоры в реальном времени**: Естественный диалог с персонажами CK3.
- **👤 Профили персонажей**: Подробная информация о каждом персонаже.
- **🔖 Система закладок**: Сохранение и организация важных разговоров.
- **📤 Экспорт**: Возможность экспорта диалогов в текстовые файлы.

### 📋 Менеджер сводок (Summary Manager)
- **🤖 Автоматические сводки**: Создание ИИ кратких описаний важных событий.
- **🔖 Интеграция закладок**: Преобразование закладок в сводки.
- **🔍 Поиск**: Поиск по конкретным разговорам и сводкам.
- **📤 Опции экспорта**: Сохранение сводок в различных форматах.

## Детали интерфейса конфигурации

Приложение предоставляет шесть основных страниц конфигурации:

### 1. Страница подключения (Connection)
Используется для настройки подключения к API языковой модели и путей к игре.
- **Настройка API**: Выбор провайдера (OpenAI, Kobold и др.), ввод ключа, URL-адреса и названия модели.
- **Путь к папке пользователя CK3**: Установка пути к данным пользователя (обычно `Документы/Paradox Interactive/Crusader Kings III`).

### 2. Страница действий (Actions)
Настройка обнаруживаемых игровых действий и соответствующих реакций ИИ.
- **Включение действий**: Общий переключатель и возможность генерации ИИ-нарратива после срабатывания действия.
- **Параметры**: Настройка температуры, штрафов за повторения и присутствие.
- **Выбор действий**: Список доступных для отслеживания событий.

### 3. Страница суммаризации (Summarization)
Настройка API для функции краткого пересказа диалогов. Помогает сжимать длинные разговоры, чтобы уложиться в лимиты токенов.

### 4. Страница промптов (Prompts)
Настройка инструкций, управляющих поведением ИИ:
- Основной промпт, промпт для мыслей персонажа, промпт для сводок, промпт памяти и нарратива.
- Выбор скриптов для динамического описания персонажей.

### 5. Страница настроек (Settings)
Технические параметры генерации:
- Максимальное количество токенов, стриминг сообщений, очистка текста от эмодзи.
- Динамический выбор персонажа и валидация личности.
- Настройка глубины вставки памяти и описаний в контекст.

### 6. Системная страница (System)
Обслуживание приложения:
- Проверка обновлений, просмотр логов.
- Управление сохраненными сводками (очистка или открытие папки).

## 🚀 Локальная установка

### 📥 Установка
1. Скачайте последнюю версию мода VOTC-CE.
2. Распакуйте в папку модов CK3.
3. Запустите CK3 и включите мод в лаунчере.
4. Запустите приложение VOTC-CE.

### ⚙️ Настройка
1. Запустите приложение.
2. Перейдите в интерфейс конфигурации.
3. Введите ваш API ключ.
4. Нажмите "Save Configuration".

## 🛠️ Разработка

1. Клонируйте репозиторий.
2. Установите зависимости: `npm i`.
3. Запустите режим разработки: `npm run start`.
4. Сборка приложения: `npm run make`.

## Credits & Attribution

This project is a derivative work based on VOTC / AliChat. We would like to extend our deep gratitude to the developers who kept this project alive and pushed the boundaries of AI in Crusader Kings III:

### Original Creators and Supporters
The VOTC, VOTC 2.0 Team and community contributors for their contributions to the project.

### Continued Development
Special thanks to the Chinese development community, including Lisiyuan233, zhaowendao2005, and others who provided critical updates and support.

### Community Edition Maintainers
The VOTC-CE team and contributors.

### Licensing Information
This project is licensed under the [GPL-3.0 License](LICENSE). Some of the original source material for this mod was released under the Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0) license.

In accordance with Section 4(b) of the CC BY-SA 4.0 license, this derivative work is being licensed under a BY-SA Compatible License: the GNU General Public License v3.0 (GPLv3).

For more details on licensing, please see the README files in our repositories: Voices of the Court 2.0 - Community Edition README and VOTC-CE Mod README.

**Original License**
GPLv3 and CC BY-SA 4.0

**Current License**
GPLv3

### GPLv3 Notice
This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see https://www.gnu.org/licenses/.


