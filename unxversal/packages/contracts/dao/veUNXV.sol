// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title VeUNXV
 * @notice Voting escrow for UNXV token - lock UNXV for veUNXV (voting power)
 */
contract VeUNXV is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Point {
        int128 bias;    // Voting power at timestamp
        int128 slope;   // Voting power change per time unit
        uint256 ts;     // Timestamp of last checkpoint
        uint256 blk;    // Block of last checkpoint
    }

    struct LockedBalance {
        int128 amount;
        uint256 end;
    }

    uint256 public constant WEEK = 7 days;
    uint256 public constant MAXTIME = 4 * 365 days; // 4 years
    uint256 public constant MULTIPLIER = 10**18;

    address public immutable token;
    uint256 public supply;

    mapping(address => LockedBalance) public locked;
    mapping(address => address) public voting_delegates;
    
    mapping(uint256 => Point) public point_history;
    mapping(address => mapping(uint256 => Point)) public user_point_history;
    mapping(address => uint256) public user_point_epoch;
    uint256 public epoch;

    event Deposit(address indexed provider, uint256 value, uint256 locktime, uint256 type_, uint256 ts);
    event Withdraw(address indexed provider, uint256 value, uint256 ts);
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);

    constructor(address _token) {
        token = _token;
        point_history[0] = Point({
            bias: 0,
            slope: 0,
            ts: block.timestamp,
            blk: block.number
        });
    }

    /**
     * @notice Get the voting power for an account
     * @param addr Account to get voting power for
     * @param _t Timestamp to get voting power at
     * @return Voting power
     */
    function balanceOf(address addr, uint256 _t) public view returns (uint256) {
        uint256 _epoch = user_point_epoch[addr];
        if (_epoch == 0) {
            return 0;
        }

        Point memory last_point = user_point_history[addr][_epoch];
        last_point.bias -= last_point.slope * int128(uint128(_t - last_point.ts));
        if (last_point.bias < 0) {
            last_point.bias = 0;
        }
        return uint256(uint128(last_point.bias));
    }

    /**
     * @notice Record global and per-user data to checkpoint
     * @param addr User address
     * @param old_locked Previous locked balance / end lock time for user
     * @param new_locked New locked balance / end lock time for user
     */
    function _checkpoint(
        address addr,
        LockedBalance memory old_locked,
        LockedBalance memory new_locked
    ) internal {
        Point memory u_old;
        Point memory u_new;
        int128 old_dslope = 0;
        int128 new_dslope = 0;
        uint256 _epoch = epoch;

        if (addr != address(0)) {
            // Calculate slopes and biases
            // Kept at zero when they have to
            if (old_locked.end > block.timestamp && old_locked.amount > 0) {
                u_old.slope = old_locked.amount / int128(uint128(MAXTIME));
                u_old.bias = u_old.slope * int128(uint128(old_locked.end - block.timestamp));
            }
            if (new_locked.end > block.timestamp && new_locked.amount > 0) {
                u_new.slope = new_locked.amount / int128(uint128(MAXTIME));
                u_new.bias = u_new.slope * int128(uint128(new_locked.end - block.timestamp));
            }

            // Read values of scheduled changes in the slope
            // old_locked.end can be in the past and in the future
            // new_locked.end can ONLY by in the FUTURE unless everything expired: than zeros
            old_dslope = u_old.slope;
            new_dslope = u_new.slope;
        }

        Point memory last_point = Point({
            bias: 0,
            slope: 0,
            ts: block.timestamp,
            blk: block.number
        });
        if (_epoch > 0) {
            last_point = point_history[_epoch];
        }
        uint256 last_checkpoint = last_point.ts;
        
        // initial_last_point is used for extrapolation to calculate block number
        // (approximately, for *At methods) and save them
        // as we cannot figure that out exactly from inside the contract
        Point memory initial_last_point = last_point;
        uint256 block_slope = 0; // dblock/dt
        if (block.timestamp > last_point.ts) {
            block_slope =
                (MULTIPLIER * (block.number - last_point.blk)) /
                (block.timestamp - last_point.ts);
        }

        // If last point is already recorded in this block, slope=0
        // But that's ok b/c we know the block in such case
        
        // Go over weeks to fill history and calculate what the current point is
        uint256 t_i = (last_checkpoint / WEEK) * WEEK;
        for (uint256 i = 0; i < 255; ++i) {
            // Hopefully it won't happen that this won't get used in 5 years!
            // If it does, users will be able to withdraw but vote weight will be broken
            t_i += WEEK;
            int128 d_slope = 0;
            if (t_i > block.timestamp) {
                t_i = block.timestamp;
            } else {
                d_slope = new_dslope;
            }
            last_point.bias -= last_point.slope * int128(uint128(t_i - last_checkpoint));
            last_point.slope += d_slope;
            if (last_point.bias < 0) {
                // This can happen
                last_point.bias = 0;
            }
            if (last_point.slope < 0) {
                // This cannot happen - just in case
                last_point.slope = 0;
            }
            last_checkpoint = t_i;
            last_point.ts = t_i;
            last_point.blk = initial_last_point.blk + uint256(
                (block_slope * (t_i - initial_last_point.ts)) / MULTIPLIER
            );
            _epoch += 1;
            if (t_i == block.timestamp) {
                last_point.blk = block.number;
                break;
            } else {
                point_history[_epoch] = last_point;
            }
        }

        epoch = _epoch;
        // Now point_history is filled until t=now

        if (addr != address(0)) {
            // Schedule new point
            last_point.slope += (u_new.slope - u_old.slope);
            last_point.bias += (u_new.bias - u_old.bias);
            if (last_point.slope < 0) {
                last_point.slope = 0;
            }
            if (last_point.bias < 0) {
                last_point.bias = 0;
            }
        }

        // Record the changed point into history
        point_history[_epoch] = last_point;

        if (addr != address(0)) {
            // Schedule the slope changes (slope is going down)
            // We subtract new_user_slope from [new_locked.end]
            // and add old_user_slope to [old_locked.end]
            if (old_locked.end > block.timestamp) {
                // old_dslope was <something> - u_old.slope, so we cancel that
                old_dslope += u_old.slope;
            }
            if (new_locked.end > block.timestamp) {
                new_dslope -= u_new.slope; // new_dslope was <something> + u_new.slope
            }
        }

        // Now handle user history
        if (addr != address(0)) {
            uint256 user_epoch = user_point_epoch[addr] + 1;
            user_point_epoch[addr] = user_epoch;
            u_new.ts = block.timestamp;
            u_new.blk = block.number;
            user_point_history[addr][user_epoch] = u_new;
        }
    }

    /**
     * @notice Deposit and lock tokens for a user
     * @param _value Amount to deposit
     * @param _unlock_time New time when to unlock the tokens, or 0 for existing lock
     */
    function deposit_for(uint256 _value, uint256 _unlock_time) external nonReentrant {
        require(_value > 0, "Cannot deposit 0");
        require(_unlock_time > block.timestamp, "Cannot lock in past");
        require(_unlock_time <= block.timestamp + MAXTIME, "Voting lock cannot exceed max time");

        LockedBalance memory _locked = locked[msg.sender];
        require(_locked.amount == 0, "Withdraw old tokens first");

        supply += _value;
        LockedBalance memory old_locked = _locked;
        _locked.amount = int128(uint128(_value));
        _locked.end = _unlock_time;
        locked[msg.sender] = _locked;

        // Transfer tokens
        IERC20(token).safeTransferFrom(msg.sender, address(this), _value);

        // Checkpoint
        _checkpoint(msg.sender, old_locked, _locked);

        emit Deposit(msg.sender, _value, _unlock_time, 1, block.timestamp);
    }

    /**
     * @notice Withdraw all tokens for `msg.sender`
     * @dev Only possible if the lock has expired
     */
    function withdraw() external nonReentrant {
        LockedBalance memory _locked = locked[msg.sender];
        require(block.timestamp >= _locked.end, "The lock didn't expire");
        uint256 value = uint256(uint128(_locked.amount));

        LockedBalance memory old_locked = _locked;
        _locked.end = 0;
        _locked.amount = 0;
        locked[msg.sender] = _locked;
        supply -= value;

        // Transfer tokens
        IERC20(token).safeTransfer(msg.sender, value);

        // Checkpoint
        _checkpoint(msg.sender, old_locked, _locked);

        emit Withdraw(msg.sender, value, block.timestamp);
    }

    /**
     * @notice Delegate voting power to another address
     * @param delegatee The address to delegate to
     */
    function delegate(address delegatee) external {
        require(delegatee != address(0), "Cannot delegate to zero address");
        address currentDelegate = voting_delegates[msg.sender];
        voting_delegates[msg.sender] = delegatee;
        emit DelegateChanged(msg.sender, currentDelegate, delegatee);
    }
}
