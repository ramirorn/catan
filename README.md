# 🏝️ Catan Web — Juego Multijugador en Tiempo Real

Juego completo de **Los Colonos de Catán** para navegador con multijugador en red en tiempo real.

- **Frontend**: React 19 + Vite + Tablero SVG interactivo + CSS moderno con diseño oscuro y acentos dorados.
- **Backend**: Node.js + Express + Socket.io (arquitectura *server-authoritative* donde el servidor valida todas las reglas y previene trampas).

---

## 🚀 Características Implementadas

### 🎲 Mecánicas Principales del Juego
- **Tablero Hexagonal procedural**:
  - Generación aleatoria de hexágonos con 5 terrenos (Bosque, Colinas, Pastos, Campos, Montañas) y Desierto.
  - Asignación de fichas numéricas (2 al 12) evitando 6 y 8 adyacentes.
  - Puertos costeros automáticos (genéricos 3:1 y especializados 2:1).
  - Modos de tablero: **Estándar (2 a 4 jugadores)** y **Extendido (2 a 6 jugadores)**.
- **Fase Inicial de Preparación (Snake Draft)**:
  - Colocación de los 2 primeros poblados y caminos en orden directo e inverso.
  - Distribución automática de recursos iniciales en la segunda ronda.
- **Ciclo de Turnos y Dados**:
  - Lanzamiento de dados con animación 3D.
  - Recolección automática de recursos según los poblados y ciudades adyacentes a los hexágonos activados.
- **Construcción y Validación Geométrica**:
  - Caminos (1 Madera + 1 Arcilla) conectados a la red del jugador.
  - Poblados (1 Madera + 1 Arcilla + 1 Oveja + 1 Trigo) respetando la regla de distancia (al menos 2 aristas de separación).
  - Ciudades (2 Trigo + 3 Piedra) mejorando poblados existentes para duplicar la producción.
- **Mecánica del Ladrón (7)**:
  - Descarte obligatorio de la mitad de cartas para jugadores con más de 7 recursos.
  - Reubicación del ladrón en cualquier hexágono para bloquear su producción.
  - Robo de 1 carta al azar a un rival adyacente.
- **Sistema de Comercio Completo**:
  - Comercio con el Banco (4:1 por defecto, o 3:1 / 2:1 mediante puertos controlados).
  - Comercio entre jugadores con propuestas de intercambio, negociación y aceptación/rechazo en tiempo real.
- **Cartas de Desarrollo**:
  - Compra de cartas (1 Oveja + 1 Trigo + 1 Piedra).
  - Caballero (mueve el ladrón y roba).
  - Construcción de Caminos (2 caminos gratis).
  - Año de la Abundancia (toma 2 recursos cualquiera del banco).
  - Monopolio (nombra 1 recurso y extrae todas las cartas de ese tipo a los rivales).
  - Puntos de Victoria ocultos (se revelan al alcanzar 10 VP).
- **Puntuaciones y Logros**:
  - Camino más Largo (al menos 5 caminos consecutivos, otorga 2 VP).
  - Gran Ejército de Caballería (al menos 3 caballeros jugados, otorga 2 VP).
  - Detección de Victoria automática (primer jugador en alcanzar 10 Puntos de Victoria en su turno).
- **Lobby y Social**:
  - Creación de salas con código único para invitar amigos.
  - Lista de salas públicas en vivo.
  - Chat en tiempo real y registro histórico de eventos de la partida.

---

## 📦 Cómo Ejecutar el Proyecto

### 1. Iniciar el Servidor Backend (Node.js)
En una terminal:
```bash
cd server
npm start
```
*El servidor se iniciará en `http://localhost:3001`.*

### 2. Iniciar el Cliente Frontend (React + Vite)
En otra terminal:
```bash
cd client
npm run dev
```
*Abre tu navegador en `http://localhost:5173`.*

---

## 🧪 Pruebas del Motor de Juego
Para ejecutar la suite de pruebas del motor de reglas del servidor:
```bash
cd server
npm test
```

## Publicar en Render (gratis)

El servidor también entrega la pantalla del juego, así que todo queda en una sola dirección.

1. Sube el proyecto a un repositorio de GitHub.
2. En [Render](https://render.com), elige **New → Blueprint** y selecciona el repositorio. Render lee `render.yaml` y crea el servicio solo.
   - O a mano: **New → Web Service**, con *Build command* `npm run build` y *Start command* `npm start`.
3. Al terminar, el juego queda en `https://<nombre>.onrender.com`.

Notas del plan gratuito: el servicio se apaga tras 15 minutos sin uso y tarda cerca de un minuto en despertar. Las partidas viven en memoria, así que se pierden cuando se apaga o se reinicia.

Para probar el modo producción en local: `npm run build` y luego `npm start` (abre http://localhost:3001).
