# Voices of the Court (VOTC)

Asystent oparty na sztucznej inteligencji dla Crusader Kings III, który pomaga śledzić postacie, spiski i wątki fabularne. Voices of the Court integruje duże modele językowe z grą, pozwalając na prowadzenie naturalnych rozmów z postaciami i dynamiczne wpływanie na stan gry.

Dokumentacja: https://docs.voicesofthecourt.app

[Strona Steam](https://steamcommunity.com/sharedfiles/filedetails/?id=3654567139)

Dołącz do naszego Discorda:

[![Discord Server](https://discord.com/api/guilds/1066522056243564585/widget.png?style=banner2)](https://discord.gg/UQpE4mJSqZ)

# Trailer 
[![link to](https://img.youtube.com/vi/E2GmlNsK-J8/0.jpg)](https://www.youtube.com/watch?v=E2GmlNsK-J8)

# Gameplay autorstwa DaFloove
[![link to](https://img.youtube.com/vi/3lhHkXPmis0/0.jpg)](https://www.youtube.com/watch?v=3lhHkXPmis0)

### 🌟 Funkcje

### 🎮 Interfejs konfiguracji
- **🤖 Wiele modeli AI**: Wsparcie dla modeli OpenAI GPT, Anthropic Claude, Player2 oraz modeli lokalnych
- **🧠 Pamięć postaci**: System trwałej pamięci śledzący relacje i historię postaci
- **📚 Zarządzanie kontekstem**: Regulowane okno kontekstowe i ustawienia historii rozmów
- **🎯 Własne prompty**: Spersonalizowane prompty systemowe dla różnych typów postaci
- **🔄 Przywracanie domyślnych**: Przywracanie domyślnych promptów i ustawień jednym kliknięciem

### 💬 Interfejs czatu
- **⚡ Rozmowy w czasie rzeczywistym**: Naturalny dialog z postaciami CK3
- **👤 Profile postaci**: Szczegółowe informacje o każdej postaci
- **🔖 System zakładek**: Zapisywanie i organizowanie ważnych rozmów
- **📤 Funkcja eksportu**: Eksportowanie rozmów do plików tekstowych

### 📋 Menedżer podsumowań
- **🤖 Automatyczne podsumowania**: Generowane przez AI podsumowania ważnych wydarzeń
- **🔖 Integracja zakładek**: Konwersja zakładek na podsumowania
- **🔍 Funkcja wyszukiwania**: Znajdowanie konkretnych rozmów i podsumowań
- **📤 Opcje eksportu**: Zapisywanie podsumowań w różnych formatach

## Szczegóły interfejsu konfiguracji

Aplikacja oferuje sześć głównych stron konfiguracji, z których każda odpowiada za inne ustawienia funkcjonalne:

### 1. Strona połączenia

Strona połączenia służy do konfiguracji połączenia z API modelu językowego oraz ustawień ścieżki gry.

- **Konfiguracja połączenia API**:
  - Wybór dostawcy API generowania tekstu (np. OpenAI, Kobold itp.)
  - Konfiguracja klucza API, adresu URL punktu końcowego i nazwy modelu

- **Ścieżka folderu użytkownika CK3**:
  - Ustawienie ścieżki folderu CK3, w którym przechowywane są dane użytkownika
  - Domyślna ścieżka: `Dokumenty/Paradox Interactive/Crusader Kings III`
  - Możesz przeglądać i wybrać poprawną ścieżkę za pomocą przycisku „Wybierz folder”

### 2. Strona akcji

Strona akcji służy do konfiguracji wykrywalnych akcji w grze i odpowiadających im odpowiedzi AI.

- **Włącz akcje**:
  - Główny przełącznik kontrolujący, czy wykrywanie akcji jest włączone
  - Włącz narrację AI: Generowanie opisów narracyjnych AI po wyzwoleniu akcji

- **Konfiguracja API**:
  - Wybór użycia tych samych ustawień API co na stronie połączenia
  - Lub konfiguracja oddzielnego API dla funkcji akcji

- **Ustawienia parametrów**:
  - Temperatura: Kontroluje kreatywność odpowiedzi AI (domyślnie 0.2, niższe wartości sprawiają, że odpowiedzi są bardziej deterministyczne)
  - Kara za częstotliwość: Zmniejsza generowanie powtarzających się treści
  - Kara za obecność: Zachęca do rozmawiania na nowe tematy
  - Top P: Kontroluje różnorodność wyboru słownictwa

- **Wybór akcji**:
  - Wybór typów akcji, które mod ma wykrywać z listy
  - Każda akcja posiada opis i informacje o twórcy
  - Odświeżanie listy akcji za pomocą przycisku „Przeładuj pliki”
  - Dostęp do własnych skryptów akcji za pomocą przycisku „Otwórz folder”

### 3. Strona podsumowania

Strona podsumowania służy do konfiguracji ustawień API dla funkcji podsumowania rozmowy.

- **Konfiguracja API**:
  - Wybór użycia tych samych ustawień API co na stronie połączenia
  - Lub konfiguracja oddzielnego API dla funkcji podsumowania

- **Ustawienia parametrów**:
  - Temperatura: Kontroluje kreatywność podsumowań (domyślnie 0.2)
  - Kara za częstotliwość: Zmniejsza powtarzające się treści w podsumowaniach
  - Kara za obecność: Zachęca do dołączania nowych informacji
  - Top P: Kontroluje różnorodność wyboru słownictwa

Funkcja podsumowania służy do kompresji długich rozmów w krótkie podsumowania, co pomaga utrzymać kontekst rozmowy w granicach limitów tokenów i generować podsumowania po rozmowach do wykorzystania w przyszłości.

### 4. Strona promptów

Strona promptów służy do konfiguracji różnych promptów i skryptów do interakcji z AI.

- **Główne prompty**:
  - Prompt główny: Podstawowe instrukcje kontrolujące sposób odpowiadania AI
  - Prompt monologu: Reguły generowania wewnętrznych monologów postaci
  - Prompt podsumowania: Instrukcje do generowania podsumowań rozmów
  - Prompt podsumowania monologu: Reguły podsumowania dla wewnętrznych monologów postaci
  - Prompt wspomnień: Jak postacie pamiętają i odnoszą się do przeszłych wydarzeń
  - Prompt sufiksu: Ostatnia wiadomość systemowa wstawiana przed żądaniem API, używana do kierowania modelem w zakresie formatowania odpowiedzi
  - Prompt narracji: Reguły generowania opisów narracyjnych AI po wyzwoleniu akcji

- **Wybór skryptu**:
  - Skrypt opisu postaci: Skrypt do dynamicznego generowania opisów postaci
  - Skrypt przykładowych wiadomości: Skrypt do generowania przykładowych wiadomości w rozmowie
  - Playbook: Specyficzne pliki playbooków do importu, zawierające wizje świata i ustawienia postaci

Każdy skrypt posiada wersję standardową i własną, wybieraną z menu rozwijanego i dostępną za pomocą przycisku „Otwórz folder”.

### 5. Strona ustawień

Strona ustawień zawiera różne konfiguracje zachowania i parametrów generowania dla aplikacji.

- **Ustawienia podstawowe**:
  - Maks. nowych tokenów: Ogranicza maksymalną długość pojedynczej odpowiedzi AI
  - Maks. tokenów pamięci: Ogranicza maksymalną długość wspomnień postaci
  - Strumieniowanie wiadomości: Włącz/wyłącz odpowiedzi strumieniowe (wyświetlanie generowania AI w czasie rzeczywistym)
  - Oczyszczanie wiadomości: Próba usunięcia niepożądanych treści z generacji AI (np. emoji)
  - Mieszaj kolejność postaci: Losuje kolejność mówienia postaci w rozmowach wieloosobowych
  - Dynamiczny wybór postaci: Używa LLM do analizy rozmowy i wyboru kolejnej postaci do wypowiedzi
  - Waliduj tożsamość postaci: Sprawdza, czy wygenerowane wiadomości pasują do tożsamości postaci, zapobiegając generowaniu odpowiedzi innych postaci przez LLM
  - Pokaż przycisk sugestii: Pokaż/ukryj funkcję rekomendowanych wypowiedzi w oknie czatu

- **Ustawienia głębokości wstawiania**:
  - Głębokość wstawiania podsumowania: Kontroluje pozycję wstawiania podsumowań w historii rozmowy
  - Głębokość wstawiania pamięci: Kontroluje pozycję wstawiania wspomnień postaci w historii rozmowy
  - Głębokość wstawiania opisu postaci: Kontroluje pozycję wstawiania opisów postaci w historii rozmowy

- **Ustawienia instrukcji**:
  - Sekwencja wejściowa: Specjalne znaczniki dla wejścia użytkownika
  - Sekwencja wyjściowa: Specjalne znaczniki dla wyjścia AI

- **Parametry generowania tekstu**:
  - Temperatura: Kontroluje kreatywność odpowiedzi AI (domyślnie 0.8)
  - Kara za częstotliwość: Zmniejsza generowanie powtarzające się treści
  - Kara za obecność: Zachęca do rozmawiania na nowe tematy
  - Top P: Kontroluje różnorodność wyboru słownictwa (domyślnie 0.9)

### 6. Strona systemowa

Strona systemowa zapewnia funkcje konserwacji aplikacji i linki społecznościowe.

- **Funkcje aktualizacji**:
  - Wyświetlanie aktualnej wersji aplikacji
  - Przycisk „Sprawdź aktualizacje”: Ręczne sprawdzanie nowych wersji
  - Sprawdzaj aktualizacje przy starcie: Automatyczne sprawdzanie aktualizacji po uruchomieniu aplikacji

- **Pliki logów**:
  - Jeśli napotkasz błędy/awarie, możesz przeglądać pliki logów
  - Przycisk „Otwórz folder logów”: Bezpośredni dostęp do plików logów

- **Zarządzanie podsumowaniami rozmów**:
  - Przycisk „Wyczyść podsumowania”: Usuwanie poprzednich podsumowań rozmów dla wszystkich postaci
  - Przycisk „Otwórz folder podsumowań rozmów”: Dostęp do przechowywanych podsumowań rozmów

## Funkcje interfejsu czatu

Interfejs czatu jest głównym interfejsem do interakcji z postaciami z gry i obejmuje następujące funkcje:

- **Wyświetlanie wiadomości**:
  - Wiadomości gracza i postaci AI są wyświetlane w różnych stylach
  - Obsługuje podstawowe formatowanie Markdown (pogrubienie, kursywa)
  - Wiadomości narracyjne są wyświetlane w specjalnym stylu, zapewniając opisy scen

- **Funkcje wejściowe**:
  - Pole wprowadzania tekstu: Wprowadzanie treści dialogu z postaciami
  - Klawisz Enter do wysyłania wiadomości
  - Obsługa wprowadzania wieloliniowego

- **Funkcje sugestii** (konfigurowalne):
  - Przycisk sugestii: Wyświetla rekomendowane wypowiedzi
  - Lista sugestii: Kliknięcie elementu sugestii automatycznie wypełnia pole wejściowe
  - Przycisk zamknij: Ukrywa panel sugestii

- **Kontrola rozmowy**:
  - Przycisk „Zakończ rozmowę”: Wyjście z bieżącego dialogu

- **Wskaźniki statusu**:
  - Kręcące się kropki: Pokazuje, że AI generuje odpowiedź
  - Komunikaty o błędach: Wyświetla błędy połączenia lub generowania

## Funkcje menedżera podsumowań

Menedżer podsumowań to interfejs do zarządzania i edycji podsumowań rozmów postaci z gry, oferujący następujące funkcje:

### Górne przyciski sterujące

- **Przycisk odśwież**: Ponownie ładuje wszystkie dane podsumowań, w tym parowanie ID gracza z logów gry i odczytywanie plików podsumowań
- **Przycisk zapisz**: Zapisuje wszystkie bieżące zmiany podsumowań do pliku
- **Przycisk zamknij**: Zamyka okno menedżera podsumowań

### Panel informacyjny

- **ID Gracza**: Wyświetla aktualne ID gracza sparsowane z logów gry (tylko do odczytu)
- **Wybierz postać**: Menu rozwijane do filtrowania podsumowań dla konkretnej postaci lub wyświetlania wszystkich
- **Ścieżka pliku podsumowania**: Wyświetla ścieżkę przechowywania aktualnego pliku podsumowania (tylko do odczytu)

### Obszar listy podsumowań

- **Lista podsumowań**: Wyświetla wszystkie podsumowania pod aktualnymi filtrami, każde zawierające datę, postać i treść
- **Przycisk „Dodaj nowe podsumowanie”**: Tworzy nowe puste podsumowanie na górze listy, domyślnie dla wybranej postaci

### Obszar edytora

- **Pole wprowadzania daty**: Edycja daty aktualnie wybranego podsumowania
- **Pole tekstowe treści**: Edycja szczegółowej treści aktualnie wybranego podsumowania
- **Przycisk „Aktualizuj podsumowanie”**: Zapisuje zmiany w aktualnie wybranym podsumowaniu
- **Przycisk „Usuń podsumowanie”**: Usuwa aktualnie wybrane podsumowanie (wymaga potwierdzenia)
- **Przycisk „Nowe podsumowanie”**: Czyści edytor, przygotowując do utworzenia nowego podsumowania

### Instrukcja użytkowania

1. Kliknij podsumowanie na liście, aby je wybrać i załadować do edytora
2. Użyj filtra postaci, aby wyświetlić podsumowania dla konkretnej postaci lub wszystkich postaci
3. Wszystkie zmiany muszą zostać zapisane przez kliknięcie przycisku „Zapisz”, aby zostały zapisane do pliku
4. Usuwania nie można cofnąć, proszę używać z ostrożnością

## 🚀 Konfiguracja lokalna

### 📥 Instalacja
1. Pobierz najnowszą wersję moda VOTC
2. Rozpakuj do folderu modów CK3
3. Uruchom CK3 i włącz mod w launcherze
4. Uruchom aplikację VOTC

### ⚙️ Konfiguracja
1. Uruchom aplikację
2. Przejdź do interfejsu konfiguracji
3. Wprowadź klucz API swojej usługi AI
4. Dostosuj ustawienia do swoich preferencji
5. Kliknij „Zapisz konfigurację”, aby zastosować zmiany

### 🔄 Przywracanie ustawień domyślnych
- Użyj przycisku „Przywróć domyślne prompty”, aby przywrócić wszystkie domyślne ustawienia promptów jednym kliknięciem
- Poszczególne elementy konfiguracji można zresetować w interfejsie konfiguracji

## 🛠️ Rozwiązywanie problemów

### 🔧 Typowe problemy

#### 1. **Aplikacja nie uruchamia się**
   - Upewnij się, że wszystkie zależności są zainstalowane: uruchom `npm install`
   - Sprawdź, czy wersja Node.js jest kompatybilna
   - Zweryfikuj, czy ścieżka do plików gry jest poprawna

#### 2. **Problemy z połączeniem AI**
   - Sprawdź, czy klucz API został wprowadzony poprawnie
   - Zweryfikuj, czy połączenie sieciowe jest normalne
   - Potwierdź status API dostawcy AI

#### 3. **Probleme z integracją z grą**
   - Upewnij się, że gra CK3 jest uruchomiona
   - Sprawdź, czy mod jest poprawnie zainstalowany
   - Zweryfikuj konfigurację ścieżki plików gry

#### 4. **Problemy z wydajnością**
   - Zmniejsz rozmiar okna kontekstowego
   - Ogranicz liczbę rekordów historii rozmów
   - Zamknij niepotrzebne programy działające w tle

#### 5. **Przywracanie ustawień domyślnych**
   - Użyj przycisku „Przywróć domyślne prompty” w interfejsie konfiguracji
   - Ponownie skonfiguruj ustawienia API i parametry modelu
   - Sprawdź, czy pliki konfiguracyjne zostały poprawnie zapisane

## 🤝 Wkład

Wkład w projekt jest mile widziany poprzez:
- Zgłaszanie błędów i sugerowanie nowych funkcji

### 📝 Wytyczne dotyczące wkładu
1. Sforkuj to repozytorium
2. Utwórz gałąź funkcji (`git checkout -b feature/AmazingFeature`)
3. Zatwierdź zmiany (`git commit -m 'Add some AmazingFeature'`)
4. Wypchnij do gałęzi (`git push origin feature/AmazingFeature`)
5. Otwórz Pull Request

### 📄 Licencja

Ten projekt jest licencjonowany na podstawie [licencji GPL-3.0](LICENSE) – szczegóły znajdują się w pliku [LICENSE](LICENSE)

### 🛠️ Konfiguracja deweloperska

1. Sklonuj repozytorium
2. Zainstaluj zależności za pomocą `npm i`
3. Uruchom tryb deweloperski za pomocą `npm run start`
4. Zbuduj aplikację za pomocą `npm run make`

Poprawka dla problemów z wersją Electron:
 ```
 npx electron-rebuild
 ```

## Licencja i Atrybucja

### Informacje o Modzie
- **Nazwa Moda**: Voices of the Court - Community Edition (VOTC-CE)
- **Licencja**: GNU General Public License v3.0 (GPLv3)
- **Wspierana wersja CK3**: 1.18 "Crane"

### Podziękowania i Atrybucja
Ten projekt jest dziełem pochodnym opartym na VOTC / AliChat. Chcielibyśmy serdecznie podziękować deweloperom, którzy utrzymali ten projekt przy życiu i przesunęli granice AI w Crusader Kings III:

**Oryginalni Twórcy**: Zespół VOTC i współtwórcy społeczności. Podziękowania dla Durond i MrAndroPC.

**Ciągły Rozwój**: Specjalne podziękowania dla chińskiej społeczności deweloperów, w tym Lisiyuan233, zhaowendao2005 i innych, którzy dostarczyli kluczowe aktualizacje i wsparcie.

**Wsparcie Społeczności**: Dziękujemy szerszej społeczności za ich spostrzeżenia, opinie i historyczny kontekst dotyczący projektu.

**Opiekunowie Edycji Społecznościowej**: Zespół VOTC-CE i współtwórcy.

### Informacje o Licencji
Część oryginalnego materiału źródłowego tego moda została wydana na licencji Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0).

Zgodnie z sekcją 4(b) licencji CC BY-SA 4.0, to dzieło pochodne jest licencjonowane na podstawie licencji kompatybilnej z BY-SA: GNU General Public License v3.0 (GPLv3).

- **Oryginalna Licencja**: CC BY-SA 4.0
- **Obecna Licencja**: GPLv3

### Nota GPLv3
Ten program jest wolnym oprogramowaniem: możesz go redystrybuować i/lub modyfikować na warunkach Powszechnej Licencji Publicznej GNU opublikowanej przez Free Software Foundation, w wersji 3 tej Licencji lub (według Twojego wyboru) dowolnej późniejszej wersji.

Ten program jest rozpowszechniany w nadziei, że będzie użyteczny, ale BEZ ŻADNEJ GWARANCJI; nawet bez domniemanej gwarancji PRZYDATNOŚCI HANDLOWEJ lub PRZYDATNOŚCI DO OKREŚLONEGO CELU. Zobacz Powszechną Licencję Publiczną GNU, aby uzyskać więcej szczegółów.

Powinieneś otrzymać kopię Powszechnej Licencji Publicznej GNU wraz z tym programem. Jeśli nie, zobacz <https://www.gnu.org/licenses/>.

