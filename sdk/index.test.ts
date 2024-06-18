import { beforeAll, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { MidcontractProtocol } from "./.";
import type { Address } from "viem";
import { DepositStatus, FeeConfig } from "./Deposit";

const random = (min: number, max: number) => Math.round(Math.random() * (max - min) + min);
const getDepositId = () => BigInt(random(100000, 1000000));
const getData = () => getDepositId().toString();

let userEscrow: Address;
let userEscrowMilestone: Address;

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
    const { userEscrow } = await mp.deployEscrow();
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

describe("Fees Manager", async () => {
  const amount = 10;

  beforeAll(async () => {
    mp.changeAccount(alice);
  });

  describe("Get fees and max BPS", async () => {
    it("getCoverageFee", async () => {
      const coverageFee = await mp.getCoverageFee();

      expect(coverageFee).toBeDefined();
      expect(coverageFee).not.toBeNaN();
    });

    it("getCoverageFee", async () => {
      const claimFee = await mp.getClaimFee();

      expect(claimFee).toBeDefined();
      expect(claimFee).not.toBeNaN();
    });

    it("get MaxBPS", async () => {
      const maxBps = await mp.getMaxBPS();

      expect(maxBps).toBeDefined();
      expect(maxBps).not.toBeNaN();
      expect(maxBps).toBeGreaterThanOrEqual(0);
      expect(maxBps).toBeLessThanOrEqual(100);
    });
  });

  describe("Calculate deposit amount", async () => {
    let coverageFee: number;
    let claimFee: number;

    beforeAll(async () => {
      coverageFee = await mp.getCoverageFee();

      expect(coverageFee).toBeDefined();
      expect(coverageFee).not.toBeNaN();
      coverageFee = coverageFee / 100;

      claimFee = await mp.getClaimFee();
      expect(claimFee).toBeDefined();
      expect(claimFee).not.toBeNaN();
      claimFee = claimFee / 100;
    });
    it("Client covers all", async () => {
      const feeApplied = amount * (coverageFee + claimFee);
      const totalDepositAmount = amount + feeApplied;
      const depositAmount = await mp.escrowDepositAmount(amount, FeeConfig.CLIENT_COVERS_ALL);

      expect(depositAmount).toBeDefined();
      expect(depositAmount.totalDepositAmount).toBeDefined();
      expect(depositAmount.totalDepositAmount).not.toBeNaN();
      expect(depositAmount.totalDepositAmount).toEqual(totalDepositAmount);
      expect(depositAmount.feeApplied).toBeDefined();
      expect(depositAmount.feeApplied).not.toBeNaN();
      expect(depositAmount.feeApplied).toEqual(feeApplied);
    });

    it("Client covers only", async () => {
      const feeApplied = amount * coverageFee;
      const totalDepositAmount = amount + feeApplied;
      const depositAmount = await mp.escrowDepositAmount(amount, FeeConfig.CLIENT_COVERS_ONLY);

      expect(depositAmount).toBeDefined();
      expect(depositAmount.totalDepositAmount).toBeDefined();
      expect(depositAmount.totalDepositAmount).not.toBeNaN();
      expect(depositAmount.totalDepositAmount).toEqual(totalDepositAmount);
      expect(depositAmount.feeApplied).toBeDefined();
      expect(depositAmount.feeApplied).not.toBeNaN();
      expect(depositAmount.feeApplied).toEqual(feeApplied);
    });

    it("No fees", async () => {
      const feeApplied = 0;
      const totalDepositAmount = amount;
      const depositAmount = await mp.escrowDepositAmount(amount, FeeConfig.CLIENT_COVERS_ONLY);

      expect(depositAmount).toBeDefined();
      expect(depositAmount.totalDepositAmount).toBeDefined();
      expect(depositAmount.totalDepositAmount).not.toBeNaN();
      expect(depositAmount.totalDepositAmount).toEqual(totalDepositAmount);
      expect(depositAmount.feeApplied).toBeDefined();
      expect(depositAmount.feeApplied).not.toBeNaN();
      expect(depositAmount.feeApplied).toEqual(feeApplied);
    });
  });

  describe("Calculate claimable amount", async () => {
    let coverageFee: number;
    let claimFee: number;

    beforeAll(async () => {
      coverageFee = await mp.getCoverageFee();

      expect(coverageFee).toBeDefined();
      expect(coverageFee).not.toBeNaN();
      coverageFee = coverageFee / 100;

      claimFee = await mp.getClaimFee();
      expect(claimFee).toBeDefined();
      expect(claimFee).not.toBeNaN();
      claimFee = claimFee / 100;
    });
    it("Client covers all", async () => {
      const feeDeducted = 0;
      const clientFee = amount * (coverageFee + claimFee);
      const totalDepositAmount = amount;
      const depositAmount = await mp.escrowClaimableAmount(amount, FeeConfig.CLIENT_COVERS_ALL);

      expect(depositAmount).toBeDefined();

      expect(depositAmount.claimableAmount).toBeDefined();
      expect(depositAmount.claimableAmount).not.toBeNaN();
      expect(depositAmount.claimableAmount).toEqual(totalDepositAmount);

      expect(depositAmount.feeDeducted).toBeDefined();
      expect(depositAmount.feeDeducted).not.toBeNaN();
      expect(depositAmount.feeDeducted).toEqual(feeDeducted);

      expect(depositAmount.clientFee).toBeDefined();
      expect(depositAmount.clientFee).not.toBeNaN();
      expect(depositAmount.clientFee).toEqual(clientFee);
    });

    it("Contractor covers claim", async () => {
      const clientFee = 0;
      const feeDeducted = amount * claimFee;
      const totalDepositAmount = amount - feeDeducted;
      const depositAmount = await mp.escrowClaimableAmount(amount, FeeConfig.CLIENT_COVERS_ALL);

      expect(depositAmount).toBeDefined();

      expect(depositAmount.claimableAmount).toBeDefined();
      expect(depositAmount.claimableAmount).not.toBeNaN();
      expect(depositAmount.claimableAmount).toEqual(totalDepositAmount);

      expect(depositAmount.feeDeducted).toBeDefined();
      expect(depositAmount.feeDeducted).not.toBeNaN();
      expect(depositAmount.feeDeducted).toEqual(feeDeducted);

      expect(depositAmount.clientFee).toBeDefined();
      expect(depositAmount.clientFee).not.toBeNaN();
      expect(depositAmount.clientFee).toEqual(clientFee);
    });

    it("Client covers only", async () => {
      const clientFee = amount * coverageFee;
      const feeDeducted = amount * claimFee;
      const totalDepositAmount = amount - feeDeducted;
      const depositAmount = await mp.escrowClaimableAmount(amount, FeeConfig.CLIENT_COVERS_ALL);

      expect(depositAmount).toBeDefined();

      expect(depositAmount.claimableAmount).toBeDefined();
      expect(depositAmount.claimableAmount).not.toBeNaN();
      expect(depositAmount.claimableAmount).toEqual(totalDepositAmount);

      expect(depositAmount.feeDeducted).toBeDefined();
      expect(depositAmount.feeDeducted).not.toBeNaN();
      expect(depositAmount.feeDeducted).toEqual(feeDeducted);

      expect(depositAmount.clientFee).toBeDefined();
      expect(depositAmount.clientFee).not.toBeNaN();
      expect(depositAmount.clientFee).toEqual(clientFee);
    });

    it("No fees", async () => {
      const clientFee = 0;
      const feeDeducted = 0;
      const totalDepositAmount = amount;
      const depositAmount = await mp.escrowClaimableAmount(amount, FeeConfig.CLIENT_COVERS_ALL);

      expect(depositAmount).toBeDefined();

      expect(depositAmount.claimableAmount).toBeDefined();
      expect(depositAmount.claimableAmount).not.toBeNaN();
      expect(depositAmount.claimableAmount).toEqual(totalDepositAmount);

      expect(depositAmount.feeDeducted).toBeDefined();
      expect(depositAmount.feeDeducted).not.toBeNaN();
      expect(depositAmount.feeDeducted).toEqual(feeDeducted);

      expect(depositAmount.clientFee).toBeDefined();
      expect(depositAmount.clientFee).not.toBeNaN();
      expect(depositAmount.clientFee).toEqual(clientFee);
    });
  });
});

describe("base", async () => {
  beforeAll(async () => {
    mp.changeAccount(alice);
    if (!userEscrow) {
      const deployEscrowResponse = await mp.deployEscrow();
      userEscrow = deployEscrowResponse.userEscrow;
    }
    if (!userEscrowMilestone) {
      const deployEscrowMilestoneResponse = await mp.deployMilestoneEscrow();
      userEscrowMilestone = deployEscrowMilestoneResponse.userEscrow;
    }
  }, 1200000);
  it("blockNumber", async () => {
    console.log(`blockNumber=${await mp.blockNumber}`);
    expect(await mp.blockNumber).greaterThan(1);
  });

  it("calcDepositAmount", async () => {
    const depositAmount = await mp.escrowDepositAmount(1.9833333333333334, FeeConfig.CLIENT_COVERS_ALL);
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
    mp.changeEscrow(userEscrow);
    const amount = 10;
    const amountToClaim = 0;
    const { data, salt, recipientData, aliceBalance, bobBalance } = await newData();
    const tokenSymbol = "MockUSDT";

    mp.changeAccount(alice);

    //  create deposit
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
    mp.changeEscrow(userEscrowMilestone);
    const amount = 10;
    const amountToClaim = 0;
    const { data, salt, recipientData, aliceBalance, bobBalance } = await newData();
    const tokenSymbol = "MockUSDT";

    // new deposit for milestone1
    mp.changeAccount(alice);
    const depositInput = [
      {
        contractorAddress: bob.address,
        token: tokenSymbol,
        amount,
        amountToClaim,
        recipientData,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      },
    ];
    const milestone1 = await mp.escrowMilestoneDeposit(depositInput, tokenSymbol);
    expect(milestone1.status).toEqual("success");
    expect(milestone1.contractId).toBeDefined();

    const contractId = milestone1.contractId;
    const milestone1Id = 0n;
    expect((await mp.getDepositListMilestone(contractId, milestone1Id)).amount).toEqual(amount);
    expect(await mp.tokenBalance(alice.address)).toBeLessThan(aliceBalance - amount);

    // submit freelancer
    mp.changeAccount(bob);
    const escrowSubmitStatus = await mp.escrowSubmitMilestone(contractId, milestone1Id, salt, data);
    expect(escrowSubmitStatus.status).toEqual("success");

    // new deposit for milestone2
    mp.changeAccount(alice);
    const deposit2Input = [
      {
        contractorAddress: bob.address,
        token: tokenSymbol,
        amount,
        amountToClaim,
        recipientData,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      },
    ];
    const milestone2 = await mp.escrowMilestoneDeposit(deposit2Input, tokenSymbol, contractId);
    expect(milestone2.status).toEqual("success");

    const milestone2Id = 1n;
    expect((await mp.getDepositListMilestone(contractId, milestone2Id)).amount).toEqual(amount);
    expect(await mp.tokenBalance(alice.address)).toBeLessThan(aliceBalance - amount * 2);

    // new deposit for milestone3
    const deposit3Input = [
      {
        contractorAddress: bob.address,
        token: tokenSymbol,
        amount,
        amountToClaim,
        recipientData,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      },
    ];
    const milestone3 = await mp.escrowMilestoneDeposit(deposit3Input, tokenSymbol, contractId);
    expect(milestone3.status).toEqual("success");

    const milestone3Id = 2n;
    expect((await mp.getDepositListMilestone(contractId, milestone3Id)).amount).toEqual(amount);

    expect(await mp.tokenBalance(alice.address)).toBeLessThan(aliceBalance - amount * 3);

    // approve and claim milestone1
    const milestone1Approve = await mp.escrowApproveMilestone({
      contractId,
      milestoneId: milestone1Id,
      valueApprove: amount,
      recipient: bob.address,
      token: tokenSymbol,
    });
    expect(milestone1Approve.status).toEqual("success");
    expect((await mp.getDepositListMilestone(contractId, milestone1Id)).amountToClaim).toEqual(amount);

    mp.changeAccount(bob);
    const milestone1Claim = await mp.escrowClaimMilestone(contractId, milestone1Id);
    expect(milestone1Claim.status).toEqual("success");
    expect(await mp.tokenBalance(bob.address)).toEqual(bobBalance + amount);

    // submit milestone2 by freelancer
    mp.changeAccount(bob);
    const escrowSubmitMilestone2 = await mp.escrowSubmitMilestone(contractId, milestone2Id, salt, data);
    expect(escrowSubmitMilestone2.status).toEqual("success");

    // approve and claim milestone2
    mp.changeAccount(alice);
    const milestone2Approve = await mp.escrowApproveMilestone({
      contractId,
      milestoneId: milestone2Id,
      valueApprove: amount,
      recipient: bob.address,
      token: tokenSymbol,
    });
    expect(milestone2Approve.status).toEqual("success");
    expect((await mp.getDepositListMilestone(contractId, milestone2Id)).amountToClaim).toEqual(amount);
    mp.changeAccount(bob);
    const milestone2Claim = await mp.escrowClaimMilestone(contractId, milestone2Id);
    expect(milestone2Claim.status).toEqual("success");
    expect(await mp.tokenBalance(bob.address)).toEqual(bobBalance + amount * 2);

    // submit milestone3 by freelancer
    mp.changeAccount(bob);
    const escrowSubmitMilestone3 = await mp.escrowSubmitMilestone(contractId, milestone3Id, salt, data);
    expect(escrowSubmitMilestone3.status).toEqual("success");

    // approve and claim milestone3
    mp.changeAccount(alice);
    const milestone3Approve = await mp.escrowApproveMilestone({
      contractId,
      valueApprove: amount,
      recipient: bob.address,
    });
    expect(milestone3Approve.status).toEqual("success");
    expect((await mp.getDepositListMilestone(contractId, milestone3Id)).amountToClaim).toEqual(amount);
    mp.changeAccount(bob);
    const milestone3Claim = await mp.escrowClaimMilestone(contractId, milestone3Id);
    expect(milestone3Claim.status).toEqual("success");
    expect(await mp.tokenBalance(bob.address)).toEqual(bobBalance + amount * 3);
  }, 1200000);

  it("success flow approve return request and withdraw", async () => {
    const amount = 10;
    const amountToClaim = 0;
    const { data, salt, recipientData } = await newData();
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

    // submit work
    mp.changeAccount(bob);
    const escrowSubmit = await mp.escrowSubmit(contractId, salt, data);
    expect(escrowSubmit.status).toEqual("success");

    mp.changeAccount(alice);
    const requestReturnResponse = await mp.requestReturn(contractId);
    expect(requestReturnResponse.status).toEqual("success");

    mp.changeAccount(bob);
    const approveReturnResponse = await mp.approveReturn(contractId);
    expect(approveReturnResponse.status).toEqual("success");

    // const aliceBalanceAfterReturnApprove = await mp.tokenBalance(alice.address, "MockUSDT");
    // expect(aliceBalanceAfterReturnApprove).toBeGreaterThan(aliceBalance);

    mp.changeAccount(alice);
    const withdrawResponse = await mp.escrowWithdraw(contractId);
    expect(withdrawResponse.status).toEqual("success");
  }, 1200000);

  it("success flow cancel return request", async () => {
    const amount = 10;
    const amountToClaim = 0;
    const { data, salt, recipientData } = await newData();
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

    // submit work
    mp.changeAccount(bob);
    const escrowSubmit = await mp.escrowSubmit(contractId, salt, data);
    expect(escrowSubmit.status).toEqual("success");

    mp.changeAccount(alice);
    const requestReturnResponse = await mp.requestReturn(contractId);
    expect(requestReturnResponse.status).toEqual("success");

    const cancelReturnResponse = await mp.cancelReturn(contractId, DepositStatus.ACTIVE);
    expect(cancelReturnResponse.status).toEqual("success");
  }, 1200000);

  it("success flow create and resole dispute", async () => {
    const amount = 10;
    const amountToClaim = 0;
    const { data, salt, recipientData } = await newData();
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

    // submit work
    mp.changeAccount(bob);
    const escrowSubmit = await mp.escrowSubmit(contractId, salt, data);
    expect(escrowSubmit.status).toEqual("success");

    mp.changeAccount(alice);
    const requestReturnResponse = await mp.requestReturn(contractId);
    expect(requestReturnResponse.status).toEqual("success");

    mp.changeAccount(bob);
    const createDispute = await mp.createDispute(contractId);
    expect(createDispute.status).toEqual("success");

    // mp.changeAccount(admin);
    // const resolveDisputeResponse = await mp.resolveDispute(contractId, DisputeWinner.CLIENT, 8, 2);
    // expect(resolveDisputeResponse.status).toEqual("success");
  }, 1200000);
});
