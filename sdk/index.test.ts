import { beforeAll, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { MidcontractProtocol } from "./.";
import type { Address } from "viem";
import { FeeConfig } from "./Deposit";

const random = (min: number, max: number) => Math.round(Math.random() * (max - min) + min);
const getDepositId = () => BigInt(random(100000, 1000000));
const getData = () => getDepositId().toString();

let userEscrow: Address;

const alice = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const bob = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");

const mp = MidcontractProtocol.buildByEnvironment("test", undefined);

async function newData() {
  const depositId = getDepositId();
  const data = getData();
  const salt = mp.escrowMakeSalt(42);
  const recipientData = await mp.escrowMakeDataHash(data, salt);
  const aliceBalance = await mp.tokenBalance(alice.address, "MockUSDT");
  const bobBalance = await mp.tokenBalance(bob.address, "MockUSDT");
  return {
    depositId,
    data,
    salt,
    recipientData,
    aliceBalance,
    bobBalance,
  };
}

describe("deployContract", async () => {
  it("deploy", async () => {
    mp.changeAccount(alice);
    const { userEscrow } = await mp.deployEscrow(bob.address);
    expect(userEscrow).toBeDefined();
  });
});

describe("getCurrentContractId", async () => {
  it("getCurrentContractId", async () => {
    mp.changeAccount(alice);
    const contractAddress = await mp.currentContractId();
    expect(contractAddress).toBeDefined();
  });
});

describe("base", async () => {
  beforeAll(async () => {
    mp.changeAccount(alice);
    if (!userEscrow) {
      const deployEscrowResponse = await mp.deployEscrow(alice.address);
      userEscrow = deployEscrowResponse.userEscrow;
    }
    mp.changeEscrow(userEscrow);
  });
  it("blockNumber", async () => {
    console.log(`blockNumber=${await mp.blockNumber}`);
    expect(await mp.blockNumber).greaterThan(1);
  });

  it("calcDepositAmount", async () => {
    const depositAmount = await mp.escrowDepositAmount(100, FeeConfig.CLIENT_COVERS_ALL);
    expect(depositAmount).toEqual({
      totalDepositAmount: 103,
      feeApplied: 0,
    });
  });

  it("getTransactionByHash", async () => {
    const transaction = await mp.getTransactionReceipt(
      "0xb2db7e406fa1ac415a14e4efc26e579472c0049de26f55b4da1033125b3ba502",
      true
    );
    expect(transaction).toBeDefined();
  });

  it("success flow Fixed Price", async () => {
    const amount = 10;
    const amountToClaim = 0;
    const { data, salt, recipientData, aliceBalance, bobBalance } = await newData();
    const tokenSymbol = "MockUSDT";

    mp.changeAccount(alice);

    // create deposit
    const depositInput = {
      contractorAddress: bob.address,
      token: tokenSymbol,
      amount,
      amountToClaim,
      recipientData,
      feeConfig: FeeConfig.CLIENT_COVERS_ALL,
    };
    const deposit = await mp.escrowDeposit(depositInput);
    expect(deposit.status).toEqual("success");
    expect(deposit.contractId).toBeDefined();

    const contractId = deposit.contractId;
    expect((await mp.getDepositList(contractId)).amount).toEqual(amount);

    // say address worker
    mp.changeAccount(bob);
    const escrowSubmit = await mp.escrowSubmit(contractId, salt, data);
    expect(escrowSubmit.status).toEqual("success");

    // approve work
    mp.changeAccount(alice);
    const escrowApprove = await mp.escrowApprove({
      contractId,
      valueApprove: amount,
      recipient: bob.address,
    });
    expect(escrowApprove.status).toEqual("success");
    expect((await mp.getDepositList(contractId)).amountToClaim).toEqual(amount);

    // claim deposit
    mp.changeAccount(bob);
    const escrowClaim = await mp.escrowClaim(contractId);
    expect(escrowClaim.status).toEqual("success");

    expect(await mp.tokenBalance(alice.address)).toBeLessThan(aliceBalance);
    expect(await mp.tokenBalance(bob.address)).toEqual(bobBalance + amount);
  }, 1200000);

  it("success flow Milestone", async () => {
    const amount = 1;
    const amountToClaim = 0;
    const { data, salt, recipientData, aliceBalance, bobBalance } = await newData();
    const tokenSymbol = "MockUSDT";

    // new deposit for milestone1
    mp.changeAccount(alice);
    const depositInput = {
      contractorAddress: bob.address,
      token: tokenSymbol,
      amount,
      amountToClaim,
      recipientData,
      feeConfig: FeeConfig.CLIENT_COVERS_ALL,
    };
    const milestone1 = await mp.escrowDeposit(depositInput);
    expect(milestone1.status).toEqual("success");
    expect(milestone1.contractId).toBeDefined();

    const contractId = milestone1.contractId;
    expect((await mp.getDepositList(contractId)).amount).toEqual(amount);
    expect(await mp.tokenBalance(alice.address)).toBeLessThan(aliceBalance - amount);

    // submit freelancer
    mp.changeAccount(bob);
    const escrowSubmitStatus = await mp.escrowSubmit(contractId, salt, data);
    expect(escrowSubmitStatus.status).toEqual("success");

    // new deposit for milestone2
    mp.changeAccount(alice);
    const milestone2 = await mp.escrowRefill(contractId, amount);
    expect(milestone2.status).toEqual("success");
    expect((await mp.getDepositList(contractId)).amount).toEqual(amount * 2);
    expect(await mp.tokenBalance(alice.address)).toBeLessThan(aliceBalance - amount * 2);

    // new deposit for milestone3
    const milestone3 = await mp.escrowRefill(contractId, amount);
    expect(milestone3.status).toEqual("success");
    expect((await mp.getDepositList(contractId)).amount).toEqual(amount * 3);
    expect(await mp.tokenBalance(alice.address)).toBeLessThan(aliceBalance - amount * 3);

    // approve and claim milestone1
    const milestone1Approve = await mp.escrowApprove({
      contractId,
      valueApprove: amount,
      recipient: bob.address,
    });
    expect(milestone1Approve.status).toEqual("success");
    expect((await mp.getDepositList(contractId)).amountToClaim).toEqual(amount);
    mp.changeAccount(bob);
    const milestone1Claim = await mp.escrowClaim(contractId);
    expect(milestone1Claim.status).toEqual("success");
    expect(await mp.tokenBalance(bob.address)).toEqual(bobBalance + amount);

    // submit milestone2 by freelancer
    mp.changeAccount(bob);
    const escrowSubmitMilestone2 = await mp.escrowSubmit(contractId, salt, data);
    expect(escrowSubmitMilestone2.status).toEqual("success");

    // approve and claim milestone2
    mp.changeAccount(alice);
    const milestone2Approve = await mp.escrowApprove({
      contractId,
      valueApprove: amount,
      recipient: bob.address,
    });
    expect(milestone2Approve.status).toEqual("success");
    expect((await mp.getDepositList(contractId)).amountToClaim).toEqual(amount);
    mp.changeAccount(bob);
    const milestone2Claim = await mp.escrowClaim(contractId);
    expect(milestone2Claim.status).toEqual("success");
    expect(await mp.tokenBalance(bob.address)).toEqual(bobBalance + amount * 2);

    // submit milestone3 by freelancer
    mp.changeAccount(bob);
    const escrowSubmitMilestone3 = await mp.escrowSubmit(contractId, salt, data);
    expect(escrowSubmitMilestone3.status).toEqual("success");

    // approve and claim milestone3
    mp.changeAccount(alice);
    const milestone3Approve = await mp.escrowApprove({
      contractId,
      valueApprove: amount,
      recipient: bob.address,
    });
    expect(milestone3Approve.status).toEqual("success");
    expect((await mp.getDepositList(contractId)).amountToClaim).toEqual(amount);
    mp.changeAccount(bob);
    const milestone3Claim = await mp.escrowClaim(contractId);
    expect(milestone3Claim.status).toEqual("success");
    expect(await mp.tokenBalance(bob.address)).toEqual(bobBalance + amount * 3);
  }, 1200000);
});
