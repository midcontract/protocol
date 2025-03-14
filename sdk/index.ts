import {
  type Abi,
  type Account,
  type Address,
  type Chain,
  ContractFunctionExecutionError,
  createPublicClient,
  createWalletClient,
  custom,
  type CustomTransport,
  decodeFunctionData,
  type EIP1193Provider,
  encodeFunctionData,
  formatUnits,
  type Hash,
  http,
  type HttpTransport,
  type Log,
  parseEventLogs,
  type ParseEventLogsReturnType,
  parseUnits,
  type PublicClient,
  type RpcLog,
  toHex,
  type WalletClient,
  type WriteContractParameters,
  type Transaction,
  type TransactionReceipt,
  keccak256,
  encodePacked,
} from "viem";
import { erc20Abi } from "abitype/abis";
import { polygonAmoy } from "viem/chains";
import type { Hex } from "viem/types/misc";
import {
  contractList,
  type ContractList,
  type DataToken,
  type Environment,
  iterateTokenList,
  type SymbolToken,
} from "@/environment";
import { fixedPriceAbiBeta, fixedPriceAbiProd, fixedPriceAbiTest } from "@/abi/EscrowFixedPrice";
import {
  CoreMidcontractProtocolError,
  NotEnoughError,
  NotFoundError,
  NotMatchError,
  NotSetError,
  NotSuccessTransactionError,
  NotSupportError,
  SimulateError,
} from "@/Error";
import { blastSepolia } from "@/chain/blastSepolia";
import { type DecodedInput, parseHourlyInput, parseInput, parseMilestoneInput, type TransactionInput } from "@/parse";
import { FeeManager } from "@/feeManager/feeManager";
import { Deposit, DepositStatus, DisputeWinner, type FeeConfig, RefillType } from "@/Deposit";
import { factoryAbiBeta, factoryAbiProd, factoryAbiTest } from "@/abi/EscrowFactory";
import { milestoneAbiBeta, milestoneAbiProd, milestoneAbiTest } from "@/abi/EscrowMilestone";
import { hourlyAbiBeta, hourlyAbiProd, hourlyAbiTest } from "@/abi/EscrowHourly";
import { feeManagerAbiBeta, feeManagerAbiProd, feeManagerAbiTest } from "@/abi/FeeManager";
import { embeddedAbi, lightAccountAbi } from "@/abi/Embedded";

export interface DepositAmount {
  totalDepositAmount: number;
  feeApplied: number;
}

export interface ClaimableAmount {
  claimableAmount: number;
  feeDeducted: number;
  clientFee: number;
}

export interface DepositInput {
  contractId: bigint;
  contractorAddress: Address;
  token: SymbolToken;
  amount: number;
  amountToClaim?: number;
  amountToWithdraw?: number;
  timeLock?: bigint;
  recipientData: Hash;
  feeConfig: FeeConfig;
  status?: DepositStatus;
  signature?: Hash;
}

export interface MilestoneDepositInput {
  contractorAddress: Address;
  token: SymbolToken;
  amount: number;
  amountToClaim?: number;
  amountToWithdraw?: number;
  timeLock?: bigint;
  recipientData: Hash;
  feeConfig: FeeConfig;
  status?: DepositStatus;
  signature?: Hash;
}

export interface HashMilestonesDepositInput {
  contractor: Address;
  amount: bigint;
  amountToClaim?: bigint;
  amountToWithdraw?: bigint;
  contractorData: Hash;
  feeConfig: FeeConfig;
  status?: DepositStatus;
}

export interface HourlyDepositInput {
  contractorAddress: Address;
  amountToClaim?: number;
  amountToWithdraw?: number;
  feeConfig: FeeConfig;
}

export interface PreparedEscrowFixedPriceDeposit {
  contractId: bigint;
  contractor: Address;
  paymentToken: Address;
  amount: bigint;
  amountToClaim: bigint;
  amountToWithdraw: bigint;
  contractorData: Hash;
  feeConfig: number;
  status: number;
  escrow: Address;
  expiration: bigint;
  signature: Hash;
}

export interface PreparedEscrowMilestoneDeposit {
  depositPayload: {
    contractId: bigint;
    paymentToken: Address;
    milestonesHash: Address;
    escrow: Address;
    expiration: bigint;
    signature: Address;
  };
  milestonesPayload: {
    contractor: Address;
    amount: bigint;
    amountToClaim: bigint;
    amountToWithdraw: bigint;
    contractorData: Hash;
    feeConfig: FeeConfig;
    status: DepositStatus;
  }[];
}

export interface PreparedEscrowHourlyDeposit {
  contractId: bigint;
  contractor: Address;
  paymentToken: Address;
  prepaymentAmount: bigint;
  amountToClaim: bigint;
  feeConfig: number;
  escrow: Address;
  expiration: bigint;
  signature: Hash;
}

export interface GetFixedPriceDepositHash {
  clientAddress: Address;
  contractId: bigint;
  contractor: Address;
  paymentToken: Address;
  amount: bigint;
  feeConfig: number;
  contractorData: Hash;
  expiration: bigint;
}

export interface GetMilestoneDepositHash {
  clientAddress: Address;
  contractId: bigint;
  paymentToken: Address;
  milestonesHash: Hash;
  expiration: bigint;
}

export interface GetHourlyDepositHash {
  clientAddress: Address;
  contractId: bigint;
  contractor: Address;
  paymentToken: Address;
  prepaymentAmount: bigint;
  amountToClaim: bigint;
  feeConfig: number;
  expiration: bigint;
}

export interface ApproveInput {
  contractId: bigint;
  valueApprove?: number;
  valueAdditional?: number;
  recipient?: Address;
  token?: SymbolToken;
}

export interface ApproveInputMilestone {
  contractId: bigint;
  milestoneId: bigint;
  valueApprove: number;
  recipient: Address;
  token: SymbolToken;
}

export interface ApproveInputHourly {
  contractId: bigint;
  weekId: bigint;
  valueApprove: number;
  recipient: Address;
  token: SymbolToken;
}

export interface ApproveByAdminInputHourly extends ApproveInputHourly {
  initializeNewWeek: boolean;
}

export type TransactionStatus = "pending" | "success" | "reverted";

export interface TransactionData {
  transaction: Transaction;
  input: TransactionInput;
  status: TransactionStatus;
  receipt: TransactionReceipt | null;
}

export interface TransactionId {
  id: Hash;
  status: TransactionStatus;
}

export interface DepositResponse extends TransactionId {
  contractId: bigint;
}

export enum EscrowType {
  FixedPrice,
  Milestone,
  Hourly,
}

export interface AbiFunction {
  name: string;
  inputs: { components: { type: string }[] }[];
}

interface AbiList {
  fixedPriceAbi: readonly object[];
  milestoneAbi: readonly object[];
  hourlyAbi: readonly object[];
  feeManagerAbi: readonly object[];
  factoryAbi: readonly object[];
}

export class MidcontractProtocol {
  private readonly contractList: ContractList;
  private escrow: Address = "0x0000000000000000000000000000000000000000";
  private wallet: WalletClient;
  private public: PublicClient;
  public readonly blockExplorer: string;
  private readonly factoryEscrow: Address;
  private readonly feeManagerEscrow: Address;
  public fixedPriceAbi: [];
  public milestoneAbi: [];
  public hourlyAbi: [];
  public feeManagerAbi: [];
  public factoryAbi: [];
  public environment: Environment;
  private transactionStorage: Map<string, number> = new Map();

