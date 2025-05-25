PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE polls (
  id TEXT PRIMARY KEY,                        
  creator_fid INTEGER NOT NULL,              
  question TEXT NOT NULL,                    
  duration_days INTEGER NOT NULL,            
  created_at INTEGER DEFAULT (strftime('%s', 'now')), 
  expires_at INTEGER NOT NULL,               
  status TEXT DEFAULT 'active',              
  total_votes INTEGER DEFAULT 0,             
  
  CHECK (duration_days IN (1, 3, 7)),
  CHECK (status IN ('active', 'expired', 'deleted'))
);
CREATE TABLE poll_options (
  id TEXT PRIMARY KEY,                        
  poll_id TEXT NOT NULL,                     
  option_index INTEGER NOT NULL,             
  option_text TEXT NOT NULL,                 
  vote_count INTEGER DEFAULT 0,              
  
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
  UNIQUE(poll_id, option_index)
);
CREATE TABLE votes (
  id TEXT PRIMARY KEY,                        
  poll_id TEXT NOT NULL,                     
  voter_fid INTEGER NOT NULL,                
  option_index INTEGER NOT NULL,             
  transaction_hash TEXT,                     
  block_number INTEGER,                      
  voted_at INTEGER DEFAULT (strftime('%s', 'now')), 
  
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
  
  
  UNIQUE(poll_id, voter_fid)
);
CREATE TABLE vote_transactions (
  transaction_hash TEXT PRIMARY KEY,         
  vote_id TEXT NOT NULL,                     
  block_number INTEGER,                      
  block_hash TEXT,                          
  gas_used INTEGER,                         
  status TEXT DEFAULT 'pending',            
  verified_at INTEGER,                      
  created_at INTEGER DEFAULT (strftime('%s', 'now')), 
  
  FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE,
  CHECK (status IN ('pending', 'confirmed', 'failed'))
);
CREATE TABLE poll_reactions (
  id TEXT PRIMARY KEY,                        
  poll_id TEXT NOT NULL,                     
  reactor_fid INTEGER NOT NULL,              
  emoji TEXT NOT NULL,                       
  created_at INTEGER DEFAULT (strftime('%s', 'now')), 
  
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
  
  
  UNIQUE(poll_id, reactor_fid)
);
CREATE TABLE neynar_user_cache (
  fid INTEGER PRIMARY KEY,                   
  username TEXT,                            
  display_name TEXT,                        
  pfp_url TEXT,                            
  bio TEXT,                                
  follower_count INTEGER,                   
  following_count INTEGER,                  
  power_badge INTEGER DEFAULT 0,            
  cached_at INTEGER DEFAULT (strftime('%s', 'now')), 
  expires_at INTEGER,                       
  
  
  CHECK (expires_at = cached_at + 86400)
);
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
CREATE TRIGGER cleanup_expired_cache
AFTER INSERT ON neynar_user_cache
FOR EACH ROW
BEGIN
  DELETE FROM neynar_user_cache 
  WHERE expires_at < strftime('%s', 'now');
END;
CREATE TRIGGER set_cache_expiration
BEFORE INSERT ON neynar_user_cache
FOR EACH ROW
WHEN NEW.expires_at IS NULL
BEGIN
  UPDATE neynar_user_cache 
  SET expires_at = NEW.cached_at + 86400
  WHERE fid = NEW.fid;
END;