// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface INFBTokenURIGetter {
    /// @dev Returns the token URI for the given token ID, series ID and edition ID.
    function tokenURI(
        uint256 tokenId,
        uint16 seriesId,
        uint8 editionId
    ) external view returns (string memory);
}