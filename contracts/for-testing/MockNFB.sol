// SPDX-License-Identifier: MIT
// NFB Contracts v0.0.7
pragma solidity ^0.8.0;

import "../NFBUpgradeable.sol";

contract MockNFB is NFBUpgradeable {
    function initialize(
        string memory name,
        string memory symbol,
        address _owner
    ) public initializer initializerERC721A {
        __NFBUpgradeable_init(name, symbol, _owner);
    }
}
