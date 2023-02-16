// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/// @dev This contract is only used for testing bitwise operations.
contract BitwiseOperationsTester {
    function joinSeriesAndEditionId(uint16 seriesId, uint8 editionId)
        public
        pure
        returns (uint24 seriesAndEditionId)
    {
        // Shift the uint16 value left by 8 bits to make room for the uint8 value
        // Add the uint8 value to the uint24 value
        seriesAndEditionId = (seriesId << 8) | editionId;
    }

    function splitSeriesAndEditionId(uint24 seriesAndEditionId)
        public
        pure
        returns (uint16 seriesId, uint8 editionId)
    {
        // Mask the top 8 bits of the uint24 value to get the uint8 value
        editionId = uint8(seriesAndEditionId & 0xFF);
        // Shift the uint24 value right by 8 bits to get the uint16 value
        seriesId = uint16(seriesAndEditionId >> 8);
    }
}
