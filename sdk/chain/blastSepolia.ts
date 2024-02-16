import { defineChain } from "viem";

export const blastSepolia = defineChain({
  id: 168_587_773,
  name: "Blast Sepolia",
  nativeCurrency: { name: "Blast Testnet (Sepolia)", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://sepolia.blast.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "Block Explorer",
      url: "https://testnet.blastscan.io",
      apiUrl: "https://api.routescan.io/v2/network/testnet/evm/168587773/etherscan",
    },
  },
  contracts: {},
  testnet: true,
});
