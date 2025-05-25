-- Polling Center Database Schema for Cloudflare D1 (SQLite)
-- No users table - all user info fetched from Neynar API by FID
-- Votes are immutable (onchain) - no updates or deletes allowed

-- Polls table
CREATE TABLE polls (
  id TEXT PRIMARY KEY,                        -- UUID as TEXT for SQLite
  creator_fid INTEGER NOT NULL,              -- FID of poll creator (from Frame/JWT)
  question TEXT NOT NULL,                    -- Poll question (max 280 chars in validation)
  duration_days INTEGER NOT NULL,            -- 1, 3, or 7 days
  created_at INTEGER DEFAULT (strftime('%s', 'now')), -- Unix timestamp
  expires_at INTEGER NOT NULL,               -- Unix timestamp (created_at + duration)
  status TEXT DEFAULT 'active',              -- 'active', 'expired', 'deleted'
  total_votes INTEGER DEFAULT 0,             -- cached vote count for performance
  image_url TEXT,                           -- URL to generated poll image in R2
  
  CHECK (duration_days IN (1, 3, 7)),
  CHECK (status IN ('active', 'expired', 'deleted'))
);

-- Poll options table
CREATE TABLE poll_options (
  id TEXT PRIMARY KEY,                        -- UUID as TEXT
  poll_id TEXT NOT NULL,                     -- Reference to poll
  option_index INTEGER NOT NULL,             -- 0, 1, 2, etc.
  option_text TEXT NOT NULL,                 -- Option text (max 100 chars)
  vote_count INTEGER DEFAULT 0,              -- cached vote count for performance
  
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
  UNIQUE(poll_id, option_index)
);

-- Votes table (immutable - onchain votes cannot be modified or deleted)
CREATE TABLE votes (
  id TEXT PRIMARY KEY,                        -- UUID as TEXT
  poll_id TEXT NOT NULL,                     -- Reference to poll
  voter_fid INTEGER NOT NULL,                -- FID of voter (no user table lookup)
  option_index INTEGER NOT NULL,             -- Which option was selected (immutable)
  transaction_hash TEXT,                     -- Blockchain transaction hash (optional initially)
  block_number INTEGER,                      -- Block number for verification
  voted_at INTEGER DEFAULT (strftime('%s', 'now')), -- Unix timestamp
  
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
  
  -- Prevent duplicate votes per poll per user (onchain ensures this too)
  UNIQUE(poll_id, voter_fid)
);

-- Vote transactions table (for blockchain verification)
CREATE TABLE vote_transactions (
  transaction_hash TEXT PRIMARY KEY,         -- Blockchain transaction hash
  vote_id TEXT NOT NULL,                     -- Reference to vote
  block_number INTEGER,                      -- Block number
  block_hash TEXT,                          -- Block hash
  gas_used INTEGER,                         -- Gas used for transaction
  status TEXT DEFAULT 'pending',            -- 'pending', 'confirmed', 'failed'
  verified_at INTEGER,                      -- Unix timestamp when verified
  created_at INTEGER DEFAULT (strftime('%s', 'now')), -- Unix timestamp
  
  FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE,
  CHECK (status IN ('pending', 'confirmed', 'failed'))
);

-- Reactions table (for emoji reactions on poll results - from design mockups)
CREATE TABLE poll_reactions (
  id TEXT PRIMARY KEY,                        -- UUID as TEXT
  poll_id TEXT NOT NULL,                     -- Reference to poll
  reactor_fid INTEGER NOT NULL,              -- FID of user who reacted (no user table)
  emoji TEXT NOT NULL,                       -- Emoji unicode (heart, smiley, nervous, etc.)
  created_at INTEGER DEFAULT (strftime('%s', 'now')), -- Unix timestamp
  
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
  
  -- One reaction per user per poll
  UNIQUE(poll_id, reactor_fid)
);

-- User info cache table (for Neynar API responses)
CREATE TABLE neynar_user_cache (
  fid INTEGER PRIMARY KEY,                   -- Farcaster ID
  username TEXT,                            -- From Neynar API
  display_name TEXT,                        -- From Neynar API
  pfp_url TEXT,                            -- Profile picture URL from Neynar
  bio TEXT,                                -- Bio from Neynar
  follower_count INTEGER,                   -- Follower count from Neynar
  following_count INTEGER,                  -- Following count from Neynar
  power_badge INTEGER DEFAULT 0,            -- Boolean as INTEGER (0/1)
  cached_at INTEGER DEFAULT (strftime('%s', 'now')), -- When cached
  expires_at INTEGER,                       -- Cache expiration (24h from cached_at)
  
  -- Auto-expire cache after 24 hours
  CHECK (expires_at = cached_at + 86400)
);

-- Indexes for performance
CREATE INDEX idx_polls_creator_fid ON polls(creator_fid);
CREATE INDEX idx_polls_status_expires ON polls(status, expires_at);
CREATE INDEX idx_polls_created_at ON polls(created_at DESC);

CREATE INDEX idx_poll_options_poll_id ON poll_options(poll_id);

CREATE INDEX idx_votes_poll_id ON votes(poll_id);
CREATE INDEX idx_votes_voter_fid ON votes(voter_fid);
CREATE INDEX idx_votes_voted_at ON votes(voted_at DESC);
CREATE INDEX idx_votes_transaction_hash ON votes(transaction_hash);

CREATE INDEX idx_vote_transactions_status ON vote_transactions(status);
CREATE INDEX idx_vote_transactions_block_number ON vote_transactions(block_number);

CREATE INDEX idx_poll_reactions_poll_id ON poll_reactions(poll_id);

CREATE INDEX idx_neynar_cache_expires ON neynar_user_cache(expires_at);

-- Triggers to maintain vote counts (only inserts, no updates/deletes for votes)

-- Update poll option vote count when vote is inserted
CREATE TRIGGER update_option_vote_count_insert
AFTER INSERT ON votes
FOR EACH ROW
BEGIN
  UPDATE poll_options 
  SET vote_count = vote_count + 1
  WHERE poll_id = NEW.poll_id AND option_index = NEW.option_index;
  
  UPDATE polls 
  SET total_votes = total_votes + 1
  WHERE id = NEW.poll_id;
END;

-- Clean up expired cache entries (triggered on cache access)
CREATE TRIGGER cleanup_expired_cache
AFTER INSERT ON neynar_user_cache
FOR EACH ROW
BEGIN
  DELETE FROM neynar_user_cache 
  WHERE expires_at < strftime('%s', 'now');
END;

-- Auto-set cache expiration
CREATE TRIGGER set_cache_expiration
BEFORE INSERT ON neynar_user_cache
FOR EACH ROW
WHEN NEW.expires_at IS NULL
BEGIN
  UPDATE neynar_user_cache 
  SET expires_at = NEW.cached_at + 86400
  WHERE fid = NEW.fid;
END;