# Voices of the Court (VOTC)

An AI-powered companion for Crusader Kings III that helps you keep track of characters, plots, and storylines. Voices of the Court integrates Large Language Models into the game, letting you hold natural conversations with characters and dynamically influence the game state.

Documentation: https://docs.voicesofthecourt.app

[Steam page](https://steamcommunity.com/sharedfiles/filedetails/?id=3654567139)

Join our Discord:

[![Discord Server](https://discord.com/api/guilds/1066522056243564585/widget.png?style=banner2)](https://discord.gg/UQpE4mJSqZ)

# Trailer video 
[![link to](https://img.youtube.com/vi/E2GmlNsK-J8/0.jpg)](https://www.youtube.com/watch?v=E2GmlNsK-J8)

# Gameplay video by DaFloove
[![link to](https://img.youtube.com/vi/3lhHkXPmis0/0.jpg)](https://www.youtube.com/watch?v=3lhHkXPmis0)

### 🌟 Features

### 🎮 Configuration Interface
- **🤖 Multiple AI Models**: Support for OpenAI GPT models, Anthropic Claude, Player2, and local models
- **🧠 Character Memory**: Persistent memory system that tracks character relationships and history
- **📚 Context Management**: Adjustable context window and conversation history settings
- **🎯 Custom Prompts**: Personalized system prompts for different character types
- **🔄 Restore Defaults**: One-click restore to default prompts and settings

### 💬 Chat Interface
- **⚡ Real-time Conversations**: Natural dialogue with CK3 characters
- **👤 Character Profiles**: Detailed information about each character
- **🔖 Bookmark System**: Save and organize important conversations
- **📤 Export Functionality**: Export conversations to text files

### 📋 Summary Manager
- **🤖 Automatic Summaries**: AI-generated summaries of important events
- **🔖 Bookmark Integration**: Convert bookmarks to summaries
- **🔍 Search Functionality**: Find specific conversations and summaries
- **📤 Export Options**: Save summaries in various formats

## Configuration Interface Details

The application provides six main configuration pages, each responsible for different functional settings:

### 1. Connection Page

The Connection page is used to configure the connection to the language model API and game path settings.

- **API Connection Configuration**:
  - Select text generation API provider (e.g., OpenAI, Kobold, etc.)
  - Configure API key, endpoint URL, and model name

- **CK3 User Folder Path**:
  - Set the CK3 folder path where user data is stored
  - Default path: `User Documents/Paradox Interactive/Crusader Kings III`
  - You can browse and select the correct path via the "Select Folder" button

### 2. Actions Page

The Actions page is used to configure detectable actions in the game and corresponding AI responses.

- **Enable Actions**:
  - Master switch to control whether action detection is enabled
  - Enable AI Narrative: Generate AI narrative descriptions after an action is triggered

- **API Configuration**:
  - Choose to use the same API settings as the Connection page
  - Or configure a separate API for action features

- **Parameter Settings**:
  - Temperature: Controls AI response creativity (default 0.2, lower values make responses more deterministic)
  - Frequency Penalty: Reduces generation of repetitive content
  - Presence Penalty: Encourages talking about new topics
  - Top P: Controls diversity of vocabulary selection

- **Action Selection**:
  - Select the types of actions you want the mod to detect from the list
  - Each action has a description and creator information
  - Refresh the action list via the "Reload Files" button
  - Access custom action scripts via the "Open Folder" button

### 3. Summarization Page

The Summarization page is used to configure API settings for the conversation summary feature.

- **API Configuration**:
  - Choose to use the same API settings as the Connection page
  - Or configure a separate API for summarization features

- **Parameter Settings**:
  - Temperature: Controls summary creativity (default 0.2)
  - Frequency Penalty: Reduces repetitive content in summaries
  - Presence Penalty: Encourages inclusion of new information
  - Top P: Controls diversity of vocabulary selection

The summarization feature is used to compress long conversations into short summaries, helping keep conversation context within token limits and generating summaries after conversations for future reference.

### 4. Prompts Page

The Prompts page is used to configure various prompts and scripts for interacting with the AI.

- **Main Prompts**:
  - Main Prompt: Basic instructions controlling how the AI responds
  - Self-talk Prompt: Generation rules for character internal monologues
  - Summarize Prompt: Instructions for generating conversation summaries
  - Self-talk Summarize Prompt: Summary rules for character internal monologues
  - Memory Prompt: How characters remember and reference past events
  - Suffix Prompt: The last system message inserted before the API request, used to guide the model in formatting responses
  - Narrative Prompt: Rules for generating AI narrative descriptions after an action is triggered

- **Script Selection**:
  - Character Description Script: Script for dynamically generating character descriptions
  - Example Message Script: Script for generating example conversation messages
  - Playbook: Specific playbook files for import, containing worldviews and character settings

Each script has standard and custom versions, selectable via dropdown menus, and accessible via the "Open Folder" button.

### 5. Settings Page

The Settings page contains various behavior and generation parameter configurations for the application.

- **Basic Settings**:
  - Max New Tokens: Limits the maximum length of a single AI response
  - Max Memory Tokens: Limits the maximum length of character memories
  - Streaming Messages: Enable/disable streaming responses (real-time display of AI generation)
  - Clean Messages: Attempt to remove unwanted content from AI generation (e.g., emojis)
  - Shuffle Character Order: Randomize character speaking order in multi-person conversations
  - Dynamic Character Selection: Use LLM to analyze conversation and select the next speaking character
  - Validate Character Identity: Verify if generated messages match character identity, preventing LLM from generating replies for other characters
  - Show Suggestions Button: Show/hide the recommended input statement feature in the chat window

- **Insertion Depth Settings**:
  - Summary Insertion Depth: Controls the insertion position of summaries in conversation history
  - Memory Insertion Depth: Controls the insertion position of character memories in conversation history
  - Character Description Insertion Depth: Controls the insertion position of character descriptions in conversation history

- **Instruction Settings**:
  - Input Sequence: Special markers for user input
  - Output Sequence: Special markers for AI output

- **Text Generation Parameters**:
  - Temperature: Controls AI response creativity (default 0.8)
  - Frequency Penalty: Reduces generation of repetitive content
  - Presence Penalty: Encourages talking about new topics
  - Top P: Controls diversity of vocabulary selection (default 0.9)

### 6. System Page

The System page provides application maintenance and community link features.

- **Update Features**:
  - Display current application version
  - Check for Updates button: Manually check for new versions
  - Check for updates on startup: Automatically check for updates when the app starts

- **Log Files**:
  - If you experience errors/crashes, you can view log files
  - Open Log Folder button: Direct access to log files

- **Conversation Summary Management**:
  - Clear Summaries button: Delete previous conversation summaries for all characters
  - Open Conversation Summary Folder button: Access stored conversation summaries

## Chat Interface Features

The chat interface is the primary interface for interacting with game characters, including the following features:

- **Message Display**:
  - Player messages and AI character messages are displayed in different styles
  - Supports basic Markdown formatting (bold, italic)
  - Narrative messages are displayed in a special style, providing scene descriptions

- **Input Features**:
  - Text Input Box: Enter dialogue content with characters
  - Enter key to send messages
  - Supports multi-line input

- **Suggestion Features** (configurable show/hide):
  - Suggestion Button: Display recommended input statements
  - Suggestion List: Click a suggestion item to automatically fill the input box
  - Close Button: Hide the suggestion panel

- **Conversation Control**:
  - End Conversation Button: Exit the current conversation

- **Status Indicators**:
  - Loading Dots: Shows AI is generating a response
  - Error Messages: Displays connection or generation errors

## Summary Manager Features

The Summary Manager is an interface for managing and editing game character conversation summaries, providing the following features:

### Top Control Buttons

- **Refresh Button**: Reload all summary data, including parsing player ID from game logs and reading summary files
- **Save Button**: Save all current summary changes to file
- **Close Button**: Close the Summary Manager window

### Information Panel

- **Player ID**: Displays the current player ID parsed from game logs (read-only)
- **Select Character**: Dropdown menu to filter summaries for a specific character or view all character summaries
- **Summary File Path**: Displays the storage path of the current summary file (read-only)

### Summary List Area

- **Summary List**: Displays all summaries under current filter criteria, each item containing date, character, and summary content
- **Add New Summary Button**: Create a new blank summary at the top of the list, defaulting to the currently selected character

### Editor Area

- **Date Input Box**: Edit the date of the currently selected summary
- **Content Text Box**: Edit the detailed content of the currently selected summary
- **Update Summary Button**: Save changes to the currently selected summary
- **Delete Summary Button**: Delete the currently selected summary (requires confirmation)
- **New Summary Button**: Clear the editor, ready to create a new summary

### Instructions

1. Click a summary item in the list to select and load it into the editor
2. Use the character filter to view summaries for a specific character or all characters
3. All changes need to be saved by clicking the "Save" button to be written to file
4. Deletion is irreversible, please use with caution

## 🚀 Local Setup

### 📥 Installation
1. Download the latest version of the VOTC mod
2. Extract to your CK3 mod folder
3. Launch CK3 and enable the mod in the launcher
4. Run the VOTC application

### ⚙️ Configuration
1. Launch the application
2. Navigate to the configuration interface
3. Enter your AI service API key
4. Adjust settings to fit your preferences
5. Click "Save Configuration" to apply changes

### 🔄 Restore Default Settings
- Use the "Restore Default Prompt" button to restore all default prompt settings with one click
- Individual configuration items can be reset in the configuration interface

## 🛠️ Troubleshooting

### 🔧 Common Issues

#### 1. **Application Fails to Start**
   - Ensure all dependencies are installed: run `npm install`
   - Check if Node.js version is compatible
   - Verify game file path is correct

#### 2. **AI Connection Issues**
   - Check if API key is entered correctly
   - Verify network connection is normal
   - Confirm API status of the AI provider

#### 3. **Game Integration Issues**
   - Ensure CK3 game is running
   - Check if mod is correctly installed
   - Verify game file path configuration

#### 4. **Performance Issues**
   - Reduce context window size
   - Limit the number of conversation history records
   - Close unnecessary background programs

#### 5. **Restore Default Settings**
   - Use the "Restore Default Prompt" button in the configuration interface
   - Reconfigure API settings and model parameters
   - Check if configuration files are correctly saved

## 🤝 Contribution

Contributions to the project are welcome via:
- Reporting bugs and suggesting feature requests

### 📝 Contribution Guidelines
1. Fork this repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### 📄 License

This project is licensed under the [GPL-3.0 License](LICENSE) - see the [LICENSE](LICENSE) file for details

### 🛠️ Local Development Setup

1. Clone the repo
2. Install dependencies with `npm i`
3. Start dev mode with `npm run start`
4. Package app with `npm run make`

Fix for Electron version issues:
```
npx electron-rebuild
```
