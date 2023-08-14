// SPDX-License-Identifier: MIT
// NFB Contracts v0.1.2
pragma solidity ^0.8.9;

/// @dev This contract is only used for testing bitwise operations.
contract BitwiseOperationsTester {
    function joinSeriesEditionAndVariant(
        uint8 seriesId,
        uint8 editionId,
        uint8 variantId
    ) public pure returns (uint24 combinedValue) {
        // Shift the uint8 series left by 16 bits to make room for the edition and variant values
        // Shift the uint8 edition left by 8 bits to make room for the variant value
        // Add all values to the uint24 combinedValue
        combinedValue =
            (uint24(seriesId) << 16) |
            (uint24(editionId) << 8) |
            variantId;
    }

    function splitSeriesEditionAndVariant(
        uint24 combinedValue
    ) public pure returns (uint8 seriesId, uint8 editionId, uint8 variantId) {
        // Mask the least significant 8 bits of the uint24 value to get the variant value
        variantId = uint8(combinedValue & 0xFF);
        // Shift the uint24 value right by 8 bits and mask the least significant 8 bits to get the edition value
        editionId = uint8((combinedValue >> 8) & 0xFF);
        // Shift the uint24 value right by 16 bits to get the series value
        seriesId = uint8(combinedValue >> 16);
    }
}
