import type { Address, Hash } from "viem";
import { CoreMidcontractProtocolError } from "@/Error";
import type { SymbolToken } from "@/environment";

enum DepositStatus {
  PENDING,
  SUBMITTED,
  APPROVED,
}

export class Deposit {
  readonly payee: Address;
  readonly recipient: Address;
  readonly token: SymbolToken;
  readonly amount: number;
  readonly amountToClaim: number;
  readonly status: DepositStatus;
  readonly timeLock: bigint;
  readonly configFee: boolean;
  readonly recipientData: Hash;
  constructor(data: readonly [Address, Address, SymbolToken, number, number, DepositStatus, bigint, boolean, Hash]) {
    if (data.length < 8) {
      throw new CoreMidcontractProtocolError("wrong data for Deposit");
    }
    this.payee = data[0];
    this.recipient = data[1];
    this.token = data[2];
    this.amount = data[3];
    this.amountToClaim = data[4];
    this.status = data[5];
    this.timeLock = data[6];
    this.configFee = data[7];
    this.recipientData = data[8];
  }
}
