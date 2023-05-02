// SPDX-License-Identifier: MIT
// NFB Contracts v0.0.5
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "../interfaces/INFB.sol";
import "../interfaces/INFBTokenURIGetter.sol";

contract MockNFBTokenURIGetter is INFBTokenURIGetter {
    using Strings for uint256;

    INFB public nfb;

    constructor(INFB _nfb) {
        nfb = _nfb;
    }

    function tokenURI(
        uint256 tokenId,
        uint16 seriesId,
        uint8 editionId
    ) external view returns (string memory) {
        (string memory seriesName, ) = nfb.series(seriesId);

        string memory metadata = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        "{",
                        '"id" : "',
                        tokenId.toString(),
                        '", "name" : "',
                        seriesName,
                        '"}'
                    )
                )
            )
        );

        return
            string(abi.encodePacked("data:application/json;base64,", metadata));
    }
}
