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
2. En [Render](https://render.com), elige **New → Web Service**, selecciona el repositorio y usa *Build command* `npm run build` y *Start command* `npm start`.
   - No uses **Blueprint**: el proyecto no tiene `render.yaml` a propósito, para que un push nunca cree un servicio nuevo.
3. Al terminar, el juego queda en `https://<nombre>.onrender.com`.

Notas del plan gratuito: el servicio se apaga tras 15 minutos sin uso y tarda cerca de un minuto en despertar. Las partidas viven en memoria, así que se pierden cuando se apaga o se reinicia.

Para probar el modo producción en local: `npm run build` y luego `npm start` (abre http://localhost:3001).

## Cuentas de jugador y Ryō (opcional)

Los invitados juegan igual que siempre. Con cuenta, el perfil (nombre y avatar) se guarda y cada partida terminada suma **Ryō**, la moneda del juego (no hay dinero real).

- **Inicio de sesión:** correo + contraseña o **Continuar con Google**, con [Neon Auth](https://neon.com/docs/auth/overview). El navegador solo habla con nuestro servidor (`/api/auth/*`), que llama a Neon Auth y guarda la sesión en una cookie *httpOnly* de nuestro propio dominio. La conexión del juego envía un token corto que el servidor verifica.
- **Datos:** Postgres de Neon. El esquema está en `server/db/schema.sql` (tablas `users`, `user_items`, `user_equipped`, `game_results`). La base solo se usa al iniciar sesión, editar el perfil y al terminar una partida, nunca en cada jugada.
- **Ryō por partida:** +20 por terminarla, +30 si ganas y +2 por punto de victoria. No dan Ryō: las partidas que abandonas, las que terminan con menos de 2 ninjas y las terminadas por votación antes de 15 minutos. Cada partida paga una sola vez por cuenta.

### Variables de entorno

| Variable | Qué es |
| --- | --- |
| `DATABASE_URL` | Cadena de conexión de Neon (Dashboard → Connect). Secreta. |
| `NEON_AUTH_BASE_URL` | "Auth URL" de Neon Auth (Neon → Auth → Configuration), termina en `/neondb/auth`. |
| `REWARD_MIN_VOTE_MINUTES` | Opcional, minutos mínimos para cobrar una partida terminada por votación (15). |

En local van en `server/.env` (está en `.gitignore`). En Render: **Environment → Add Environment Variable** con las dos primeras. Si faltan, el servidor arranca igual con las cuentas desactivadas.

Neon Auth solo acepta inicios de sesión desde dominios autorizados (localhost ya lo está): en Neon → **Auth → Configuration → Domains** agrega la dirección pública del juego, por ejemplo `https://catan-jqnb.onrender.com`.

Google funciona sin crear nada en Google Cloud porque Neon presta sus credenciales compartidas (la pantalla de Google muestra el nombre de Neon). Para que muestre el nombre del juego hay que crear un cliente OAuth propio en Google Cloud y pegarlo en Neon → Auth → OAuth providers.

Nota: la sesión usa cookies seguras, así que el inicio de sesión funciona en `https://` y en `http://localhost`, pero no al abrir el juego por la IP de la red local (`http://192.168…`).

