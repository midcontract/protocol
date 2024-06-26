import { type Address } from "viem";
import type { PartialRecord } from "@/common";
import { NotSupportError } from "@/Error";

export type Environment = "prod" | "beta" | "test" | "local";

export type SymbolToken = "USDT" | "USDC" | "MockUSDT";

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
  escrow: { [key: string]: Address };
  tokenList: TokenList;
};

export enum ChainID {
  Localhost = 31337,
  Sepolia = 11_155_111,
  BlastSepolia = 168_587_773,
}

export type ChainList = PartialRecord<ChainID, ContractList>;

export type EnvironmentList = Record<Environment, ChainList>;

export const environmentList: EnvironmentList = {
  local: {
    31337: {
      chainName: "Localhost",
      escrow: {
        REGISTRY: "0xB536cc39702CE1103E12d6fBC3199cFC32d714f3",
        MOCK_PAYMENT_TOKEN: "0x288f4508660A747C77A95D68D5b77eD89CdE9D03",
        ESCROW_FIX_PRICE: "0xD8038Fae596CDC13cC9b3681A6Eb44cC1984D670",
        ESCROW_MILESTONE: "0x9fD178b75AE324B573f8A8a21a74159375F383c5",
        FACTORY: "0xeaD5265B6412103d316b6389c0c15EBA82a0cbDa",
        FEE_MANAGER: "0xA4857B1178425cfaaaeedBcFc220F242b4A518fA",
        ESCROW_PROXY: "0xEAC34764333F697c31a7C72ee74ED33D1dEfff0d",
        ADMIN: "0x3eAb900aC1E0de25F465c63717cD1044fF69243C",
      },
      tokenList: {
        MockUSDT: {
          symbol: "MockUSDT",
          address: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
          decimals: 6,
        },
      },
    },
  },
  test: {
    11_155_111: {
      chainName: "Sepolia",
      escrow: {
        REGISTRY: "0xB536cc39702CE1103E12d6fBC3199cFC32d714f3",
        MOCK_PAYMENT_TOKEN: "0x288f4508660A747C77A95D68D5b77eD89CdE9D03",
        ESCROW_FIX_PRICE: "0xD8038Fae596CDC13cC9b3681A6Eb44cC1984D670",
        ESCROW_MILESTONE: "0x9fD178b75AE324B573f8A8a21a74159375F383c5",
        ESCROW_HOURLY: "0x9161479c7Edb38D752BD17d31782c49784F52706",
        FACTORY: "0xeaD5265B6412103d316b6389c0c15EBA82a0cbDa",
        FEE_MANAGER: "0xA4857B1178425cfaaaeedBcFc220F242b4A518fA",
        ESCROW_PROXY: "0xEAC34764333F697c31a7C72ee74ED33D1dEfff0d",
        ADMIN: "0x3eAb900aC1E0de25F465c63717cD1044fF69243C",
      },
      tokenList: {
        MockUSDT: {
          symbol: "MockUSDT",
          address: "0xa801061f49970Ef796e0fD0998348f3436ccCb1d",
          decimals: 6,
        },
      },
    },
  },
  beta: {
    168_587_773: {
      chainName: "BlastSepolia",
      escrow: {
        REGISTRY: "0xcda8DF73fFA90c151879F0E5A46B2ad659502C73",
        MOCK_PAYMENT_TOKEN: "0x288f4508660A747C77A95D68D5b77eD89CdE9D03",
        ESCROW: "0x6ff9DFae2ca36CCd06f30Fb272bCcb2A88848568",
        FACTORY: "0xE732a3625499885cE800f795A076C6Daf69e9E3d",
        FEE_MANAGER: "0xA4857B1178425cfaaaeedBcFc220F242b4A518fA",
        ESCROW_PROXY: "0xEAC34764333F697c31a7C72ee74ED33D1dEfff0d",
        ADMIN: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      },
      tokenList: {
        USDT: {
          symbol: "USDT",
          address: "0x6593f0D49BB695098358cAcE2Db325610daa3830",
          decimals: 18,
        },
      },
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
