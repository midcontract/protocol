import { beforeAll, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { MidcontractProtocol } from "./.";
import type { Address } from "viem";
import { DepositStatus, DisputeWinner, FeeConfig, RefillType } from "./Deposit";

const random = (min: number, max: number) => Math.round(Math.random() * (max - min) + min);
const getDepositId = () => BigInt(random(100000, 1000000));
const getData = () => getDepositId().toString();

let userEscrow: Address;
let userEscrowMilestone: Address;
let userEscrowHourly: Address;

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
  it("deploy Fix Price", async () => {
    mp.changeAccount(alice);
    const { userEscrow } = await mp.deployEscrow();
    expect(userEscrow).toBeDefined();
  }, 1200000);

  it("deploy Milestone", async () => {
    mp.changeAccount(alice);
    const { userEscrow } = await mp.deployMilestoneEscrow();
    expect(userEscrow).toBeDefined();
  }, 1200000);

  it("deploy Hourly", async () => {
    mp.changeAccount(alice);
    const { userEscrow } = await mp.deployHourlyEscrow();
    expect(userEscrow).toBeDefined();
  }, 1200000);
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
      const coverageFee = await mp.getCoverageFee(alice.address);

      expect(coverageFee).toBeDefined();
      expect(coverageFee).not.toBeNaN();
    });

    it("getClaimFee", async () => {
      const claimFee = await mp.getClaimFee(alice.address);

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
      coverageFee = await mp.getCoverageFee(alice.address);

      expect(coverageFee).toBeDefined();
      expect(coverageFee).not.toBeNaN();
      coverageFee = coverageFee / 100;

      claimFee = await mp.getClaimFee(alice.address);
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
      const depositAmount = await mp.escrowDepositAmount(amount, FeeConfig.NO_FEES);

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
      coverageFee = await mp.getCoverageFee(alice.address);

      expect(coverageFee).toBeDefined();
      expect(coverageFee).not.toBeNaN();
      coverageFee = coverageFee / 100;

      claimFee = await mp.getClaimFee(alice.address);
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
      const depositAmount = await mp.escrowClaimableAmount(amount, FeeConfig.CONTRACTOR_COVERS_CLAIM);

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
      const depositAmount = await mp.escrowClaimableAmount(amount, FeeConfig.CLIENT_COVERS_ONLY);

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
      const depositAmount = await mp.escrowClaimableAmount(amount, FeeConfig.NO_FEES);

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
      console.log("Fixed price contract deployed");
    }
    if (!userEscrowMilestone) {
      const deployEscrowMilestoneResponse = await mp.deployMilestoneEscrow();
      userEscrowMilestone = deployEscrowMilestoneResponse.userEscrow;
      console.log("Milestone contract deployed");
    }

    if (!userEscrowHourly) {
      const deployEscrowHourlyResponse = await mp.deployHourlyEscrow();
      userEscrowHourly = deployEscrowHourlyResponse.userEscrow;
      console.log("Hourly contract deployed!");
    }
  }, 1200000);
  describe("Fixed price flow", async () => {
    beforeAll(async () => {
      mp.changeAccount(alice);
      mp.changeEscrow(userEscrow);
    }, 1200000);
    it("success flow Fixed Price", async () => {
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

    it("success flow create dispute", async () => {
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

    it("success flow create and approve return request with withdraw", async () => {
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
      const createDispute = await mp.approveReturn(contractId);
      expect(createDispute.status).toEqual("success");

      mp.changeAccount(alice);
      const withdrawalResponse = await mp.escrowWithdraw(contractId);
      expect(withdrawalResponse.status).toEqual("success");
    }, 1200000);

    it("success flow withdraw transaction events", async () => {
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
      const createDispute = await mp.approveReturn(contractId);
      expect(createDispute.status).toEqual("success");

      mp.changeAccount(alice);
      const withdrawalResponse = await mp.escrowWithdraw(contractId);
      expect(withdrawalResponse.status).toEqual("success");

      const transactionData = await mp.transactionByHash(withdrawalResponse.id);
      expect(transactionData).toBeDefined();

      const parsedTransactionData = await mp.transactionParse(transactionData);
      expect(parsedTransactionData.events.length).toBeGreaterThan(0);
    }, 1200000);

    it("success flow resolve dispute - client won", async () => {
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
      const createDisputeResponse = await mp.createDispute(contractId);
      expect(createDisputeResponse.status).toEqual("success");

      mp.changeAccount(admin);
      const resolveDisputeResponse = await mp.resolveDispute(contractId, DisputeWinner.CLIENT, amount, 0);
      expect(resolveDisputeResponse.status).toEqual("success");
    }, 1200000);

    it("success flow resolve dispute - contractor won", async () => {
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
      const createDisputeResponse = await mp.createDispute(contractId);
      expect(createDisputeResponse.status).toEqual("success");

      mp.changeAccount(admin);
      const resolveDisputeResponse = await mp.resolveDispute(contractId, DisputeWinner.CONTRACTOR, 0, amount);
      expect(resolveDisputeResponse.status).toEqual("success");
    }, 1200000);

    it("success flow resolve dispute - split", async () => {
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
      const createDisputeResponse = await mp.createDispute(contractId);
      expect(createDisputeResponse.status).toEqual("success");

      mp.changeAccount(admin);
      const resolveDisputeResponse = await mp.resolveDispute(contractId, DisputeWinner.SPLIT, 5, 5);
      expect(resolveDisputeResponse.status).toEqual("success");
    }, 1200000);
  });

  describe("Milestone flow", async () => {
    beforeAll(async () => {
      mp.changeAccount(alice);
      mp.changeEscrow(userEscrowMilestone);
    }, 1200000);

    it("success flow", async () => {
      const amount = 1;
      const amountToClaim = 0;
      const { data, salt, recipientData, aliceBalance } = await newData();
      const tokenSymbol = "MockUSDT";

      // new deposit for milestone1
      const depositInput = [
        {
          contractorAddress: bob.address as Address,
          token: tokenSymbol,
          amount,
          amountToClaim,
          recipientData: recipientData,
          feeConfig: FeeConfig.CLIENT_COVERS_ONLY,
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
      // expect(await mp.tokenBalance(bob.address)).toEqual(bobBalance + amount);

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
      // expect(await mp.tokenBalance(bob.address)).toEqual(bobBalance + amount * 2);

      // submit milestone3 by freelancer
      mp.changeAccount(bob);
      const escrowSubmitMilestone3 = await mp.escrowSubmitMilestone(contractId, milestone3Id, salt, data);
      expect(escrowSubmitMilestone3.status).toEqual("success");

      // approve and claim milestone3
      mp.changeAccount(alice);
      const milestone3Approve = await mp.escrowApproveMilestone({
        contractId,
        milestoneId: milestone3Id,
        valueApprove: amount,
        recipient: bob.address,
        token: tokenSymbol,
      });
      expect(milestone3Approve.status).toEqual("success");
      expect((await mp.getDepositListMilestone(contractId, milestone3Id)).amountToClaim).toEqual(amount);
      mp.changeAccount(bob);
      const milestone3Claim = await mp.escrowClaimMilestone(contractId, milestone3Id);
      expect(milestone3Claim.status).toEqual("success");
      // expect(await mp.tokenBalance(bob.address)).toEqual(bobBalance + amount * 3);
    }, 1200000);

    it("Claim all", async () => {
      const amount = 1;
      const amountToClaim = 0;
      const { data, salt, recipientData, aliceBalance, bobBalance } = await newData();
      const tokenSymbol = "MockUSDT";

      // new deposit for milestone1
      const depositInput = [
        {
          contractorAddress: bob.address,
          token: tokenSymbol,
          amount,
          amountToClaim,
          recipientData: recipientData,
          feeConfig: FeeConfig.CLIENT_COVERS_ONLY,
        },
      ];
      const milestone1 = await mp.escrowMilestoneDeposit(depositInput, tokenSymbol);
      expect(milestone1.status).toEqual("success");
      expect(milestone1.contractId).toBeDefined();

      const parsedData = await mp.transactionByHashMilestone(milestone1.id);
      expect(parsedData).toBeDefined();

      const contractId = milestone1.contractId;
      const milestone1Id = 0n;
      const milestone1Data = await mp.getDepositListMilestone(contractId, milestone1Id);
      expect(milestone1Data.amount).toEqual(amount);
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

      // approve
      const milestone1Approve = await mp.escrowApproveMilestone({
        contractId,
        milestoneId: milestone1Id,
        valueApprove: amount,
        recipient: bob.address,
        token: tokenSymbol,
      });
      expect(milestone1Approve.status).toEqual("success");
      expect((await mp.getDepositListMilestone(contractId, milestone1Id)).amountToClaim).toEqual(amount);

      // submit milestone2 by freelancer
      mp.changeAccount(bob);
      const escrowSubmitMilestone2 = await mp.escrowSubmitMilestone(contractId, milestone2Id, salt, data);
      expect(escrowSubmitMilestone2.status).toEqual("success");

      // approve milestone2
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

      // submit milestone3 by freelancer
      mp.changeAccount(bob);
      const escrowSubmitMilestone3 = await mp.escrowSubmitMilestone(contractId, milestone3Id, salt, data);
      expect(escrowSubmitMilestone3.status).toEqual("success");

      // approve milestone3
      mp.changeAccount(alice);
      const milestone3Approve = await mp.escrowApproveMilestone({
        contractId,
        milestoneId: milestone3Id,
        valueApprove: amount,
        recipient: bob.address,
        token: tokenSymbol,
      });
      expect(milestone3Approve.status).toEqual("success");
      expect((await mp.getDepositListMilestone(contractId, milestone3Id)).amountToClaim).toEqual(amount);
      mp.changeAccount(bob);

      //claim all 3 milestones with claimAll
      mp.changeAccount(bob);
      const claimAll = await mp.escrowClaimAllMilestone(contractId, milestone1Id, milestone3Id);
      expect(claimAll.status).toEqual("success");
      expect(await mp.tokenBalance(bob.address)).toBeLessThan(bobBalance + amount * 3);
    }, 1200000);

    it("success flow - auto approve work", async () => {
      const amount = 1;
      const amountToClaim = 0;
      const { data, salt, recipientData, aliceBalance } = await newData();
      const tokenSymbol = "MockUSDT";

      // new deposit for milestone1
      const depositInput = [
        {
          contractorAddress: bob.address as Address,
          token: tokenSymbol,
          amount,
          amountToClaim,
          recipientData: recipientData,
          feeConfig: FeeConfig.CLIENT_COVERS_ONLY,
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

      // auto approve and claim milestone1
      mp.changeAccount(admin);
      const milestone1AutoApprove = await mp.escrowApproveMilestone({
        contractId,
        milestoneId: milestone1Id,
        valueApprove: amount,
        recipient: bob.address,
        token: tokenSymbol,
      });
      expect(milestone1AutoApprove.status).toEqual("success");
      expect((await mp.getDepositListMilestone(contractId, milestone1Id)).amountToClaim).toEqual(amount);

      mp.changeAccount(bob);
      const milestone1Claim = await mp.escrowClaimMilestone(contractId, milestone1Id);
      expect(milestone1Claim.status).toEqual("success");
    }, 1200000);

    it("success flow create and cancel return request", async () => {
      const amount = 10;
      const amountToClaim = 0;
      const { data, salt, recipientData } = await newData();
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

      // submit freelancer
      mp.changeAccount(bob);
      const escrowSubmitStatus = await mp.escrowSubmitMilestone(contractId, milestone1Id, salt, data);
      expect(escrowSubmitStatus.status).toEqual("success");

      mp.changeAccount(alice);
      const requestReturnResponse = await mp.requestReturnMilestone(contractId, milestone1Id);
      expect(requestReturnResponse.status).toEqual("success");

      const approveReturnResponse = await mp.cancelReturnMilestone(contractId, milestone1Id, DepositStatus.SUBMITTED);
      expect(approveReturnResponse.status).toEqual("success");
    }, 1200000);

    it("success flow create and approve return request with withdraw", async () => {
      const amount = 10;
      const amountToClaim = 0;
      const { data, salt, recipientData } = await newData();
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

      // submit freelancer
      mp.changeAccount(bob);
      const escrowSubmitStatus = await mp.escrowSubmitMilestone(contractId, milestone1Id, salt, data);
      expect(escrowSubmitStatus.status).toEqual("success");

      mp.changeAccount(alice);
      const requestReturnResponse = await mp.requestReturnMilestone(contractId, milestone1Id);
      expect(requestReturnResponse.status).toEqual("success");

      mp.changeAccount(bob);
      const approveReturnResponse = await mp.approveReturnMilestone(contractId, milestone1Id);
      expect(approveReturnResponse.status).toEqual("success");

      // const aliceBalanceAfterReturnApprove = await mp.tokenBalance(alice.address, "MockUSDT");
      // expect(aliceBalanceAfterReturnApprove).toBeGreaterThan(aliceBalance);

      mp.changeAccount(alice);
      const withdrawResponse = await mp.escrowWithdrawMilestone(contractId, milestone1Id);
      expect(withdrawResponse.status).toEqual("success");
    }, 1200000);

    it("success flow dispute - client won", async () => {
      const amount = 10;
      const amountToClaim = 0;
      const { data, salt, recipientData } = await newData();
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

      // submit freelancer
      mp.changeAccount(bob);
      const escrowSubmitStatus = await mp.escrowSubmitMilestone(contractId, milestone1Id, salt, data);
      expect(escrowSubmitStatus.status).toEqual("success");

      mp.changeAccount(alice);
      const requestReturnResponse = await mp.requestReturnMilestone(contractId, milestone1Id);
      expect(requestReturnResponse.status).toEqual("success");

      mp.changeAccount(bob);
      const createDispute = await mp.createDisputeMilestone(contractId, milestone1Id);
      expect(createDispute.status).toEqual("success");

      mp.changeAccount(admin);
      const resolveDispute = await mp.resolveDisputeMilestone(
        contractId,
        milestone1Id,
        DisputeWinner.CLIENT,
        amount,
        0
      );
      expect(resolveDispute.status).toEqual("success");

      mp.changeAccount(alice);
      const withdrawResponse = await mp.escrowWithdrawMilestone(contractId, milestone1Id);
      expect(withdrawResponse.status).toEqual("success");
    }, 1200000);

    it("success flow dispute - contractor won", async () => {
      const amount = 10;
      const amountToClaim = 0;
      const { data, salt, recipientData } = await newData();
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

      // submit freelancer
      mp.changeAccount(bob);
      const escrowSubmitStatus = await mp.escrowSubmitMilestone(contractId, milestone1Id, salt, data);
      expect(escrowSubmitStatus.status).toEqual("success");

      mp.changeAccount(alice);
      const requestReturnResponse = await mp.requestReturnMilestone(contractId, milestone1Id);
      expect(requestReturnResponse.status).toEqual("success");

      mp.changeAccount(bob);
      const createDispute = await mp.createDisputeMilestone(contractId, milestone1Id);
      expect(createDispute.status).toEqual("success");

      mp.changeAccount(admin);
      const resolveDispute = await mp.resolveDisputeMilestone(
        contractId,
        milestone1Id,
        DisputeWinner.CONTRACTOR,
        0,
        amount
      );
      expect(resolveDispute.status).toEqual("success");

      mp.changeAccount(bob);
      const claimResponse = await mp.escrowClaimMilestone(contractId, milestone1Id);
      expect(claimResponse.status).toEqual("success");
    }, 1200000);

    it("success flow dispute - split", async () => {
      const amount = 10;
      const amountToClaim = 0;
      const { data, salt, recipientData } = await newData();
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

      // submit freelancer
      mp.changeAccount(bob);
      const escrowSubmitStatus = await mp.escrowSubmitMilestone(contractId, milestone1Id, salt, data);
      expect(escrowSubmitStatus.status).toEqual("success");

      mp.changeAccount(alice);
      const requestReturnResponse = await mp.requestReturnMilestone(contractId, milestone1Id);
      expect(requestReturnResponse.status).toEqual("success");

      mp.changeAccount(bob);
      const createDispute = await mp.createDisputeMilestone(contractId, milestone1Id);
      expect(createDispute.status).toEqual("success");

      mp.changeAccount(admin);
      const resolveDispute = await mp.resolveDisputeMilestone(contractId, milestone1Id, DisputeWinner.SPLIT, 5, 5);
      expect(resolveDispute.status).toEqual("success");

      mp.changeAccount(alice);
      const withdrawResponse = await mp.escrowWithdrawMilestone(contractId, milestone1Id);
      expect(withdrawResponse.status).toEqual("success");

      const transactionData = await mp.transactionByHashMilestone(withdrawResponse.id);
      expect(transactionData).toBeDefined();

      const parsedTransaction = await mp.transactionParseMilestone(transactionData);
      expect(parsedTransaction).toBeDefined();
      expect(parsedTransaction.events).toBeDefined();
      expect(parsedTransaction.events.length).toBeGreaterThan(0);
      expect(parsedTransaction.input).toBeDefined();
      expect(parsedTransaction.input.args).toBeDefined();
      expect(parsedTransaction.input.args.length).toBeGreaterThan(0);
    }, 1200000);

    it("success flow refill", async () => {
      const amount = 10;
      const amountToClaim = 0;
      const { data, salt, recipientData } = await newData();
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

      const refillMilestoneResponse = await mp.escrowRefillMilestone(contractId, milestone1Id, amount);
      expect(refillMilestoneResponse.status).toEqual("success");
      expect((await mp.getDepositListMilestone(contractId, milestone1Id)).amount).toEqual(amount * 2);

      // submit freelancer
      mp.changeAccount(bob);
      const escrowSubmitStatus = await mp.escrowSubmitMilestone(contractId, milestone1Id, salt, data);
      expect(escrowSubmitStatus.status).toEqual("success");

      mp.changeAccount(alice);
      const approveMilestoneResponse = await mp.escrowApproveMilestone({
        contractId,
        milestoneId: milestone1Id,
        valueApprove: amount,
        recipient: bob.address,
        token: tokenSymbol,
      });
      expect(approveMilestoneResponse.status).toEqual("success");

      mp.changeAccount(bob);
      const claimMilestoneResponse = await mp.escrowClaimMilestone(contractId, milestone1Id);
      expect(claimMilestoneResponse.status).toEqual("success");
    }, 1200000);
  });

  describe("Hourly flow", async () => {
    beforeAll(async () => {
      mp.changeAccount(alice);
      mp.changeEscrow(userEscrowHourly);
    }, 1200000);
    it("success flow without prepayment", async () => {
      const amountToClaim = 10;
      // const { aliceBalance, bobBalance } = await newData();
      const tokenSymbol = "MockUSDT";

      // new deposit for week1
      mp.changeAccount(alice);
      const depositInput = {
        contractorAddress: bob.address,
        amountToClaim,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };
      const week1 = await mp.escrowDepositHourly(tokenSymbol, 0, undefined, depositInput);
      expect(week1.status).toEqual("success");
      expect(week1.contractId).toBeDefined();

      const contractId = week1.contractId;
      const week1Id = 0n;
      const contractDetails = await mp.getDepositListHourly(contractId, week1Id);
      expect(contractDetails.amount).toBeDefined();
      expect(await mp.tokenBalance(alice.address)).toBeDefined();

      mp.changeAccount(bob);
      const claim = await mp.escrowClaimHourly(contractId, week1Id);
      expect(claim.status).toEqual("success");
      expect(claim.id).toBeDefined();
    }, 1200000);

    it("success flow with prepayment", async () => {
      const prepaymentAmount = 10;
      const amountToClaim = 10;
      // const { aliceBalance, bobBalance } = await newData();
      const tokenSymbol = "MockUSDT";

      // new deposit for week1
      mp.changeAccount(alice);
      const depositInput = {
        contractorAddress: bob.address,
        amountToClaim: 0,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };
      const week1 = await mp.escrowDepositHourly(tokenSymbol, prepaymentAmount, 0n, depositInput);
      console.log(week1.id, " - deposit");
      expect(week1.status).toEqual("success");
      expect(week1.contractId).toBeDefined();

      const contractId = week1.contractId;
      const week1Id = 0n;
      const contractDetails = await mp.getDepositListHourly(contractId, week1Id);
      expect(contractDetails.amount).toBeDefined();
      expect(await mp.tokenBalance(alice.address)).toBeDefined();

      const approvePayload = {
        contractId,
        weekId: week1Id,
        valueApprove: amountToClaim,
        recipient: bob.address,
        token: tokenSymbol,
      };
      const escrowApprove = await mp.escrowApproveHourly(approvePayload);

      expect(escrowApprove.status).toEqual("success");
      expect(escrowApprove.id).toBeDefined();

      mp.changeAccount(bob);
      const claim = await mp.escrowClaimHourly(contractId, week1Id);
      expect(claim.status).toEqual("success");
      expect(claim.id).toBeDefined();
    }, 1200000);

    it("success flow with prepayment and auto approve first week", async () => {
      const prepaymentAmount = 10;
      const amountToClaim = 5;
      const aliceBalance = await mp.tokenBalance(alice.address, "MockUSDT");
      const bobBalance = await mp.tokenBalance(bob.address, "MockUSDT");
      const tokenSymbol = "MockUSDT";

      /* deposit prepayment */
      mp.changeAccount(alice);
      const depositInput = {
        contractorAddress: bob.address,
        amountToClaim: 0,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };
      const prepayment = await mp.escrowDepositHourly(tokenSymbol, prepaymentAmount, 0n, depositInput);
      expect(prepayment.status).toEqual("success");
      expect(prepayment.contractId).toBeDefined();

      /* Get contract and first week */
      const contractId = prepayment.contractId;
      const week1Id = 0n;
      const contractDetails = await mp.getDepositListHourly(contractId, week1Id);
      expect(contractDetails.amount).toEqual(prepaymentAmount);
      expect(await mp.tokenBalance(alice.address)).toBeLessThanOrEqual(aliceBalance - prepaymentAmount);

      /*  Auto approve by admin for first week */
      mp.changeAccount(admin);
      const adminApprovePayload = {
        contractId,
        weekId: week1Id,
        valueApprove: amountToClaim,
        recipient: bob.address,
        token: tokenSymbol,
        initializeNewWeek: false,
      };
      const escrowApproveByAdmin = await mp.escrowApproveByAdminHourly(adminApprovePayload);

      expect(escrowApproveByAdmin.status).toEqual("success");
      expect(escrowApproveByAdmin.id).toBeDefined();

      /* Claim first week by freelancer */
      mp.changeAccount(bob);
      const claim = await mp.escrowClaimHourly(contractId, week1Id);
      expect(claim.status).toEqual("success");
      expect(claim.id).toBeDefined();
      expect(await mp.tokenBalance(bob.address)).toBeLessThanOrEqual(bobBalance + amountToClaim);

      /* Get contract and first week */
      const contractDetailsAfterAutoapprove = await mp.getDepositListHourly(contractId, week1Id);
      expect(contractDetailsAfterAutoapprove.amount).toEqual(prepaymentAmount - amountToClaim);
    }, 1200000);

    it("success flow with prepayment and auto approve second week", async () => {
      const prepaymentAmount = 10;
      const amountToClaim = 5;
      const aliceBalance = await mp.tokenBalance(alice.address, "MockUSDT");
      const bobBalance = await mp.tokenBalance(bob.address, "MockUSDT");
      const tokenSymbol = "MockUSDT";

      /* deposit prepayment */
      mp.changeAccount(alice);
      const depositInput = {
        contractorAddress: bob.address,
        amountToClaim: 0,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };
      const prepayment = await mp.escrowDepositHourly(tokenSymbol, prepaymentAmount, 0n, depositInput);
      expect(prepayment.status).toEqual("success");
      expect(prepayment.contractId).toBeDefined();
      expect(await mp.tokenBalance(alice.address)).toBeLessThanOrEqual(aliceBalance - prepaymentAmount);

      /* get contract with first week */
      const contractId = prepayment.contractId;
      const week1Id = 0n;
      const contractDetails = await mp.getDepositListHourly(contractId, week1Id);
      expect(contractDetails.amount).toBeDefined();
      expect(contractDetails.amount).toEqual(prepaymentAmount);

      /* Deposit for first week */
      const approvePayload = {
        contractId,
        weekId: week1Id,
        valueApprove: amountToClaim,
        recipient: bob.address,
        token: tokenSymbol,
      };
      const escrowApprove = await mp.escrowApproveHourly(approvePayload);

      expect(escrowApprove.status).toEqual("success");
      expect(escrowApprove.id).toBeDefined();
      expect(await mp.tokenBalance(alice.address)).toBeLessThanOrEqual(
        aliceBalance - (prepaymentAmount + amountToClaim)
      );

      /* Claim first week by freelancer */
      mp.changeAccount(bob);
      const claimFirstWeek = await mp.escrowClaimHourly(contractId, week1Id);
      expect(claimFirstWeek.status).toEqual("success");
      expect(claimFirstWeek.id).toBeDefined();
      expect(await mp.tokenBalance(bob.address)).toBeGreaterThanOrEqual(bobBalance + amountToClaim);

      /* Auto approve second week by admin */
      mp.changeAccount(admin);

      const week2Id = 1n;
      const adminApprovePayload = {
        contractId,
        weekId: week2Id,
        valueApprove: amountToClaim,
        recipient: bob.address,
        token: tokenSymbol,
        initializeNewWeek: true,
      };
      const escrowApproveByAdmin = await mp.escrowApproveByAdminHourly(adminApprovePayload);

      expect(escrowApproveByAdmin.status).toEqual("success");
      expect(escrowApproveByAdmin.id).toBeDefined();

      /* Get contract with first week */
      const contractDetailsAfterAutoApprove = await mp.getDepositListHourly(contractId, week2Id);
      expect(contractDetailsAfterAutoApprove.amount).toBeDefined();
      expect(contractDetailsAfterAutoApprove.amount).toEqual(prepaymentAmount - amountToClaim);

      /* Claim second week by freelancer */
      mp.changeAccount(bob);
      const claimSecondWeek = await mp.escrowClaimHourly(contractId, week2Id);
      expect(claimSecondWeek.status).toEqual("success");
      expect(claimSecondWeek.id).toBeDefined();
      expect(await mp.tokenBalance(bob.address)).toBeGreaterThanOrEqual(bobBalance + amountToClaim * 2);
    }, 1200000);

    it("success flow with prepayment and refill", async () => {
      const prepaymentAmount = 10;
      const amountToClaim = 10;
      const aliceBalance = await mp.tokenBalance(alice.address, "MockUSDT");
      const bobBalance = await mp.tokenBalance(bob.address, "MockUSDT");
      const tokenSymbol = "MockUSDT";

      /* deposit prepayment */
      mp.changeAccount(alice);
      const depositInput = {
        contractorAddress: bob.address,
        amountToClaim: 0,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };
      const prepayment = await mp.escrowDepositHourly(tokenSymbol, prepaymentAmount, 0n, depositInput);
      expect(prepayment.status).toEqual("success");
      expect(prepayment.contractId).toBeDefined();
      expect(await mp.tokenBalance(alice.address)).toBeLessThanOrEqual(aliceBalance - prepaymentAmount);

      /* get contract with first week */
      const contractId = prepayment.contractId;
      const week1Id = 0n;
      const contractDetails = await mp.getDepositListHourly(contractId, week1Id);
      expect(contractDetails.amount).toBeDefined();
      expect(contractDetails.amount).toEqual(prepaymentAmount);

      /* Admin approve week */
      mp.changeAccount(admin);
      const approvePayload = {
        contractId,
        weekId: week1Id,
        valueApprove: amountToClaim,
        recipient: bob.address,
        token: tokenSymbol,
        initializeNewWeek: false,
      };
      const adminApproveResponse = await mp.escrowApproveByAdminHourly(approvePayload);

      expect(adminApproveResponse.status).toEqual("success");
      expect(adminApproveResponse.id).toBeDefined();
      // expect(await mp.tokenBalance(alice.address)).toBeLessThanOrEqual(
      //   aliceBalance - (prepaymentAmount + amountToClaim)
      // );

      /* Claim first week by freelancer */
      mp.changeAccount(bob);
      const claimFirstWeek = await mp.escrowClaimHourly(contractId, week1Id);
      expect(claimFirstWeek.status).toEqual("success");
      expect(claimFirstWeek.id).toBeDefined();
      expect(await mp.tokenBalance(bob.address)).toBeGreaterThanOrEqual(bobBalance + amountToClaim);

      mp.changeAccount(alice);
      const refillPrepaymentResponse = await mp.escrowRefillHourly(
        contractId,
        week1Id,
        prepaymentAmount,
        RefillType.PREPAYMENT
      );
      expect(refillPrepaymentResponse.status).toEqual("success");

      /* Auto approve second week by admin */
      mp.changeAccount(admin);

      const week2Id = 1n;
      const adminApprovePayload = {
        contractId,
        weekId: week2Id,
        valueApprove: amountToClaim,
        recipient: bob.address,
        token: tokenSymbol,
        initializeNewWeek: true,
      };
      const escrowApproveByAdmin = await mp.escrowApproveByAdminHourly(adminApprovePayload);

      expect(escrowApproveByAdmin.status).toEqual("success");
      expect(escrowApproveByAdmin.id).toBeDefined();

      /* Get contract with first week */
      const contractDetailsAfterAutoApprove = await mp.getDepositListHourly(contractId, week2Id);
      expect(contractDetailsAfterAutoApprove.amount).toBeDefined();
      expect(contractDetailsAfterAutoApprove.amount).toEqual(prepaymentAmount - amountToClaim);

      /* Claim second week by freelancer */
      mp.changeAccount(bob);
      const claimSecondWeek = await mp.escrowClaimHourly(contractId, week2Id);
      expect(claimSecondWeek.status).toEqual("success");
      expect(claimSecondWeek.id).toBeDefined();
      expect(await mp.tokenBalance(bob.address)).toBeGreaterThanOrEqual(bobBalance + amountToClaim * 2);
    }, 1200000);

    it("success flow with prepayment and escrow return request", async () => {
      const prepaymentAmount = 10;
      const amountToClaim = 5;
      const aliceBalance = await mp.tokenBalance(alice.address, "MockUSDT");
      const bobBalance = await mp.tokenBalance(bob.address, "MockUSDT");
      const tokenSymbol = "MockUSDT";

      /* deposit prepayment */
      mp.changeAccount(alice);
      const depositInput = {
        contractorAddress: bob.address,
        amountToClaim: 0,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };
      const prepayment = await mp.escrowDepositHourly(tokenSymbol, prepaymentAmount, 0n, depositInput);
      expect(prepayment.status).toEqual("success");
      expect(prepayment.contractId).toBeDefined();
      expect(await mp.tokenBalance(alice.address)).toBeLessThanOrEqual(aliceBalance - prepaymentAmount);
      console.log("Deposited!");

      /* get contract with first week */
      const contractId = prepayment.contractId;
      const week1Id = 0n;
      const contractDetails = await mp.getDepositListHourly(contractId, week1Id);
      expect(contractDetails.amount).toBeDefined();
      expect(contractDetails.amount).toEqual(prepaymentAmount);

      /* Deposit for first week */
      const approvePayload = {
        contractId,
        weekId: week1Id,
        valueApprove: amountToClaim,
        recipient: bob.address,
        token: tokenSymbol,
      };
      const escrowApprove = await mp.escrowApproveHourly(approvePayload);
      console.log("First week deposited and approved!");

      expect(escrowApprove.status).toEqual("success");
      expect(escrowApprove.id).toBeDefined();
      expect(await mp.tokenBalance(alice.address)).toBeLessThanOrEqual(
        aliceBalance - (prepaymentAmount + amountToClaim)
      );

      /* Claim first week by freelancer */
      mp.changeAccount(bob);
      const claimFirstWeek = await mp.escrowClaimHourly(contractId, week1Id);
      expect(claimFirstWeek.status).toEqual("success");
      expect(claimFirstWeek.id).toBeDefined();
      expect(await mp.tokenBalance(bob.address)).toBeGreaterThanOrEqual(bobBalance + amountToClaim);
      console.log("First week claimed!");

      /* Create escrow return request */
      mp.changeAccount(alice);
      const requestReturn = await mp.requestReturnHourly(contractId, week1Id);
      expect(requestReturn.status).toEqual("success");
      expect(requestReturn.id).toBeDefined();
      console.log("Return request created!");

      /* Approve return request */
      mp.changeAccount(bob);
      const approveReturn = await mp.approveReturnHourly(contractId, week1Id);
      expect(approveReturn.status).toEqual("success");
      expect(approveReturn.id).toBeDefined();
      console.log("Return request approved!");
    }, 1200000);

    it("success flow with prepayment and escrow return request cancel", async () => {
      const prepaymentAmount = 10;
      const amountToClaim = 5;
      const aliceBalance = await mp.tokenBalance(alice.address, "MockUSDT");
      const bobBalance = await mp.tokenBalance(bob.address, "MockUSDT");
      const tokenSymbol = "MockUSDT";

      /* deposit prepayment */
      mp.changeAccount(alice);
      const depositInput = {
        contractorAddress: bob.address,
        amountToClaim: 0,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };
      const prepayment = await mp.escrowDepositHourly(tokenSymbol, prepaymentAmount, 0n, depositInput);
      expect(prepayment.status).toEqual("success");
      expect(prepayment.contractId).toBeDefined();
      expect(await mp.tokenBalance(alice.address)).toBeLessThanOrEqual(aliceBalance - prepaymentAmount);
      console.log("Deposited!");

      /* get contract with first week */
      const contractId = prepayment.contractId;
      const week1Id = 0n;
      const contractDetails = await mp.getDepositListHourly(contractId, week1Id);
      expect(contractDetails.amount).toBeDefined();
      expect(contractDetails.amount).toEqual(prepaymentAmount);

      /* Deposit for first week */
      const approvePayload = {
        contractId,
        weekId: week1Id,
        valueApprove: amountToClaim,
        recipient: bob.address,
        token: tokenSymbol,
      };
      const escrowApprove = await mp.escrowApproveHourly(approvePayload);
      console.log("First week deposited and approved!");

      expect(escrowApprove.status).toEqual("success");
      expect(escrowApprove.id).toBeDefined();
      expect(await mp.tokenBalance(alice.address)).toBeLessThanOrEqual(
        aliceBalance - (prepaymentAmount + amountToClaim)
      );

      /* Claim first week by freelancer */
      mp.changeAccount(bob);
      const claimFirstWeek = await mp.escrowClaimHourly(contractId, week1Id);
      expect(claimFirstWeek.status).toEqual("success");
      expect(claimFirstWeek.id).toBeDefined();
      expect(await mp.tokenBalance(bob.address)).toBeGreaterThanOrEqual(bobBalance + amountToClaim);
      console.log("First week claimed!");

      /* Create escrow return request */
      mp.changeAccount(alice);
      const requestReturn = await mp.requestReturnHourly(contractId, week1Id);
      expect(requestReturn.status).toEqual("success");
      expect(requestReturn.id).toBeDefined();
      console.log("Return request created!");

      /* Approve return request */
      const cancelReturn = await mp.cancelReturnHourly(contractId, week1Id, DepositStatus.ACTIVE);
      expect(cancelReturn.status).toEqual("success");
      expect(cancelReturn.id).toBeDefined();
      console.log("Return request approved!");
    }, 1200000);

    it("success flow - dispute, client win", async () => {
      const prepaymentAmount = 10;
      const amountToClaim = 5;
      const aliceBalance = await mp.tokenBalance(alice.address, "MockUSDT");
      const bobBalance = await mp.tokenBalance(bob.address, "MockUSDT");
      const tokenSymbol = "MockUSDT";

      /* deposit prepayment */
      mp.changeAccount(alice);
      const depositInput = {
        contractorAddress: bob.address,
        amountToClaim: 0,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };
      const prepayment = await mp.escrowDepositHourly(tokenSymbol, prepaymentAmount, 0n, depositInput);
      expect(prepayment.status).toEqual("success");
      expect(prepayment.contractId).toBeDefined();
      expect(await mp.tokenBalance(alice.address)).toBeLessThanOrEqual(aliceBalance - prepaymentAmount);

      /* get contract with first week */
      const contractId = prepayment.contractId;
      const week1Id = 0n;
      const contractDetails = await mp.getDepositListHourly(contractId, week1Id);
      expect(contractDetails.amount).toBeDefined();
      expect(contractDetails.amount).toEqual(prepaymentAmount);

      /* Deposit for first week */
      const approvePayload = {
        contractId,
        weekId: week1Id,
        valueApprove: amountToClaim,
        recipient: bob.address,
        token: tokenSymbol,
      };
      const escrowApprove = await mp.escrowApproveHourly(approvePayload);

      expect(escrowApprove.status).toEqual("success");
      expect(escrowApprove.id).toBeDefined();
      expect(await mp.tokenBalance(alice.address)).toBeLessThanOrEqual(
        aliceBalance - (prepaymentAmount + amountToClaim)
      );

      /* Claim first week by freelancer */
      mp.changeAccount(bob);
      const claimFirstWeek = await mp.escrowClaimHourly(contractId, week1Id);
      expect(claimFirstWeek.status).toEqual("success");
      expect(claimFirstWeek.id).toBeDefined();
      expect(await mp.tokenBalance(bob.address)).toBeGreaterThanOrEqual(bobBalance + amountToClaim);

      /* Create escrow return request */
      mp.changeAccount(alice);
      const requestReturn = await mp.requestReturnHourly(contractId, week1Id);
      expect(requestReturn.status).toEqual("success");
      expect(requestReturn.id).toBeDefined();

      /* create dispute */
      mp.changeAccount(bob);
      const createDispute = await mp.createDisputeHourly(contractId, week1Id);
      expect(createDispute.status).toEqual("success");
      expect(createDispute.id).toBeDefined();

      /* resolve dispute */
      mp.changeAccount(admin);
      const resolveDispute = await mp.resolveDisputeHourly(
        contractId,
        week1Id,
        DisputeWinner.CLIENT,
        prepaymentAmount,
        0
      );
      expect(resolveDispute.status).toEqual("success");
      expect(resolveDispute.id).toBeDefined();

      mp.changeAccount(alice);
      const withdraw = await mp.escrowWithdrawHourly(contractId, week1Id);
      expect(withdraw.status).toEqual("success");
      expect(withdraw.id).toBeDefined();
    }, 1200000);

    it("success flow - dispute, freelancer win", async () => {
      const prepaymentAmount = 10;
      const amountToClaim = 5;
      const aliceBalance = await mp.tokenBalance(alice.address, "MockUSDT");
      const bobBalance = await mp.tokenBalance(bob.address, "MockUSDT");
      const tokenSymbol = "MockUSDT";

      /* deposit prepayment */
      mp.changeAccount(alice);
      const depositInput = {
        contractorAddress: bob.address,
        amountToClaim: 0,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };
      const prepayment = await mp.escrowDepositHourly(tokenSymbol, prepaymentAmount, 0n, depositInput);
      expect(prepayment.status).toEqual("success");
      expect(prepayment.contractId).toBeDefined();
      expect(await mp.tokenBalance(alice.address)).toBeLessThanOrEqual(aliceBalance - prepaymentAmount);

      /* get contract with first week */
      const contractId = prepayment.contractId;
      const week1Id = 0n;
      const contractDetails = await mp.getDepositListHourly(contractId, week1Id);
      expect(contractDetails.amount).toBeDefined();
      expect(contractDetails.amount).toEqual(prepaymentAmount);

      /* Deposit for first week */
      const approvePayload = {
        contractId,
        weekId: week1Id,
        valueApprove: amountToClaim,
        recipient: bob.address,
        token: tokenSymbol,
      };
      const escrowApprove = await mp.escrowApproveHourly(approvePayload);

      expect(escrowApprove.status).toEqual("success");
      expect(escrowApprove.id).toBeDefined();
      expect(await mp.tokenBalance(alice.address)).toBeLessThanOrEqual(
        aliceBalance - (prepaymentAmount + amountToClaim)
      );

      /* Claim first week by freelancer */
      mp.changeAccount(bob);
      const claimFirstWeek = await mp.escrowClaimHourly(contractId, week1Id);
      expect(claimFirstWeek.status).toEqual("success");
      expect(claimFirstWeek.id).toBeDefined();
      expect(await mp.tokenBalance(bob.address)).toBeGreaterThanOrEqual(bobBalance + amountToClaim);

      /* Create escrow return request */
      mp.changeAccount(alice);
      const requestReturn = await mp.requestReturnHourly(contractId, week1Id);
      expect(requestReturn.status).toEqual("success");
      expect(requestReturn.id).toBeDefined();

      /* create dispute */
      mp.changeAccount(bob);
      const createDispute = await mp.createDisputeHourly(contractId, week1Id);
      expect(createDispute.status).toEqual("success");
      expect(createDispute.id).toBeDefined();

      /* resolve dispute */
      mp.changeAccount(admin);
      const resolveDispute = await mp.resolveDisputeHourly(
        contractId,
        week1Id,
        DisputeWinner.CONTRACTOR,
        0,
        prepaymentAmount
      );
      expect(resolveDispute.status).toEqual("success");
      expect(resolveDispute.id).toBeDefined();

      mp.changeAccount(bob);
      const claim = await mp.escrowClaimHourly(contractId, week1Id);
      expect(claim.status).toEqual("success");
      expect(claim.id).toBeDefined();
    }, 1200000);

    it("success flow - dispute, split", async () => {
      const prepaymentAmount = 10;
      const amountToClaim = 5;
      const aliceBalance = await mp.tokenBalance(alice.address, "MockUSDT");
      const bobBalance = await mp.tokenBalance(bob.address, "MockUSDT");
      const tokenSymbol = "MockUSDT";

      /* deposit prepayment */
      mp.changeAccount(alice);
      const depositInput = {
        contractorAddress: bob.address,
        amountToClaim: 0,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };
      const prepayment = await mp.escrowDepositHourly(tokenSymbol, prepaymentAmount, 0n, depositInput);
      expect(prepayment.status).toEqual("success");
      expect(prepayment.contractId).toBeDefined();
      expect(await mp.tokenBalance(alice.address)).toBeLessThanOrEqual(aliceBalance - prepaymentAmount);

      /* get contract with first week */
      const contractId = prepayment.contractId;
      const week1Id = 0n;
      const contractDetails = await mp.getDepositListHourly(contractId, week1Id);
      expect(contractDetails.amount).toBeDefined();
      expect(contractDetails.amount).toEqual(prepaymentAmount);

      /* Deposit for first week */
      const approvePayload = {
        contractId,
        weekId: week1Id,
        valueApprove: amountToClaim,
        recipient: bob.address,
        token: tokenSymbol,
      };
      const escrowApprove = await mp.escrowApproveHourly(approvePayload);

      expect(escrowApprove.status).toEqual("success");
      expect(escrowApprove.id).toBeDefined();
      expect(await mp.tokenBalance(alice.address)).toBeLessThanOrEqual(
        aliceBalance - (prepaymentAmount + amountToClaim)
      );

      /* Claim first week by freelancer */
      mp.changeAccount(bob);
      const claimFirstWeek = await mp.escrowClaimHourly(contractId, week1Id);
      expect(claimFirstWeek.status).toEqual("success");
      expect(claimFirstWeek.id).toBeDefined();
      expect(await mp.tokenBalance(bob.address)).toBeGreaterThanOrEqual(bobBalance + amountToClaim);

      /* Create escrow return request */
      mp.changeAccount(alice);
      const requestReturn = await mp.requestReturnHourly(contractId, week1Id);
      expect(requestReturn.status).toEqual("success");
      expect(requestReturn.id).toBeDefined();

      /* create dispute */
      mp.changeAccount(bob);
      const createDispute = await mp.createDisputeHourly(contractId, week1Id);
      expect(createDispute.status).toEqual("success");
      expect(createDispute.id).toBeDefined();

      /* resolve dispute */
      mp.changeAccount(admin);
      const freelancerDisputeAmount = 5;
      const clientDisputeAmount = 5;
      const resolveDispute = await mp.resolveDisputeHourly(
        contractId,
        week1Id,
        DisputeWinner.SPLIT,
        clientDisputeAmount,
        freelancerDisputeAmount
      );
      expect(resolveDispute.status).toEqual("success");
      expect(resolveDispute.id).toBeDefined();

      mp.changeAccount(alice);
      const withdraw = await mp.escrowWithdrawHourly(contractId, week1Id);
      expect(withdraw.status).toEqual("success");
      expect(withdraw.id).toBeDefined();

      mp.changeAccount(bob);
      const claim = await mp.escrowClaimHourly(contractId, week1Id);
      expect(claim.status).toEqual("success");
      expect(claim.id).toBeDefined();
    }, 1200000);
  });

  it("blockNumber", async () => {
    console.log(`blockNumber=${await mp.blockNumber}`);
    expect(await mp.blockNumber).greaterThan(1);
  });

  it("calcDepositAmount", async () => {
    const depositAmount = await mp.escrowDepositAmount(1, FeeConfig.CLIENT_COVERS_ALL);
    expect(depositAmount).toEqual({
      totalDepositAmount: 1.8,
      feeApplied: 0.8,
    });
  });

  it("Parse embedded transaction milestone ", async () => {
    const transaction = await mp.transactionByHashMilestone(
      "0x7cf2e8aa903b8f84983fae34b0ed6fe9c13192ef2d3144e50025354a25670161",
      true
    );
    expect(transaction).toBeDefined();

    mp.changeEscrow("0x5bD6097bD68AE515502DCBa004a2f16fbF69eC20");
    const transactionData = await mp.transactionParseMilestone(transaction);
    expect(transactionData).toBeDefined();
  });
});

it("Parse embedded transaction hourly", async () => {
  const transactionData = await mp.transactionByHashHourly(
    // "0x71dba92983a70850bc335b11be7a4411704c203521d8a5b723dc64933a915ce0"
    "0x954b7951e7bfcea593bd9daf54c918d7cda1797b22b44b45a6cd18bce9982fdf"
  );
  expect(transactionData).toBeDefined();

  mp.changeEscrow("0x7E66D81E7641fBF3ceba2104b124DC7DAc71cAEB");
  const transactionParse = await mp.transactionParseHourly(transactionData);
  expect(transactionParse).toBeDefined();
}, 1200000);

it("Parse embedded transaction fixed", async () => {
  const transactionData = await mp.transactionByHash(
    "0xef6fa11dbbbf569d1f9550669ec025440e9ffb484c46ffa727d9e27d69d9cbbc"
  );
  expect(transactionData).toBeDefined();

  mp.changeEscrow("0x7048c8EC9100eE5cA86E92aE179D6A9b8aBB4b44");
  const transactionParse = await mp.transactionParse(transactionData);
  expect(transactionParse).toBeDefined();
}, 1200000);
