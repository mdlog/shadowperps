// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockPriceOracle — Testnet price feed for ShadowPerps
/// @notice Owner can update prices; in production, replace with Chainlink/Pyth
contract MockPriceOracle is Ownable {
    struct PriceData {
        uint256 price;      // price in 8 decimals (e.g. 6784250000000 = $67,842.50)
        uint256 updatedAt;
        uint256 roundId;
    }

    uint8 public constant DECIMALS = 8;

    mapping(bytes32 => PriceData) public prices;
    mapping(bytes32 => bool) public supportedMarkets;

    bytes32[] public marketList;

    event PriceUpdated(bytes32 indexed market, uint256 price, uint256 roundId);
    event MarketAdded(bytes32 indexed market);

    constructor() Ownable(msg.sender) {}

    function addMarket(string calldata symbol) external onlyOwner {
        bytes32 marketId = keccak256(abi.encodePacked(symbol));
        require(!supportedMarkets[marketId], "Market exists");
        supportedMarkets[marketId] = true;
        marketList.push(marketId);
        emit MarketAdded(marketId);
    }

    function updatePrice(string calldata symbol, uint256 price) external onlyOwner {
        bytes32 marketId = keccak256(abi.encodePacked(symbol));
        require(supportedMarkets[marketId], "Unknown market");

        PriceData storage data = prices[marketId];
        data.price = price;
        data.updatedAt = block.timestamp;
        data.roundId += 1;

        emit PriceUpdated(marketId, price, data.roundId);
    }

    function updatePriceBatch(
        string[] calldata symbols,
        uint256[] calldata _prices
    ) external onlyOwner {
        require(symbols.length == _prices.length, "Length mismatch");
        for (uint256 i = 0; i < symbols.length; i++) {
            bytes32 marketId = keccak256(abi.encodePacked(symbols[i]));
            require(supportedMarkets[marketId], "Unknown market");

            PriceData storage data = prices[marketId];
            data.price = _prices[i];
            data.updatedAt = block.timestamp;
            data.roundId += 1;

            emit PriceUpdated(marketId, _prices[i], data.roundId);
        }
    }

    function getPrice(string calldata symbol) external view returns (uint256 price, uint256 updatedAt) {
        bytes32 marketId = keccak256(abi.encodePacked(symbol));
        require(supportedMarkets[marketId], "Unknown market");
        PriceData storage data = prices[marketId];
        require(data.updatedAt > 0, "No price data");
        return (data.price, data.updatedAt);
    }

    function getMarketId(string calldata symbol) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(symbol));
    }

    function getMarketCount() external view returns (uint256) {
        return marketList.length;
    }
}
