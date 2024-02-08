import { type Address } from "viem";
import type { PartialRecord } from "@/common";
import { NotSupportError } from "@/Error";

export type Environment = "prod" | "beta" | "test" | "local";

export type SymbolToken = "USDT" | "USDC";

export type DataToken = {
  symbol: SymbolToken;
  address: Address;
  decimals: number;
};

export type TokenList = PartialRecord<SymbolToken, DataToken>;

export function* iterateTokenList(tokenList: TokenList): IterableIterator<DataToken> {
  for (const symbol of Object.keys(tokenList) as SymbolToken[]) {
    const dataToken = tokenList[symbol];
    if (dataToken) {
      yield dataToken;
    }
  }
}

export type ContractList = {
  chainName: string;
  escrow: Address;
  tokenList: TokenList;
};

export enum ChainID {
  Localhost = 1337,
  Sepolia = 11_155_111,
  BlastSepolia = 168_587_773,
}

export type ChainList = PartialRecord<ChainID, ContractList>;

export type EnvironmentList = Record<Environment, ChainList>;

export const environmentList: EnvironmentList = {
  local: {
    1337: {
      chainName: "Localhost",
      escrow: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
      tokenList: {
        USDT: {
          symbol: "USDT",
          address: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
          decimals: 18,
        },
      },
    },
  },
  test: {
    11_155_111: {
      chainName: "Sepolia",
      escrow: "0xc6F1B2Df92a852bd0B956eEe71B03c319f911ad1",
      tokenList: {
        USDT: {
          symbol: "USDT",
          address: "0x563BbEC31968a3887B2e3e80e84640faEE54D094",
          decimals: 18,
        },
      },
    },
  },
  beta: {
    168_587_773: {
      chainName: "BlastSepolia",
      escrow: "0xDFDA60aA3294f4E593A82F22431EC30C90B2c0Ec",
      tokenList: {},
    },
  },
  prod: {},
};

export function environmentByName(name: Environment): ChainList {
  const environment = environmentList[name];
  if (!environment) {
    throw new NotSupportError(`environment ${name}`);
  }
  return environmentList[name];
}

export function contractList(name: Environment, chainID: ChainID): ContractList {
  const environment = environmentByName(name);
  const chainList = environment[chainID];
  if (!chainList) {
    throw new NotSupportError(`chain id ${chainID}`);
  }
  return chainList;
}
