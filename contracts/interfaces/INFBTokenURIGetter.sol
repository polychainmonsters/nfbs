// SPDX-License-Identifier: MIT
// NFB Contracts v0.1.1
pragma solidity ^0.8.9;

interface INFBTokenURIGetter {
    /// @dev Returns the token URI for the given token ID, series ID and edition ID.
    function tokenURI(
        uint256 tokenId,
        uint8 seriesId,
        uint8 editionId,
        uint8 variantId
    ) external view returns (string memory);
}
