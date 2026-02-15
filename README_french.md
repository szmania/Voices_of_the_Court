# Voices of the Court (VOTC)

Un compagnon alimenté par l'IA pour Crusader Kings III qui vous aide à suivre les personnages, les complots et les intrigues. Voices of the Court intègre des modèles de langage (LLM) dans le jeu, vous permettant de tenir des conversations naturelles avec les personnages et d'influencer dynamiquement l'état du jeu.

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
1. Téléchargez la dernière version du mod VOTC.
2. Extrayez-le dans votre dossier de mods CK3.
3. Lancez CK3 et activez le mod dans le launcher.
4. Lancez l'application VOTC.

### 🛠️ Configuration pour le Développement Local
1. Clonez le dépôt.
2. Installez les dépendances avec `npm i`.
3. Lancez le mode dev avec `npm run start`.
4. Compilez l'application avec `npm run make`.

### 📄 Licence
Ce projet est sous licence [GPL-3.0](LICENSE).
