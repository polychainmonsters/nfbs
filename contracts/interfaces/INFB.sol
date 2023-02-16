// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface INFB {
    function burn(uint256 tokenId) external;

    function ownerOf(uint256 tokenId) external view returns (address owner);

    function mint(
        address to,
        uint256 amount,
        uint16 seriesId,
        uint8 editionId
    ) external returns (uint256 startTokenId);

    function editions(uint16 seriesId, uint8 id)
        external
        view
        returns (
            uint256 availableFrom,
            uint256 availableUntil,
            string memory description
        );

    function series(uint16 id)
        external
        view
        returns (string memory name, string memory description);

    function getSeriesAndEdition(uint256 tokenId)
        external
        view
        returns (uint16 seriesId, uint8 editionId);
}
