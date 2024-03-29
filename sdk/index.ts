import {
  type PublicClient,
  type WalletClient,
  type Chain,
  type HttpTransport,
  type Account,
  type WriteContractParameters,
  ContractFunctionExecutionError,
  type Address,
  type Hash,
  type CustomTransport,
  decodeFunctionData,
  type EIP1193Provider,
  custom,
  parseEventLogs,
  type RpcLog,
  type Log,
} from "viem";
import { createWalletClient, http, createPublicClient } from "viem";
import { parseUnits, formatUnits } from "viem";
import { erc20Abi } from "abitype/abis";
import { sepolia, localhost } from "viem/chains";
import type { Transaction, TransactionReceipt } from "viem/types/transaction";
import type { Hex } from "viem/types/misc";
import {
  contractList,
  type ContractList,
  type DataToken,
  type Environment,
  iterateTokenList,
  type SymbolToken,
} from "@/environment";
import { escrow } from "@/abi/Escrow";
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
import { Deposit } from "@/Deposit";
import { parseInput, type TransactionInput } from "@/parse";

export interface DepositAmount {
  depositAmount: number;
  fee: number;
}

export interface DepositInput {
  depositId: bigint;
  token?: SymbolToken;
  amount: number;
  timeLock?: bigint;
  fullFee?: boolean;
  recipientData: Hash;
}

export interface ApproveInput {
  depositId: bigint;
  valueApprove?: number;
  valueAdditional?: number;
  recipient?: Address;
  token?: SymbolToken;
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

export class MidcontractProtocol {
  private readonly contractList: ContractList;
  private escrow: Address;
  private wallet: WalletClient;
  private public: PublicClient;
  public readonly blockExplorer: string;

  constructor(chain: Chain, transport: HttpTransport, contractList: ContractList, account?: Account) {
    this.contractList = contractList;
    if (!contractList.escrow[0]) {
      throw new Error();
    }
    this.escrow = contractList.escrow[0];
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
  }

