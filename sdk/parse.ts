import { type Address, decodeFunctionData, formatUnits, type Hash } from "viem";
import type { Hex } from "viem/types/misc";
import { escrow } from "@/abi/Escrow";
import { NotMatchError } from "@/Error";
import type { SymbolToken } from "@/environment";

interface ContractInput {
  functionName: string;
}

export interface EscrowDepositInput extends ContractInput {
  contractor: Address;
  tokenAddress: Address;
  tokenSymbol: SymbolToken;
  amount: number;
  timeLock: bigint;
  feeConfig: number;
  recipientData: Hash;
}

export interface EscrowWithdrawInput extends ContractInput {
  depositId: bigint;
}

export interface EscrowClaimInput extends ContractInput {
  depositId: bigint;
}

export interface EscrowSubmitInput extends ContractInput {
  depositId: bigint;
  data: string;
}

export interface EscrowApproveInput extends ContractInput {
  depositId: bigint;
  valueApprove: number;
  valueAdditional: number;
  recipient: Address;
}

export type TransactionInput = EscrowDepositInput | EscrowWithdrawInput;

export function parseInput(data: Hex): TransactionInput {
  const input = decodeFunctionData({
    abi: escrow,
    data,
  });
  switch (input.functionName) {
    case "deposit":
      return {
        functionName: "deposit",
        contractor: input.args[0].contractor,
        tokenAddress: input.args[0].paymentToken,
        tokenSymbol: "USDT", // FIXME remove hardcode
        amount: Number(formatUnits(input.args[0].amount, 6)), // FIXME remove hardcode
        timeLock: input.args[0].timeLock,
        feeConfig: input.args[0].feeConfig,
        recipientData: input.args[0].contractorData,
      } as EscrowDepositInput;
    case "withdraw":
      return {
        functionName: "withdraw",
        depositId: input.args[0],
      } as EscrowWithdrawInput;
    case "claim":
      return {
        functionName: "claim",
        depositId: input.args[0],
      } as EscrowClaimInput;
    case "submit":
      return {
        functionName: "submit",
        depositId: input.args[0],
        data: input.args[1],
      } as EscrowSubmitInput;
    case "approve":
      return {
        functionName: "approve",
        depositId: input.args[0],
        valueApprove: Number(formatUnits(input.args[1], 18)), // FIXME remove hardcode
        valueAdditional: Number(formatUnits(input.args[2], 18)), // FIXME remove hardcode
        recipient: input.args[3],
      } as EscrowApproveInput;
    default:
      throw new NotMatchError("input data");
  }
}
