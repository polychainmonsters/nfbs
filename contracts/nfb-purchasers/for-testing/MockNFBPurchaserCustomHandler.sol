// SPDX-License-Identifier: MIT
// NFB Contracts v0.0.4
pragma solidity ^0.8.0;

import "../interfaces/INFBPurchaserCustomHandler.sol";

contract MockNFBPurchaserCustomHandler is INFBPurchaserCustomHandler {
    bool public purchaseDone = false;

    function onNFBPurchase(
        address purchaser,
        uint256 amount,
        uint16 seriesId,
        uint8 editionId
    ) external payable override {
        purchaseDone = true;
    }
}
