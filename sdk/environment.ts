import { type Abi, type Address } from "viem";
import type { PartialRecord } from "@/common";
import { NotSupportError } from "@/Error";
import { amoyEscrowFixedPrice, escrowFixedPrice } from "@/abi/EscrowFixedPrice";
import { amoyEscrowMilestone, escrowMilestone } from "@/abi/EscrowMilestone";
import { escrowHourly } from "@/abi/EscrowHourly";
import { amoyEscrowFactoryAbi, escrowFactoryAbi } from "@/abi/EscrowFactory";
import { feeManagerAbi } from "@/abi/FeeManager";

export type Environment = "prod" | "beta" | "beta2" | "test" | "local";

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
  chainName: ChainNameEnum;
  escrow: { [key: string]: Address | Abi };
  tokenList: TokenList;
};

export enum ChainID {
  Localhost = 31337,
  Sepolia = 11_155_111,
  BlastSepolia = 168_587_773,
  PolygonAmoy = 80_002,
}

export type ChainList = PartialRecord<ChainID, ContractList>;

export type EnvironmentList = Record<Environment, ChainList>;

export enum ChainNameEnum {
  Localhost = "Localhost",
  Sepolia = "Sepolia",
  BlastSepolia = "BlastSepolia",
  PolygonAmoy = "PolygonAmoy",
}

export const environmentList: EnvironmentList = {
  local: {
    31337: {
      chainName: ChainNameEnum.Localhost,
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
      chainName: ChainNameEnum.Sepolia,
      escrow: {
        REGISTRY: "0xDA5989640185C37AB850E769D9B7b7dD5662F006",
        MOCK_PAYMENT_TOKEN: "0x288f4508660A747C77A95D68D5b77eD89CdE9D03",
        ESCROW_FIX_PRICE: "0xD8038Fae596CDC13cC9b3681A6Eb44cC1984D670",
        ESCROW_MILESTONE: "0x2dc075B51ef3b4f0AD868b0cc342951682019E62",
        ESCROW_HOURLY: "0x2b8660f1c512dBc74967d35BC23A6186a5CDE90a",
        FACTORY: "0xeaD5265B6412103d316b6389c0c15EBA82a0cbDa",
        FEE_MANAGER: "0xA4857B1178425cfaaaeedBcFc220F242b4A518fA",
        ESCROW_PROXY: "0xEAC34764333F697c31a7C72ee74ED33D1dEfff0d",
        ADMIN: "0x3eAb900aC1E0de25F465c63717cD1044fF69243C",
        FIXED_PRICE_ABI: escrowFixedPrice,
        MILESTONE_ABI: escrowMilestone,
        HOURLY_ABI: escrowHourly,
        FACTORY_ABI: escrowFactoryAbi,
        FEE_MANAGER_ABI: feeManagerAbi,
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
      chainName: ChainNameEnum.BlastSepolia,
      escrow: {
        REGISTRY: "0xcda8DF73fFA90c151879F0E5A46B2ad659502C73",
        MOCK_PAYMENT_TOKEN: "0x288f4508660A747C77A95D68D5b77eD89CdE9D03",
        ESCROW: "0x6ff9DFae2ca36CCd06f30Fb272bCcb2A88848568",
        FACTORY: "0xE732a3625499885cE800f795A076C6Daf69e9E3d",
        FEE_MANAGER: "0xA4857B1178425cfaaaeedBcFc220F242b4A518fA",
        ESCROW_PROXY: "0xEAC34764333F697c31a7C72ee74ED33D1dEfff0d",
        ADMIN: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        FIXED_PRICE_ABI: escrowFixedPrice,
        MILESTONE_ABI: escrowMilestone,
        HOURLY_ABI: escrowHourly,
        FACTORY_ABI: escrowFactoryAbi,
        FEE_MANAGER_ABI: feeManagerAbi,
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
  beta2: {
    80_002: {
      chainName: ChainNameEnum.PolygonAmoy,
      escrow: {
        REGISTRY: "0x8f4f2C43ec5C40227E8e614D91139740D256B5d5",
        MOCK_PAYMENT_TOKEN: "0xD19AC10fE911d913Eb0B731925d3a69c80Bd6643",
        ESCROW_FIX_PRICE: "0xA925686d8DA646854BF47b493C0f053ce62308C5",
        ESCROW_MILESTONE: "0xD3CAc137673Bc5b13C1A8672D6319F54Adb95f10",
        ESCROW_HOURLY: "0x76319b7D5156d9b443c1fAB269f42ac27d8c2F17",
        FACTORY: "0x109F725FFda5020D6E4C9DEc83F07191e4a9632d",
        FEE_MANAGER: "0x4FCe69069179559D28f607867ed6c708a799c7a5",
        ESCROW_PROXY: "0xEAC34764333F697c31a7C72ee74ED33D1dEfff0d",
        ADMIN: "0x3eAb900aC1E0de25F465c63717cD1044fF69243C",
        FIXED_PRICE_ABI: amoyEscrowFixedPrice,
        MILESTONE_ABI: amoyEscrowMilestone,
        HOURLY_ABI: escrowHourly,
        FACTORY_ABI: amoyEscrowFactoryAbi,
        FEE_MANAGER_ABI: feeManagerAbi,
      },
      tokenList: {
        MockUSDT: {
          symbol: "MockUSDT",
          address: "0xD19AC10fE911d913Eb0B731925d3a69c80Bd6643",
          decimals: 6,
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
