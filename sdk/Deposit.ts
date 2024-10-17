import type { Address, Hash } from "viem";
import { CoreMidcontractProtocolError } from "@/Error";
import type { SymbolToken } from "@/environment";

export enum DepositStatus {
  NONE,
  ACTIVE, // The contract is active and ongoing
  SUBMITTED, // Work submitted by the contractor but not yet approved
  APPROVED, // Work has been approved
  COMPLETED, // The final claim has been done
  RETURN_REQUESTED, // Client has requested a return of funds
  DISPUTED, // A dispute has been raised following a denied return request
  RESOLVED, // The dispute has been resolved
  REFUND_APPROVED, // Refund has been approved, funds can be withdrawn
  CANCELED, // Contract has been cancelled after a refund or resolution
}

export enum FeeConfig {
  CLIENT_COVERS_ALL, // Client covers all fees
  CLIENT_COVERS_ONLY, // Client pays only for his fee
  CONTRACTOR_COVERS_CLAIM, // Client covers only freelancer's claim fee
  NO_FEES,
}

export enum RefillType {
  PREPAYMENT, // Indicates a refill to the contract's general prepayment pool, which can be used to cover future claims.
  WEEK_PAYMENT, // Indicates a refill targeted at a specific week's deposit amount within the contract, typically to fulfill or increase the amount claimable for that week.
}

export enum DisputeWinner {
  NONE,
  CLIENT,
  CONTRACTOR,
  SPLIT,
}

export class Deposit {
  readonly contractor: Address;
  readonly paymentToken: SymbolToken;
  readonly amount: number;
  readonly amountToClaim: number;
  readonly amountToWithdraw: number;
  readonly timeLock: bigint;
  readonly contractorData: Hash;
  readonly feeConfig: FeeConfig;
  readonly status: DepositStatus;
  constructor(data: readonly [Address, SymbolToken, number, number, number, bigint, Hash, FeeConfig, DepositStatus]) {
    if (data.length < 8) {
      throw new CoreMidcontractProtocolError("wrong data for Deposit");
    }
    this.contractor = data[0];
    this.paymentToken = data[1];
    this.amount = data[2];
    this.amountToClaim = data[3];
    this.amountToWithdraw = data[4];
    this.timeLock = data[5];
    this.contractorData = data[6];
    this.feeConfig = data[7];
    this.status = data[8];
  }
}
