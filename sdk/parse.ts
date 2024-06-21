import { type Address, decodeFunctionData, formatUnits, type Hash } from "viem";
import type { Hex } from "viem/types/misc";
import { escrowFixedPrice } from "@/abi/EscrowFixedPrice";
import { NotMatchError } from "@/Error";
import type { SymbolToken } from "@/environment";
import { DepositStatus, type DisputeWinner } from "@/Deposit";
import { escrowMilestone } from "@/abi/EscrowMilestone";

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

export interface EscrowDepositMilestoneInput extends ContractInput {
  depositId?: bigint;
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

export interface EscrowWithdrawMilestoneInput extends ContractInput {
  depositId: bigint;
  escrowMilestoneId: bigint;
}

export interface EscrowClaimInput extends ContractInput {
  depositId: bigint;
}

export interface EscrowClaimMilestoneInput extends ContractInput {
  depositId: bigint;
  escrowMilestoneId: bigint;
}

export interface EscrowSubmitInput extends ContractInput {
  depositId: bigint;
  data: string;
}

export interface EscrowSubmitMilestoneInput extends ContractInput {
  depositId: bigint;
  escrowMilestoneId: bigint;
  data: string;
}

export interface EscrowApproveInput extends ContractInput {
  depositId: bigint;
  valueApprove: number;
  valueAdditional: number;
  recipient: Address;
}

export interface EscrowApproveMilestoneInput extends ContractInput {
  depositId: bigint;
  escrowMilestoneId: bigint;
  valueApprove: number;
  recipient: Address;
}

export interface EscrowRefillInput extends ContractInput {
  depositId: bigint;
  valueAdditional: number;
}

export interface EscrowRefillMilestoneInput extends ContractInput {
  depositId: bigint;
  escrowMilestoneId: bigint;
  valueAdditional: number;
}

export interface EscrowCreateReturnRequestInput extends ContractInput {
  depositId: bigint;
}

export interface EscrowCreateReturnRequestMilestoneInput extends ContractInput {
  depositId: bigint;
  escrowMilestoneId: bigint;
}

export interface EscrowApproveReturnRequestInput extends ContractInput {
  depositId: bigint;
}

export interface EscrowApproveReturnRequestMilestoneInput extends ContractInput {
  depositId: bigint;
  escrowMilestoneId: bigint;
}

export interface EscrowCancelReturnRequestInput extends ContractInput {
  depositId: bigint;
  status: DepositStatus;
}

export interface EscrowCancelReturnRequestMilestoneInput extends ContractInput {
  depositId: bigint;
  escrowMilestoneId: bigint;
  status: DepositStatus;
}

export interface EscrowCreateDisputeInput extends ContractInput {
  depositId: bigint;
}

export interface EscrowCreateDisputeMilestoneInput extends ContractInput {
  depositId: bigint;
  escrowMilestoneId: bigint;
}

export interface EscrowResolveDisputeInputInput extends ContractInput {
  depositId: bigint;
  winner: DisputeWinner;
  clientAmount: number;
  contractorAmount: number;
}

export interface EscrowResolveDisputeMilestoneInput extends ContractInput {
  depositId: bigint;
  escrowMilestoneId: bigint;
  winner: DisputeWinner;
  clientAmount: number;
  contractorAmount: number;
}

export type TransactionInput = EscrowDepositInput | EscrowWithdrawInput;

export function parseInput(data: Hex): TransactionInput {
  let inputFixPrice;
  let inputMilestone;
  try {
    inputFixPrice = decodeFunctionData({
      abi: escrowFixedPrice,
      data,
    });
  } catch (e) {
    console.log();
  }

  try {
    inputMilestone = decodeFunctionData({
      abi: escrowMilestone,
      data,
    });
  } catch (e) {
    console.log();
  }

  if (inputFixPrice) {
    switch (inputFixPrice.functionName) {
      case "deposit":
        return {
          functionName: "deposit",
          contractor: inputFixPrice.args[0].contractor,
          tokenAddress: inputFixPrice.args[0].paymentToken,
          tokenSymbol: "USDT", // FIXME remove hardcode
          amount: Number(formatUnits(inputFixPrice.args[0].amount, 6)), // FIXME remove hardcode
          timeLock: inputFixPrice.args[0].timeLock,
          feeConfig: inputFixPrice.args[0].feeConfig,
          recipientData: inputFixPrice.args[0].contractorData,
        } as EscrowDepositInput;
      case "withdraw":
        return {
          functionName: "withdraw",
          depositId: inputFixPrice.args[0],
        } as EscrowWithdrawInput;
      case "claim":
        return {
          functionName: "claim",
          depositId: inputFixPrice.args[0],
        } as EscrowClaimInput;
      case "submit":
        return {
          functionName: "submit",
          depositId: inputFixPrice.args[0],
          data: inputFixPrice.args[1],
        } as EscrowSubmitInput;
      case "approve":
        return {
          functionName: "approve",
          depositId: inputFixPrice.args[0],
          valueApprove: Number(formatUnits(inputFixPrice.args[1], 6)), // FIXME remove hardcode
          recipient: inputFixPrice.args[2],
        } as EscrowApproveInput;
      case "refill":
        return {
          functionName: "refill",
          depositId: inputFixPrice.args[0],
          valueAdditional: Number(formatUnits(inputFixPrice.args[1], 6)),
        } as EscrowRefillInput;
      case "requestReturn":
        return {
          functionName: "requestReturn",
          depositId: inputFixPrice.args[0],
        } as EscrowCreateReturnRequestInput;
      case "approveReturn":
        return {
          functionName: "requestReturn",
          depositId: inputFixPrice.args[0],
        } as EscrowApproveReturnRequestInput;
      case "cancelReturn":
        return {
          functionName: "cancelReturn",
          depositId: inputFixPrice.args[0],
          status: inputFixPrice.args[1],
        } as EscrowCancelReturnRequestInput;
      case "createDispute":
        return {
          functionName: "createDispute",
          depositId: inputFixPrice.args[0],
        } as EscrowCreateDisputeInput;
      case "resolveDispute":
        return {
          functionName: "resolveDispute",
          depositId: inputFixPrice.args[0],
          winner: inputFixPrice.args[1],
          clientAmount: Number(formatUnits(inputFixPrice.args[2], 6)),
          contractorAmount: Number(formatUnits(inputFixPrice.args[3], 6)),
        } as EscrowResolveDisputeInputInput;
      default:
        throw new NotMatchError("input data");
    }
  }

  if (inputMilestone) {
    switch (inputMilestone.functionName) {
      case "deposit":
        return {
          functionName: "deposit",
          depositId: inputMilestone.args[0],
          contractor: inputMilestone.args[1][0]?.contractor,
          tokenAddress: inputMilestone.args[1][0]?.paymentToken,
          tokenSymbol: "MockUSDT", // FIXME remove hardcode
          amount: inputMilestone.args[1].reduce((accumulator, value) => {
            accumulator += Number(formatUnits(value.amount, 6));
            return accumulator;
          }, 0),
          timeLock: inputMilestone.args[1][0]?.timeLock,
          feeConfig: inputMilestone.args[1][0]?.feeConfig,
          recipientData: inputMilestone.args[1][0]?.contractorData,
        } as EscrowDepositMilestoneInput;
      case "withdraw":
        return {
          functionName: "withdraw",
          depositId: inputMilestone.args[0],
          escrowMilestoneId: inputMilestone.args[1],
        } as EscrowWithdrawMilestoneInput;
      case "claim":
        return {
          functionName: "claim",
          depositId: inputMilestone.args[0],
          escrowMilestoneId: inputMilestone.args[1],
        } as EscrowClaimMilestoneInput;
      case "submit":
        return {
          functionName: "submit",
          depositId: inputMilestone.args[0],
          escrowMilestoneId: inputMilestone.args[1],
          data: inputMilestone.args[2],
        } as EscrowSubmitMilestoneInput;
      case "approve":
        return {
          functionName: "approve",
          depositId: inputMilestone.args[0],
          escrowMilestoneId: inputMilestone.args[1],
          valueApprove: Number(formatUnits(inputMilestone.args[2], 6)), // FIXME remove hardcode
          recipient: inputMilestone.args[3],
        } as EscrowApproveMilestoneInput;
      case "refill":
        return {
          functionName: "refill",
          depositId: inputMilestone.args[0],
          escrowMilestoneId: inputMilestone.args[1],
          valueAdditional: Number(formatUnits(inputMilestone.args[1], 6)),
        } as EscrowRefillMilestoneInput;
      case "requestReturn":
        return {
          functionName: "requestReturn",
          depositId: inputMilestone.args[0],
          escrowMilestoneId: inputMilestone.args[1],
        } as EscrowCreateReturnRequestMilestoneInput;
      case "approveReturn":
        return {
          functionName: "requestReturn",
          depositId: inputMilestone.args[0],
          escrowMilestoneId: inputMilestone.args[1],
        } as EscrowApproveReturnRequestMilestoneInput;
      case "cancelReturn":
        return {
          functionName: "cancelReturn",
          depositId: inputMilestone.args[0],
          escrowMilestoneId: inputMilestone.args[1],
          status: inputMilestone.args[2],
        } as EscrowCancelReturnRequestMilestoneInput;
      case "createDispute":
        return {
          functionName: "createDispute",
          depositId: inputMilestone.args[0],
        } as EscrowCreateDisputeMilestoneInput;
      case "resolveDispute":
        return {
          functionName: "resolveDispute",
          depositId: inputMilestone.args[0],
          escrowMilestoneId: inputMilestone.args[1],
          winner: inputMilestone.args[2],
          clientAmount: Number(formatUnits(inputMilestone.args[3], 6)),
          contractorAmount: Number(formatUnits(inputMilestone.args[4], 6)),
        } as EscrowResolveDisputeMilestoneInput;
      default:
        throw new NotMatchError("input data");
    }
  }
  throw new NotMatchError("unsupported input data");
}
