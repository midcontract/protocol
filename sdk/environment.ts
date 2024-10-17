import { type Abi, type Address } from "viem";
import type { PartialRecord } from "@/common";
import { NotSupportError } from "@/Error";
import { fixedPriceAbiBeta, fixedPriceAbiTest } from "@/abi/EscrowFixedPrice";
import { milestoneAbiBeta, milestoneAbiTest } from "@/abi/EscrowMilestone";
import { hourlyAbiTest } from "@/abi/EscrowHourly";
import { factoryAbiBeta, factoryAbiTest } from "@/abi/EscrowFactory";
import { feeManagerAbiTest } from "@/abi/FeeManager";

export type Environment = "prod" | "beta" | "beta2" | "test" | "local";

export type SymbolToken = "USDT" | "USDC" | "MockUSDT" | "MockDAI";

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
        ADMIN_MANAGER: "0xaDfE561EE14842D05a7720a4d9Eb2579891f3D67",
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
    80_002: {
      chainName: ChainNameEnum.PolygonAmoy,
      escrow: {
        ESCROW_FIX_PRICE: "0x4De255Fb29f4FBF87EDAFA344da1712DCc7B3323",
        ESCROW_MILESTONE: "0x56d2Ff92eE746D69Da1B798706da00269e341f59",
        ESCROW_HOURLY: "0x53Dc240057218b37AEDAc21DE3b1948f35F332da",
        FACTORY: "0xE2B05184705A5b25De95DcEc77147B93B4a26f31",
        REGISTRY: "0x17EB9587525A4CdD60A06375f1F5ba9d69684198",
        FEE_MANAGER: "0x311fCF7F01bf49836c4e1E43FD44fE4921B00e6a",
        ADMIN_MANAGER: "0x501cbBCa63ea1f0cc9a490A33B60f08eCD2DAB27",
        ADMIN: "0x3eAb900aC1E0de25F465c63717cD1044fF69243C",
        MOCK_PAYMENT_TOKEN: "0xD19AC10fE911d913Eb0B731925d3a69c80Bd6643",
        FIXED_PRICE_ABI: fixedPriceAbiTest,
        MILESTONE_ABI: milestoneAbiTest,
        HOURLY_ABI: hourlyAbiTest,
        FACTORY_ABI: factoryAbiTest,
        FEE_MANAGER_ABI: feeManagerAbiTest,
      },
      tokenList: {
        MockUSDT: {
          symbol: "MockUSDT",
          address: "0xD19AC10fE911d913Eb0B731925d3a69c80Bd6643",
          decimals: 6,
        },
        MockDAI: {
          symbol: "MockDAI",
          address: "0xA0A8Ee7bF502EC4Eb5C670fE5c63092950dbB718",
          decimals: 18,
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
        FIXED_PRICE_ABI: fixedPriceAbiTest,
        MILESTONE_ABI: milestoneAbiTest,
        HOURLY_ABI: hourlyAbiTest,
        FACTORY_ABI: factoryAbiTest,
        FEE_MANAGER_ABI: feeManagerAbiTest,
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
        ESCROW_FIX_PRICE: "0xf26D105Ffa6Cb592Cc531218FCE5c6b9F3Fc4fe1",
        ESCROW_MILESTONE: "0x6fbB5D345E55Ccc5675a7f3b218ED54741B42Db6",
        ESCROW_HOURLY: "0x2700184a3fBb4DA8DD1D881619cBCdc9BaEfE9c2",
        FACTORY: "0x7cdFBb8867450F3791ce79Dc41b0027b6de5943f",
        REGISTRY: "0x043b15159a4210Dd884e254FA794ECF6ae8449b3",
        FEE_MANAGER: "0x0D642fB93036cC33455d971e3E74eF712B433b90",
        ADMIN_MANAGER: "0x501cbBCa63ea1f0cc9a490A33B60f08eCD2DAB27",
        ADMIN: "0x3eAb900aC1E0de25F465c63717cD1044fF69243C",
        MOCK_PAYMENT_TOKEN: "0xD19AC10fE911d913Eb0B731925d3a69c80Bd6643",
        FIXED_PRICE_ABI: fixedPriceAbiBeta,
        MILESTONE_ABI: milestoneAbiBeta,
        HOURLY_ABI: hourlyAbiTest,
        FACTORY_ABI: factoryAbiBeta,
        FEE_MANAGER_ABI: feeManagerAbiTest,
      },
      tokenList: {
        MockUSDT: {
          symbol: "MockUSDT",
          address: "0xD19AC10fE911d913Eb0B731925d3a69c80Bd6643",
          decimals: 6,
        },
        MockDAI: {
          symbol: "MockDAI",
          address: "0xA0A8Ee7bF502EC4Eb5C670fE5c63092950dbB718",
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
