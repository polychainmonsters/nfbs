// SPDX-License-Identifier: MIT
// NFB Contracts v0.0.3
pragma solidity ^0.8.0;

import "../interfaces/INFB.sol";

contract MockNFB is INFB {
    mapping(uint16 => Series) public override series;
    mapping(uint16 => mapping(uint8 => Edition)) public override editions;

    constructor() {
        series[1] = Series("Mock Series", "Mock Description");
        editions[1][1] = Edition(1, 1, "Mock Edition");
    }

    function burn(uint256 tokenId) external override {}

    function getSeriesAndEdition(
        uint256 tokenId
    ) external view returns (uint16 seriesId, uint8 editionId) {
        return (1, 1);
    }

    function mint(
        address to,
        uint256 amount,
        uint16 seriesId,
        uint8 editionId
    ) external override returns (uint256 startTokenId) {
        return 0;
    }

    function ownerOf(uint256 tokenId) external view returns (address owner) {
        return address(0);
    }
}
