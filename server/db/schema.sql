-- Catán Shinobi: player accounts, coins (Ryō), items and game results.
--
-- Sign-in itself (email + password, Google) is handled by Neon Auth, which
-- keeps its own tables in the `neon_auth` schema (users, sessions, hashed
-- passwords, OAuth accounts). This file only holds the game's own data and is
-- applied as migrations through the Neon MCP / SQL editor. Every statement is
-- idempotent, so the whole file can be run again safely.

-- One row per account that has opened the game at least once. `id` is the
-- Neon Auth user id (the `sub` of its JWT); deleting the Neon Auth user
-- deletes everything below.
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  email         text NOT NULL UNIQUE,
  display_name  text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 20),
  avatar_id     smallint NOT NULL DEFAULT 0 CHECK (avatar_id BETWEEN 0 AND 11),
  coins         integer NOT NULL DEFAULT 0 CHECK (coins >= 0),
  games_played  integer NOT NULL DEFAULT 0 CHECK (games_played >= 0),
  games_won     integer NOT NULL DEFAULT 0 CHECK (games_won >= 0),
  -- How the account signs in: 'credential' (email + password) or 'google'
  auth_provider text NOT NULL DEFAULT 'credential',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Items owned (shop, next phase). item_id is a catalogue key defined in code,
-- e.g. 'pieces:akatsuki' or 'board:desert-night'.
CREATE TABLE IF NOT EXISTS user_items (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     text NOT NULL CHECK (char_length(item_id) BETWEEN 1 AND 64),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

-- What is equipped in each slot: piece skins (seen by everyone in the game)
-- and the board theme (the host's one is used for the room). Only owned
-- items can be equipped.
CREATE TABLE IF NOT EXISTS user_equipped (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot    text NOT NULL CHECK (slot IN ('pieces', 'board')),
  item_id text NOT NULL,
  PRIMARY KEY (user_id, slot),
  FOREIGN KEY (user_id, item_id) REFERENCES user_items(user_id, item_id) ON DELETE CASCADE
);

-- One row per account and finished game. The unique key makes the coin
-- award idempotent: a game can never pay the same account twice.
CREATE TABLE IF NOT EXISTS game_results (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_id       uuid NOT NULL,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id       text NOT NULL,
  won           boolean NOT NULL,
  vp            smallint NOT NULL CHECK (vp >= 0),
  coins_awarded integer NOT NULL CHECK (coins_awarded >= 0),
  ended_by      text NOT NULL CHECK (ended_by IN ('victory', 'vote')),
  players       smallint NOT NULL,
  duration_s    integer NOT NULL CHECK (duration_s >= 0),
  played_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, user_id)
);

CREATE INDEX IF NOT EXISTS game_results_user_idx ON game_results (user_id, played_at DESC);
