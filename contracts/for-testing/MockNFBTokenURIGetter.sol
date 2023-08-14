// SPDX-License-Identifier: MIT
// NFB Contracts v0.1.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "../interfaces/INFB.sol";
import "../interfaces/INFBTokenURIGetter.sol";

contract MockNFBTokenURIGetter is INFBTokenURIGetter {
    using Strings for uint256;
    using Strings for uint8;

    INFB public nfb;

    constructor(INFB _nfb) {
        nfb = _nfb;
    }

    function tokenURI(
        uint256 tokenId,
        uint8 seriesId,
        uint8 editionId,
        uint8 variant
    ) external view returns (string memory) {
        (string memory seriesName, ) = nfb.series(seriesId);

        string memory baseJson = string(
            abi.encodePacked(
                "{",
                '"id" : "',
                tokenId.toString(),
                '", "name" : "',
                seriesName,
                '"'
            )
        );

        // If variant is set, add the variant trait to the metadata
        string memory variantTrait = "";
        if (variant > 0) {
            variantTrait = string(
                abi.encodePacked(', "variant" : ', variant.toString())
            );
        }

        string memory fullJson = string(
            abi.encodePacked(baseJson, variantTrait, "}")
        );
        string memory metadata = Base64.encode(bytes(fullJson));

        return
            string(abi.encodePacked("data:application/json;base64,", metadata));
    }
}