  constructor(
    chain: Chain,
    transport: HttpTransport,
    contractList: ContractList,
    abiList: AbiList,
    environment: Environment,
    account?: Account
  ) {
    this.contractList = contractList;
    this.wallet = createWalletClient({
      account,
      chain: chain,
      transport: transport,
    });
    this.public = createPublicClient({
      chain: chain,
      transport: transport,
    });
    this.blockExplorer =
      chain.blockExplorers && chain.blockExplorers.default ? chain.blockExplorers.default.url : "http://localhost";

    this.factoryEscrow = contractList.escrow["FACTORY"] as Address;
    this.feeManagerEscrow = contractList.escrow["FEE_MANAGER"] as Address;
    this.fixedPriceAbi = abiList.fixedPriceAbi as [];
    this.milestoneAbi = abiList.milestoneAbi as [];
    this.hourlyAbi = abiList.hourlyAbi as [];
    this.feeManagerAbi = abiList.feeManagerAbi as [];
    this.factoryAbi = abiList.factoryAbi as [];
    this.environment = environment;
  }

  static buildByEnvironment(name: Environment = "test", account?: Account, url?: string): MidcontractProtocol {
    let chain = polygonAmoy as Chain;
    const contracts = contractList(name, chain.id);
    let abiList: AbiList;
    switch (name) {
      case "test":
        chain = polygonAmoy;
        abiList = {
          fixedPriceAbi: fixedPriceAbiTest,
          milestoneAbi: milestoneAbiTest,
          hourlyAbi: hourlyAbiTest,
          feeManagerAbi: feeManagerAbiTest,
          factoryAbi: factoryAbiTest,
        };
        break;
      case "beta":
        chain = blastSepolia;
        abiList = {
          fixedPriceAbi: fixedPriceAbiTest,
          milestoneAbi: milestoneAbiTest,
          hourlyAbi: hourlyAbiTest,
          feeManagerAbi: feeManagerAbiTest,
          factoryAbi: factoryAbiTest,
        };
        break;
      case "beta2":
        chain = polygonAmoy;
        abiList = {
          fixedPriceAbi: fixedPriceAbiBeta,
          milestoneAbi: milestoneAbiBeta,
          hourlyAbi: hourlyAbiBeta,
          feeManagerAbi: feeManagerAbiBeta,
          factoryAbi: factoryAbiBeta,
        };
        break;
      case "prod":
        chain = polygonAmoy;
        abiList = {
          fixedPriceAbi: fixedPriceAbiProd,
          milestoneAbi: milestoneAbiProd,
          hourlyAbi: hourlyAbiProd,
          feeManagerAbi: feeManagerAbiProd,
          factoryAbi: factoryAbiProd,
        };
        break;
    }

    const transport = url ? http(url) : http();
    if (url) {
      chain.rpcUrls = {
        default: { http: [url] },
      } as const;
    }
    return new MidcontractProtocol(chain, transport, contracts, abiList, name, account);
  }

  /** @deprecated */
  changeTransport(transport: CustomTransport, account: Account): void {
    this.wallet = createWalletClient({
      account,
      chain: this.wallet.chain,
      transport,
    });
  }

  async changeProvider(provider: EIP1193Provider): Promise<void> {
    const accounts = await provider.request({ method: "eth_accounts" });
    if (accounts.length == 0) {
      throw new NotSetError("account");
    }
    const account = {
      address: accounts[0],
      type: "json-rpc",
    } as Account;
    if (this.public.chain) {
      const currentChainId = BigInt(this.public.chain.id);
      const providerChainId = await provider
        .request({
          method: "eth_chainId",
        })
        .then(chainId => BigInt(chainId));
      if (currentChainId != providerChainId) {
        throw new NotMatchError(`chainId ${providerChainId} provider and current chainId ${currentChainId}`);
      }
    }
    this.wallet = createWalletClient({
      account,
      chain: this.wallet.chain,
      transport: custom(provider),
    });
    this.public = createPublicClient({
      chain: this.public.chain,
      transport: custom(provider),
    });
  }

  changeEscrow(escrow: Address): void {
    this.escrow = escrow;
  }

  changeAccount(account: Account): void {
    this.wallet = createWalletClient({
      account,
      chain: this.wallet.chain,
      transport: http(),
    });
  }

  async escrowDepositAmount(
    amount: number,
    feeConfig: FeeConfig = 1,
    tokenSymbol: SymbolToken = "MockUSDT"
  ): Promise<DepositAmount> {
    const tokenData = this.dataToken(tokenSymbol);
    const convertedAmount = parseUnits(amount.toString(), tokenData.decimals);
    const feeManager = new FeeManager(
      this.wallet,
      this.public,
      this.account,
      this.feeManagerEscrow,
      this.feeManagerAbi
    );
    const { totalDepositAmount, feeApplied } = await feeManager.computeDepositAmountAndFee(
      convertedAmount,
      feeConfig,
      this.escrow
    );

    return {
      totalDepositAmount: Number(totalDepositAmount) / Math.pow(10, tokenData.decimals),
      feeApplied: Number(feeApplied) / Math.pow(10, tokenData.decimals),
    };
  }

  async escrowClaimableAmount(
    amount: number,
    feeConfig: FeeConfig = 1,
    tokenSymbol: SymbolToken = "MockUSDT"
  ): Promise<ClaimableAmount> {
    const tokenData = this.dataToken(tokenSymbol);
    const convertedAmount = parseUnits(amount.toString(), tokenData.decimals);
    const feeManager = new FeeManager(
      this.wallet,
      this.public,
      this.account,
      this.feeManagerEscrow,
      this.feeManagerAbi
    );
    const { claimableAmount, feeDeducted, clientFee } = await feeManager.computeClaimableAmountAndFee(
      convertedAmount,
      feeConfig,
      this.escrow
    );

    return {
      claimableAmount: Number(claimableAmount) / Math.pow(10, tokenData.decimals),
      feeDeducted: Number(feeDeducted) / Math.pow(10, tokenData.decimals),
      clientFee: Number(clientFee) / Math.pow(10, tokenData.decimals),
    };
  }

  async getCoverageFee(wallet?: Hash, contractId?: bigint): Promise<number> {
    const feeManager = new FeeManager(
      this.wallet,
      this.public,
      this.account,
      this.feeManagerEscrow,
      this.feeManagerAbi
    );
    const { coverageFee } = await feeManager.getCoverageFee(this.escrow, wallet, contractId);

    return Number(coverageFee);
  }

  async getClaimFee(wallet?: Hash, contractId?: bigint): Promise<number> {
    const feeManager = new FeeManager(
      this.wallet,
      this.public,
      this.account,
      this.feeManagerEscrow,
      this.feeManagerAbi
    );
    const { claimFee } = await feeManager.getClaimFee(this.escrow, wallet, contractId);

    return Number(claimFee);
  }

  async getMaxBPS(): Promise<number> {
    const feeManager = new FeeManager(
      this.wallet,
      this.public,
      this.account,
      this.feeManagerEscrow,
      this.feeManagerAbi
    );
    const bps = await feeManager.getBPS();

    return Number(bps);
  }

  async getDepositList(contractId: bigint): Promise<Deposit> {
    const data = await this.public.readContract({
      address: this.escrow,
      args: [contractId],
      abi: this.fixedPriceAbi,
      functionName: "deposits",
    });

    for (const token of this.tokenList) {
      if (token.address == data[1]) {
        return new Deposit([
          data[0],
          token.symbol,
          Number(formatUnits(data[2], token.decimals)),
          Number(formatUnits(data[3], token.decimals)),
          Number(formatUnits(data[4], token.decimals)),
          data[5],
          data[6],
          data[7],
          data[8],
        ]);
      }
    }
    throw new NotFoundError();
  }

