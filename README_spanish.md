# Voices of the Court (VOTC)

Un compañero impulsado por IA para Crusader Kings III que te ayuda a realizar un seguimiento de los personajes, complots e historias. Voices of the Court integra Modelos de Lenguaje Extensos (LLM) en el juego, permitiéndote mantener conversaciones naturales con los personajes e influir dinámicamente en el estado del juego.

Documentación: https://docs.voicesofthecourt.app

[Página de Steam](https://steamcommunity.com/sharedfiles/filedetails/?id=3654567139)

Únete a nuestro Discord:

[![Servidor de Discord](https://discord.com/api/guilds/1066522056243564585/widget.png?style=banner2)](https://discord.gg/UQpE4mJSqZ)

# Video Trailer 
[![enlace a](https://img.youtube.com/vi/E2GmlNsK-J8/0.jpg)](https://www.youtube.com/watch?v=E2GmlNsK-J8)

# Video de Gameplay por DaFloove
[![enlace a](https://img.youtube.com/vi/3lhHkXPmis0/0.jpg)](https://www.youtube.com/watch?v=3lhHkXPmis0)

### 🌟 Características

### 🎮 Interfaz de Configuración
- **🤖 Múltiples Modelos de IA**: Soporte para modelos OpenAI GPT, Anthropic Claude, Player2 y modelos locales.
- **🧠 Memoria de Personajes**: Sistema de memoria persistente que rastrea las relaciones e historia de los personajes.
- **📚 Gestión de Contexto**: Ajustes personalizables para la ventana de contexto y el historial de conversaciones.
- **🎯 Prompts Personalizados**: Prompts de sistema personalizados para diferentes tipos de personajes.
- **🔄 Restaurar Valores Predeterminados**: Restauración con un solo clic de los prompts y ajustes predeterminados.

### 💬 Interfaz de Chat
- **⚡ Conversaciones en Tiempo Real**: Diálogo natural con personajes de CK3.
- **👤 Perfiles de Personajes**: Información detallada sobre cada personaje.
- **🔖 Sistema de Marcadores**: Guarda y organiza conversaciones importantes.
- **📤 Funcionalidad de Exportación**: Exporta conversaciones a archivos de texto.

### 📋 Gestor de Resúmenes
- **🤖 Resúmenes Automáticos**: Resúmenes generados por IA de eventos importantes.
- **🔖 Integración de Marcadores**: Convierte marcadores en resúmenes.
- **🔍 Funcionalidad de Búsqueda**: Encuentra conversaciones y resúmenes específicos.
- **📤 Opciones de Exportación**: Guarda resúmenes en varios formatos.

## Detalles de la Interfaz de Configuración

La aplicación proporciona seis páginas de configuración principales, cada una responsable de diferentes ajustes funcionales:

### 1. Página de Conexión

La página de Conexión se utiliza para configurar la conexión a la API del modelo de lenguaje y los ajustes de la ruta del juego.

- **Configuración de Conexión API**:
  - Selecciona el proveedor de la API de generación de texto (ej., OpenAI, Kobold, etc.)
  - Configura la clave API, la URL del endpoint y el nombre del modelo.

- **Ruta de la Carpeta de Usuario de CK3**:
  - Establece la ruta de la carpeta de CK3 donde se almacenan los datos del usuario.
  - Ruta predeterminada: `Documentos de Usuario/Paradox Interactive/Crusader Kings III`
  - Puedes buscar y seleccionar la ruta correcta mediante el botón "Seleccionar Carpeta".

### 2. Página de Acciones

La página de Acciones se utiliza para configurar las acciones detectables en el juego y las respuestas correspondientes de la IA.

- **Habilitar Acciones**:
  - Interruptor maestro para controlar si la detección de acciones está habilitada.
  - Habilitar Narrativa de IA: Genera descripciones narrativas de IA después de que se activa una acción.

- **Configuración de API**:
  - Elige usar los mismos ajustes de API que la página de Conexión.
  - O configura una API separada para las funciones de acción.

- **Ajustes de Parámetros**:
  - Temperatura: Controla la creatividad de la respuesta de la IA (predeterminado 0.2, valores más bajos hacen que las respuestas sean más deterministas).
  - Penalización de Frecuencia: Reduce la generación de contenido repetitivo.
  - Penalización de Presencia: Fomenta hablar sobre temas nuevos.
  - Top P: Controla la diversidad de la selección de vocabulario.

- **Selección de Acciones**:
  - Selecciona los tipos de acciones que deseas que el mod detecte de la lista.
  - Cada acción tiene una descripción e información del creador.
  - Actualiza la lista de acciones mediante el botón "Recargar Archivos".
  - Accede a los scripts de acciones personalizados mediante el botón "Abrir Carpeta".

### 3. Página de Resumen

La página de Resumen se utiliza para configurar los ajustes de la API para la función de resumen de conversaciones.

- **Configuración de API**:
  - Elige usar los mismos ajustes de API que la página de Conexión.
  - O configura una API separada para las funciones de resumen.

- **Ajustes de Parámetros**:
  - Temperatura: Controla la creatividad del resumen (predeterminado 0.2).
  - Penalización de Frecuencia: Reduce el contenido repetitivo en los resúmenes.
  - Penalización de Presencia: Fomenta la inclusión de nueva información.
  - Top P: Controla la diversidad de la selección de vocabulario.

La función de resumen se utiliza para comprimir conversaciones largas en resúmenes cortos, ayudando a mantener el contexto de la conversación dentro de los límites de tokens y generando resúmenes después de las conversaciones para referencia futura.

### 4. Página de Prompts

La página de Prompts se utiliza para configurar varios prompts y scripts para interactuar con la IA.

- **Prompts Principales**:
  - Prompt Principal: Instrucciones básicas que controlan cómo responde la IA.
  - Prompt de Monólogo Interno: Reglas de generación para los pensamientos internos de los personajes.
  - Prompt de Resumen: Instrucciones para generar resúmenes de conversaciones.
  - Prompt de Resumen de Monólogo Interno: Reglas de resumen para los pensamientos internos.
  - Prompt de Memoria: Cómo los personajes recuerdan y referencian eventos pasados.
  - Prompt de Sufijo: El último mensaje del sistema insertado antes de la solicitud a la API, utilizado para guiar al modelo en el formato de las respuestas.
  - Prompt de Narrativa: Reglas para generar descripciones narrativas de IA después de que se activa una acción.

- **Selección de Scripts**:
  - Script de Descripción de Personaje: Script para generar dinámicamente descripciones de personajes.
  - Script de Mensajes de Ejemplo: Script para generar mensajes de conversación de ejemplo.
  - Playbook: Archivos de playbook específicos para importar, que contienen visiones del mundo y configuraciones de personajes.

Cada script tiene versiones estándar y personalizadas, seleccionables mediante menús desplegables y accesibles mediante el botón "Abrir Carpeta".

### 5. Página de Ajustes

La página de Ajustes contiene varias configuraciones de comportamiento y parámetros de generación para la aplicación.

- **Ajustes Básicos**:
  - Máximo de Nuevos Tokens: Limita la longitud máxima de una sola respuesta de la IA.
  - Máximo de Tokens de Memoria: Limita la longitud máxima de los recuerdos de los personajes.
  - Mensajes en Streaming: Habilita/deshabilita las respuestas en streaming (visualización en tiempo real de la generación de la IA).
  - Limpiar Mensajes: Intenta eliminar contenido no deseado de la generación de la IA (ej., emojis).
  - Barajar Orden de Personajes: Aleatoriza el orden de habla de los personajes en conversaciones de varias personas.
  - Selección Dinámica de Personajes: Usa el LLM para analizar la conversación y seleccionar el siguiente personaje en hablar.
  - Validar Identidad del Personaje: Verifica si los mensajes generados coinciden con la identidad del personaje, evitando que el LLM genere respuestas para otros personajes.
  - Mostrar Botón de Sugerencias: Muestra/oculta la función de frases de entrada recomendadas en la ventana de chat.

- **Ajustes de Profundidad de Inserción**:
  - Profundidad de Inserción de Resumen: Controla la posición de inserción de los resúmenes en el historial de conversaciones.
  - Profundidad de Inserción de Memoria: Controla la posición de inserción de los recuerdos de los personajes en el historial de conversaciones.
  - Profundidad de Inserción de Descripción de Personaje: Controla la posición de inserción de las descripciones de los personajes en el historial de conversaciones.

- **Ajustes de Instrucción**:
  - Secuencia de Entrada: Marcadores especiales para la entrada del usuario.
  - Secuencia de Salida: Marcadores especiales para la salida de la IA.

- **Parámetros de Generación de Texto**:
  - Temperatura: Controla la creatividad de la respuesta de la IA (predeterminado 0.8).
  - Penalización de Frecuencia: Reduce la generación de contenido repetitivo.
  - Penalización de Presencia: Fomenta hablar sobre temas nuevos.
  - Top P: Controla la diversidad de la selección de vocabulario (predeterminado 0.9).

### 6. Página de Sistema

La página de Sistema proporciona mantenimiento de la aplicación y enlaces a la comunidad.

- **Funciones de Actualización**:
  - Muestra la versión actual de la aplicación.
  - Botón Buscar Actualizaciones: Busca manualmente nuevas versiones.
  - Buscar actualizaciones al iniciar: Busca actualizaciones automáticamente cuando se inicia la aplicación.

- **Archivos de Registro**:
  - Si experimentas errores o bloqueos, puedes ver los archivos de registro.
  - Botón Abrir Carpeta de Registros: Acceso directo a los archivos de registro.

- **Gestión de Resúmenes de Conversación**:
  - Botón Borrar Resúmenes: Elimina los resúmenes de conversaciones anteriores para todos los personajes.
  - Botón Abrir Carpeta de Resúmenes de Conversación: Acceso a los resúmenes de conversación almacenados.

## Características de la Interfaz de Chat

La interfaz de chat es la interfaz principal para interactuar con los personajes del juego, incluyendo las siguientes características:

- **Visualización de Mensajes**:
  - Los mensajes del jugador y de los personajes de la IA se muestran con estilos diferentes.
  - Soporta formato Markdown básico (negrita, cursiva).
  - Los mensajes narrativos se muestran con un estilo especial, proporcionando descripciones de la escena.

- **Funciones de Entrada**:
  - Cuadro de Entrada de Texto: Introduce el contenido del diálogo con los personajes.
  - Tecla Enter para enviar mensajes.
  - Soporta entrada multilínea.

- **Funciones de Sugerencia** (configurables):
  - Botón de Sugerencia: Muestra frases de entrada recomendadas.
  - Lista de Sugerencias: Haz clic en un elemento de sugerencia para completar automáticamente el cuadro de entrada.
  - Botón de Cierre: Oculta el panel de sugerencias.

- **Control de Conversación**:
  - Botón Terminar Conversación: Sale de la conversación actual.

- **Indicadores de Estado**:
  - Puntos de Carga: Muestra que la IA está generando una respuesta.
  - Mensajes de Error: Muestra errores de conexión o generación.

## Características del Gestor de Resúmenes

El Gestor de Resúmenes es una interfaz para gestionar y editar los resúmenes de las conversaciones de los personajes del juego, proporcionando las siguientes características:

### Botones de Control Superiores

- **Botón Actualizar**: Recarga todos los datos de los resúmenes, incluyendo el análisis del ID del jugador de los registros del juego y la lectura de los archivos de resumen.
- **Botón Guardar**: Guarda todos los cambios actuales de los resúmenes en el archivo.
- **Botón Cerrar**: Cierra la ventana del Gestor de Resúmenes.

### Panel de Información

- **ID del Jugador**: Muestra el ID del jugador actual analizado de los registros del juego (solo lectura).
- **Seleccionar Personaje**: Menú desplegable para filtrar resúmenes de un personaje específico o ver todos los resúmenes de personajes.
- **Ruta del Archivo de Resumen**: Muestra la ruta de almacenamiento del archivo de resumen actual (solo lectura).

### Área de Lista de Resúmenes

- **Lista de Resúmenes**: Muestra todos los resúmenes bajo los criterios de filtro actuales, cada elemento contiene la fecha, el personaje y el contenido del resumen.
- **Botón Añadir Nuevo Resumen**: Crea un nuevo resumen en blanco en la parte superior de la lista, por defecto para el personaje seleccionado actualmente.

### Área del Editor

- **Cuadro de Entrada de Fecha**: Edita la fecha del resumen seleccionado actualmente.
- **Cuadro de Texto de Contenido**: Edita el contenido detallado del resumen seleccionado actualmente.
- **Botón Actualizar Resumen**: Guarda los cambios en el resumen seleccionado actualmente.
- **Botón Borrar Resumen**: Elimina el resumen seleccionado actualmente (requiere confirmación).
- **Botón Nuevo Resumen**: Limpia el editor, listo para crear un nuevo resumen.

### Instrucciones

1. Haz clic en un elemento de resumen en la lista para seleccionarlo y cargarlo en el editor.
2. Usa el filtro de personajes para ver resúmenes de un personaje específico o de todos los personajes.
3. Todos los cambios deben guardarse haciendo clic en el botón "Guardar" para que se escriban en el archivo.
4. La eliminación es irreversible, por favor úsala con precaución.

## 📥 Instalación Local

### 📥 Instalación
1. Descarga la última versión del mod VOTC.
2. Extráelo en tu carpeta de mods de CK3.
3. Inicia CK3 y habilita el mod en el lanzador.
4. Ejecuta la aplicación VOTC.

### ⚙️ Configuración
1. Inicia la aplicación.
2. Navega a la interfaz de configuración.
3. Introduce tu clave API del servicio de IA.
4. Ajusta la configuración según tus preferencias.
5. Haz clic en "Guardar Configuración" para aplicar los cambios.

### 🔄 Restaurar Ajustes Predeterminados
- Usa el botón "Restaurar Prompt Predeterminado" para restaurar todos los ajustes de prompts predeterminados con un solo clic.
- Los elementos de configuración individuales se pueden restablecer en la interfaz de configuración.

## 🛠️ Solución de Problemas

### 🔧 Problemas Comunes

#### 1. **La Aplicación no se Inicia**
   - Asegúrate de que todas las dependencias estén instaladas: ejecuta `npm install`.
   - Comprueba si la versión de Node.js es compatible.
   - Verifica que la ruta de los archivos del juego sea correcta.

#### 2. **Problemas de Conexión de IA**
   - Comprueba si la clave API se ha introducido correctamente.
   - Verifica que la conexión de red sea normal.
   - Confirma el estado de la API del proveedor de IA.

#### 3. **Problemas de Integración con el Juego**
   - Asegúrate de que el juego CK3 se esté ejecutando.
   - Comprueba si el mod está correctamente instalado.
   - Verifica la configuración de la ruta de los archivos del juego.

#### 4. **Problemas de Rendimiento**
   - Reduce el tamaño de la ventana de contexto.
   - Limita el número de registros del historial de conversaciones.
   - Cierra programas en segundo plano innecesarios.

#### 5. **Restaurar Ajustes Predeterminados**
   - Usa el botón "Restaurar Prompt Predeterminado" en la interfaz de configuración.
   - Reconfigura los ajustes de la API y los parámetros del modelo.
   - Comprueba si los archivos de configuración se han guardado correctamente.

## 🤝 Contribución

Las contribuciones al proyecto son bienvenidas a través de:
- Reporte de errores y sugerencias de nuevas funciones.

### 📝 Directrices de Contribución
1. Haz un Fork de este repositorio.
2. Crea tu rama de funciones (`git checkout -b feature/AmazingFeature`).
3. Realiza tus cambios (`git commit -m 'Add some AmazingFeature'`).
4. Sube la rama (`git push origin feature/AmazingFeature`).
5. Abre un Pull Request.

### 📄 Licencia

Este proyecto está bajo la licencia [GPL-3.0 License](LICENSE) - consulta el archivo [LICENSE](LICENSE) para más detalles.

### 🛠️ Configuración de Desarrollo Local

1. Clona el repositorio.
2. Instala las dependencias con `npm i`.
3. Inicia el modo de desarrollo con `npm run start`.
4. Empaqueta la aplicación con `npm run make`.

Solución para problemas de versión de Electron:
```
npx electron-rebuild
```
