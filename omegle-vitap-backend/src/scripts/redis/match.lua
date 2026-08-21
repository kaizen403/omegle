---@diagnostic disable: undefined-global, lowercase-global
-- Smart matching algorithm with priority-based selection
-- Priority 1: Opposite gender
-- Priority 2: Same gender
-- Priority 3: Allow consecutive match (but only once with same user)
--
-- BOT MATCHING RULES:
-- - Bots (isBot=true) can ONLY match with real users (isBot=false/nil)
-- - Real users can match with bots or real users
-- - Bot-to-bot matching is NEVER allowed
--
-- GLOBALS (provided by Redis runtime):
--   redis: Redis command interface
--   KEYS: Array of key arguments
--   ARGV: Array of value arguments
--   cjson: JSON encoding/decoding library
--
-- KEYS[1]: queueKey (sorted set of waiting users)
-- ARGV[1]: currentUID (user requesting match)
-- ARGV[2]: currentData (current user data with gender)
--
-- Returns: matched user data (JSON string) or nil if no match found

local queueKey = KEYS[1]
local currentUID = tonumber(ARGV[1])
local currentData = ARGV[2]

-- Parse current user to get gender and bot status
local currentUserObj = cjson.decode(currentData)
local currentGender = currentUserObj.gender
local currentIsBot = currentUserObj.isBot or false

-- Get last matched partner (to prevent immediate consecutive rematch)
local lastPartnerKey = 'user:last_partner:' .. currentUID
local lastPartnerUID = redis.call('GET', lastPartnerKey)
if lastPartnerUID then
    lastPartnerUID = tonumber(lastPartnerUID)
end

-- Get all users in queue
local allUsers = redis.call('ZRANGE', queueKey, 0, -1)

-- Get current time for random seed
local time = redis.call('TIME')
local timestamp_sec = tonumber(time[1])
local timestamp_usec = tonumber(time[2])

-- CRITICAL: Check if current user is already in an active room
local currentRoomKey = 'user:room:' .. currentUID
local currentUserRoom = redis.call('GET', currentRoomKey)
if currentUserRoom and currentUserRoom ~= '' and currentUserRoom ~= 'null' then
    return nil
end

-- Separate candidates by priority
local oppositeGenderCandidates = {}      -- Priority 1: Opposite gender (no consecutive)
local sameGenderCandidates = {}          -- Priority 2: Same gender (no consecutive)
local oppositeGenderConsecutive = {}     -- Priority 3: Opposite gender with consecutive
local sameGenderConsecutive = {}         -- Priority 4: Same gender with consecutive

for i = 1, #allUsers do
    local userData = allUsers[i]
    local userObj = cjson.decode(userData)
    local userUID = tonumber(userObj.uid)
    local userGender = userObj.gender
    local userIsBot = userObj.isBot or false
    
    -- Skip self
    if userUID ~= currentUID then
        -- BOT MATCHING RULE: Prevent bot-to-bot matching
        -- If current user is a bot, skip other bots
        -- If current user is real, allow matching with anyone
        local allowMatch = true
        if currentIsBot and userIsBot then
            allowMatch = false  -- Bot cannot match with another bot
        end
        
        if allowMatch then
            -- Check if candidate is already in an active room
            local candidateRoomKey = 'user:room:' .. userUID
            local candidateRoom = redis.call('GET', candidateRoomKey)
            
            if not candidateRoom or candidateRoom == '' or candidateRoom == 'null' then
                -- Check if this was the last partner (consecutive match)
                local isLastPartner = (lastPartnerUID and userUID == lastPartnerUID)
                
                if userGender ~= currentGender then
                    -- Opposite gender
                    if not isLastPartner then
                        table.insert(oppositeGenderCandidates, userData)  -- Priority 1
                    else
                        table.insert(oppositeGenderConsecutive, userData)  -- Priority 3
                    end
                else
                    -- Same gender
                    if not isLastPartner then
                        table.insert(sameGenderCandidates, userData)  -- Priority 2
                    else
                        table.insert(sameGenderConsecutive, userData)  -- Priority 4
                    end
                end
            end
        end
    end
end

-- Select from priority tiers
local selectedCandidates = {}
local matchPriority = ''

if #oppositeGenderCandidates > 0 then
    -- Priority 1: Opposite gender (no consecutive)
    selectedCandidates = oppositeGenderCandidates
    matchPriority = 'opposite_gender'
elseif #sameGenderCandidates > 0 then
    -- Priority 2: Same gender (no consecutive)
    selectedCandidates = sameGenderCandidates
    matchPriority = 'same_gender'
elseif #oppositeGenderConsecutive > 0 then
    -- Priority 3: Opposite gender with consecutive match
    selectedCandidates = oppositeGenderConsecutive
    matchPriority = 'opposite_consecutive'
elseif #sameGenderConsecutive > 0 then
    -- Priority 4: Same gender with consecutive match
    selectedCandidates = sameGenderConsecutive
    matchPriority = 'same_consecutive'
else
    -- No candidates available at all
    return nil
end

-- Random selection using Fisher-Yates shuffle
local entropy = (timestamp_sec * 1000000 + timestamp_usec + currentUID * 997) % 2147483647

local function random(max_val, seed)
    local a = 1664525
    local c = 1013904223
    local m = 2147483648
    local next_seed = (a * seed + c) % m
    return (next_seed % max_val) + 1, next_seed
end

-- Shuffle candidates
local seed = entropy
for i = #selectedCandidates, 2, -1 do
    local j, new_seed = random(i, seed)
    seed = new_seed
    selectedCandidates[i], selectedCandidates[j] = selectedCandidates[j], selectedCandidates[i]
end

-- Select first candidate
local selectedUser = selectedCandidates[1]
local matchedObj = cjson.decode(selectedUser)
local matchedUID = tonumber(matchedObj.uid)

-- Store last partner to prevent immediate consecutive rematch
redis.call('SETEX', lastPartnerKey, 300, tostring(matchedUID))  -- 5 min TTL
local partnerLastKey = 'user:last_partner:' .. matchedUID
redis.call('SETEX', partnerLastKey, 300, tostring(currentUID))  -- 5 min TTL

-- CRITICAL: Atomically remove BOTH users from queue to prevent double-matching
redis.call('ZREM', queueKey, selectedUser)
redis.call('ZREM', queueKey, currentData)

return selectedUser