  async getDepositListMilestone(contractId: bigint, milestoneId: bigint): Promise<Deposit> {
    const contractMilestones = await this.public.readContract({
      address: this.escrow,
      args: [contractId, milestoneId],
      abi: this.milestoneAbi,
      functionName: "contractMilestones",
    });

    const milestoneData = await this.public.readContract({
      address: this.escrow,
      args: [contractId, milestoneId],
      abi: this.milestoneAbi,
      functionName: "milestoneDetails",
    });

    for (const token of this.tokenList) {
      if (token.address == milestoneData[0]) {
        return new Deposit([
          contractMilestones[0],
          token.symbol,
          Number(formatUnits(contractMilestones[1], token.decimals)),
          Number(formatUnits(contractMilestones[2], token.decimals)),
          Number(formatUnits(contractMilestones[3], token.decimals)),
          0n,
          contractMilestones[4],
          contractMilestones[5],
          contractMilestones[6],
        ]);
      }
    }
    throw new NotFoundError();
  }

  async getDepositListHourly(contractId: bigint, weekId: bigint): Promise<Deposit> {
    const contractDetails = await this.public.readContract({
      address: this.escrow,
      args: [contractId],
      abi: this.hourlyAbi,
      functionName: "contractDetails",
    });

    const data = await this.public.readContract({
      address: this.escrow,
      args: [contractId, weekId],
      abi: this.hourlyAbi,
      functionName: "weeklyEntries",
    });

    for (const token of this.tokenList) {
      if (token.address == contractDetails[1]) {
        return new Deposit([
          contractDetails[0],
          token.symbol,
          Number(formatUnits(contractDetails[2], token.decimals)),
          Number(formatUnits(data[0], token.decimals)),
          Number(formatUnits(contractDetails[3], token.decimals)),
          0n,
          "0x0",
          contractDetails[4],
          contractDetails[5],
        ]);
      }
    }
    throw new NotFoundError();
  }

  async currentContractId(): Promise<bigint> {
    return this.public.readContract({
      address: this.escrow,
      abi: this.fixedPriceAbi,
      functionName: "getCurrentContractId",
    });
  }

  async currentContractIdMilestone(): Promise<bigint> {
    return this.public.readContract({
      address: this.escrow,
      abi: this.milestoneAbi,
      functionName: "getCurrentContractId",
    });
  }

  async currentContractIdHourly(): Promise<bigint> {
    return this.public.readContract({
      address: this.escrow,
      abi: this.milestoneAbi,
      functionName: "getCurrentContractId",
    });
  }

  get blockNumber(): Promise<number> {
    return this.public.getBlockNumber().then(v => Number(v));
  }

  get account(): Account {
    if (!this.wallet.account) {
      throw new NotSetError("account");
    }
    return this.wallet.account;
  }

  private dataToken(symbol: SymbolToken): DataToken {
    const data = this.contractList.tokenList[symbol];
    if (!data) {
      throw new NotSupportError(`token ${symbol}`);
    }
    return data;
  }

  private async tokenAllowance(account: Address, symbol: SymbolToken = "MockUSDT"): Promise<number> {
    const token: DataToken = this.dataToken(symbol);
    const allowance = await this.public.readContract({
      abi: erc20Abi,
      address: token.address,
      account,
      args: [account, this.escrow],
      functionName: "allowance",
    });
    return Number(formatUnits(allowance, token.decimals));
  }

  async tokenBalance(account: Address, symbol: SymbolToken = "MockUSDT"): Promise<number> {
    const token = this.dataToken(symbol);
    const balance = await this.public.readContract({
      abi: erc20Abi,
      address: token.address,
      account,
      args: [account],
      functionName: "balanceOf",
    });
    // return 10000;
    return Number(formatUnits(balance, token.decimals));
  }

