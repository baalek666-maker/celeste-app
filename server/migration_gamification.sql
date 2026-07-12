-- Céleste — Gamification & Premium Features Migration

-- Gamification: XP & Levels
CREATE TABLE IF NOT EXISTS user_xp (
    user_id INTEGER PRIMARY KEY,
    xp_total INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    updated_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Gamification: Daily Quests
CREATE TABLE IF NOT EXISTS daily_quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    quest_key TEXT NOT NULL,
    quest_label TEXT NOT NULL,
    xp_reward INTEGER DEFAULT 10,
    completed INTEGER DEFAULT 0,
    completed_at INTEGER,
    UNIQUE(user_id, date, quest_key),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Gamification: Badges/Achievements
CREATE TABLE IF NOT EXISTS user_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    badge_id TEXT NOT NULL,
    earned_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(user_id, badge_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Gamification: XP transaction log
CREATE TABLE IF NOT EXISTS xp_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Astrological Portrait cache
CREATE TABLE IF NOT EXISTS astro_portraits (
    user_id INTEGER PRIMARY KEY,
    portrait TEXT NOT NULL,
    word_count INTEGER,
    generated_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Cosmic events cache
CREATE TABLE IF NOT EXISTS cosmic_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_date TEXT NOT NULL,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    emoji TEXT,
    UNIQUE(event_date, event_type, title)
);

-- Horoscope accuracy feedback
CREATE TABLE IF NOT EXISTS horoscope_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    rating INTEGER NOT NULL,
    note TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
