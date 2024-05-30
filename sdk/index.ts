import {
  type PublicClient,
  type WalletClient,
  type Chain,
  type HttpTransport,
  type Account,
  type WriteContractParameters,
  type Address,
  type Hash,
  type CustomTransport,
  type EIP1193Provider,
  type RpcLog,
  type Log,
} from "viem";
import {
  createWalletClient,
  http,
  createPublicClient,
  custom,
  parseEventLogs,
  decodeFunctionData,
  ContractFunctionExecutionError,
} from "viem";
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
import { parseInput, type TransactionInput } from "@/parse";
import { EscrowFactoryService } from "@/escrowFactory/escrowFactoryService";
import { FeeManager } from "@/feeManager/feeManager";
import { Deposit, DepositStatus, type FeeConfig } from "@/Deposit";

export interface DepositAmount {
  totalDepositAmount: number;
  feeApplied: number;
}

export interface DepositInput {
  contractorAddress: Address;
  token: SymbolToken;
  amount: number;
  amountToClaim?: number;
  timeLock?: bigint;
  recipientData: Hash;
  feeConfig: FeeConfig;
  status?: DepositStatus;
}

export interface ApproveInput {
  contractId: bigint;
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

export interface DepositResponse extends TransactionId {
  contractId: bigint;
}

export class MidcontractProtocol {
  private readonly contractList: ContractList;
  private escrow: Address = "0x0";
  private wallet: WalletClient;
  private public: PublicClient;
  public readonly blockExplorer: string;
  private readonly factoryEscrow: Address;
  private readonly registryEscrow: Address;
  private readonly feeManagerEscrow: Address;
  private readonly transport: HttpTransport;

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
    this.blockExplorer =
      chain.blockExplorers && chain.blockExplorers.default ? chain.blockExplorers.default.url : "http://localhost";

    this.factoryEscrow = contractList.escrow["FACTORY"] as Address;
    this.registryEscrow = contractList.escrow["REGISTRY"] as Address;
    this.feeManagerEscrow = contractList.escrow["FEE_MANAGER"] as Address;
    this.transport = transport;
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

  async escrowDepositAmount(
    amount: number,
    feeConfig: FeeConfig = 1,
    tokenSymbol: SymbolToken = "MockUSDT"
  ): Promise<DepositAmount> {
    const token = this.dataToken(tokenSymbol);
    const convertedAmount = parseUnits(amount.toString(), token.decimals);
    const feeManager = new FeeManager(this.wallet, this.public, this.account, this.feeManagerEscrow);
    const { totalDepositAmount, feeApplied } = await feeManager.computeDepositAmountAndFee(convertedAmount, feeConfig);

    return {
      totalDepositAmount: Number(totalDepositAmount),
      feeApplied: Number(feeApplied),
    };
  }

  async getDepositList(contractId: bigint): Promise<Deposit> {
    const data = await this.public.readContract({
      address: this.escrow,
      args: [contractId],
      abi: escrow,
      functionName: "deposits",
    });

    for (const token of this.tokenList) {
      if (token.address == data[1]) {
        return new Deposit([
          data[0],
          token.symbol,
          Number(formatUnits(data[2], token.decimals)),
          Number(formatUnits(data[3], token.decimals)),
          data[4],
          data[5],
          data[6],
          data[7],
        ]);
      }
    }
    throw new NotFoundError();
  }