  static buildByEnvironment(name: Environment = "test", account?: Account, url?: string): MidcontractProtocol {
    let chain = localhost as Chain;
    if (name == "test") {
      chain = sepolia;
    } else if (name == "beta") {
      chain = blastSepolia;
    }
    const transport = url ? http(url) : http();
    return new MidcontractProtocol(chain, transport, contractList(name, chain.id), account);
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

  private get escrowPayeeFee(): Promise<number> {
    return this.public
      .readContract({
        functionName: "payeeFee",
        address: this.escrow,
        abi: escrow,
      })
      .then(pf => this.escrowDenominatorFee.then(df => Number(pf) / Number(df)));
  }

  private get escrowRecipientFee(): Promise<number> {
    return this.public
      .readContract({
        address: this.escrow,
        abi: escrow,
        functionName: "recipientFee",
      })
      .then(rf => this.escrowDenominatorFee.then(df => Number(rf) / Number(df)));
  }

  private get escrowDenominatorFee(): Promise<bigint> {
    return this.public.readContract({
      address: this.escrow,
      abi: escrow,
      functionName: "FEE_DENOMINATOR",
    });
  }

  async escrowDepositAmount(amount: number, fullFee = false): Promise<DepositAmount> {
    const recipientFee = await this.escrowRecipientFee;
    const payeeFee = await this.escrowPayeeFee;
    if (fullFee) {
      return {
        depositAmount: amount * (recipientFee + payeeFee + 1),
        fee: recipientFee + payeeFee,
      };
    }
    return {
      depositAmount: amount * (payeeFee + 1),
      fee: payeeFee,
    };
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

  private async tokenAllowance(account: Address, symbol: SymbolToken = "USDT"): Promise<number> {
    const token = this.dataToken(symbol);
    const allowance = await this.public.readContract({
      abi: erc20Abi,
      address: token.address,
      account,
      args: [account, this.escrow],
      functionName: "allowance",
    });
    return Number(formatUnits(allowance, token.decimals));
  }

  async tokenBalance(account: Address, symbol: SymbolToken = "USDT"): Promise<number> {
    const token = this.dataToken(symbol);
    const balance = await this.public.readContract({
      abi: erc20Abi,
      address: token.address,
      account,
      args: [account],
      functionName: "balanceOf",
    });
    return Number(formatUnits(balance, token.decimals));
  }

  async tokenApprove(amount: number, symbol: SymbolToken = "USDT"): Promise<Hash> {
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
        throw new SimulateError(error.shortMessage);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
    return this.send(param);
  }

  async tokenRequireBalance(owner: Address, amount: number, symbol: SymbolToken = "USDT"): Promise<void> {
    const balance = await this.tokenBalance(owner, symbol);
    if (balance < amount) {
      throw new NotEnoughError(`balance of ${symbol} is ${balance}`);
    }
  }

  async tokenRequireAllowance(owner: Address, amount: number, symbol: SymbolToken = "USDT"): Promise<void> {
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

  escrowMakeDataHash(data: string): Promise<Hash> {
    return this.public.readContract({
      abi: escrow,
      address: this.escrow,
      args: [data],
      functionName: "makeDataHash",
    });
  }

  async getDepositList(depositId: bigint): Promise<Deposit> {
    const data = await this.public.readContract({
      address: this.escrow,
      abi: escrow,
      functionName: "depositList",
      args: [depositId],
    });
    for (const token of this.tokenList) {
      if (token.address == data[2]) {
        return new Deposit([
          data[0],
          data[1],
          token.symbol,
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

  private async getTransactionReceipt(hash: Hash, waitReceipt = false): Promise<TransactionReceipt | null> {
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

  async escrowDeposit(input: DepositInput, waitReceipt = true): Promise<TransactionId> {
    input.token = input.token || "USDT";
    input.timeLock = input.timeLock || BigInt(0);
    input.fullFee = input.fullFee || false;
    input.recipientData = input.recipientData || "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";

    const token = this.dataToken(input.token);
    const account = this.account;
    const { depositAmount } = await this.escrowDepositAmount(input.amount, input.fullFee || false);
    await this.tokenRequireBalance(account.address, depositAmount, input.token);
    await this.tokenRequireAllowance(account.address, depositAmount, input.token);
    const { request } = await this.public.simulateContract({
      address: this.escrow,
      abi: escrow,
      account,
      args: [
        input.depositId,
        token.address,
        parseUnits(input.amount.toString(), token.decimals),
        input.timeLock,
        input.fullFee,
        input.recipientData,
      ],
      functionName: "deposit",
    });
    const hash = await this.send(request);
    const receipt = await this.getTransactionReceipt(hash, waitReceipt);
    return { id: hash, status: receipt ? receipt.status : "pending" };
  }

  async escrowSubmit(depositId: bigint, data: string, waitReceipt = true): Promise<TransactionId> {
    const { request } = await this.public.simulateContract({
      address: this.escrow,
      abi: escrow,
      account: this.account,
      args: [depositId, data],
      functionName: "submit",
    });
    const hash = await this.send(request);
    const receipt = await this.getTransactionReceipt(hash, waitReceipt);
    return { id: hash, status: receipt ? receipt.status : "pending" };
  }

  escrowRefill(depositId: bigint, value: number, waitReceipt = true): Promise<TransactionId> {
    return this.escrowApprove(
      {
        depositId,
        valueAdditional: value,
      },
      waitReceipt
    );
  }

  async escrowApprove(input: ApproveInput, waitReceipt = true): Promise<TransactionId> {
    input.token = input.token || "USDT";
    input.valueApprove = input.valueApprove || 0;
    input.valueAdditional = input.valueAdditional || 0;
    const recipient = input.recipient || "0x0000000000000000000000000000000000000000";
    if (input.valueApprove == 0 && input.valueAdditional == 0) {
      throw new NotSetError("valueAdditional");
    }
    const account = this.account;
    if (input.valueAdditional > 0) {
      const deposit = await this.getDepositList(input.depositId);
      const { depositAmount } = await this.escrowDepositAmount(input.valueAdditional, deposit.configFee);
      await this.tokenRequireAllowance(account.address, depositAmount, input.token);
    }
    const token = this.dataToken(input.token);
    const { request } = await this.public.simulateContract({
      address: this.escrow,
      abi: escrow,
      account: this.account,
      args: [
        input.depositId,
        parseUnits(input.valueApprove.toString(), token.decimals),
        parseUnits(input.valueAdditional.toString(), token.decimals),
        recipient,
      ],
      functionName: "approve",
    });
    const hash = await this.send(request);
    const receipt = await this.getTransactionReceipt(hash, waitReceipt);
    return { id: hash, status: receipt ? receipt.status : "pending" };
  }

  async escrowClaim(depositId: bigint, waitReceipt = true): Promise<TransactionId> {
    const { request } = await this.public.simulateContract({
      address: this.escrow,
      abi: escrow,
      account: this.account,
      args: [depositId],
      functionName: "claim",
    });
    const hash = await this.send(request);
    const receipt = await this.getTransactionReceipt(hash, waitReceipt);
    return { id: hash, status: receipt ? receipt.status : "pending" };
  }

  async escrowWithdraw(depositId: bigint, waitReceipt = true): Promise<TransactionId> {
    const { request } = await this.public.simulateContract({
      address: this.escrow,
      abi: escrow,
      account: this.account,
      args: [depositId],
      functionName: "withdraw",
    });
    const hash = await this.send(request);
    const receipt = await this.getTransactionReceipt(hash, waitReceipt);
    return { id: hash, status: receipt ? receipt.status : "pending" };
  }

  async transactionByHashWait(hash: Hash): Promise<TransactionData> {
    return this.transactionByHash(hash, true);
  }

  async transactionByHash(hash: Hash, waitReceipt = false): Promise<TransactionData> {
    const transaction = await this.public.getTransaction({
      hash,
    });
    const receipt = await this.getTransactionReceipt(hash, waitReceipt);
    return {
      transaction,
      input: parseInput(transaction.input),
      status: receipt ? receipt.status : "pending",
      receipt,
    };
  }

  async transactionParse(data: TransactionData) {
    const { transaction, receipt } = data;
    if (BigInt(transaction.to || "0") != BigInt(this.escrow)) {
      throw new NotSupportError(`contract ${transaction.to} ${this.escrow}`);
    }
    const input = await this.parseInput(transaction.input);
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

  private async parseLogs(logs: (RpcLog | Log)[]) {
    return parseEventLogs({
      abi: escrow,
      logs,
    });
  }

  private async parseInput(data: Hex) {
    return decodeFunctionData({
      abi: escrow,
      data,
    });
  }

  private async send(input: WriteContractParameters): Promise<Hash> {
    return this.wallet.writeContract(input);
  }

  transactionUrl(transactionHash: Hash): string {
    return `${this.blockExplorer}/tx/${transactionHash}`;
  }

  accountUrl(account: Address): string {
    return `${this.blockExplorer}/address/${account}`;
  }
}
