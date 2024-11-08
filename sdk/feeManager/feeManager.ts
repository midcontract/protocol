import type { Account, Address, Hash, PublicClient, WalletClient, WriteContractParameters } from "viem";
import { FeeConfig } from "@/Deposit";

export class FeeManager {
  private readonly wallet: WalletClient;
  private readonly public: PublicClient;
  private readonly account: Account;
  private readonly feeManagerEscrow: Address;
  private readonly abi: [];

  constructor(
    walletClient: WalletClient,
    publicClient: PublicClient,
    account: Account,
    feeManagerEscrow: Address,
    abi: []
  ) {
    this.wallet = walletClient;
    this.public = publicClient;
    this.account = account;
    this.feeManagerEscrow = feeManagerEscrow;
    this.abi = abi;
  }
  async updateDefaultFees(coverageFee: number, claimFee: number): Promise<void> {
    const { request } = await this.public.simulateContract({
      address: this.feeManagerEscrow,
      abi: this.abi,
      account: this.account,
      args: [coverageFee, claimFee],
      functionName: "updateDefaultFees",
    });
    await this.send(request);
  }

  async setSpecialFees(accountAddress: Address, coverageFee: number, claimFee: number): Promise<void> {
    const { request } = await this.public.simulateContract({
      address: this.feeManagerEscrow,
      abi: this.abi,
      account: this.account,
      args: [accountAddress, coverageFee, claimFee],
      functionName: "setSpecialFees",
    });
    await this.send(request);
  }

  async computeDepositAmountAndFee(amount: bigint, configFee: FeeConfig = 1, escrowAddress: Address, contractId = 0n) {
    const result = await this.public.readContract({
      address: this.feeManagerEscrow,
      abi: this.abi,
      account: this.account,
      args: [escrowAddress, contractId, this.account.address, amount, configFee],
      functionName: "computeDepositAmountAndFee",
    });
    return {
      totalDepositAmount: Number(result[0]),
      feeApplied: Number(result[1]),
    };
  }

  async computeClaimableAmountAndFee(amount: bigint, configFee: FeeConfig = 1) {
    const result = await this.public.readContract({
      address: this.feeManagerEscrow,
      abi: this.abi,
      account: this.account,
      args: [this.account.address, amount, configFee],
      functionName: "computeClaimableAmountAndFee",
    });
    return {
      claimableAmount: Number(result[0]),
      feeDeducted: Number(result[1]),
      clientFee: Number(result[2]),
    };
  }

  async getCoverageFee(wallet?: Hash) {
    const BPS = await this.getBPS();
    let coverageFee;
    if (wallet) {
      coverageFee = await this.public.readContract({
        address: this.feeManagerEscrow,
        abi: this.abi,
        account: this.account,
        args: [wallet],
        functionName: "getCoverageFee",
      });
    } else {
      const result = await this.public.readContract({
        address: this.feeManagerEscrow,
        abi: this.abi,
        functionName: "defaultFees",
      });
      coverageFee = Number(result[0]);
    }
    return {
      coverageFee: Number(coverageFee) / Number(BPS),
    };
  }

  async getClaimFee(wallet?: Hash) {
    const BPS = await this.getBPS();
    let claimFee;
    if (wallet) {
      claimFee = await this.public.readContract({
        address: this.feeManagerEscrow,
        abi: this.abi,
        account: this.account,
        args: [wallet],
        functionName: "getClaimFee",
      });
    } else {
      const result = await this.public.readContract({
        address: this.feeManagerEscrow,
        abi: this.abi,
        functionName: "defaultFees",
      });
      claimFee = Number(result[1]);
    }
    return {
      claimFee: Number(claimFee) / Number(BPS),
    };
  }

  async getBPS() {
    const result = await this.public.readContract({
      address: this.feeManagerEscrow,
      abi: this.abi,
      account: this.account,
      args: [],
      functionName: "MAX_BPS",
    });
    return Number(result) / 100;
  }

  private async send(input: WriteContractParameters): Promise<Hash> {
    return this.wallet.writeContract(input);
  }
}
