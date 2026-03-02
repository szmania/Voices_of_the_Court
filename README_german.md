# Voices of the Court (VOTC)

Ein KI-gestützter Begleiter für Crusader Kings III, der Ihnen hilft, Charaktere, Pläne und Handlungsstränge im Auge zu behalten. Voices of the Court integriert große Sprachmodelle in das Spiel, sodass Sie natürliche Gespräche mit Charakteren führen und den Spielzustand dynamisch beeinflussen können.

Dokumentation: https://docs.voicesofthecourt.app

[Steam-Seite](https://steamcommunity.com/sharedfiles/filedetails/?id=3654567139)

Tritt unserem Discord bei:

[![Discord Server](https://discord.com/api/guilds/1066522056243564585/widget.png?style=banner2)](https://discord.gg/UQpE4mJSqZ)

# Trailer-Video
[![link to](https://img.youtube.com/vi/E2GmlNsK-J8/0.jpg)](https://www.youtube.com/watch?v=E2GmlNsK-J8)

# Gameplay-Video von DaFloove
[![link to](https://img.youtube.com/vi/3lhHkXPmis0/0.jpg)](https://www.youtube.com/watch?v=3lhHkXPmis0)

### 🌟 Funktionen

### 🎮 Konfigurationsoberfläche
- **🤖 Mehrere KI-Modelle**: Unterstützung für OpenAI GPT-Modelle, Anthropic Claude, Player2 und lokale Modelle
- **🧠 Charaktergedächtnis**: Persistentes Gedächtnissystem, das Charakterbeziehungen und -verläufe verfolgt
- **📚 Kontextverwaltung**: Anpassbares Kontextfenster und Einstellungen für den Gesprächsverlauf
- **🎯 Benutzerdefinierte Prompts**: Personalisierte System-Prompts für verschiedene Charaktertypen
- **🔄 Standardwerte wiederherstellen**: Ein-Klick-Wiederherstellung der Standard-Prompts und -Einstellungen

### 💬 Chat-Oberfläche
- **⚡ Echtzeit-Gespräche**: Natürlicher Dialog mit CK3-Charakteren
- **👤 Charakterprofile**: Detaillierte Informationen zu jedem Charakter
- **🔖 Lesezeichensystem**: Wichtige Gespräche speichern und organisieren
- **📤 Exportfunktion**: Gespräche in Textdateien exportieren

### 📋 Zusammenfassungs-Manager
- **🤖 Automatische Zusammenfassungen**: KI-generierte Zusammenfassungen wichtiger Ereignisse
- **🔖 Lesezeichen-Integration**: Lesezeichen in Zusammenfassungen umwandeln
- **🔍 Suchfunktion**: Bestimmte Gespräche und Zusammenfassungen finden
- **📤 Exportoptionen**: Zusammenfassungen in verschiedenen Formaten speichern

## Details zur Konfigurationsoberfläche

Die Anwendung bietet sechs Hauptkonfigurationsseiten, die jeweils für unterschiedliche Funktionseinstellungen zuständig sind:

### 1. Verbindungsseite

Die Verbindungsseite wird verwendet, um die Verbindung zur Sprachmodell-API und die Spielpfadeinstellungen zu konfigurieren.

- **API-Verbindungskonfiguration**:
  - Textgenerierungs-API-Anbieter auswählen (z. B. OpenAI, Kobold usw.)
  - API-Schlüssel, Endpunkt-URL und Modellname konfigurieren

- **CK3-Benutzerordnerpfad**:
  - Den CK3-Ordnerpfad festlegen, in dem Benutzerdaten gespeichert sind
  - Standardpfad: `User Documents/Paradox Interactive/Crusader Kings III`
  - Sie können den korrekten Pfad über die Schaltfläche "Ordner auswählen" suchen und auswählen

### 2. Aktionsseite

Die Aktionsseite wird verwendet, um erkennbare Aktionen im Spiel und entsprechende KI-Antworten zu konfigurieren.

- **Aktionen aktivieren**:
  - Hauptschalter zur Steuerung, ob die Aktionserkennung aktiviert ist
  - KI-Erzählung aktivieren: KI-Erzählbeschreibungen generieren, nachdem eine Aktion ausgelöst wurde

- **API-Konfiguration**:
  - Wählen Sie, ob dieselben API-Einstellungen wie auf der Verbindungsseite verwendet werden sollen
  - Oder konfigurieren Sie eine separate API für Aktionsfunktionen

- **Parametereinstellungen**:
  - Temperatur: Steuert die Kreativität der KI-Antworten (Standard 0,2; niedrigere Werte machen Antworten deterministischer)
  - Frequenzstrafe: Reduziert die Generierung sich wiederholender Inhalte
  - Präsenzstrafe: Ermutigt dazu, über neue Themen zu sprechen
  - Top P: Steuert die Vielfalt der Wortschatzauswahl

- **Aktionsauswahl**:
  - Wählen Sie aus der Liste die Arten von Aktionen aus, die der Mod erkennen soll
  - Jede Aktion hat eine Beschreibung und Erstellerinformationen
  - Aktionsliste über die Schaltfläche "Dateien neu laden" aktualisieren
  - Zugriff auf benutzerdefinierte Aktionsskripte über die Schaltfläche "Ordner öffnen"

### 3. Zusammenfassungsseite

Die Zusammenfassungsseite wird verwendet, um API-Einstellungen für die Gesprächszusammenfassungsfunktion zu konfigurieren.

- **API-Konfiguration**:
  - Wählen Sie, ob dieselben API-Einstellungen wie auf der Verbindungsseite verwendet werden sollen
  - Oder konfigurieren Sie eine separate API für Zusammenfassungsfunktionen

- **Parametereinstellungen**:
  - Temperatur: Steuert die Kreativität der Zusammenfassungen (Standard 0,2)
  - Frequenzstrafe: Reduziert sich wiederholende Inhalte in Zusammenfassungen
  - Präsenzstrafe: Ermutigt zur Aufnahme neuer Informationen
  - Top P: Steuert die Vielfalt der Wortschatzauswahl

Die Zusammenfassungsfunktion wird verwendet, um lange Gespräche in kurze Zusammenfassungen zu komprimieren. Dies hilft, den Gesprächskontext innerhalb der Token-Limits zu halten und Zusammenfassungen für zukünftige Gespräche nach Ende des Dialogs zu generieren.

### 4. Prompt-Seite

Die Prompt-Seite wird verwendet, um verschiedene Prompts und Skripte für die Interaktion mit der KI zu konfigurieren.

- **Haupt-Prompts**:
  - Haupt-Prompt: Grundlegende Anweisungen, die steuern, wie die KI antwortet
  - Selbstgespräch-Prompt: Generierungsregeln für innere Monologe der Charaktere
  - Zusammenfassungs-Prompt: Anweisungen zum Generieren von Gesprächszusammenfassungen
  - Selbstgespräch-Zusammenfassungs-Prompt: Zusammenfassungsregeln für innere Monologe der Charaktere
  - Erinnerungs-Prompt: Wie Charaktere sich an vergangene Ereignisse erinnern und darauf Bezug nehmen
  - Suffix-Prompt: Die letzte Systemnachricht, die vor der API-Anfrage eingefügt wird, um die Formatierung der Modellantwort zu steuern
  - Erzähl-Prompt: Regeln zum Generieren von KI-Erzählbeschreibungen, nachdem eine Aktion ausgelöst wurde

- **Skriptauswahl**:
  - Charakterbeschreibungs-Skript: Skript zur dynamischen Generierung von Charakterbeschreibungen
  - Beispielnachrichten-Skript: Skript zum Generieren von Beispiel-Gesprächsnachrichten
  - Playbook: Spezifische Playbook-Dateien zum Importieren, die Weltanschauungen und Charaktereinstellungen enthalten

Jedes Skript hat Standard- und benutzerdefinierte Versionen, die über Dropdown-Menüs ausgewählt werden können und über die Schaltfläche "Ordner öffnen" zugänglich sind.

### 5. Einstellungsseite

Die Einstellungsseite enthält verschiedene Verhaltens- und Generierungsparameterkonfigurationen für die Anwendung.

- **Grundeinstellungen**:
  - Max. neue Tokens: Begrenzt die maximale Länge einer einzelnen KI-Antwort
  - Max. Speicher-Tokens: Begrenzt die maximale Länge der Charaktererinnerungen
  - Nachrichten streamen: Aktiviert/deaktiviert Streaming-Antworten (Echtzeitanzeige der KI-Generierung)
  - Nachrichten bereinigen: Versucht, unerwünschte Inhalte aus der KI-Generierung zu entfernen (z. B. Emojis)
  - Charakterreihenfolge mischen: Randomisiert die Sprechreihenfolge der Charaktere in Gesprächen mit mehreren Personen
  - Dynamische Charakterauswahl: Verwendet die KI, um das Gespräch zu analysieren und den nächsten Charakter auszuwählen, der antwortet
  - Charakteridentität validieren: Überprüft, ob generierte Nachrichten zur Charakteridentität passen, um zu verhindern, dass die KI Antworten anderer Charaktere generiert
  - Vorschlags-Schaltfläche anzeigen: Zeigt/verbirgt die Funktion für empfohlene Eingabeanweisungen im Chat-Fenster

- **Einfügetiefen-Einstellungen**:
  - Zusammenfassungs-Einfügetiefe: Steuert die Einfügeposition von Zusammenfassungen im Gesprächsverlauf
  - Erinnerungs-Einfügetiefe: Steuert die Einfügeposition von Charaktererinnerungen im Gesprächsverlauf
  - Charakterbeschreibungs-Einfügetiefe: Steuert die Einfügeposition von Charakterbeschreibungen im Gesprächsverlauf

- **Anweisungseinstellungen**:
  - Eingabesequenz: Spezielle Markierungen für Benutzereingaben
  - Ausgabesequenz: Spezielle Markierungen für KI-Ausgaben

- **Textgenerierungsparameter**:
  - Temperatur: Steuert die Kreativität der KI-Antworten (Standard 0,8)
  - Frequenzstrafe: Reduziert die Generierung sich wiederholender Inhalte
  - Präsenzstrafe: Ermutigt dazu, über neue Themen zu sprechen
  - Top P: Steuert die Vielfalt der Wortschatzauswahl (Standard 0,9)

### 6. Systemseite

Die Systemseite bietet Anwendungswartung und Community-Link-Funktionen.

- **Update-Funktionen**:
  - Aktuelle Anwendungsversion anzeigen
  - Auf Updates prüfen-Schaltfläche: Manuell auf neue Versionen prüfen
  - Beim Start auf Updates prüfen: Automatisch auf Updates prüfen, wenn die App startet

- **Log-Dateien**:
  - Falls Fehler oder Abstürze auftreten, können Sie Log-Dateien ansehen
  - Log-Ordner öffnen-Schaltfläche: Direkter Zugriff auf Log-Dateien

- **Gesprächszusammenfassungsverwaltung**:
  - Zusammenfassungen löschen-Schaltfläche: Frühere Gesprächszusammenfassungen für alle Charaktere löschen
  - Ordner für Gesprächszusammenfassungen öffnen-Schaltfläche: Zugriff auf gespeicherte Gesprächszusammenfassungen

## Chat-Schnittstellenfunktionen

Die Chat-Schnittstelle ist die Hauptschnittstelle für die Interaktion mit Spielcharakteren und umfasst die folgenden Funktionen:

- **Nachrichtenanzeige**:
  - Nachrichten von Spielern und KI-Charakteren werden in unterschiedlichen Stilen angezeigt
  - Unterstützt grundlegende Markdown-Formatierung (fett, kursiv)
  - Erzählnachrichten werden in einem speziellen Stil angezeigt und liefern Szenenbeschreibungen

- **Eingabefunktionen**:
  - Texteingabefeld: Dialoginhalt mit Charakteren eingeben
  - Enter-Taste zum Senden von Nachrichten
  - Unterstützt mehrzeilige Eingaben

- **Vorschlagsfunktionen** (konfigurierbar):
  - Vorschlags-Schaltfläche: Zeigt empfohlene Eingabeanweisungen an
  - Vorschlagsliste: Klicken Sie auf einen Vorschlag, um das Eingabefeld automatisch auszufüllen
  - Schließen-Schaltfläche: Verbirgt das Vorschlags-Panel

- **Gesprächssteuerung**:
  - Gespräch beenden-Schaltfläche: Aktuellen Dialog verlassen

- **Statusanzeigen**:
  - Ladeanzeige: Zeigt an, dass die KI eine Antwort generiert
  - Fehlermeldungen: Zeigt Verbindungs- oder Generierungsfehler an

## Funktionen des Zusammenfassungs-Managers

Der Zusammenfassungs-Manager ist eine Schnittstelle zum Verwalten und Bearbeiten von Gesprächszusammenfassungen der Spielcharaktere und bietet die folgenden Funktionen:

### Obere Steuerungsschaltflächen

- **Aktualisieren-Schaltfläche**: Lädt alle Zusammenfassungsdaten neu, einschließlich des Parsens der Spieler-ID aus den Spiel-Logs und des Lesens der Zusammenfassungsdateien
- **Speichern-Schaltfläche**: Speichert alle aktuellen Zusammenfassungsänderungen in der Datei
- **Schließen-Schaltfläche**: Schließt das Fenster des Zusammenfassungs-Managers

### Informations-Panel

- **Spieler-ID**: Zeigt die aktuelle Spieler-ID an, die aus den Spiel-Logs geparst wurde (schreibgeschützt)
- **Charakter auswählen**: Dropdown-Menü zum Filtern von Zusammenfassungen für einen bestimmten Charakter oder zum Anzeigen aller
- **Pfad zur Zusammenfassungsdatei**: Zeigt den Speicherpfad der aktuellen Zusammenfassungsdatei an (schreibgeschützt)

### Zusammenfassungslistenbereich

- **Zusammenfassungsliste**: Zeigt alle Zusammenfassungen unter den aktuellen Filtern an, jeweils mit Datum, Charakter und Inhalt
- **Neue Zusammenfassung hinzufügen-Schaltfläche**: Erstellt eine neue leere Zusammenfassung am Anfang der Liste, standardmäßig für den ausgewählten Charakter

### Editor-Bereich

- **Datumseingabefeld**: Bearbeiten Sie das Datum der aktuell ausgewählten Zusammenfassung
- **Inhaltstextfeld**: Bearbeiten Sie den detaillierten Inhalt der aktuell ausgewählten Zusammenfassung
- **Zusammenfassung aktualisieren-Schaltfläche**: Speichert Änderungen an der aktuell ausgewählten Zusammenfassung
- **Zusammenfassung löschen-Schaltfläche**: Löscht die aktuell ausgewählte Zusammenfassung (erfordert Bestätigung)
- **Neue Zusammenfassung-Schaltfläche**: Leert den Editor und bereitet eine neue Zusammenfassung vor

### Nutzungshinweise

1. Klicken Sie auf eine Zusammenfassung in der Liste, um sie auszuwählen und in den Editor zu laden
2. Verwenden Sie den Charakterfilter, um Zusammenfassungen für einen bestimmten Charakter oder alle Charaktere anzuzeigen
3. Alle Änderungen müssen durch Klicken auf die Schaltfläche "Speichern" gespeichert werden, um in die Datei geschrieben zu werden
4. Das Löschen kann nicht rückgängig gemacht werden, bitte mit Vorsicht verwenden

## 🚀 Lokale Einrichtung

### 📥 Installation
1. Laden Sie die neueste Version des VOTC-Mods herunter
2. In Ihren CK3-Mod-Ordner entpacken
3. CK3 starten und den Mod im Launcher aktivieren
4. Die VOTC-Anwendung ausführen

### ⚙️ Konfiguration
1. Die Anwendung starten
2. Zur Konfigurationsoberfläche navigieren
3. Ihren KI-Dienst-API-Schlüssel eingeben
4. Einstellungen nach Ihren Wünschen anpassen
5. Auf "Konfiguration speichern" klicken, um die Änderungen zu übernehmen

### 🔄 Standardeinstellungen wiederherstellen
- Verwenden Sie die Schaltfläche "Standard-Prompts wiederherstellen", um alle Standard-Prompt-Einstellungen mit einem Klick wiederherzustellen
- Einzelne Konfigurationselemente können in der Konfigurationsoberfläche zurückgesetzt werden

## 🛠️ Fehlerbehebung

### 🔧 Häufige Probleme

#### 1. **Anwendung startet nicht**
   - Stellen Sie sicher, dass alle Abhängigkeiten installiert sind: Führen Sie `npm install` aus
   - Prüfen Sie, ob die Node.js-Version kompatibel ist
   - Überprüfen Sie, ob der Spielpfad korrekt ist

#### 2. **KI-Verbindungsprobleme**
   - Prüfen Sie, ob der API-Schlüssel korrekt eingegeben wurde
   - Überprüfen Sie, ob die Netzwerkverbindung normal ist
   - Bestätigen Sie den API-Status des KI-Anbieters

#### 3. **Probleme bei der Spielintegration**
   - Stellen Sie sicher, dass das CK3-Spiel läuft
   - Prüfen Sie, ob der Mod korrekt installiert ist
   - Überprüfen Sie die Konfiguration des Spieldateipfads

#### 4. **Leistungsprobleme**
   - Kontextfenstergröße reduzieren
   - Anzahl der Gesprächsverlaufsdatensätze begrenzen
   - Unnötige Hintergrundprogramme schließen

#### 5. **Standardeinstellungen wiederherstellen**
   - Verwenden Sie die Schaltfläche "Standard-Prompts wiederherstellen" in der Konfigurationsoberfläche
   - API-Einstellungen und Modellparameter neu konfigurieren
   - Prüfen Sie, ob Konfigurationsdateien korrekt gespeichert wurden

## 🤝 Beitrag

Beiträge zum Projekt sind willkommen über:
- Fehlermeldungen und Vorschläge für Funktionsanfragen

### 📝 Beitragsrichtlinien
1. Forken Sie dieses Repository
2. Erstellen Sie Ihren Feature-Branch (`git checkout -b feature/AmazingFeature`)
3. Committen Sie Ihre Änderungen (`git commit -m 'Add some AmazingFeature'`)
4. Pushen Sie den Branch (`git push origin feature/AmazingFeature`)
5. Öffnen Sie einen Pull Request

### 📄 Lizenz

Dieses Projekt ist unter der [GPL-3.0-Lizenz](LICENSE) lizenziert – siehe die [LICENSE](LICENSE)-Datei für Details.

### 🛠️ Lokale Entwicklungseinrichtung

1. Das Repo klonen
2. Abhängigkeiten mit `npm i` installieren
3. Dev-Modus mit `npm run start` starten
4. App mit `npm run make` paketieren

Fix für Electron-Versionsprobleme:
```
npx electron-rebuild
```

Credits & Attribution
This project is a derivative work based on VOTC / AliChat. We would like to extend our deep gratitude to the developers who kept this project alive and pushed the boundaries of AI in Crusader Kings III:

Original Creators and Supporters
The VOTC Team and community contributors for their contributions to the project.

Continued Development
Special thanks to the Chinese development community, including Lisiyuan233, zhaowendao2005, and others who provided critical updates and support.

Community Edition Maintainers
The VOTC-CE team and contributors.

Licensing Information
Some of the original source material for this mod was released under the Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0) license.

In accordance with Section 4(b) of the CC BY-SA 4.0 license, this derivative work is being licensed under a BY-SA Compatible License: the GNU General Public License v3.0 (GPLv3).

For more details on licensing, please see the README files in our repositories: Voices of the Court README and VOTC Mod README.

Original License
GPLv3 and CC BY-SA 4.0

Current License
GPLv3

GPLv3 Notice
This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see https://www.gnu.org/licenses/.