  async currentContractId(): Promise<bigint> {
    return this.public.readContract({
      address: this.escrow,
      abi: escrow,
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
        throw new SimulateError(error.shortMessage);
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

  async escrowMakeDataHash(data: string, salt: Hash): Promise<Hash> {
    const result = await this.public.readContract({
      address: this.escrow,
      abi: escrow,
      account: this.account,
      args: [data as Hash, salt],
      functionName: "getContractorDataHash",
    });
    console.log(result);
    return result;
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

  async escrowDeposit(input: DepositInput, waitReceipt = true): Promise<DepositResponse> {
    input.token = input.token || "MockUSDT";
    input.timeLock = input.timeLock || BigInt(0);
    input.recipientData = input.recipientData || "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";

    const token = this.dataToken(input.token);

    const account = this.account;
    const amount = parseUnits(input.amount.toString(), token.decimals);
    const amountToClaim = parseUnits(String(input.amountToClaim || 0), token.decimals);
    const { totalDepositAmount } = await this.escrowDepositAmount(input.amount, input.feeConfig, input.token);

    const status = input.status || DepositStatus.PENDING;
    await this.tokenRequireBalance(account.address, totalDepositAmount / 1000000, input.token);
    await this.tokenRequireAllowance(account.address, totalDepositAmount / 1000000, input.token);

    try {
      const balance = await this.public.getBalance({ address: this.account.address });
      console.log("Баланс:", balance.toString());

      const data = await this.public.simulateContract({
        address: this.escrow,
        abi: escrow,
        account,
        args: [
          {
            contractor: input.contractorAddress,
            paymentToken: token.address,
            amount: amount,
            amountToClaim: amountToClaim,
            timeLock: input.timeLock,
            contractorData: input.recipientData,
            feeConfig: input.feeConfig,
            status,
          },
        ],
        functionName: "deposit",
      });
      const hash = await this.send({ ...data.request });
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      const contractId = await this.currentContractId();
      return { id: hash, status: receipt ? receipt.status : "pending", contractId };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.shortMessage);
      } else {
        throw new CoreMidcontractProtocolError(JSON.stringify(error));
      }
    }
  }

  async escrowSubmit(contractId: bigint, salt: Hash, data: string, waitReceipt = true): Promise<TransactionId> {
    try {
      const { request } = await this.public.simulateContract({
        address: this.escrow,
        abi: escrow,
        account: this.account,
        args: [contractId, data as Hash, salt],
        functionName: "submit",
      });
      const hash = await this.send(request);
      const receipt = await this.getTransactionReceipt(hash, waitReceipt);
      return { id: hash, status: receipt ? receipt.status : "pending" };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SimulateError(error.shortMessage);
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
    const { totalDepositAmount } = await this.escrowDepositAmount(value, deposit.feeConfig, deposit.paymentToken);
    await this.tokenRequireAllowance(account.address, totalDepositAmount, deposit.paymentToken);

    const { request } = await this.public.simulateContract({
      address: this.escrow,
      abi: escrow,
      account: this.account,
      args: [contractId, parseUnits(value.toString(), token.decimals)],
      functionName: "refill",
    });
    const hash = await this.send(request);
    const receipt = await this.getTransactionReceipt(hash, waitReceipt);
    return { id: hash, status: receipt ? receipt.status : "pending" };
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

    const { request } = await this.public.simulateContract({
      address: this.escrow,
      abi: escrow,
      account,
      args: [input.contractId, parseUnits(input.valueApprove.toString(), token.decimals), recipient],
      functionName: "approve",
    });
    const hash = await this.send(request);
    const receipt = await this.getTransactionReceipt(hash, waitReceipt);
    return { id: hash, status: receipt ? receipt.status : "pending" };
  }

  async escrowClaim(contractId: bigint, waitReceipt = true): Promise<TransactionId> {
    const { request } = await this.public.simulateContract({
      address: this.escrow,
      abi: escrow,
      account: this.account,
      args: [contractId],
      functionName: "claim",
    });
    const hash = await this.send(request);
    const receipt = await this.getTransactionReceipt(hash, waitReceipt);
    return { id: hash, status: receipt ? receipt.status : "pending" };
  }

  async escrowWithdraw(contractId: bigint, waitReceipt = true): Promise<TransactionId> {
    const { request } = await this.public.simulateContract({
      address: this.escrow,
      abi: escrow,
      account: this.account,
      args: [contractId],
      functionName: "withdraw",
    });
    const hash = await this.send(request);
    const receipt = await this.getTransactionReceipt(hash, waitReceipt);
    return { id: hash, status: receipt ? receipt.status : "pending" };
  }

  async deployEscrow(adminAddress: Address): Promise<{
    userEscrow: Address;
    salt: Hash;
  }> {
    const escrowFactoryService = new EscrowFactoryService(this.transport, this.factoryEscrow);
    const contractAddress = await escrowFactoryService.deploy(this.account, adminAddress, this.registryEscrow);
    const salt = this.generateRandomNumber();
    return {
      userEscrow: contractAddress,
      salt,
    };
  }

  async updateDefaultFees(coverageFee: number, claimFee: number): Promise<void> {
    const feeManager = new FeeManager(this.wallet, this.public, this.account, this.feeManagerEscrow);
    await feeManager.updateDefaultFees(coverageFee, claimFee);
  }

  async setSpecialFees(accountAddress: Address, coverageFee: number, claimFee: number): Promise<void> {
    const feeManager = new FeeManager(this.wallet, this.public, this.account, this.feeManagerEscrow);
    await feeManager.setSpecialFees(accountAddress, coverageFee, claimFee);
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
