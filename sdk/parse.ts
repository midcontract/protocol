import { type Address, decodeFunctionData, formatUnits, type Hash } from "viem";
import type { Hex } from "viem/types/misc";
import { NotMatchError } from "@/Error";
import { ChainNameEnum, type Environment, type SymbolToken } from "@/environment";
import { DepositStatus, type DisputeWinner, RefillType } from "@/Deposit";
import { /*hourlyAbiBeta,*/ hourlyAbiTest } from "@/abi/EscrowHourly";
import { /*fixedPriceAbiBeta*/ fixedPriceAbiTest } from "@/abi/EscrowFixedPrice";
import { /*milestoneAbiBeta, */ milestoneAbiTest } from "@/abi/EscrowMilestone";
import { embeddedAbi, lightAccountAbi } from "@/abi/Embedded";

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

export interface EscrowDepositHourlyInput extends ContractInput {
  depositId?: bigint;
  contractor: Address;
  tokenAddress: Address;
  tokenSymbol: SymbolToken;
  amount: number;
  amountToClaim: number;
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

export interface EscrowWithdrawHourlyInput extends ContractInput {
  depositId: bigint;
}

export interface EscrowClaimInput extends ContractInput {
  depositId: bigint;
}

export interface EscrowClaimMilestoneInput extends ContractInput {
  depositId: bigint;
  escrowMilestoneId: bigint;
  startMilestoneId: bigint;
  endMilestoneId: bigint;
}

export interface EscrowClaimHourlyInput extends ContractInput {
  depositId: bigint;
  escrowWeekId: bigint;
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

export interface EscrowSubmitHourlyInput extends ContractInput {
  depositId: bigint;
  escrowWeekId: bigint;
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

export interface EscrowApproveHourlyInput extends ContractInput {
  depositId: bigint;
  escrowWeekId: bigint;
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

export interface EscrowRefillHourlyInput extends ContractInput {
  depositId: bigint;
  escrowWeekId: bigint;
  valueAdditional: number;
  refillType: RefillType;
}

export interface EscrowCreateReturnRequestInput extends ContractInput {
  depositId: bigint;
}

export interface EscrowCreateReturnRequestMilestoneInput extends ContractInput {
  depositId: bigint;
  escrowMilestoneId: bigint;
}

export interface EscrowCreateReturnRequestHourlyInput extends ContractInput {
  depositId: bigint;
}

export interface EscrowApproveReturnRequestInput extends ContractInput {
  depositId: bigint;
}

export interface EscrowApproveReturnRequestMilestoneInput extends ContractInput {
  depositId: bigint;
  escrowMilestoneId: bigint;
}

export interface EscrowApproveReturnRequestHourlyInput extends ContractInput {
  depositId: bigint;
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

export interface EscrowCancelReturnRequestHourlyInput extends ContractInput {
  depositId: bigint;
  status: DepositStatus;
}

export interface EscrowCreateDisputeInput extends ContractInput {
  depositId: bigint;
}

export interface EscrowCreateDisputeMilestoneInput extends ContractInput {
  depositId: bigint;
  escrowMilestoneId: bigint;
}

export interface EscrowCreateDisputeHourlyInput extends ContractInput {
  depositId: bigint;
  escrowWeekId: bigint;
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

export interface EscrowResolveDisputeHourlyInput extends ContractInput {
  depositId: bigint;
  escrowWeekId: bigint;
  winner: DisputeWinner;
  clientAmount: number;
  contractorAmount: number;
}

export type TransactionInput = EscrowDepositInput | EscrowWithdrawInput;

export interface DecodedInput {
  callData: Hash;
  nonce: bigint;
}

export function parseInput(data: Hex, chainName: ChainNameEnum, isEmbedded: boolean = false): TransactionInput {
  let abi;
  let inputFixPrice;

  switch (chainName) {
    case ChainNameEnum.Sepolia:
      abi = fixedPriceAbiTest;
      break;
    case ChainNameEnum.PolygonAmoy:
      abi = fixedPriceAbiTest;
      break;
    default:
      throw new Error("Unsupported chainName");
  }

  if (isEmbedded) {
    const handleOpsInput = decodeFunctionData({
      abi: embeddedAbi,
      data: data,
    }) as { args: readonly DecodedInput[][] };

    const handleOpsData = handleOpsInput.args[0]?.[handleOpsInput?.args[0].length - 1]?.["callData"];

    const executeInput = decodeFunctionData({
      abi: lightAccountAbi,
      data: handleOpsData as Hash,
    });

    inputFixPrice = decodeFunctionData({
      abi: abi,
      data: executeInput.args[2] as Hash,
    });
  } else {
    inputFixPrice = decodeFunctionData({
      abi: abi,
      data,
    });
  }

  switch (inputFixPrice.functionName) {
    case "deposit":
      return {
        functionName: "deposit",
        contractor: inputFixPrice.args[0].contractor,
        tokenAddress: inputFixPrice.args[0].paymentToken,
        tokenSymbol: "MockUSDT",
        amount: Number(formatUnits(inputFixPrice.args[0].amount, 6)),
        timeLock: 0n,
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
        depositId: inputFixPrice.args ? inputFixPrice.args[0] : "",
      } as EscrowClaimInput;
    case "submit":
      return {
        functionName: "submit",
        depositId: inputFixPrice.args[0].contractId,
        data: inputFixPrice.args[0].data,
        expiration: inputFixPrice.args[0].expiration,
        salt: inputFixPrice.args[0].salt,
        signature: inputFixPrice.args[0].signature,
      } as EscrowSubmitInput;
    case "approve":
      return {
        functionName: "approve",
        depositId: inputFixPrice.args[0],
        valueApprove: Number(formatUnits(inputFixPrice.args[1], 6)),
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

export function parseMilestoneInput(
  data: Hex,
  environment: Environment,
  isEmbedded: boolean = false
): TransactionInput {
  let abi;
  let inputMilestone;

  switch (environment) {
    case "test":
      abi = milestoneAbiTest;
      break;
    case "beta2":
      abi = milestoneAbiTest;
      break;
    default:
      throw new Error("Unsupported chainName");
  }

  if (isEmbedded) {
    const handleOpsInput = decodeFunctionData({
      abi: embeddedAbi,
      data: data,
    }) as { args: readonly DecodedInput[][] };

    const handleOpsData = handleOpsInput?.args[0]?.[handleOpsInput?.args[0].length - 1]?.callData;

    const executeInput = decodeFunctionData({
      abi: lightAccountAbi,
      data: handleOpsData as Hash,
    });

    inputMilestone = decodeFunctionData({
      abi: abi,
      data: executeInput.args[2] as Hash,
    });
  } else {
    inputMilestone = decodeFunctionData({
      abi: abi,
      data,
    });
  }

  switch (inputMilestone.functionName) {
    case "deposit":
      if (!Array.isArray(inputMilestone.args[1])) {
        throw new Error("Expected array for deposit milestones but got something else.");
      }

      console.log("Decoded args:", inputMilestone.args);
      console.log("First milestone object:", inputMilestone.args[1][0]);
      console.log("contractId:", inputMilestone.args[0]?.contractId);

      return {
        functionName: "deposit",
        depositId: inputMilestone.args[0]?.contractId || 1n,
        contractor: inputMilestone.args[1][0]?.contractor,
        tokenAddress: inputMilestone.args[0].paymentToken,
        tokenSymbol: "MockUSDT", // FIXME remove hardcode
        amount: inputMilestone.args[1].reduce((accumulator, value) => {
          accumulator += Number(formatUnits(value.amount, 6));
          return accumulator;
        }, 0),
        timeLock: 0n,
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
    case "claimAll":
      return {
        functionName: "claimAll",
        depositId: inputMilestone.args[0],
        startMilestoneId: inputMilestone.args[1],
        endMilestoneId: inputMilestone.args[2],
      } as EscrowClaimMilestoneInput;
    case "submit":
      return {
        functionName: "submit",
        depositId: inputMilestone.args[0].contractId,
        escrowMilestoneId: inputMilestone.args[0].milestoneId,
        data: inputMilestone.args[0].data,
        salt: inputMilestone.args[0].salt,
        signature: inputMilestone.args[0].signature,
        expiration: inputMilestone.args[0].expiration,
      } as EscrowSubmitMilestoneInput;
    case "approve":
      return {
        functionName: "approve",
        depositId: inputMilestone.args[0],
        escrowMilestoneId: inputMilestone.args[1],
        valueApprove: Number(formatUnits(inputMilestone.args[2], 6)),
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

export function parseHourlyInput(data: Hex, chainName: ChainNameEnum, isEmbedded: boolean = false): TransactionInput {
  let abi;
  let inputHourly;

  switch (chainName) {
    case ChainNameEnum.Sepolia:
      abi = hourlyAbiTest;
      break;
    case ChainNameEnum.PolygonAmoy:
      abi = hourlyAbiTest;
      break;
    default:
      throw new Error("Unsupported chainName");
  }
  if (isEmbedded) {
    const handleOpsInput = decodeFunctionData({
      abi: embeddedAbi,
      data: data,
    }) as { args: readonly DecodedInput[][] };

    handleOpsInput?.args[0]?.sort((a, b) => Number(a.nonce) - Number(b.nonce));

    const executeInput = decodeFunctionData({
      abi: lightAccountAbi,
      data: handleOpsInput?.args[0]?.[0]?.callData as Hash,
    });

    inputHourly = decodeFunctionData({
      abi: abi,
      data: executeInput.args[2] as Hash,
    });
  } else {
    inputHourly = decodeFunctionData({
      abi: abi,
      data,
    });
  }

  switch (inputHourly.functionName) {
    case "deposit":
      return {
        functionName: "deposit",
        depositId: inputHourly.args[0].contractId,
        contractor: inputHourly.args[0]?.contractor,
        tokenAddress: inputHourly.args[0]?.paymentToken,
        tokenSymbol: "MockUSDT",
        amount: Number(formatUnits(inputHourly?.args[0]?.prepaymentAmount || 0n, 6)),
        amountToClaim: Number(formatUnits(inputHourly?.args[0]?.amountToClaim || 0n, 6)),
        timeLock: 0n,
        feeConfig: inputHourly.args[0]?.feeConfig,
        recipientData: "0x0",
      } as EscrowDepositHourlyInput;
    case "withdraw":
      return {
        functionName: "withdraw",
        depositId: inputHourly.args[0],
      } as EscrowWithdrawHourlyInput;
    case "claim":
      return {
        functionName: "claim",
        depositId: inputHourly.args[0],
        escrowWeekId: inputHourly.args[1],
      } as EscrowClaimHourlyInput;
    case "approve":
      return {
        functionName: "approve",
        depositId: inputHourly.args[0],
        escrowWeekId: inputHourly.args[1],
        valueApprove: Number(formatUnits(inputHourly.args[2], 6)), // FIXME remove hardcode
        recipient: inputHourly.args[3],
      } as EscrowApproveHourlyInput;
    case "adminApprove":
      return {
        functionName: "adminApprove",
        depositId: inputHourly.args[0],
        escrowWeekId: inputHourly.args[1],
        valueApprove: Number(formatUnits(inputHourly.args[2], 6)),
        recipient: inputHourly.args[3],
        initializeNewWeek: inputHourly.args[4],
      } as EscrowApproveHourlyInput;
    case "refill":
      return {
        functionName: "refill",
        depositId: inputHourly.args[0],
        escrowWeekId: inputHourly.args[1],
        valueAdditional: Number(formatUnits(inputHourly.args[2], 6)),
        refillType: inputHourly.args[3],
      } as EscrowRefillHourlyInput;
    case "requestReturn":
      return {
        functionName: "requestReturn",
        depositId: inputHourly.args[0],
      } as EscrowCreateReturnRequestHourlyInput;
    case "approveReturn":
      return {
        functionName: "requestReturn",
        depositId: inputHourly.args[0],
      } as EscrowApproveReturnRequestHourlyInput;
    case "cancelReturn":
      return {
        functionName: "cancelReturn",
        depositId: inputHourly.args[0],
      } as EscrowCancelReturnRequestHourlyInput;
    case "createDispute":
      return {
        functionName: "createDispute",
        depositId: inputHourly.args[0],
        escrowWeekId: inputHourly.args[1],
      } as EscrowCreateDisputeHourlyInput;
    case "resolveDispute":
      return {
        functionName: "resolveDispute",
        depositId: inputHourly.args[0],
        escrowWeekId: inputHourly.args[1],
        winner: inputHourly.args[2],
        clientAmount: Number(formatUnits(inputHourly.args[3], 6)),
        contractorAmount: Number(formatUnits(inputHourly.args[4], 6)),
      } as EscrowResolveDisputeHourlyInput;
    default:
      throw new NotMatchError("input data");
  }
}
