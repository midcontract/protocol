import {
  type Account,
  type Address,
  createPublicClient,
  createWalletClient,
  type Hash,
  type HttpTransport,
  type PublicClient,
  type WalletClient,
  type WriteContractParameters,
} from "viem";

import { escrowFactoryAbi } from "@/abi/EscrowFactory";
import { sepolia } from "viem/chains";

export class EscrowFactoryService {
  public public: PublicClient;
  public wallet: WalletClient;
  private escrow: Address;

  constructor(transport: HttpTransport, escrowAddress: Address, account?: Account) {
    this.escrow = escrowAddress;
    this.public = createPublicClient({
      chain: sepolia,
      transport: transport,
    });

    this.wallet = createWalletClient({
      account,
      chain: sepolia,
      transport: transport,
    });
  }

  async deploy(account: Account, admin: Address, registry: Address): Promise<Address> {
    const data = await this.public.simulateContract({
      address: this.escrow,
      abi: escrowFactoryAbi,
      account: account,
      args: [account.address, admin, registry],
      functionName: "deployEscrow",
    });
    await this.send(data.request);
    return data.result;
  }

  private async send(input: WriteContractParameters): Promise<Hash> {
    return this.wallet.writeContract(input);
  }
}
