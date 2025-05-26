// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Ownable} from "solady/auth/Ownable.sol";
import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";

contract PollingCenter is Ownable, ReentrancyGuard {
    struct Poll {
        string pollId;
        address creator;
        uint256 creatorFid;
        uint256 expiresAt;
        uint256 optionCount;
        bool active;
    }

    struct Vote {
        uint256 voterFid;
        uint256 optionIndex;
        uint256 timestamp;
    }

    mapping(string => Poll) public polls;
    mapping(string => mapping(uint256 => Vote)) public votes;
    mapping(string => mapping(uint256 => bool)) public hasVoted;
    mapping(string => uint256) public voteCount;

    event PollCreated(
        string indexed pollId,
        address indexed creator,
        uint256 indexed creatorFid,
        uint256 expiresAt
    );

    event VoteCast(
        string indexed pollId,
        address indexed voter,
        uint256 indexed fid,
        uint256 optionIndex
    );

    error PollAlreadyExists();
    error PollNotFound();
    error PollExpired();
    error PollInactive();
    error InvalidOptionIndex();
    error AlreadyVoted();
    error InvalidDuration();
    error InvalidOptionCount();

    constructor() {
        _initializeOwner(msg.sender);
    }

    function createPoll(
        string calldata pollId,
        uint256 creatorFid,
        uint256 durationDays,
        uint256 optionCount
    ) external nonReentrant {
        if (bytes(polls[pollId].pollId).length != 0) {
            revert PollAlreadyExists();
        }

        if (durationDays == 0 || durationDays > 30) {
            revert InvalidDuration();
        }

        if (optionCount < 2 || optionCount > 10) {
            revert InvalidOptionCount();
        }

        uint256 expiresAt = block.timestamp + (durationDays * 1 days);

        polls[pollId] = Poll({
            pollId: pollId,
            creator: msg.sender,
            creatorFid: creatorFid,
            expiresAt: expiresAt,
            optionCount: optionCount,
            active: true
        });

        emit PollCreated(pollId, msg.sender, creatorFid, expiresAt);
    }

    function submitVote(
        string calldata pollId,
        uint256 optionIndex,
        uint256 voterFid
    ) external nonReentrant {
        Poll storage poll = polls[pollId];
        
        if (bytes(poll.pollId).length == 0) {
            revert PollNotFound();
        }

        if (!poll.active) {
            revert PollInactive();
        }

        if (block.timestamp >= poll.expiresAt) {
            revert PollExpired();
        }

        if (optionIndex >= poll.optionCount) {
            revert InvalidOptionIndex();
        }

        if (hasVoted[pollId][voterFid]) {
            revert AlreadyVoted();
        }

        hasVoted[pollId][voterFid] = true;
        votes[pollId][voteCount[pollId]] = Vote({
            voterFid: voterFid,
            optionIndex: optionIndex,
            timestamp: block.timestamp
        });

        voteCount[pollId]++;

        emit VoteCast(pollId, msg.sender, voterFid, optionIndex);
    }

    function getPoll(string calldata pollId) external view returns (Poll memory) {
        if (bytes(polls[pollId].pollId).length == 0) {
            revert PollNotFound();
        }
        return polls[pollId];
    }

    function getVote(string calldata pollId, uint256 voteIndex) external view returns (Vote memory) {
        if (bytes(polls[pollId].pollId).length == 0) {
            revert PollNotFound();
        }
        if (voteIndex >= voteCount[pollId]) {
            revert("Vote index out of bounds");
        }
        return votes[pollId][voteIndex];
    }

    function hasUserVoted(string calldata pollId, uint256 fid) external view returns (bool) {
        return hasVoted[pollId][fid];
    }

    function getTotalVotes(string calldata pollId) external view returns (uint256) {
        return voteCount[pollId];
    }

    function isPollActive(string calldata pollId) external view returns (bool) {
        Poll storage poll = polls[pollId];
        return poll.active && block.timestamp < poll.expiresAt;
    }

    function deactivatePoll(string calldata pollId) external {
        Poll storage poll = polls[pollId];
        
        if (bytes(poll.pollId).length == 0) {
            revert PollNotFound();
        }

        if (msg.sender != poll.creator && msg.sender != owner()) {
            revert("Not authorized");
        }

        poll.active = false;
    }
}