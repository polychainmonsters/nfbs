// SPDX-License-Identifier: MIT
// NFB Contracts v0.0.3
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/INFB.sol";
import "./interfaces/INFBPurchaserCustomHandler.sol";

contract GenericNFBPurchaser is Initializable, AccessControlUpgradeable {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");

    enum PurchaseType {
        DEFAULT,
        GIFT,
        CREDIT_CARD
    }

    struct NFB {
        INFB collection;
        uint256 availableAmount;
        uint256 maxPerTx;
        uint256 priceInNative;
    }

    struct PaymentToken {
        IERC20 token;
        uint256 priceInTokens;
        uint256 additionalPriceInNative;
    }

    event NFBSet(
        uint16 indexed seriesId,
        uint8 indexed editionId,
        address indexed collection,
        uint256 availableAmount,
        uint256 priceInNative,
        uint256 maxPerTx
    );

    event PaymentTokenSet(
        uint16 indexed seriesId,
        uint8 indexed editionId,
        address indexed token,
        uint256 priceInTokens,
        uint256 additionalPriceInNative
    );

    event EnforceTokenPaymentToggled(
        uint16 indexed seriesId,
        uint8 indexed editionId,
        bool indexed newValue
    );

    event Withdrawn(
        address indexed to,
        uint256 indexed amount,
        address indexed token
    );

    event NFBsPurchased(
        uint16 indexed seriesId,
        uint8 indexed editionId,
        uint256 indexed amount,
        address to,
        address paymentToken,
        PurchaseType purchaseType
    );

    mapping(uint16 => mapping(uint8 => NFB)) public nfbs;
    mapping(uint16 => mapping(uint8 => mapping(address => PaymentToken)))
        public paymentTokens;
    mapping(uint16 => mapping(uint8 => bool)) public enforceTokenPayments;
    mapping(uint16 => mapping(uint8 => INFBPurchaserCustomHandler))
        public customHandlers;
    mapping(uint16 => mapping(uint8 => uint256)) public nfbsSold;

    function initialize() public initializer {
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        _grantRole(WITHDRAWER_ROLE, msg.sender);
    }

    /// @dev The public function for purchasing NFBs.
    /// @param seriesId The series ID of the NFBs to purchase.
    /// @param editionId The edition ID of the NFBs to purchase.
    /// @param amount The amount of NFBs to purchase.
    /// @param to The address to send the NFBs to.
    /// @param paymentToken The token to pay with (optional)
    /// @param purchaseType The type of purchase (for analytics purposes)
    function purchaseNFBs(
        uint16 seriesId,
        uint8 editionId,
        uint256 amount,
        address to,
        IERC20 paymentToken,
        PurchaseType purchaseType
    ) external payable {
        handleNFBPurchase(seriesId, editionId, amount, to, paymentToken);

        emit NFBsPurchased(
            seriesId,
            editionId,
            amount,
            to,
            address(paymentToken),
            purchaseType
        );
    }

    // For viewers

    /// @dev Utility function to read information from a frontend.
    function getNFBInfo(
        uint16 seriesId,
        uint8 editionId
    )
        external
        view
        returns (
            string memory name,
            string memory description,
            uint256 availableFrom,
            uint256 availableUntil,
            uint256 availableAmount,
            uint256 soldAmount,
            uint256 maxPerTx,
            uint256 priceInNative,
            bool enforceTokenPayment
        )
    {
        NFB memory nfb = nfbs[seriesId][editionId];
        (availableFrom, availableUntil, ) = nfb.collection.editions(
            seriesId,
            editionId
        );
        (name, description) = nfb.collection.series(seriesId);

        availableAmount = nfb.availableAmount;
        soldAmount = nfbsSold[seriesId][editionId];
        maxPerTx = nfb.maxPerTx;
        priceInNative = nfb.priceInNative;

        enforceTokenPayment = this.enforceTokenPayments(seriesId, editionId);
    }

    // Internal stuff

    function handleNFBPurchase(
        uint16 seriesId,
        uint8 editionId,
        uint256 amount,
        address to,
        IERC20 paymentToken
    ) internal {
        require(to != address(0), "NFBPurchaser: Invalid recipient");

        NFB memory nfb = nfbs[seriesId][editionId];

        require(amount <= nfb.maxPerTx, "NFBPurchaser: Too many nfbs");
        require(
            amount + nfbsSold[seriesId][editionId] <= nfb.availableAmount,
            "NFBPurchaser: Sold out"
        );

        processPayment(msg.sender, seriesId, editionId, amount, paymentToken);
        nfbsSold[seriesId][editionId] += amount;
        nfb.collection.mint(to, amount, seriesId, editionId);
    }

    function processPayment(
        address purchaser,
        uint16 seriesId,
        uint8 editionId,
        uint256 amount,
        IERC20 paymentToken
    ) internal {
        NFB memory nfb = nfbs[seriesId][editionId];

        bool paymentProcessed = false;

        // Do this only if a payment token is specified for this NFB
        if (address(paymentToken) != address(0)) {
            require(
                paymentTokens[seriesId][editionId][address(paymentToken)]
                    .priceInTokens > 0,
                "NFBPurchaser: Payment token not accepted"
            );

            paymentToken.transferFrom(
                msg.sender,
                address(this),
                paymentTokens[seriesId][editionId][address(paymentToken)]
                    .priceInTokens * amount
            );

            if (
                paymentTokens[seriesId][editionId][address(paymentToken)]
                    .additionalPriceInNative > 0
            ) {
                require(
                    msg.value ==
                        paymentTokens[seriesId][editionId][
                            address(paymentToken)
                        ].additionalPriceInNative *
                            amount,
                    "NFBPurchaser: Not enough payment"
                );
            }

            paymentProcessed = true;
        }

        if (!paymentProcessed && nfb.priceInNative > 0) {
            require(
                !enforceTokenPayments[seriesId][editionId],
                "NFBPurchaser: Token payment required"
            );

            uint256 totalPrice = nfb.priceInNative * amount;
            require(
                msg.value == totalPrice,
                "NFBPurchaser: Invalid payment amount"
            );

            paymentProcessed = true;
        }

        // If we still haven't processed the payment, means the NFB is a free mint and availability must be handled
        // by the NFB contract itself

        if (address(customHandlers[seriesId][editionId]) != address(0)) {
            customHandlers[seriesId][editionId].onNFBPurchase{value: msg.value}(
                purchaser,
                amount,
                seriesId,
                editionId
            );
        }
    }

    // For the manager

    function setNFB(
        uint16 seriesId,
        uint8 editionId,
        INFB collection,
        uint256 availableAmount,
        uint256 priceInNative,
        uint256 maxPerTx
    ) external onlyRole(MANAGER_ROLE) {
        nfbs[seriesId][editionId] = NFB({
            availableAmount: availableAmount,
            collection: collection,
            maxPerTx: maxPerTx,
            priceInNative: priceInNative
        });
        emit NFBSet(
            seriesId,
            editionId,
            address(collection),
            availableAmount,
            priceInNative,
            maxPerTx
        );
    }

    function setPaymentToken(
        uint16 seriesId,
        uint8 editionId,
        IERC20 token,
        uint256 priceInTokens,
        uint256 additionalPriceInNative
    ) external onlyRole(MANAGER_ROLE) {
        paymentTokens[seriesId][editionId][address(token)] = PaymentToken({
            token: token,
            priceInTokens: priceInTokens,
            additionalPriceInNative: additionalPriceInNative
        });
        emit PaymentTokenSet(
            seriesId,
            editionId,
            address(token),
            priceInTokens,
            additionalPriceInNative
        );
    }

    function toggleEnforceTokenPayment(
        uint16 seriesId,
        uint8 editionId
    ) external onlyRole(MANAGER_ROLE) {
        enforceTokenPayments[seriesId][editionId] = !enforceTokenPayments[
            seriesId
        ][editionId];
        emit EnforceTokenPaymentToggled(
            seriesId,
            editionId,
            enforceTokenPayments[seriesId][editionId]
        );
    }

    function setCustomHandler(
        uint16 seriesId,
        uint8 editionId,
        INFBPurchaserCustomHandler handler
    ) external onlyRole(MANAGER_ROLE) {
        customHandlers[seriesId][editionId] = handler;
    }

    // For the withdrawer

    function withdrawTokens(IERC20 token) external onlyRole(WITHDRAWER_ROLE) {
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0, "NFBPurchaser: Nothing to withdraw");
        token.transfer(msg.sender, balance);
        emit Withdrawn(msg.sender, balance, address(token));
    }

    function withdrawNative() external onlyRole(WITHDRAWER_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "NFBPurchaser: Nothing to withdraw");
        payable(msg.sender).transfer(balance);
        emit Withdrawn(msg.sender, balance, address(0));
    }
}
