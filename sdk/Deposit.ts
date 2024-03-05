import type { Address, Hash } from "viem";
import { CoreMidcontractProtocolError } from "@/Error";

enum DepositStatus {
  PENDING,
  SUBMITTED,
  APPROVED,
}

export class Deposit {
  readonly payee: Address;
  readonly recipient: Address;
  readonly token: Address;
  readonly amount: bigint;
  readonly amountToClaim: bigint;
  readonly status: DepositStatus;
  readonly timeLock: bigint;
  readonly configFee: boolean;
  readonly recipientData: Hash;
  constructor(data: readonly [Address, Address, Address, bigint, bigint, DepositStatus, bigint, boolean, Hash]) {
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
