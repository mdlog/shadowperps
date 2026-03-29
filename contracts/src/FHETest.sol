// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title FHETest — minimal test to verify CoFHE works on this chain
contract FHETest {
    euint64 public lastEncrypted;
    bool public lastSuccess;

    /// @notice Test trivial encrypt (plaintext -> encrypted)
    function testTrivialEncrypt(uint256 value) external {
        lastEncrypted = FHE.asEuint64(value);
        FHE.allowThis(lastEncrypted);
        FHE.allowSender(lastEncrypted);
        lastSuccess = true;
    }

    /// @notice Test encrypted add
    function testAdd(uint256 a, uint256 b) external {
        euint64 encA = FHE.asEuint64(a);
        euint64 encB = FHE.asEuint64(b);
        lastEncrypted = FHE.add(encA, encB);
        FHE.allowThis(lastEncrypted);
        FHE.allowSender(lastEncrypted);
        lastSuccess = true;
    }
}
