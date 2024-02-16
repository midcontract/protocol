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
  NotMatchError,
  NotSetError,
  NotSuccessTransactionError,
  NotSupportError,
  SimulateError,
} from "@/Error";
import { blastSepolia } from "@/chain/blastSepolia";

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
  valueApprove: number;
  valueAdditional?: number;
  recipient: Address;
  token?: SymbolToken;
}

export interface TransactionData {
  transaction: Transaction;
  receipt: TransactionReceipt;
}

export interface TransactionStatus {
  id: Hash;
  status: "success" | "reverted";
}

export class MidcontractProtocol {
  private readonly contractList: ContractList;
  private wallet: WalletClient;
  private public: PublicClient;

  constructor(chain: Chain, transport: HttpTransport, contractList: ContractList, account?: Account) {
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
  }

  static buildByEnvironment(name: Environment = "test", account?: Account): MidcontractProtocol {
    let chain = localhost as Chain;
    if (name == "test") {
      chain = sepolia;
    } else if (name == "beta") {
      chain = blastSepolia;
    }
    return new MidcontractProtocol(chain, http(), contractList(name, chain.id), account);
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
        address: this.contractList.escrow,
        abi: escrow,
      })
      .then(pf => this.escrowDenominatorFee.then(df => Number(pf) / Number(df)));
  }

  private get escrowRecipientFee(): Promise<number> {
    return this.public
      .readContract({
        address: this.contractList.escrow,
        abi: escrow,
        functionName: "recipientFee",
      })
      .then(rf => this.escrowDenominatorFee.then(df => Number(rf) / Number(df)));
  }

  private get escrowDenominatorFee(): Promise<bigint> {
    return this.public.readContract({
      address: this.contractList.escrow,
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
      args: [account, this.contractList.escrow],
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
        args: [this.contractList.escrow, parseUnits(amount.toString(), token.decimals)],
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
      address: this.contractList.escrow,
      args: [data],
      functionName: "makeDataHash",
    });
  }

  async escrowDeposit(input: DepositInput): Promise<TransactionStatus> {
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
      address: this.contractList.escrow,
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
    const transaction = await this.public.waitForTransactionReceipt({ hash });
    return { id: hash, status: transaction.status };
  }

  async escrowSubmit(depositId: bigint, data: string): Promise<TransactionStatus> {
    const { request } = await this.public.simulateContract({
      address: this.contractList.escrow,
      abi: escrow,
      account: this.account,
      args: [depositId, data],
      functionName: "submit",
    });
    const hash = await this.send(request);
    const transaction = await this.public.waitForTransactionReceipt({ hash });
    return { id: hash, status: transaction.status };
  }

  async escrowApprove(input: ApproveInput): Promise<TransactionStatus> {
    input.token = input.token || "USDT";
    input.valueAdditional = input.valueAdditional || 0;
    if (!input.valueApprove || input.valueApprove == 0) {
      throw new NotSetError("valueAdditional");
    }
    const account = this.account;
    if (input.valueAdditional > 0) {
      await this.tokenRequireAllowance(account.address, input.valueAdditional, input.token);
    }
    const token = this.dataToken(input.token);
    const { request } = await this.public.simulateContract({
      address: this.contractList.escrow,
      abi: escrow,
      account: this.account,
      args: [
        input.depositId,
        parseUnits(input.valueApprove.toString(), token.decimals),
        parseUnits(input.valueAdditional.toString(), token.decimals),
        input.recipient,
      ],
      functionName: "approve",
    });
    const hash = await this.send(request);
    const transaction = await this.public.waitForTransactionReceipt({ hash });
    return { id: hash, status: transaction.status };
  }

  async escrowClaim(depositId: bigint): Promise<TransactionStatus> {
    const { request } = await this.public.simulateContract({
      address: this.contractList.escrow,
      abi: escrow,
      account: this.account,
      args: [depositId],
      functionName: "claim",
    });
    const hash = await this.send(request);
    const transaction = await this.public.waitForTransactionReceipt({ hash });
    return { id: hash, status: transaction.status };
  }

  async escrowWithdraw(depositId: bigint): Promise<Hash> {
    const { request } = await this.public.simulateContract({
      address: this.contractList.escrow,
      abi: escrow,
      account: this.account,
      args: [depositId],
      functionName: "withdraw",
    });
    const hash = await this.send(request);
    const transaction = await this.public.waitForTransactionReceipt({ hash });
    if (transaction.status != "success") {
      throw new NotSuccessTransactionError(`withdraw #${depositId}`);
    }
    return hash;
  }

  async transactionByHash(hash: Hash): Promise<TransactionData> {
    const transaction = await this.public.getTransaction({
      hash,
    });
    const receipt = await this.public.getTransactionReceipt({
      hash,
    });
    return {
      transaction,
      receipt,
    };
  }

  async transactionParse(data: TransactionData) {
    const { transaction, receipt } = data;
    if (BigInt(transaction.to || "0") != BigInt(this.contractList.escrow)) {
      throw new NotSupportError(`contract ${transaction.to} ${this.contractList.escrow}`);
    }
    const input = await this.parseInput(transaction.input);
    const events = await this.parseLogs(receipt.logs).then(logs =>
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
}
