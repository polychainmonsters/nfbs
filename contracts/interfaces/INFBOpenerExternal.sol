// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface INFBOpenerExternal {
    /// @dev Implement this function to make your NFB opener compatible with NFB. Only important if you want to support opening
    /// directly through the NFB contract.
    function openViaNfb(
        uint16 seriesId,
        uint8 editionId,
        uint256 amount,
        address to
    ) external;
}
