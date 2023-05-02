// SPDX-License-Identifier: MIT
// NFB Contracts v0.0.5
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

    mapping(uint16 => Series) public override series;
    mapping(uint16 => mapping(uint8 => Edition)) public override editions;

    /// @dev If a series is frozen, it's data can not be updated anymore. Also no editions can be added or updated.
    mapping(uint16 => bool) public isSeriesFrozen;

    /// @dev This contract does not care about token URIs, instead it delegates that to a separate contract.
    mapping(uint16 => mapping(uint8 => INFBTokenURIGetter))
        public tokenURIGetters;

    event SeriesSet(uint16 indexed id, string indexed name, string description);
    event EditionSet(
        uint16 indexed seriesId,
        uint8 indexed editionId,
        uint256 availableFrom,
        uint256 availableUntil,
        string description
    );
    event Minted(
        address indexed to,
        uint16 indexed seriesId,
        uint8 indexed editionId,
        uint256 amount
    );
    event SeriesFrozen(uint16 indexed id);
    event TokenURIGetterSet(
        uint16 indexed seriesId,
        uint8 indexed editionId,
        address indexed tokenURIGetter
    );
    event NFBsOpened(
        address indexed opener,
        uint256 amount,
        address indexed to,
        uint16 seriesId,
        uint8 editionId
    );

    modifier seriesIsNotFrozen(uint16 id) {
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
        uint16 seriesId,
        uint8 editionId
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
            joinSeriesAndEditionId(seriesId, editionId)
        );

        emit Minted(to, seriesId, editionId, amount);
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
        uint24 seriesAndEditionId = _ownershipOf(tokenIds[0]).extraData;

        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(
                _ownershipOf(tokenIds[i]).extraData == seriesAndEditionId,
                "NFB: Token is not part of the series and edition"
            );
            _burn(tokenIds[i]);
        }

        (uint16 seriesId, uint8 editionId) = splitSeriesAndEditionId(
            seriesAndEditionId
        );
        opener.openViaNfb(seriesId, editionId, tokenIds.length, to);
        emit NFBsOpened(
            address(opener),
            tokenIds.length,
            to,
            seriesId,
            editionId
        );
    }

    // Some extra view functions

    function getSeriesAndEdition(
        uint256 tokenId
    ) public view override returns (uint16 seriesId, uint8 editionId) {
        (seriesId, editionId) = splitSeriesAndEditionId(
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
        (uint16 seriesId, uint8 editionId) = splitSeriesAndEditionId(
            _ownershipOf(tokenId).extraData
        );

        require(
            address(tokenURIGetters[seriesId][editionId]) != address(0),
            "NFB: No tokenURI getter set"
        );

        return
            tokenURIGetters[seriesId][editionId].tokenURI(
                tokenId,
                seriesId,
                editionId
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

    /// @dev You might want to still get the metadata for burned packs and display them in your frontend.
    function tokenURIForBurned(
        uint256 tokenId
    ) public view virtual returns (string memory) {
        require(!_exists(tokenId), "NFB: Non-burned token");

        return tokenURIInternal(tokenId);
    }

    // For metadata updating by the manager(s)

    function freezeSeries(
        uint16 id
    ) external onlyRole(MANAGER_ROLE) seriesIsNotFrozen(id) {
        isSeriesFrozen[id] = true;
        emit SeriesFrozen(id);
    }

    function setTokenURIGetter(
        uint16 seriesId,
        uint8 editionId,
        INFBTokenURIGetter tokenURIGetter
    ) external onlyRole(MANAGER_ROLE) seriesIsNotFrozen(seriesId) {
        tokenURIGetters[seriesId][editionId] = tokenURIGetter;
        emit TokenURIGetterSet(seriesId, editionId, address(tokenURIGetter));
    }

    function setEdition(
        uint16 seriesId,
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
        uint16 id,
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

    function joinSeriesAndEditionId(
        uint16 seriesId,
        uint8 editionId
    ) private pure returns (uint24 seriesAndEditionId) {
        // Shift the uint16 value left by 8 bits to make room for the uint8 value
        // Add the uint8 value to the uint24 value
        seriesAndEditionId = (seriesId << 8) | editionId;
    }

    function splitSeriesAndEditionId(
        uint24 seriesAndEditionId
    ) private pure returns (uint16 seriesId, uint8 editionId) {
        // Mask the top 8 bits of the uint24 value to get the uint8 value
        editionId = uint8(seriesAndEditionId & 0xFF);
        // Shift the uint24 value right by 8 bits to get the uint16 value
        seriesId = uint16(seriesAndEditionId >> 8);
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
