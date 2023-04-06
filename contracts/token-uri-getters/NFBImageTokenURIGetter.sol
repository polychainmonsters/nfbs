// SPDX-License-Identifier: MIT
// NFB Contracts v0.0.3
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "../interfaces/INFB.sol";
import "../interfaces/INFBTokenURIGetter.sol";

/// @dev A very simple NFB token URI getter that just returns the image URI + some basic traits.
/// Example metadata to be returned:
/// {
///   "id": "1",
///   "name": "NFB #1",
///   "description": "First generation of Polychain Monsters.",
///   "image": "https://nft.polychainmonsters.com/1.png",
///   "attributes": [
///     {
///       "trait_type": "Series",
///       "value": "Polychain Monsters Gen1"
///     },
///     {
///       "trait_type": "Series ID",
///       "display_type": "number",
///       "value": 1
///     },
///     {
///       "trait_type": "Edition",
///       "value": "End of Gen 1"
///     },
///     {
///       "trait_type": "Edition ID",
///       "display_type": "number",
///       "value": 1
///     },
///     {
///       "trait_type": "NFB Number",
///       "display_type": "number",
///       "value": 1
///     }
///   ]
/// }
contract NFBImageTokenURIGetter is INFBTokenURIGetter {
    using Strings for uint8;
    using Strings for uint16;
    using Strings for uint256;

    INFB public nfb;
    string public name;
    string public imageURI;
    bool public hasEditionDescription;

    constructor(
        INFB _nfb,
        string memory _name,
        string memory _imageURI,
        bool _hasEditionDescription
    ) {
        nfb = _nfb;
        name = _name;
        imageURI = _imageURI;
        hasEditionDescription = _hasEditionDescription;
    }

    /// @dev Returns the token ID as the NFB number. If the token ID exceeds integer limits, it won't work.
    /// This is for NFB contracts that don't expect the token ID out of integer scope.
    function getAttributes(
        uint256 tokenId,
        uint16 seriesId,
        uint8 editionId
    ) internal view returns (string memory) {
        (string memory seriesName, string memory seriesDescription) = nfb
            .series(seriesId);

        (, , string memory editionDescription) = nfb.editions(
            seriesId,
            editionId
        );

        string memory editionDescriptionStr = hasEditionDescription
            ? string(
                abi.encodePacked(
                    '{"trait_type":"Edition","value":"',
                    editionDescription,
                    '"},'
                )
            )
            : "";

        return
            string(
                abi.encodePacked(
                    '"attributes":[{"trait_type":"Series","value":"',
                    seriesName,
                    // lets also add the series id as an attribute
                    '"},{"trait_type":"Series ID","display_type":"number","value":',
                    seriesId.toString(),
                    "},",
                    editionDescriptionStr,
                    '{"trait_type":"Edition ID","display_type":"number","value":',
                    editionId.toString(),
                    '},{"trait_type":"NFB Number","display_type":"number","value":',
                    tokenId.toString(),
                    "}]"
                )
            );
    }

    function tokenURI(
        uint256 tokenId,
        uint16 seriesId,
        uint8 editionId
    ) external view returns (string memory) {
        (string memory seriesName, string memory seriesDescription) = nfb
            .series(seriesId);
        string memory tokenIdStr = tokenId.toString();
        string memory metadata = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        "{",
                        '"id":"',
                        tokenIdStr,
                        '","name":"',
                        name,
                        " #",
                        tokenIdStr,
                        '","description":"',
                        seriesDescription,
                        '","image":"',
                        imageURI,
                        '",',
                        getAttributes(tokenId, seriesId, editionId),
                        "}"
                    )
                )
            )
        );

        return
            string(abi.encodePacked("data:application/json;base64,", metadata));
    }
}
