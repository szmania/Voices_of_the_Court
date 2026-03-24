# Voices of the Court 2.0 - Community Edition (VOTC-CE)

Um companheiro alimentado por IA para o Crusader Kings III que o ajuda a acompanhar personagens, enredos e histórias. O Voices of the Court 2.0 - Community Edition integra Modelos de Linguagem Grandes (LLMs) no jogo, permitindo que você tenha conversas naturais com personagens e influencie dinamicamente o estado do jogo.

Documentação: https://docs.voicesofthecourt.app

[Página Steam](https://steamcommunity.com/sharedfiles/filedetails/?id=3654567139)

Junte-se ao nosso Discord:

[![Servidor Discord](https://discord.com/api/guilds/1066522056243564585/widget.png?style=banner2)](https://discord.gg/UQpE4mJSqZ)

# Trailer em Vídeo
[![link para](https://img.youtube.com/vi/E2GmlNsK-J8/0.jpg)](https://www.youtube.com/watch?v=E2GmlNsK-J8)

# Vídeo de Gameplay por DaFloove
[![link para](https://img.youtube.com/vi/3lhHkXPmis0/0.jpg)](https://www.youtube.com/watch?v=3lhHkXPmis0)

### 🌟 Funcionalidades

### 🎮 Interface de Configuração
- **🤖 Múltiplos Modelos de IA**: Suporte para modelos OpenAI GPT, Anthropic Claude, Player2 e modelos locais.
- **🧠 Memória de Personagem**: Sistema de memória persistente que rastreia os relacionamentos e a história dos personagens.
- **📚 Gestão de Contexto**: Configurações personalizáveis para a janela de contexto e histórico de conversas.
- **🎯 Prompts Personalizados**: Prompts de sistema personalizados para diferentes tipos de personagens.
- **🔄 Restaurar Padrões**: Restauração com um clique dos prompts e configurações padrão.

### 💬 Interface de Chat
- **⚡ Conversas em Tempo Real**: Diálogo natural com personagens do CK3.
- **👤 Perfis de Personagem**: Informações detalhadas sobre cada personagem.
- **🔖 Sistema de Marcadores**: Salve e organize conversas importantes.
- **📤 Funcionalidade de Exportação**: Exporte conversas para arquivos de texto.

### 📋 Gestor de Resumos
- **🤖 Resumos Automáticos**: Resumos gerados por IA de eventos importantes.
- **🔖 Integração de Marcadores**: Converta marcadores em resumos.
- **🔍 Funcionalidade de Pesquisa**: Encontre conversas e resumos específicos.
- **📤 Opções de Exportação**: Salve resumos em vários formatos.

## Detalhes da Interface de Configuração

A aplicação fornece seis páginas de configuração principais, cada uma responsável por diferentes configurações funcionais:

### 1. Página de Conexão

A página de Conexão é usada para configurar a conexão da API do modelo de linguagem e as configurações do caminho do jogo.

- **Configuração da Conexão API**:
  - Selecione o provedor da API de geração de texto (ex., OpenAI, Kobold, etc.)
  - Configure a chave da API, URL do endpoint e nome do modelo.

- **Caminho da Pasta de Usuário do CK3**:
  - Defina o caminho para a pasta do CK3 onde os dados do usuário são armazenados.
  - Caminho padrão: `Documentos do Usuário/Paradox Interactive/Crusader Kings III`
  - Você pode navegar e selecionar o caminho correto usando o botão "Selecionar Pasta".

### 2. Página de Ações

A página de Ações é usada para configurar ações detectáveis no jogo e as respostas de IA correspondentes.

- **Habilitar Ações**:
  - Interruptor mestre para controlar se a deteção de ações está habilitada.
  - Habilitar Narrativa de IA: Gera descrições narrativas de IA após a ativação de uma ação.

- **Configuração da API**:
  - Escolha usar as mesmas configurações de API da página de Conexão.
  - Ou configure uma API separada para as funcionalidades de ação.

- **Configurações de Parâmetros**:
  - Temperatura: Controla a criatividade da resposta da IA (padrão 0.2, valores mais baixos tornam as respostas mais determinísticas).
  - Penalidade de Frequência: Reduz a geração de conteúdo repetitivo.
  - Penalidade de Presença: Incentiva a discussão de novos tópicos.
  - Top P: Controla a diversidade da seleção de vocabulário.

- **Seleção de Ações**:
  - Selecione os tipos de ações que você deseja que o mod detecte na lista.
  - Cada ação tem uma descrição e informações do criador.
  - Atualize a lista de ações usando o botão "Recarregar Arquivos".
  - Acesse scripts de ações personalizados usando o botão "Abrir Pasta".

### 3. Página de Resumo

A página de Resumo é usada para configurar as configurações da API para a funcionalidade de resumo de conversas.

- **Configuração da API**:
  - Escolha usar as mesmas configurações de API da página de Conexão.
  - Ou configure uma API separada para as funcionalidades de resumo.

- **Configurações de Parâmetros**:
  - Temperatura: Controla a criatividade do resumo (padrão 0.2).
  - Penalidade de Frequência: Reduz o conteúdo repetitivo nos resumos.
  - Penalidade de Presença: Incentiva a inclusão de novas informações.
  - Top P: Controla a diversidade da seleção de vocabulário.

A funcionalidade de resumo é usada para comprimir conversas longas em resumos curtos, ajudando a manter o contexto da conversa dentro dos limites de tokens e gerando resumos após as conversas para referência futura.

### 4. Página de Prompts

A página de Prompts é usada para configurar vários prompts e scripts para interagir com a IA.

- **Prompts Principais**:
  - Prompt Principal: Instruções básicas que controlam como a IA responde.
  - Prompt de Monólogo Interno: Regras de geração para os pensamentos internos dos personagens.
  - Prompt de Resumo: Instruções para gerar resumos de conversas.
  - Prompt de Resumo de Monólogo Interno: Regras de resumo para os pensamentos internos.
  - Prompt de Memória: Como os personagens lembram e referenciam eventos passados.
  - Prompt de Sufixo: A última mensagem do sistema inserida antes da solicitação da API, usada para guiar o modelo na formatação das respostas.
  - Prompt de Narrativa: Regras para gerar descrições narrativas de IA após a ativação de uma ação.

- **Seleção de Scripts**:
  - Script de Descrição de Personagem: Script para gerar dinamicamente descrições de personagens.
  - Script de Mensagens de Exemplo: Script para gerar mensagens de conversa de exemplo.
  - Playbook: Arquivos de playbook específicos para importar, contendo visões de mundo e configurações de personagens.

Cada script tem versões padrão e personalizadas, selecionáveis através de menus suspensos e acessíveis através do botão "Abrir Pasta".

### 5. Página de Configurações

A página de Configurações contém várias configurações de comportamento e parâmetros de geração para a aplicação.

- **Configurações Básicas**:
  - Máximo de Novos Tokens: Limita o comprimento máximo de uma única resposta da IA.
  - Máximo de Tokens de Memória: Limita o comprimento máximo das memórias dos personagens.
  - Mensagens em Streaming: Habilita/desabilita respostas em streaming (visualização em tempo real da geração da IA).
  - Limpar Mensagens: Tenta remover conteúdo indesejado da geração da IA (ex., emojis).
  - Baralhar Ordem dos Personagens: Aleatoriza a ordem de fala dos personagens em conversas com várias pessoas.
  - Seleção Dinâmica de Personagens: Usa o LLM para analisar a conversa e selecionar o próximo personagem a falar.
  - Validar Identidade do Personagem: Verifica se as mensagens geradas correspondem à identidade do personagem, evitando que o LLM gere respostas para outros personagens.
  - Mostrar Botão de Sugestões: Mostra/oculta a funcionalidade de frases de entrada recomendadas na janela de chat.

- **Configurações de Profundidade de Inserção**:
  - Profundidade de Inserção de Resumo: Controla a posição de inserção dos resumos no histórico de conversas.
  - Profundidade de Inserção de Memória: Controla a posição de inserção das memórias dos personagens no histórico de conversas.
  - Profundidade de Inserção de Descrição de Personagem: Controla a posição de inserção das descrições dos personagens no histórico de conversas.

- **Configurações de Instrução**:
  - Sequência de Entrada: Marcadores especiais para a entrada do usuário.
  - Sequência de Saída: Marcadores especiais para a saída da IA.

- **Parâmetros de Geração de Texto**:
  - Temperatura: Controla a criatividade da resposta da IA (padrão 0.8).
  - Penalidade de Frequência: Reduz a geração de conteúdo repetitivo.
  - Penalidade de Presença: Incentiva a discussão de novos tópicos.
  - Top P: Controla a diversidade da seleção de vocabulário (padrão 0.9).

### 6. Página de Sistema

A página de Sistema fornece manutenção da aplicação e links para a comunidade.

- **Funcionalidades de Atualização**:
  - Exibe a versão atual da aplicação.
  - Botão Verificar Atualizações: Verifica manualmente por novas versões.
  - Verificar atualizações ao iniciar: Verifica automaticamente por atualizações quando a aplicação é iniciada.

- **Arquivos de Log**:
  - Se você encontrar erros ou travamentos, pode visualizar os arquivos de log.
  - Botão Abrir Pasta de Logs: Acesso direto aos arquivos de log.

- **Gestão de Resumos de Conversa**:
  - Botão Limpar Resumos: Exclui os resumos de conversas anteriores para todos os personagens.
  - Botão Abrir Pasta de Resumos de Conversa: Acesso aos resumos de conversa armazenados.

## Funcionalidades da Interface de Chat

A interface de chat é a interface principal para interagir com os personagens do jogo, incluindo as seguintes funcionalidades:

- **Visualização de Mensagens**:
  - As mensagens do jogador e dos personagens da IA são exibidas com estilos diferentes.
  - Suporta formatação Markdown básica (negrito, itálico).
  - As mensagens narrativas são exibidas com um estilo especial, fornecendo descrições da cena.

- **Funcionalidades de Entrada**:
  - Caixa de Entrada de Texto: Insira o conteúdo do diálogo com os personagens.
  - Tecla Enter para enviar mensagens.
  - Suporta entrada de múltiplas linhas.

- **Funcionalidades de Sugestão** (configuráveis):
  - Botão de Sugestão: Exibe frases de entrada recomendadas.
  - Lista de Sugestões: Clique num item de sugestão para preencher automaticamente a caixa de entrada.
  - Botão de Fechar: Oculta o painel de sugestões.

- **Controlo da Conversa**:
  - Botão Terminar Conversa: Sai da conversa atual.

- **Indicadores de Estado**:
  - Pontos de Carregamento: Mostra que a IA está a gerar uma resposta.
  - Mensagens de Erro: Exibe erros de conexão ou geração.

## Funcionalidades do Gestor de Resumos

O Gestor de Resumos é uma interface para gerir e editar os resumos das conversas dos personagens do jogo, fornecendo as seguintes funcionalidades:

### Botões de Controlo Superiores

- **Botão Atualizar**: Recarrega todos os dados de resumos, incluindo a análise do ID do jogador a partir dos logs do jogo e a leitura dos arquivos de resumo.
- **Botão Salvar**: Salva todas as alterações atuais dos resumos no arquivo.
- **Botão Fechar**: Fecha a janela do Gestor de Resumos.

### Painel de Informações

- **ID do Jogador**: Exibe o ID do jogador atual analisado a partir dos logs do jogo (apenas leitura).
- **Selecionar Personagem**: Menu suspenso para filtrar resumos de um personagem específico ou ver todos os resumos de personagens.
- **Caminho do Arquivo de Resumo**: Exibe o caminho de armazenamento do arquivo de resumo atual (apenas leitura).

### Área da Lista de Resumos

- **Lista de Resumos**: Exibe todos os resumos sob os critérios de filtro atuais, cada item contém a data, o personagem e o conteúdo do resumo.
- **Botão Adicionar Novo Resumo**: Cria um novo resumo em branco no topo da lista, por defeito para o personagem atualmente selecionado.

### Área do Editor

- **Caixa de Entrada de Data**: Edita a data do resumo atualmente selecionado.
- **Caixa de Texto de Conteúdo**: Edita o conteúdo detalhado do resumo atualmente selecionado.
- **Botão Atualizar Resumo**: Salva as alterações no resumo atualmente selecionado.
- **Botão Excluir Resumo**: Exclui o resumo atualmente selecionado (requer confirmação).
- **Botão Novo Resumo**: Limpa o editor, pronto para criar um novo resumo.

### Instruções

1. Clique num item de resumo na lista para o selecionar e carregar no editor.
2. Use o filtro de personagens para ver resumos de um personagem específico ou de todos os personagens.
3. Todas as alterações devem ser salvas clicando no botão "Salvar" para serem escritas no arquivo.
4. A exclusão é irreversível, por favor, use com cautela.

## 📥 Instalação Local

### 📥 Instalação
1. Baixe a versão mais recente do mod VOTC-CE.
2. Extraia-o para a sua pasta de mods do CK3.
3. Inicie o CK3 e habilite o mod no launcher.
4. Execute a aplicação VOTC-CE.

### ⚙️ Configuração
1. Inicie a aplicação.
2. Navegue para a interface de configuração.
3. Insira a sua chave de API do serviço de IA.
4. Ajuste as configurações de acordo com as suas preferências.
5. Clique em "Salvar Configurações" para aplicar as alterações.

### 🔄 Restaurar Configurações Padrão
- Use o botão "Restaurar Prompt Padrão" para restaurar todas as configurações de prompts padrão com um clique.
- Os itens de configuração individuais podem ser redefinidos na interface de configuração.

## 🛠️ Solução de Problemas

### 🔧 Problemas Comuns

#### 1. **A Aplicação não Inicia**
   - Certifique-se de que todas as dependências estão instaladas: execute `npm install`.
   - Verifique se a versão do Node.js é compatível.
   - Verifique se o caminho dos arquivos do jogo está correto.

#### 2. **Problemas de Conexão com a IA**
   - Verifique se a chave da API foi inserida corretamente.
   - Verifique se a conexão de rede está normal.
   - Confirme o estado da API do provedor de IA.

#### 3. **Problemas de Integração com o Jogo**
   - Certifique-se de que o jogo CK3 está em execução.
   - Verifique se o mod está instalado corretamente.
   - Verifique a configuração do caminho dos arquivos do jogo.

#### 4. **Problemas de Desempenho**
   - Reduza o tamanho da janela de contexto.
   - Limite o número de registros do histórico de conversas.
   - Feche programas desnecessários em segundo plano.

#### 5. **Restaurar Configurações Padrão**
   - Use o botão "Restaurar Prompt Padrão" na interface de configuração.
   - Reconfigure as configurações da API e os parâmetros do modelo.
   - Verifique se os arquivos de configuração foram salvos corretamente.

## 🤝 Contribuição

As contribuições para o projeto são bem-vindas através de:
- Relatórios de bugs e sugestões de novas funcionalidades.

### 📝 Diretrizes de Contribuição
1. Faça um Fork deste repositório.
2. Crie a sua branch de funcionalidade (`git checkout -b feature/AmazingFeature`).
3. Faça commit das suas alterações (`git commit -m 'Add some AmazingFeature'`).
4. Faça push para a branch (`git push origin feature/AmazingFeature`).
5. Abra um Pull Request.

### 🛠️ Configuração de Desenvolvimento Local

1. Clone o repositório.
2. Instale as dependências com `npm i`.
3. Inicie o modo de desenvolvimento com `npm run start`.
4. Empacote a aplicação com `npm run make`.

Solução para problemas de versão do Electron:
```
npx electron-rebuild
```

## Créditos e Atribuição

Este projeto é um trabalho derivado baseado no VOTC / AliChat. Gostaríamos de estender a nossa profunda gratidão aos desenvolvedores que mantiveram este projeto vivo e expandiram os limites da IA em Crusader Kings III:

### Criadores Originais e Apoiadores
A equipa do VOTC, VOTC 2.0 e os contribuidores da comunidade pelas suas contribuições para o projeto.

### Desenvolvimento Contínuo
Agradecimentos especiais à comunidade de desenvolvimento chinesa, incluindo Lisiyuan233, zhaowendao2005 e outros que forneceram atualizações e suporte críticos.

### Mantenedores da Edição Comunitária
A equipa do VOTC-CE e contribuidores.

### Informações de Licenciamento
Este projeto está licenciado sob a [Licença GPL-3.0](LICENSE). Parte do material de origem original para este mod foi lançado sob a licença Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0).

De acordo com a Seção 4(b) da licença CC BY-SA 4.0, este trabalho derivado está a ser licenciado sob uma Licença Compatível com BY-SA: a GNU General Public License v3.0 (GPLv3).

Para mais detalhes sobre o licenciamento, por favor, consulte os arquivos README nos nossos repositórios: Voices of the Court 2.0 - Community Edition README e VOTC-CE Mod README.

**Licença Original**
GPLv3 e CC BY-SA 4.0

**Licença Atual**
GPLv3

### Aviso GPLv3
Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo sob os termos da GNU General Public License, conforme publicada pela Free Software Foundation, seja a versão 3 da Licença, ou (a seu critério) qualquer versão posterior.

Este programa é distribuído na esperança de que seja útil, mas SEM QUALQUER GARANTIA; sem mesmo a garantia implícita de COMERCIALIZAÇÃO ou ADEQUAÇÃO A UM DETERMINADO FIM. Consulte a GNU General Public License para mais detalhes.

Você deveria ter recebido uma cópia da GNU General Public License junto com este programa. Se não, veja https://www.gnu.org/licenses/.
