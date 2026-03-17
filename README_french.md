# Voices of the Court 2.0 - Community Edition (VOTC-CE)

Un compagnon alimenté par l'IA pour Crusader Kings III qui vous aide à suivre les personnages, les complots et les intrigues. Voices of the Court 2.0 - Community Edition intègre des modèles de langage (LLM) dans le jeu, vous permettant de tenir des conversations naturelles avec les personnages et d'influencer dynamiquement l'état du jeu.

Documentation : https://docs.voicesofthecourt.app

[Page Steam](https://steamcommunity.com/sharedfiles/filedetails/?id=3654567139)

Rejoignez notre Discord :

[![Serveur Discord](https://discord.com/api/guilds/1066522056243564585/widget.png?style=banner2)](https://discord.gg/UQpE4mJSqZ)

# Vidéo de présentation
[![lien vers](https://img.youtube.com/vi/E2GmlNsK-J8/0.jpg)](https://www.youtube.com/watch?v=E2GmlNsK-J8)

# Vidéo de gameplay par DaFloove
[![lien vers](https://img.youtube.com/vi/3lhHkXPmis0/0.jpg)](https://www.youtube.com/watch?v=3lhHkXPmis0)

### 🌟 Fonctionnalités

### 🎮 Interface de Configuration
- **🤖 Modèles d'IA multiples** : Prise en charge des modèles OpenAI GPT, Anthropic Claude, Player2 et des modèles locaux.
- **🧠 Mémoire des personnages** : Système de mémoire persistante qui suit les relations et l'histoire des personnages.
- **📚 Gestion du contexte** : Fenêtre de contexte et paramètres de l'historique des conversations ajustables.
- **🎯 Prompts personnalisés** : Instructions système personnalisées pour différents types de personnages.
- **🔄 Restaurer les paramètres par défaut** : Restauration en un clic des prompts et paramètres par défaut.

### 💬 Interface de Chat
- **⚡ Conversations en temps réel** : Dialogue naturel avec les personnages de CK3.
- **👤 Profils de personnages** : Informations détaillées sur chaque personnage.
- **🔖 Système de favoris** : Enregistrez et organisez les conversations importantes.
- **📤 Fonctionnalité d'exportation** : Exportez les conversations vers des fichiers texte.

### 📋 Gestionnaire de Résumés
- **🤖 Résumés automatiques** : Résumés générés par l'IA des événements importants.
- **🔖 Intégration des favoris** : Convertissez les favoris en résumés.
- **🔍 Fonctionnalité de recherche** : Trouvez des conversations et des résumés spécifiques.
- **📤 Options d'exportation** : Enregistrez les résumés dans divers formats.

## Détails de l'Interface de Configuration

L'application propose six pages de configuration principales :

### 1. Page de Connexion
Utilisée pour configurer la connexion à l'API du modèle de langage et les paramètres du chemin du jeu.
- Configuration de la connexion API (Clé, URL, Modèle).
- Chemin du dossier utilisateur CK3 (Documents/Paradox Interactive/Crusader Kings III).

### 2. Page des Actions
Configure les actions détectables dans le jeu et les réponses de l'IA correspondantes.
- Activation des actions et de la narration IA.
- Paramètres de génération (Température, Pénalité de fréquence, etc.).
- Sélection des actions à détecter.

### 3. Page de Résumé
Configure les paramètres de l'API pour la fonction de résumé des conversations.
- Permet d'utiliser une API distincte ou identique à la connexion principale.
- Gère la compression des conversations pour respecter les limites de tokens.

### 4. Page des Prompts
Configure les instructions (prompts) et les scripts pour l'interaction avec l'IA.
- Prompts principaux, de monologue interne, de mémoire et de narration.
- Sélection de scripts pour les descriptions de personnages et les messages d'exemple.

### 5. Page des Paramètres
Configurations diverses sur le comportement et la génération.
- Limites de tokens (Max New Tokens, Max Memory Tokens).
- Options de streaming, nettoyage des messages et validation de l'identité des personnages.
- Paramètres de profondeur d'insertion pour les résumés et la mémoire.

### 6. Page Système
Maintenance de l'application et liens communautaires.
- Mises à jour du logiciel.
- Accès aux fichiers de logs.
- Gestion et suppression des résumés de conversation.

## 🚀 Installation Locale

### 📥 Installation

**Windows**
1. Téléchargez le programme d'installation `.exe` depuis la dernière version.
2. Exécutez le programme d'installation et suivez les instructions à l'écran.
3. Lancez l'application VOTC-CE.

**macOS**
1. Téléchargez le fichier `.zip` ou `.dmg` depuis la dernière version.
2. Si vous avez téléchargé le `.dmg`, ouvrez-le et faites glisser l'icône de l'application dans votre dossier `/Applications`.
3. Si vous avez téléchargé le `.zip`, décompressez-le et faites glisser l'icône de l'application dans votre dossier `/Applications`.
4. **Première étape importante**: Pour exécuter l'application, vous devez contourner la sécurité Gatekeeper d'Apple. Faites un clic droit (ou Ctrl-clic) sur l'icône de l'application et sélectionnez **Ouvrir** dans le menu.
5. Une boîte de dialogue d'avertissement apparaîtra. Cliquez sur le bouton **Ouvrir** pour confirmer. Vous ne devez effectuer cette opération que la première fois que vous lancez l'application.

**Configuration du mod CK3**
1. Téléchargez la dernière version des fichiers du mod VOTC-CE (généralement un fichier `.zip`) depuis la page des versions.
2. Extrayez le contenu dans votre dossier de mods CK3 (généralement situé dans `Documents/Paradox Interactive/Crusader Kings III/mod`).
3. Lancez Crusader Kings III et activez le mod "Voices of the Court" dans le lanceur.

### 🛠️ Configuration pour le Développement Local
1. Clonez le dépôt.
2. Installez les dépendances avec `npm i`.
3. Lancez le mode dev avec `npm run start`.
4. Compilez l'application avec `npm run make`.

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

