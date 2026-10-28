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

-- Items bought in the shop. item_id is a catalogue key defined in code
-- (server/src/shop/catalog.js), e.g. 'pieces:temple' or 'board:night'. The
-- free default items ('pieces:classic', 'board:classic') are never stored:
-- everyone owns them. The primary key makes a purchase idempotent.
CREATE TABLE IF NOT EXISTS user_items (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     text NOT NULL CHECK (char_length(item_id) BETWEEN 1 AND 64),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

-- What is equipped in each slot: piece skins (seen by everyone in the game)
-- and the board theme (the host's one is used for the room). Only owned
-- items can be equipped; no row = the slot's free default.
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
-- Ranking (most wins, all time / this week)
CREATE INDEX IF NOT EXISTS game_results_wins_idx ON game_results (played_at DESC, user_id) WHERE won;

-- ─── Admin panel (phase A) ───
-- Role and moderation status of an account. 'suspended' is only effective
-- while suspended_until is in the future; 'banned' is permanent until lifted.
-- ADMIN_EMAILS (env, comma-separated) also grants 'admin' on sign-in.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'player';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('player', 'admin'));
  END IF;
END $$;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended', 'banned'));
  END IF;
END $$;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason text CHECK (ban_reason IS NULL OR char_length(ban_reason) <= 300);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role) WHERE role = 'admin';
CREATE INDEX IF NOT EXISTS users_created_idx ON users (created_at DESC);

-- Board used in each finished game (admin stats; NULL for older rows)
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS board_type text CHECK (board_type IS NULL OR board_type IN ('standard', 'extended'));
CREATE INDEX IF NOT EXISTS game_results_played_idx ON game_results (played_at DESC);

-- Audit log: one row per admin action (who, what, on what, details)
CREATE TABLE IF NOT EXISTS admin_actions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  action      text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 64),
  target_type text CHECK (target_type IS NULL OR char_length(target_type) <= 32),
  target_id   text CHECK (target_id IS NULL OR char_length(target_id) <= 128),
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_actions_created_idx ON admin_actions (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS admin_actions_action_idx ON admin_actions (action, id DESC);
CREATE INDEX IF NOT EXISTS admin_actions_admin_idx ON admin_actions (admin_id, id DESC);

-- Server-wide settings that must survive restarts (e.g. 'maintenance')
CREATE TABLE IF NOT EXISTS app_settings (
  key        text PRIMARY KEY CHECK (char_length(key) BETWEEN 1 AND 64),
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);