  async tokenApprove(amount: number, symbol: SymbolToken = "MockUSDT"): Promise<Hash> {
    const token = this.dataToken(symbol);
    let param: WriteContractParameters;
    try {
      const { request } = await this.public.simulateContract({
        address: token.address,
        abi: erc20Abi,
        account: this.account,
        args: [this.escrow, parseUnits(amount.toString(), token.decimals)],
        functionName: "approve",
      });
      param = request;
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
    return this.send(param);
  }

  async tokenRequireBalance(owner: Address, amount: number, symbol: SymbolToken = "MockUSDT"): Promise<void> {
    const balance = await this.tokenBalance(owner, symbol);
    if (balance < amount) {
      throw new NotEnoughError(`balance of ${symbol} is ${balance}`);
    }
  }

  async tokenRequireAllowance(owner: Address, amount: number, symbol: SymbolToken = "MockUSDT"): Promise<void> {
    const allowance = await this.tokenAllowance(owner, symbol);
    if (allowance < amount) {
      const approveAmount = amount - allowance;
      const hash = await this.tokenApprove(approveAmount, symbol);
      const transaction = await this.public.waitForTransactionReceipt({ hash });
      if (transaction.status != "success") {
        throw new NotSuccessTransactionError(`token approve of ${symbol} for ${approveAmount}`);
      }
    }
  }

  escrowMakeSalt(salt: number): Hash {
    return this.numberToBytes32(salt);
  }

  private numberToBytes32(number: number): `0x${string}` {
    let hexString = number.toString(16);
    hexString = hexString.padStart(64, "0");
    return `0x${hexString}`;
  }

  async escrowMakeDataHash(contractor: Hash, data: string, salt: Hash): Promise<Hash> {
    const encodedData = toHex(new TextEncoder().encode(data));
    return await this.public.readContract({
      address: this.escrow,
      abi: this.fixedPriceAbi,
      args: [contractor, encodedData as Hash, salt],
      functionName: "getContractorDataHash",
    });
  }

  hashContractorData(data: string, salt: Hash) {
    const hexData = toHex(new TextEncoder().encode(data));

    return keccak256(encodePacked(["address", "bytes", "bytes32"], [this.account.address, hexData, salt]));
  }

  public async getTransactionReceipt(hash: Hash, waitReceipt = false): Promise<TransactionReceipt | null> {
    let receipt: TransactionReceipt | null = null;
    try {
      if (waitReceipt) {
        receipt = await this.public.waitForTransactionReceipt({
          hash,
        });
      } else {
        receipt = await this.public.getTransactionReceipt({
          hash,
        });
      }
    } catch (_) {}
    return receipt;
  }

  async prepareEscrowDepositPayload(input: DepositInput): Promise<PreparedEscrowFixedPriceDeposit> {
    input.token = input.token || "MockUSDT";
    input.timeLock = input.timeLock || BigInt(0);
    input.recipientData = input.recipientData || "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";

    const token = this.dataToken(input.token);

    const amount = parseUnits(input.amount.toString(), token.decimals);
    const amountToClaim = parseUnits(String(input.amountToClaim || 0), token.decimals);
    const amountToWithdraw = parseUnits(String(input.amountToWithdraw || 0), token.decimals);
    const { totalDepositAmount } = await this.escrowDepositAmount(input.amount, input.feeConfig, input.token);

    const status = input.status || DepositStatus.ACTIVE;
    await this.tokenRequireBalance(this.account.address, totalDepositAmount, input.token);
    await this.tokenRequireAllowance(this.account.address, totalDepositAmount, input.token);
    const expiration = BigInt(Math.floor(Date.now() / 1000) + 3 * 60 * 60);
    const hash = await this.getFixedPriceDepositHash({
      clientAddress: this.account.address,
      contractId: input.contractId,
      contractor: input.contractorAddress,
      paymentToken: token.address,
      amount: amount,
      feeConfig: input.feeConfig,
      contractorData: input.recipientData,
      expiration,
    });

    return {
      contractId: input.contractId,
      contractor: input.contractorAddress,
      paymentToken: token.address,
      amount: amount,
      amountToClaim: amountToClaim,
      amountToWithdraw: amountToWithdraw,
      contractorData: input.recipientData,
      feeConfig: input.feeConfig,
      status,
      escrow: this.escrow,
      expiration,
      signature: hash,
    };
  }

  async escrowDeposit(input: PreparedEscrowFixedPriceDeposit, waitReceipt = true): Promise<DepositResponse> {
    try {
      const data = await this.public.simulateContract({
        address: this.escrow,
        abi: this.fixedPriceAbi,
        account: this.account,
        args: [input],
        functionName: "deposit",
      });
      const hash = await this.send({ ...data.request });
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
        contractId: input.contractId,
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async prepareMilestoneDepositPayload(
    deposits: MilestoneDepositInput[],
    tokenSymbol: SymbolToken,
    escrowContractId: bigint
  ): Promise<PreparedEscrowMilestoneDeposit> {
    const account = this.account;
    let totalDepositToAllow = 0;
    const milestonesPayload = [];
    const paymentToken = this.dataToken(tokenSymbol);
    for (const deposit of deposits) {
      deposit.token = deposit.token || "MockUSDT";
      deposit.timeLock = deposit.timeLock || BigInt(0);
      deposit.recipientData =
        deposit.recipientData || "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";
      const { totalDepositAmount } = await this.escrowDepositAmount(
        Number(deposit.amount),
        deposit.feeConfig,
        deposit.token
      );
      totalDepositToAllow += totalDepositAmount;
      deposit.status = deposit.status || DepositStatus.ACTIVE;
      milestonesPayload.push({
        contractor: deposit.contractorAddress,
        amount: parseUnits(String(deposit.amount), paymentToken.decimals),
        amountToClaim: parseUnits(String(deposit.amountToClaim || 0), paymentToken.decimals),
        amountToWithdraw: parseUnits(String(deposit.amountToWithdraw || 0), paymentToken.decimals),
        contractorData: deposit.recipientData,
        feeConfig: deposit.feeConfig,
        status: deposit.status,
      });
    }

    await this.tokenRequireBalance(account.address, totalDepositToAllow, tokenSymbol);
    await this.tokenRequireAllowance(account.address, totalDepositToAllow, tokenSymbol);

    const expiration = BigInt(Math.floor(Date.now() / 1000) + 3 * 60 * 60);
    const milestonesHash = await this.hashMilestones(milestonesPayload);
    const milestoneDepositHash = await this.getMilestoneDepositHash({
      clientAddress: this.account.address,
      contractId: escrowContractId,
      milestonesHash,
      paymentToken: paymentToken.address,
      expiration,
    });

    const depositPayload = {
      contractId: escrowContractId,
      paymentToken: paymentToken.address,
      milestonesHash,
      escrow: this.escrow,
      expiration,
      signature: milestoneDepositHash,
    };

    return {
      depositPayload,
      milestonesPayload,
    };
  }

  async escrowMilestoneDeposit(input: PreparedEscrowMilestoneDeposit, waitReceipt = true): Promise<DepositResponse> {
    const lastDepositTime = this.transactionStorage.get("lastMilestoneDepositTimestamp");
    console.log("lastMilestoneDepositTimestamp got -> ", lastDepositTime);

    if (lastDepositTime && Date.now() - lastDepositTime < 30000) {
      throw new Error("You have recently submitted a deposit. Please wait before making another.");
    }

    console.log("lastMilestoneDepositTimestamp checked -> ", lastDepositTime);

    try {
      const data = await this.public.simulateContract({
        address: this.escrow,
        abi: this.milestoneAbi,
        account: this.account,
        args: [input.depositPayload, input.milestonesPayload],
        functionName: "deposit",
      });
      const hash = await this.send({ ...data.request });
      const dateNow = Date.now();
      this.transactionStorage.set("lastMilestoneDepositTimestamp", dateNow);
      console.log("lastMilestoneDepositTimestamp set -> ", dateNow);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      this.transactionStorage.delete("lastMilestoneDepositTimestamp");
      console.log("lastMilestoneDepositTimestamp removed -> ");
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
        contractId: input.depositPayload.contractId,
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async prepareEscrowDepositHourlyPayload(
    tokenSymbol: SymbolToken,
    prepaymentAmount = 0,
    escrowContractId = 0n,
    deposit: HourlyDepositInput
  ): Promise<PreparedEscrowHourlyDeposit> {
    const account = this.account;
    const token = this.dataToken(tokenSymbol);
    const { totalDepositAmount } = await this.escrowDepositAmount(
      prepaymentAmount ? Number(prepaymentAmount) : Number(deposit.amountToClaim),
      deposit.feeConfig,
      tokenSymbol
    );
    const parsedPrepaymentAmount = parseUnits(String(prepaymentAmount || 0), token.decimals);
    const parsedAmountToClaim = parseUnits(String(deposit.amountToClaim || 0), token.decimals);
    const expiration = BigInt(Math.floor(Date.now() / 1000) + 3 * 60 * 60);

    const hourlyDepositHash = await this.getHourlyDepositHash({
      clientAddress: this.account.address,
      contractId: escrowContractId,
      contractor: deposit.contractorAddress,
      paymentToken: token.address,
      prepaymentAmount: parsedPrepaymentAmount,
      amountToClaim: parsedAmountToClaim,
      feeConfig: deposit.feeConfig,
      expiration,
    });

    const depositPayload = {
      contractId: escrowContractId,
      contractor: deposit.contractorAddress,
      paymentToken: token.address,
      prepaymentAmount: parsedPrepaymentAmount,
      amountToClaim: parsedAmountToClaim,
      feeConfig: deposit.feeConfig,
      escrow: this.escrow,
      expiration,
      signature: hourlyDepositHash,
    };

    await this.tokenRequireBalance(account.address, totalDepositAmount, tokenSymbol);
    await this.tokenRequireAllowance(account.address, totalDepositAmount, tokenSymbol);

    return depositPayload;
  }

  async escrowDepositHourly(input: PreparedEscrowHourlyDeposit, waitReceipt = true): Promise<DepositResponse> {
    const lastDepositTime = this.transactionStorage.get("lastHourlyDepositTimestamp");
    console.log("Last hourly deposit time got");

    if (lastDepositTime && Date.now() - lastDepositTime < 30000) {
      throw new Error("You have recently submitted a deposit. Please wait before making another.");
    }
    console.log("Last hourly deposit time checked");
    try {
      const data = await this.public.simulateContract({
        address: this.escrow,
        abi: this.hourlyAbi,
        account: this.account,
        args: [input],
        functionName: "deposit",
      });
      const hash = await this.send({ ...data.request });
      this.transactionStorage.set("lastHourlyDepositTimestamp", Date.now());
      console.log("Last hourly deposit time set");
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      this.transactionStorage.delete("lastHourlyDepositTimestamp");
      console.log("Last hourly deposit time deleted");
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
        contractId: input.contractId,
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async escrowSubmit(
    contractId: bigint,
    salt: Hash,
    data: string,
    signature: Hash,
    expiration: number,
    waitReceipt = true
  ): Promise<TransactionId> {
    try {
      const hexData = toHex(new TextEncoder().encode(data));

      const payload = {
        contractId,
        data: hexData,
        salt,
        expiration: BigInt(expiration),
        signature,
      };

      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.fixedPriceAbi,
        account: this.account,
        args: [payload],
        functionName: "submit",
      });

      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async escrowSubmitMilestone(
    contractId: bigint,
    milestoneId: bigint,
    salt: Hash,
    data: string,
    signature: Hash,
    expiration: number,
    waitReceipt = true
  ): Promise<TransactionId> {
    try {
      const hexData = toHex(new TextEncoder().encode(data));

      const payload = {
        contractId,
        milestoneId,
        data: hexData,
        salt,
        expiration: BigInt(expiration),
        signature,
      };

      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.milestoneAbi,
        account: this.account,
        args: [payload],
        functionName: "submit",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);

      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async escrowRefill(contractId: bigint, value: number, waitReceipt = true): Promise<TransactionId> {
    if (value == 0) {
      throw new NotSetError("valueAdditional");
    }

    const deposit = await this.getDepositList(contractId);
    const token = this.dataToken(deposit.paymentToken);
    const account = this.account;
    const { totalDepositAmount } = await this.escrowDepositAmount(value, deposit.feeConfig);
    await this.tokenRequireAllowance(account.address, totalDepositAmount, deposit.paymentToken);

    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.fixedPriceAbi,
        account: this.account,
        args: [contractId, parseUnits(value.toString(), token.decimals)],
        functionName: "refill",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async escrowRefillMilestone(
    contractId: bigint,
    milestoneId: bigint,
    value: number,
    waitReceipt = true
  ): Promise<TransactionId> {
    if (value == 0) {
      throw new NotSetError("valueAdditional");
    }

    const deposit = await this.getDepositListMilestone(contractId, milestoneId);
    const token = this.dataToken(deposit.paymentToken);
    const account = this.account;
    const { totalDepositAmount } = await this.escrowDepositAmount(value, deposit.feeConfig);
    await this.tokenRequireAllowance(account.address, totalDepositAmount, deposit.paymentToken);

    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.milestoneAbi,
        account: this.account,
        args: [contractId, milestoneId, parseUnits(value.toString(), token.decimals)],
        functionName: "refill",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async escrowRefillHourly(
    contractId: bigint,
    weekId: bigint,
    value: number,
    refillType: RefillType,
    waitReceipt = true
  ): Promise<TransactionId> {
    if (value == 0) {
      throw new NotSetError("valueAdditional");
    }

    const deposit = await this.getDepositListHourly(contractId, weekId);
    const token = this.dataToken(deposit.paymentToken);
    const account = this.account;
    const { totalDepositAmount } = await this.escrowDepositAmount(value, deposit.feeConfig);

    await this.tokenRequireAllowance(account.address, totalDepositAmount, deposit.paymentToken);
    await this.tokenRequireAllowance(account.address, totalDepositAmount, deposit.paymentToken);

    const parsedAmount = parseUnits(value.toString(), token.decimals);

    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.hourlyAbi,
        account: this.account,
        args: [contractId, weekId, parsedAmount, refillType],
        functionName: "refill",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async escrowApprove(input: ApproveInput, waitReceipt = true): Promise<TransactionId> {
    input.token = input.token || "MockUSDT";
    input.valueApprove = input.valueApprove || 0;
    input.valueAdditional = input.valueAdditional || 0;
    const recipient = input.recipient || "0x0000000000000000000000000000000000000000";

    if (input.valueApprove == 0 && input.valueAdditional == 0) {
      throw new NotSetError("valueAdditional");
    }

    const token = this.dataToken(input.token);
    const account = this.account;
    if (input.valueAdditional > 0) {
      return await this.escrowRefill(input.contractId, input.valueAdditional);
    }

    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.fixedPriceAbi,
        account,
        args: [input.contractId, parseUnits(input.valueApprove.toString(), token.decimals), recipient],
        functionName: "approve",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async escrowApproveMilestone(input: ApproveInputMilestone, waitReceipt = true): Promise<TransactionId> {
    input.token = input.token || "MockUSDT";
    input.valueApprove = input.valueApprove || 0;
    const recipient = input.recipient || "0x0000000000000000000000000000000000000000";

    if (input.valueApprove == 0) {
      throw new NotSetError("valueAdditional");
    }

    const token = this.dataToken(input.token);
    const account = this.account;

    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.milestoneAbi,
        account,
        args: [
          input.contractId,
          input.milestoneId,
          parseUnits(input.valueApprove.toString(), token.decimals),
          recipient,
        ],
        functionName: "approve",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async escrowApproveHourly(input: ApproveInputHourly, waitReceipt = true): Promise<TransactionId> {
    const lastDepositTime = this.transactionStorage.get("lastHourlyDepositTimestamp");
    console.log("Last hourly deposit time got ->", lastDepositTime);

    if (lastDepositTime && Date.now() - lastDepositTime < 30000) {
      throw new Error("You have recently submitted a deposit. Please wait before making another.");
    }
    console.log("Last hourly deposit time checked");
    input.token = input.token || "MockUSDT";
    input.valueApprove = input.valueApprove || 0;
    const account = this.account;
    const recipient = input.recipient || "0x0000000000000000000000000000000000000000";
    const token = this.dataToken(input.token);

    if (input.valueApprove == 0) {
      throw new NotSetError("valueAdditional");
    }

    const deposit = await this.getDepositListHourly(input.contractId, input.weekId);

    const { totalDepositAmount } = await this.escrowDepositAmount(input.valueApprove, deposit.feeConfig);
    await this.tokenRequireBalance(account.address, totalDepositAmount, input.token);
    await this.tokenRequireAllowance(account.address, totalDepositAmount, input.token);

    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.hourlyAbi,
        account,
        args: [input.contractId, input.weekId, parseUnits(input.valueApprove.toString(), token.decimals), recipient],
        functionName: "approve",
      });
      const hash = await this.send(request);
      this.transactionStorage.set("lastHourlyDepositTimestamp", Date.now());
      console.log("Last hourly deposit time set");
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      this.transactionStorage.delete("lastHourlyDepositTimestamp");
      console.log("Last hourly deposit time deleted");
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async escrowApproveByAdminHourly(input: ApproveByAdminInputHourly, waitReceipt = true): Promise<TransactionId> {
    input.token = input.token || "MockUSDT";
    input.valueApprove = input.valueApprove || 0;
    const account = this.account;
    const recipient = input.recipient || "0x0000000000000000000000000000000000000000";
    const token = this.dataToken(input.token);

    if (input.valueApprove == 0) {
      throw new NotSetError("valueAdditional");
    }
    let deposit;

    if (!input.initializeNewWeek) {
      deposit = await this.getDepositListHourly(input.contractId, input.weekId);
    } else {
      const previousWeekId = BigInt(Number(input.weekId) - 1);
      deposit = await this.getDepositListHourly(input.contractId, previousWeekId);
    }

    const { totalDepositAmount } = await this.escrowDepositAmount(input.valueApprove, deposit.feeConfig);
    await this.tokenRequireAllowance(account.address, totalDepositAmount, input.token);
    await this.tokenRequireAllowance(account.address, totalDepositAmount, input.token);

    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.hourlyAbi,
        account,
        args: [
          input.contractId,
          input.weekId,
          parseUnits(input.valueApprove.toString(), token.decimals),
          recipient,
          input.initializeNewWeek,
        ],
        functionName: "adminApprove",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async escrowClaim(contractId: bigint, waitReceipt = true): Promise<TransactionId> {
    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.fixedPriceAbi,
        account: this.account,
        args: [contractId],
        functionName: "claim",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async escrowClaimMilestone(contractId: bigint, milestoneId: bigint, waitReceipt = true): Promise<TransactionId> {
    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.milestoneAbi,
        account: this.account,
        args: [contractId, milestoneId],
        functionName: "claim",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async escrowClaimAllMilestone(
    contractId: bigint,
    startMilestoneId: bigint,
    endMilestoneId: bigint,
    waitReceipt = true
  ): Promise<TransactionId> {
    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.milestoneAbi,
        account: this.account,
        args: [contractId, startMilestoneId, endMilestoneId],
        functionName: "claimAll",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async escrowClaimHourly(contractId: bigint, weekId: bigint, waitReceipt = true): Promise<TransactionId> {
    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.hourlyAbi,
        account: this.account,
        args: [contractId, weekId],
        functionName: "claim",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async escrowWithdraw(contractId: bigint, waitReceipt = true): Promise<TransactionId> {
    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.fixedPriceAbi,
        account: this.account,
        args: [contractId],
        functionName: "withdraw",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async escrowWithdrawMilestone(contractId: bigint, milestoneId: bigint, waitReceipt = true): Promise<TransactionId> {
    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.milestoneAbi,
        account: this.account,
        args: [contractId, milestoneId],
        functionName: "withdraw",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async escrowWithdrawHourly(contractId: bigint, waitReceipt = true): Promise<TransactionId> {
    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.hourlyAbi,
        account: this.account,
        args: [contractId],
        functionName: "withdraw",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async requestReturn(contractId: bigint, waitReceipt = true): Promise<TransactionId> {
    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.fixedPriceAbi,
        account: this.account,
        args: [contractId],
        functionName: "requestReturn",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async requestReturnMilestone(contractId: bigint, milestoneId: bigint, waitReceipt = true): Promise<TransactionId> {
    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.milestoneAbi,
        account: this.account,
        args: [contractId, milestoneId],
        functionName: "requestReturn",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async requestReturnHourly(contractId: bigint, waitReceipt = true): Promise<TransactionId> {
    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.hourlyAbi,
        account: this.account,
        args: [contractId],
        functionName: "requestReturn",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async approveReturn(contractId: bigint, waitReceipt = true): Promise<TransactionId> {
    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.fixedPriceAbi,
        account: this.account,
        args: [contractId],
        functionName: "approveReturn",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async approveReturnMilestone(contractId: bigint, milestoneId: bigint, waitReceipt = true): Promise<TransactionId> {
    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.milestoneAbi,
        account: this.account,
        args: [contractId, milestoneId],
        functionName: "approveReturn",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async approveReturnHourly(contractId: bigint, waitReceipt = true): Promise<TransactionId> {
    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.hourlyAbi,
        account: this.account,
        args: [contractId],
        functionName: "approveReturn",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async cancelReturn(contractId: bigint, waitReceipt = true): Promise<TransactionId> {
    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.fixedPriceAbi,
        account: this.account,
        args: [contractId],
        functionName: "cancelReturn",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async cancelReturnMilestone(contractId: bigint, milestoneId: bigint, waitReceipt = true): Promise<TransactionId> {
    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.milestoneAbi,
        account: this.account,
        args: [contractId, milestoneId],
        functionName: "cancelReturn",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async cancelReturnHourly(contractId: bigint, waitReceipt = true): Promise<TransactionId> {
    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.hourlyAbi,
        account: this.account,
        args: [contractId],
        functionName: "cancelReturn",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async createDispute(contractId: bigint, waitReceipt = true): Promise<TransactionId> {
    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.fixedPriceAbi,
        account: this.account,
        args: [contractId],
        functionName: "createDispute",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async createDisputeMilestone(contractId: bigint, milestoneId: bigint, waitReceipt = true): Promise<TransactionId> {
    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.milestoneAbi,
        account: this.account,
        args: [contractId, milestoneId],
        functionName: "createDispute",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async createDisputeHourly(contractId: bigint, weekId: bigint, waitReceipt = true): Promise<TransactionId> {
    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.hourlyAbi,
        account: this.account,
        args: [contractId, weekId],
        functionName: "createDispute",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async resolveDispute(
    contractId: bigint,
    winner: DisputeWinner,
    clientAmount: number,
    contractorAmount: number,
    waitReceipt = true
  ): Promise<TransactionId> {
    const deposit = await this.getDepositList(contractId);
    const token = this.dataToken(deposit.paymentToken);
    const clientAmountConverted = clientAmount ? parseUnits(clientAmount.toString(), token.decimals) : 0n;
    const contractorAmountConverted = contractorAmount ? parseUnits(contractorAmount.toString(), token.decimals) : 0n;

    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.fixedPriceAbi,
        account: this.account,
        args: [contractId, winner, clientAmountConverted, contractorAmountConverted],
        functionName: "resolveDispute",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async resolveDisputeMilestone(
    contractId: bigint,
    milestoneId: bigint,
    winner: DisputeWinner,
    clientAmount: number,
    contractorAmount: number,
    waitReceipt = true
  ): Promise<TransactionId> {
    const deposit = await this.getDepositListMilestone(contractId, milestoneId);
    const token = this.dataToken(deposit.paymentToken);
    const clientAmountConverted = clientAmount ? parseUnits(clientAmount.toString(), token.decimals) : 0n;
    const contractorAmountConverted = contractorAmount ? parseUnits(contractorAmount.toString(), token.decimals) : 0n;

    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.milestoneAbi,
        account: this.account,
        args: [contractId, milestoneId, winner, clientAmountConverted, contractorAmountConverted],
        functionName: "resolveDispute",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async resolveDisputeHourly(
    contractId: bigint,
    weekId: bigint,
    winner: DisputeWinner,
    clientAmount: number,
    contractorAmount: number,
    waitReceipt = true
  ): Promise<TransactionId> {
    const deposit = await this.getDepositListHourly(contractId, weekId);
    const token = this.dataToken(deposit.paymentToken);
    const clientAmountConverted = clientAmount ? parseUnits(clientAmount.toString(), token.decimals) : 0n;
    const contractorAmountConverted = contractorAmount ? parseUnits(contractorAmount.toString(), token.decimals) : 0n;

    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: this.hourlyAbi,
        account: this.account,
        args: [contractId, weekId, winner, clientAmountConverted, contractorAmountConverted],
        functionName: "resolveDispute",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return {
        id: hash,
        status: receipt ? receipt.status : "pending",
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async mintMockUSDTTokens(): Promise<TransactionId> {
    const token = this.dataToken("MockUSDT");

    const account = this.account;
    const amount = parseUnits("1000", token.decimals);

    const mintAbi = [
      {
        inputs: [
          { internalType: "address", name: "account", type: "address" },
          { internalType: "uint256", name: "amount", type: "uint256" },
        ],
        name: "mint",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
      },
    ];

    const { request } = await this.public.simulateContract({
      address: token.address,
      abi: mintAbi,
      account,
      args: [account.address, amount],
      functionName: "mint",
    });
    const hash = await this.send(request);
    const receipt = await this.getTransactionReceipt(hash, true);
    return {
      id: hash,
      status: receipt ? receipt.status : "pending",
    };
  }

  async deployEscrow(): Promise<{
    userEscrow: Address;
    salt: Hash;
  }> {
    try {
      const data = await this.public.simulateContract({
        address: this.factoryEscrow,
        abi: this.factoryAbi,
        account: this.account,
        args: [EscrowType.FixedPrice],
        functionName: "deployEscrow",
      });
      const hash = await this.send(data.request);
      await this.getTransactionReceipt(hash, true);
      const salt = this.generateRandomNumber();
      return {
        userEscrow: data.result,
        salt,
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async deployMilestoneEscrow(): Promise<{
    userEscrow: Address;
    salt: Hash;
  }> {
    try {
      const data = await this.public.simulateContract({
        address: this.factoryEscrow,
        abi: this.factoryAbi,
        account: this.account,
        args: [EscrowType.Milestone],
        functionName: "deployEscrow",
      });
      const hash = await this.send(data.request);
      await this.getTransactionReceipt(hash, true);
      const salt = this.generateRandomNumber();
      return {
        userEscrow: data.result,
        salt,
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async deployHourlyEscrow(): Promise<{
    userEscrow: Address;
    salt: Hash;
  }> {
    try {
      const data = await this.public.simulateContract({
        address: this.factoryEscrow,
        abi: this.factoryAbi,
        account: this.account,
        args: [EscrowType.Hourly],
        functionName: "deployEscrow",
      });
      const hash = await this.send(data.request);
      await this.getTransactionReceipt(hash, true);
      const salt = this.generateRandomNumber();
      return {
        userEscrow: data.result,
        salt,
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async updateDefaultFees(coverageFee: number, claimFee: number): Promise<void> {
    const feeManager = new FeeManager(
      this.wallet,
      this.public,
      this.account,
      this.feeManagerEscrow,
      this.feeManagerAbi
    );
    await feeManager.updateDefaultFees(coverageFee, claimFee);
  }

  async setSpecialFees(accountAddress: Address, coverageFee: number, claimFee: number): Promise<void> {
    const feeManager = new FeeManager(
      this.wallet,
      this.public,
      this.account,
      this.feeManagerEscrow,
      this.feeManagerAbi
    );
    await feeManager.setUserSpecificFees(accountAddress, coverageFee, claimFee);
  }

  async setContractSpecificFees(
    accountAddress: Address,
    contractId: bigint,
    coverageFee: number,
    claimFee: number
  ): Promise<void> {
    const feeManager = new FeeManager(
      this.wallet,
      this.public,
      this.account,
      this.feeManagerEscrow,
      this.feeManagerAbi
    );
    await feeManager.setContractSpecificFees(accountAddress, contractId, coverageFee, claimFee);
  }

  async setInstanceFees(accountAddress: Address, coverageFee: number, claimFee: number): Promise<void> {
    const feeManager = new FeeManager(
      this.wallet,
      this.public,
      this.account,
      this.feeManagerEscrow,
      this.feeManagerAbi
    );
    await feeManager.setInstanceFees(accountAddress, coverageFee, claimFee);
  }

  async transactionByHashWait(hash: Hash): Promise<TransactionData> {
    return this.transactionByHash(hash, true);
  }

  async transactionByHash(hash: Hash, waitReceipt = false): Promise<TransactionData> {
    let isEmbedded = false;
    const transaction = await this.public.getTransaction({
      hash,
    });
    const receipt = await this.getTransactionReceipt(hash, waitReceipt);

    const embeddedAddress = "0x0000000071727de22e5e9d8baf0edac6f37da032";
    if (transaction.to?.toLowerCase() === embeddedAddress.toLowerCase()) {
      isEmbedded = true;
    }
    return {
      transaction,
      input: parseInput(transaction.input, this.contractList.chainName, isEmbedded),
      status: receipt ? receipt.status : "pending",
      receipt,
    };
  }

  async transactionByHashMilestoneWait(hash: Hash): Promise<TransactionData> {
    return this.transactionByHashMilestone(hash, true);
  }

  async transactionByHashMilestone(hash: Hash, waitReceipt = false): Promise<TransactionData> {
    let isEmbedded = false;
    const transaction = await this.public.getTransaction({
      hash,
    });
    const receipt = await this.getTransactionReceipt(hash, waitReceipt);

    const embeddedAddress = "0x0000000071727de22e5e9d8baf0edac6f37da032";
    if (transaction.to?.toLowerCase() === embeddedAddress.toLowerCase()) {
      isEmbedded = true;
    }

    return {
      transaction,
      input: parseMilestoneInput(transaction.input, this.environment, isEmbedded),
      status: receipt ? receipt.status : "pending",
      receipt,
    };
  }

  async transactionByHashHourlyWait(hash: Hash): Promise<TransactionData> {
    return this.transactionByHashHourly(hash, true);
  }

  async transactionByHashHourly(hash: Hash, waitReceipt = false): Promise<TransactionData> {
    let isEmbedded = false;
    const transaction = await this.public.getTransaction({
      hash,
    });
    const receipt = await this.getTransactionReceipt(hash, waitReceipt);

    const embeddedAddress = "0x0000000071727de22e5e9d8baf0edac6f37da032";
    if (transaction.to?.toLowerCase() === embeddedAddress.toLowerCase()) {
      isEmbedded = true;
    }

    return {
      transaction,
      input: parseHourlyInput(transaction.input, this.contractList.chainName, isEmbedded),
      status: receipt ? receipt.status : "pending",
      receipt,
    };
  }

  async transactionParse(data: TransactionData) {
    let isEmbedded = false;
    const { transaction, receipt } = data;
    const embeddedAddress = "0x0000000071727de22e5e9d8baf0edac6f37da032";
    if (transaction.to?.toLowerCase() === embeddedAddress.toLowerCase()) {
      isEmbedded = true;
    }
    if (!isEmbedded && BigInt(transaction.to || "0") != BigInt(this.escrow)) {
      throw new NotSupportError(`contract ${transaction.to} ${this.escrow}`);
    }
    const input = await this.parseInput(transaction.input, isEmbedded);
    const events = await this.parseLogs(receipt ? receipt.logs : []).then(logs =>
      logs.map(log => {
        return {
          eventName: log.eventName,
          args: log.args,
        };
      })
    );
    return {
      input,
      events,
    };
  }

  async transactionParseMilestone(data: TransactionData) {
    let isEmbedded = false;
    const { transaction, receipt } = data;

    const embeddedAddress = "0x0000000071727de22e5e9d8baf0edac6f37da032";
    if (transaction.to?.toLowerCase() === embeddedAddress.toLowerCase()) {
      isEmbedded = true;
    }

    if (!isEmbedded && BigInt(transaction.to || "0") != BigInt(this.escrow)) {
      throw new NotSupportError(`contract ${transaction.to} ${this.escrow}`);
    }
    const input = await this.parseInputMilestone(transaction.input, isEmbedded);
    const events = await this.parseLogsMilestone(receipt ? receipt.logs : []).then(logs =>
      logs.map(log => {
        return {
          eventName: log.eventName,
          args: log.args,
        };
      })
    );
    return {
      input,
      events,
    };
  }

  async transactionParseHourly(data: TransactionData) {
    let isEmbedded = false;
    const { transaction, receipt } = data;

    const embeddedAddress = "0x0000000071727de22e5e9d8baf0edac6f37da032";
    if (transaction.to?.toLowerCase() === embeddedAddress.toLowerCase()) {
      isEmbedded = true;
    }

    if (!isEmbedded && BigInt(transaction.to || "0") != BigInt(this.escrow)) {
      throw new NotSupportError(`contract ${transaction.to} ${this.escrow}`);
    }
    const input = await this.parseInputHourly(transaction.input, isEmbedded);
    const events = await this.parseLogsHourly(receipt ? receipt.logs : []).then(logs =>
      logs.map(log => {
        return {
          eventName: log.eventName,
          args: log.args,
        };
      })
    );
    return {
      input,
      events,
    };
  }

  async hashMilestones(milestoneInput: HashMilestonesDepositInput[]): Promise<Hash> {
    return await this.public.readContract({
      address: this.escrow,
      abi: this.milestoneAbi,
      account: this.account,
      args: [milestoneInput],
      functionName: "hashMilestones",
    });
  }

  // getFixedPriceDepositTypes(): string[] {
  //   const abi: AbiFunction[] = this.fixedPriceAbi;
  //   const depositAbi = abi.filter(func => func.name === "deposit")[0];
  //   if (depositAbi && depositAbi.inputs.length) {
  //     return depositAbi.inputs[0].components.map(value => value.type);
  //   } else {
  //     return [];
  //   }
  // }
  //
  // getFixedPriceSubmitTypes(): string[] {
  //   const abi: AbiFunction[] = this.fixedPriceAbi;
  //   const depositAbi = abi.find(func => func.name === "submit");
  //   if (!depositAbi) {
  //     return [];
  //   } else {
  //     return depositAbi.inputs.map(value => value.type);
  //   }
  // }
  //
  // getMilestoneDepositTypes(): string[] {
  //   const abi: AbiFunction[] = this.milestoneAbi;
  //   const depositAbi = abi.find(func => func.name === "deposit");
  //   if (!depositAbi) {
  //     return [];
  //   } else {
  //     return depositAbi.inputs.map(value => value.type);
  //   }
  // }
  //
  // getMilestoneSubmitTypes(): string[] {
  //   const abi: AbiFunction[] = this.milestoneAbi;
  //   const depositAbi = abi.find(func => func.name === "submit");
  //   if (!depositAbi) {
  //     return [];
  //   } else {
  //     return depositAbi.inputs.map(value => value.type);
  //   }
  // }
  //
  // getHourlyDepositTypes(): string[] {
  //   const abi: AbiFunction[] = this.milestoneAbi;
  //   const depositAbi = abi.find(func => func.name === "deposit");
  //   if (!depositAbi) {
  //     return [];
  //   } else {
  //     return depositAbi.inputs.map(value => value.type);
  //   }
  // }

  private async getFixedPriceDepositHash(input: GetFixedPriceDepositHash): Promise<Hash> {
    try {
      const data = await this.public.simulateContract({
        address: this.escrow,
        abi: this.fixedPriceAbi,
        account: this.account,
        args: [
          input.clientAddress,
          input.contractId,
          input.contractor,
          input.paymentToken,
          input.amount,
          input.feeConfig,
          input.contractorData,
          input.expiration,
        ],
        functionName: "getDepositHash",
      });
      return data.result;
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  private async getMilestoneDepositHash(input: GetMilestoneDepositHash): Promise<Hash> {
    try {
      const data = await this.public.simulateContract({
        address: this.escrow,
        abi: this.milestoneAbi,
        account: this.account,
        args: [input.clientAddress, input.contractId, input.paymentToken, input.milestonesHash, input.expiration],
        functionName: "getDepositHash",
      });
      return data.result;
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  private async getHourlyDepositHash(input: GetHourlyDepositHash): Promise<Hash> {
    try {
      const data = await this.public.simulateContract({
        address: this.escrow,
        abi: this.hourlyAbi,
        account: this.account,
        args: [
          input.clientAddress,
          input.contractId,
          input.contractor,
          input.paymentToken,
          input.prepaymentAmount,
          input.amountToClaim,
          input.feeConfig,
          input.expiration,
        ],
        functionName: "getDepositHash",
      });
      return data.result;
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.message);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  private get tokenList(): IterableIterator<DataToken> {
    return iterateTokenList(this.contractList.tokenList);
  }

  parseAmount(tokenAddress: Address, amount: bigint): { symbol: SymbolToken; amount: number } {
    for (const token of this.tokenList) {
      if (BigInt(token.address) == BigInt(tokenAddress)) {
        return {
          symbol: token.symbol,
          amount: Number(formatUnits(amount, token.decimals)),
        };
      }
    }
    throw new NotSupportError(`token ${tokenAddress}`);
  }

  private async parseLogs(logs: (RpcLog | Log)[]): Promise<ParseEventLogsReturnType<Abi, undefined, true>> {
    return parseEventLogs({
      abi: this.fixedPriceAbi,
      logs,
    });
  }

  private async parseLogsMilestone(logs: (RpcLog | Log)[]): Promise<ParseEventLogsReturnType<Abi, undefined, true>> {
    return parseEventLogs({
      abi: this.milestoneAbi,
      logs,
    });
  }

  private async parseLogsHourly(logs: (RpcLog | Log)[]): Promise<ParseEventLogsReturnType<Abi, undefined, true>> {
    return parseEventLogs({
      abi: this.hourlyAbi,
      logs,
    });
  }

  private async parseInput(data: Hex, isEmbedded: boolean = false) {
    if (isEmbedded) {
      const handleOpsInput = decodeFunctionData({
        abi: embeddedAbi,
        data: data,
      }) as { args: readonly DecodedInput[][] };

      const handleOpsData = handleOpsInput.args[0]?.[handleOpsInput?.args[0].length - 1]?.callData;

      const executeInput = decodeFunctionData({
        abi: lightAccountAbi,
        data: handleOpsData as Hash,
      });

      return decodeFunctionData({
        abi: this.fixedPriceAbi,
        data: executeInput.args[2] as `0x${string}`,
      });
    } else {
      return decodeFunctionData({
        abi: this.fixedPriceAbi,
        data,
      });
    }
  }

  private async parseInputMilestone(data: Hex, isEmbedded: boolean = false) {
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

      return decodeFunctionData({
        abi: this.milestoneAbi,
        data: executeInput.args[2] as `0x${string}`,
      });
    } else {
      return decodeFunctionData({
        abi: this.milestoneAbi,
        data,
      });
    }
  }

  private async parseInputHourly(data: Hex, isEmbedded: boolean = false) {
    if (isEmbedded) {
      const handleOpsInput = decodeFunctionData({
        abi: embeddedAbi,
        data: data,
      }) as { args: readonly DecodedInput[][] };

      handleOpsInput?.args[0]?.sort((a, b) => Number(a.nonce) - Number(b.nonce));

      const handleOpsData = handleOpsInput?.args[0]?.[0]?.callData;

      const executeInput = decodeFunctionData({
        abi: lightAccountAbi,
        data: handleOpsData as Hash,
      });

      return decodeFunctionData({
        abi: this.hourlyAbi,
        data: executeInput.args[2] as `0x${string}`,
      });
    } else {
      return decodeFunctionData({
        abi: this.hourlyAbi,
        data,
      });
    }
  }

  private async send(input: WriteContractParameters): Promise<Hash> {
    const inputData = (input.args as unknown[]).map(arg => {
      return typeof arg === "number" ? BigInt(arg) : arg;
    }) as never;

    const encodedData = encodeFunctionData({ abi: input.abi, functionName: input.functionName, args: inputData });

    const tx = {
      from: this.account.address,
      to: input.address,
      data: encodedData,
    };

    const estimatedGasLimit: bigint = await this.public.request({
      method: "eth_estimateGas",
      params: [tx],
    });

    input.gas = BigInt(estimatedGasLimit) + (BigInt(estimatedGasLimit) * BigInt(30)) / BigInt(100);

    const latestBlock = await this.public.request({
      method: "eth_getBlockByNumber",
      params: ["latest", false],
    });

    const baseFeePerGas = BigInt(latestBlock?.baseFeePerGas ? latestBlock.baseFeePerGas : input.gas);

    const maxPriorityFeePerGas = 40_000_000_000n;

    const maxFeePerGas = baseFeePerGas + maxPriorityFeePerGas;

    input.maxPriorityFeePerGas = maxPriorityFeePerGas;
    input.maxFeePerGas = maxFeePerGas;

    const transactionPrice = ((Number(maxFeePerGas) / 1000000000) * Number(input.gas)) / 1000000000;

    console.log("method -> ", input.functionName);
    console.log("Transaction Price ->", transactionPrice);

    return this.wallet.writeContract(input);
  }

  private generateRandomNumber(): Hash {
    const randomNumber = Math.floor(Math.random() * 999) + 1;

    return this.escrowMakeSalt(randomNumber);
  }

  transactionUrl(transactionHash: Hash): string {
    return `${this.blockExplorer}/tx/${transactionHash}`;
  }

  accountUrl(account: Address): string {
    return `${this.blockExplorer}/address/${account}`;
  }
}
