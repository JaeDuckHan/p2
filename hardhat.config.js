require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,       // 배포 빈도 낮음 → 200 (런타임 가스 최적화)
      },
      viaIR: false,
    },
  },

  networks: {
    // ── 로컬 개발 ────────────────────────────────────────────────
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },

    // ── Arbitrum One (메인넷) ────────────────────────────────────
    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
      chainId: 42161,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },

    // ── Arbitrum Sepolia (테스트넷) ──────────────────────────────
    arbitrumSepolia: {
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },

    // ── Polygon PoS (메인넷) ──────────────────────────────────
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      chainId: 137,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },

    // ── Polygon Amoy (테스트넷) ───────────────────────────────
    polygonAmoy: {
      url: process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },

  // ── Gas Reporter ─────────────────────────────────────────────
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY || "",
    L2: "arbitrum",
    token: "ETH",
  },

  // ── Etherscan / Arbiscan 검증 ─────────────────────────────────
  etherscan: {
    apiKey: {
      arbitrumOne:     process.env.ARBISCAN_API_KEY || "",
      arbitrumSepolia: process.env.ARBISCAN_API_KEY || "",
      polygon:         process.env.POLYGONSCAN_API_KEY || "",
      polygonAmoy:     process.env.POLYGONSCAN_API_KEY || "",
    },
  },

  // ── 테스트 경로 ──────────────────────────────────────────────
  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};
