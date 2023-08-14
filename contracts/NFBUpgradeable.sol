// SPDX-License-Identifier: MIT
// NFB Contracts v0.1.1
pragma solidity ^0.8.9;

import "erc721a-upgradeable/contracts/IERC721AUpgradeable.sol";
import "erc721a-upgradeable/contracts/ERC721AUpgradeable.sol";
import "erc721a-upgradeable/contracts/ERC721A__Initializable.sol";
import "erc721a-upgradeable/contracts/extensions/ERC721ABurnableUpgradeable.sol";
import "erc721a-upgradeable/contracts/extensions/ERC721AQueryableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./interfaces/INFBTokenURIGetter.sol";
import "./interfaces/INFB.sol";
import "./interfaces/INFBOpenerExternal.sol";

/// @dev Contract uses Ownable + AccessControl because some marketplaces allow editing collection details (e.g. royalties)
/// by the owner and not by the admin. They call the owner() function. The owner does not have any other
/// access rights in this contract.
abstract contract NFBUpgradeable is
    INFB,
    Initializable,
    OwnableUpgradeable,
    AccessControlUpgradeable,
    ERC721A__Initializable,
    ERC721AUpgradeable,
    ERC721AQueryableUpgradeable,
    ERC721ABurnableUpgradeable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    mapping(uint8 => Series) public override series;
    mapping(uint8 => mapping(uint8 => Edition)) public override editions;

    /// @dev If a series is frozen, it's data can not be updated anymore. Also no editions can be added or updated.
    mapping(uint8 => bool) public isSeriesFrozen;

    /// @dev This contract does not care about token URIs, instead it delegates that to a separate contract.
    mapping(uint8 => mapping(uint8 => INFBTokenURIGetter))
        public tokenURIGetters;

    event SeriesSet(uint8 indexed id, string indexed name, string description);
    event EditionSet(
        uint8 indexed seriesId,
        uint8 indexed editionId,
        uint256 availableFrom,
        uint256 availableUntil,
        string description
    );
    event Minted(
        address indexed to,
        uint8 indexed seriesId,
        uint8 indexed editionId,
        uint8 variantId,
        uint256 amount
    );
    event SeriesFrozen(uint8 indexed id);
    event TokenURIGetterSet(
        uint8 indexed seriesId,
        uint8 indexed editionId,
        address indexed tokenURIGetter
    );
    event NFBsOpened(
        address indexed opener,
        uint256 amount,
        address indexed to,
        uint8 seriesId,
        uint8 editionId,
        uint8 variantId
    );

    modifier seriesIsNotFrozen(uint8 id) {
        require(!isSeriesFrozen[id], "NFB: Series already frozen");
        _;
    }

    function __NFBUpgradeable_init(
        string memory name,
        string memory symbol,
        address owner
    ) internal onlyInitializing onlyInitializingERC721A {
        __Ownable_init();
        __AccessControl_init();
        __ERC721A_init(name, symbol);
        __ERC721AQueryable_init();
        __ERC721ABurnable_init();

        __NFBUpgradeable_init_unchained(owner);
    }

    function __NFBUpgradeable_init_unchained(
        address owner
    ) internal onlyInitializing onlyInitializingERC721A {
        _setupRole(DEFAULT_ADMIN_ROLE, owner);
        _setupRole(MANAGER_ROLE, owner);
    }

    /// @dev This is not meant to be a public minting function, but rather a function that can be called by other contracts.
    function mint(
        address to,
        uint256 amount,
        uint8 seriesId,
        uint8 editionId,
        uint8 variantId
    ) external override onlyRole(MINTER_ROLE) returns (uint256 startTokenId) {
        require(
            editions[seriesId][editionId].availableFrom <= block.timestamp &&
                editions[seriesId][editionId].availableUntil >= block.timestamp,
            "NFB: Series or edition is not available"
        );

        startTokenId = _totalMinted();
        _safeMint(to, amount);
        _setExtraDataAt(
            startTokenId,
            _joinSeriesEditionAndVariant(seriesId, editionId, variantId)
        );

        emit Minted(to, seriesId, editionId, variantId, amount);
    }

    /**
     * @dev Utility function for opening. Why? The opening is handled by a different contract.
     * When the user would interact directly with that contract, the user would have to
     * approve the NFB contract to transfer the NFBs. By providing an open function here,
     * the extra approval is avoided.
     */
    function open(
        INFBOpenerExternal opener,
        uint256[] memory tokenIds,
        address to
    ) external {
        require(tokenIds.length > 0, "NFB: No tokenIds provided");
        // first token will define the series and edition
        uint24 seriesEditionAndVariant = _ownershipOf(tokenIds[0]).extraData;

        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(
                _ownershipOf(tokenIds[i]).extraData == seriesEditionAndVariant,
                "NFB: Token is not part of the series and edition"
            );
            _burn(tokenIds[i]);
        }

        (
            uint8 seriesId,
            uint8 editionId,
            uint8 variantId
        ) = _splitSeriesEditionAndVariant(seriesEditionAndVariant);
        opener.openViaNfb(seriesId, editionId, tokenIds.length, to);
        emit NFBsOpened(
            address(opener),
            tokenIds.length,
            to,
            seriesId,
            editionId,
            variantId
        );
    }

    // Some extra view functions

    function getSeriesEditionAndVariant(
        uint256 tokenId
    )
        public
        view
        override
        returns (uint8 seriesId, uint8 editionId, uint8 variantId)
    {
        (seriesId, editionId, variantId) = _splitSeriesEditionAndVariant(
            _ownershipOf(tokenId).extraData
        );
    }

    // Overriding the tokenURI

    /**
     * @dev This internal helper function will not check if the token actually exists.
     */
    function tokenURIInternal(
        uint256 tokenId
    ) internal view returns (string memory) {
        (
            uint8 seriesId,
            uint8 editionId,
            uint8 variantId
        ) = _splitSeriesEditionAndVariant(_ownershipOf(tokenId).extraData);

        require(
            address(tokenURIGetters[seriesId][editionId]) != address(0),
            "NFB: No tokenURI getter set"
        );

        return
            tokenURIGetters[seriesId][editionId].tokenURI(
                tokenId,
                seriesId,
                editionId,
                variantId
            );
    }

    function tokenURI(
        uint256 tokenId
    )
        public
        view
        virtual
        override(ERC721AUpgradeable, IERC721AUpgradeable)
        returns (string memory)
    {
        require(_exists(tokenId), "NFB: Non-existent token");

        return tokenURIInternal(tokenId);
    }

    // For metadata updating by the manager(s)

    function freezeSeries(
        uint8 id
    ) external onlyRole(MANAGER_ROLE) seriesIsNotFrozen(id) {
        isSeriesFrozen[id] = true;
        emit SeriesFrozen(id);
    }

    function setTokenURIGetter(
        uint8 seriesId,
        uint8 editionId,
        INFBTokenURIGetter tokenURIGetter
    ) external onlyRole(MANAGER_ROLE) seriesIsNotFrozen(seriesId) {
        tokenURIGetters[seriesId][editionId] = tokenURIGetter;
        emit TokenURIGetterSet(seriesId, editionId, address(tokenURIGetter));
    }

    function setEdition(
        uint8 seriesId,
        uint8 id,
        uint256 availableFrom,
        uint256 availableUntil,
        string memory description
    ) external onlyRole(MANAGER_ROLE) seriesIsNotFrozen(seriesId) {
        editions[seriesId][id] = Edition(
            availableFrom,
            availableUntil,
            description
        );
        emit EditionSet(
            seriesId,
            id,
            availableFrom,
            availableUntil,
            description
        );
    }

    function setSeries(
        uint8 id,
        string memory name,
        string memory description
    ) external onlyRole(MANAGER_ROLE) seriesIsNotFrozen(id) {
        series[id] = Series({description: description, name: name});
        emit SeriesSet(id, name, description);
    }

    // The following functions are overrides required by Solidity.

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(
            ERC721AUpgradeable,
            IERC721AUpgradeable,
            AccessControlUpgradeable
        )
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function burn(
        uint256 tokenId
    ) public override(INFB, ERC721ABurnableUpgradeable) {
        super.burn(tokenId);
    }

    function ownerOf(
        uint256 tokenId
    )
        public
        view
        override(ERC721AUpgradeable, IERC721AUpgradeable, INFB)
        returns (address)
    {
        return super.ownerOf(tokenId);
    }

    // Some utility functions

    function _joinSeriesEditionAndVariant(
        uint8 seriesId,
        uint8 editionId,
        uint8 variantId
    ) private pure returns (uint24 combinedValue) {
        // Shift the uint8 series left by 16 bits to make room for the edition and variant values
        // Shift the uint8 edition left by 8 bits to make room for the variant value
        // Add all values to the uint24 combinedValue
        combinedValue =
            (uint24(seriesId) << 16) |
            (uint24(editionId) << 8) |
            variantId;
    }

    function _splitSeriesEditionAndVariant(
        uint24 combinedValue
    ) private pure returns (uint8 seriesId, uint8 editionId, uint8 variantId) {
        // Mask the least significant 8 bits of the uint24 value to get the variant value
        variantId = uint8(combinedValue & 0xFF);
        // Shift the uint24 value right by 8 bits and mask the least significant 8 bits to get the edition value
        editionId = uint8((combinedValue >> 8) & 0xFF);
        // Shift the uint24 value right by 16 bits to get the series value
        seriesId = uint8(combinedValue >> 16);
    }

    // Keep extra data on transfer
    function _extraData(
        address,
        address,
        uint24 previousExtraData
    ) internal pure override returns (uint24) {
        return previousExtraData;
    }
}
