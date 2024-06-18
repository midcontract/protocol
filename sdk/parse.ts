import { type Address, decodeFunctionData, formatUnits, type Hash } from "viem";
import type { Hex } from "viem/types/misc";
import { escrowHourly } from "@/abi/EscrowHourly";
import { NotMatchError } from "@/Error";
import type { SymbolToken } from "@/environment";
import { DepositStatus, type DisputeWinner } from "@/Deposit";

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

export interface EscrowRefillInput extends ContractInput {
  depositId: bigint;
  valueAdditional: number;
}

export interface EscrowCreateReturnRequest extends ContractInput {
  depositId: bigint;
}

export interface EscrowApproveReturnRequest extends ContractInput {
  depositId: bigint;
}

export interface EscrowCancelReturnRequest extends ContractInput {
  depositId: bigint;
  status: DepositStatus;
}

export interface EscrowCreateDispute extends ContractInput {
  depositId: bigint;
}

export interface EscrowResolveDisputeInput extends ContractInput {
  depositId: bigint;
  winner: DisputeWinner;
  clientAmount: number;
  contractorAmount: number;
}

export type TransactionInput = EscrowDepositInput | EscrowWithdrawInput;

export function parseInput(data: Hex): TransactionInput {
  const input = decodeFunctionData({
    abi: escrowHourly,
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
        valueApprove: Number(formatUnits(input.args[1], 6)), // FIXME remove hardcode
        recipient: input.args[2],
      } as EscrowApproveInput;
    case "refill":
      return {
        functionName: "refill",
        depositId: input.args[0],
        valueAdditional: Number(formatUnits(input.args[1], 6)),
      } as EscrowRefillInput;
    case "requestReturn":
      return {
        functionName: "requestReturn",
        depositId: input.args[0],
      } as EscrowCreateReturnRequest;
    case "approveReturn":
      return {
        functionName: "requestReturn",
        depositId: input.args[0],
      } as EscrowApproveReturnRequest;
    case "cancelReturn":
      return {
        functionName: "cancelReturn",
        depositId: input.args[0],
        status: input.args[1],
      } as EscrowCancelReturnRequest;
    case "createDispute":
      return {
        functionName: "createDispute",
        depositId: input.args[0],
      } as EscrowCreateDispute;
    case "resolveDispute":
      return {
        functionName: "resolveDispute",
        depositId: input.args[0],
        winner: input.args[1],
        clientAmount: Number(formatUnits(input.args[2], 6)),
        contractorAmount: Number(formatUnits(input.args[3], 6)),
      } as EscrowResolveDisputeInput;
    default:
      throw new NotMatchError("input data");
  }
}
