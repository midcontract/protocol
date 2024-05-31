import type { Address, Hash } from "viem";
import { CoreMidcontractProtocolError } from "@/Error";
import type { SymbolToken } from "@/environment";

export enum DepositStatus {
  PENDING,
  SUBMITTED,
  APPROVED,
}

export enum FeeConfig {
  CLIENT_COVERS_ALL,
  CLIENT_COVERS_ONLY,
  CONTRACTOR_COVERS_CLAIM,
  NO_FEES,
}

export enum DisputeWinner {
  CLIENT,
  CONTRACTOR,
  SPLIT,
}

export class Deposit {
  readonly contractor: Address;
  readonly paymentToken: SymbolToken;
  readonly amount: number;
  readonly amountToClaim: number;
  readonly timeLock: bigint;
  readonly contractorData: Hash;
  readonly feeConfig: FeeConfig;
  readonly status: DepositStatus;
  constructor(data: readonly [Address, SymbolToken, number, number, bigint, Hash, FeeConfig, DepositStatus]) {
    if (data.length < 8) {
      throw new CoreMidcontractProtocolError("wrong data for Deposit");
    }
    this.contractor = data[0];
    this.paymentToken = data[1];
    this.amount = data[2];
    this.amountToClaim = data[3];
    this.timeLock = data[4];
    this.contractorData = data[5];
    this.feeConfig = data[6];
    this.status = data[7];
  }
}
