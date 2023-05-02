// SPDX-License-Identifier: MIT
// NFB Contracts v0.0.4
pragma solidity ^0.8.9;

interface INFBPurchaserCustomHandler {
    function onNFBPurchase(
        address purchaser,
        uint256 amount,
        uint16 seriesId,
        uint8 editionId
    ) external payable;
}
