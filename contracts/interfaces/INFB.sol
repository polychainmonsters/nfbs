// SPDX-License-Identifier: MIT
// NFB Contracts v0.1.2
pragma solidity ^0.8.9;

interface INFB {
    /// @dev Series is meant to be used like this:
    /// Name = Polychain Monsters Gen1, Description = First generation of Polychain Monsters.
    struct Series {
        string name;
        string description;
    }

    /// @dev Every series can have multiple editions, for example to have a limited 1. edition.
    struct Edition {
        uint256 availableFrom;
        uint256 availableUntil;
        string description;
    }

    function burn(uint256 tokenId) external;

    function ownerOf(uint256 tokenId) external view returns (address owner);

    function mint(
        address to,
        uint256 amount,
        uint8 seriesId,
        uint8 editionId,
        uint8 variantId
    ) external returns (uint256 startTokenId);

    function editions(
        uint8 seriesId,
        uint8 id
    )
        external
        view
        returns (
            uint256 availableFrom,
            uint256 availableUntil,
            string memory description
        );

    function series(
        uint8 id
    ) external view returns (string memory name, string memory description);

    function getSeriesEditionAndVariant(
        uint256 tokenId
    ) external view returns (uint8 seriesId, uint8 editionId, uint8 variantId);
}
