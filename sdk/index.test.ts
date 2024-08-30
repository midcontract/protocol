import { beforeAll, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { MidcontractProtocol } from "./.";
import type { Address } from "viem";
import { DepositStatus, DisputeWinner, FeeConfig } from "./Deposit";

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

it("getDepositListMilestone", async () => {
  mp.changeEscrow(userEscrowMilestone);
  const data = await mp.getDepositListMilestone(9n, 1n);
  expect(data).toBeDefined();
});

it("parse transaction", async () => {
  // const data = decodeFunctionData({
  //   abi: escrowMilestone,
  //   data: "0xa60429c900000000000000000000000000000000000000000000000000000000000000d80000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007915a0b0e5fcc4c8c31e0da4c1ae8876b1598eae",
  // });
  // expect(data).toBeDefined();
  const res = await mp.transactionByHashMilestoneWait(
    "0xcffba5a0ae278766b4857b632ce7803611f990bb2d5b7e8a70f6c5ca13453b94"
  );
  expect(res);
}, 1200000);

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

    if (!userEscrowHourly) {
      const deployEscrowHourlyResponse = await mp.deployHourlyEscrow();
      userEscrowHourly = deployEscrowHourlyResponse.userEscrow;
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
  });

  describe("Milestone flow", async () => {
    beforeAll(async () => {
      mp.changeAccount(alice);
      mp.changeEscrow(userEscrowMilestone);
    }, 1200000);

    it("success flow", async () => {
      const amount = 1;
      const amountToClaim = 0;
      const { data, salt, recipientData, aliceBalance, bobBalance } = await newData();
      const tokenSymbol = "MockUSDT";

      // new deposit for milestone1
      const depositInput = [
        {
          contractorAddress: "0x26c69010e91e5e288515567901b42bcaa6630479" as Address,
          token: tokenSymbol,
          amount,
          amountToClaim,
          recipientData: "0xc972eed48b8b5252f8e3ffa6330afd4cda228829bbb274a915b01f8f02a6e6ca" as Address,
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
      expect(await mp.tokenBalance(bob.address)).toEqual(bobBalance + amount * 3);
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
      const claimAll = await mp.escrowClaimAllMilestone(contractId);
      expect(claimAll.status).toEqual("success");
      expect(await mp.tokenBalance(alice.address)).toBeLessThan(bobBalance + amount * 3);
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

      mp.changeAccount(bob);
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

      /* Approve return request */
      mp.changeAccount(bob);
      const approveReturn = await mp.approveReturnHourly(contractId, week1Id);
      expect(approveReturn.status).toEqual("success");
      expect(approveReturn.id).toBeDefined();
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
    const depositAmount = await mp.escrowDepositAmount(1.9833333333333334, FeeConfig.CLIENT_COVERS_ALL);
    expect(depositAmount).toEqual({
      totalDepositAmount: 103,
      feeApplied: 0,
    });
  });

  it("getTransactionReceipt", async () => {
    const transaction = await mp.getTransactionReceipt(
      "0xb2db7e406fa1ac415a14e4efc26e579472c0049de26f55b4da1033125b3ba502",
      true
    );
    expect(transaction).toBeDefined();
  });
});

it("getTransactionByHash", async () => {
  const transactionData = await mp.transactionByHash(
    "0x3eddf07975631fcadb45470d54cb8d0bb6363a94a17892ff89ac87c7c3f3b8d3"
  );
  expect(transactionData).toBeDefined();

  const transactionParse = await mp.transactionParse(transactionData);
  expect(transactionParse).toBeDefined();
}, 1200000);

it("mint mockUSDT", async () => {
  mp.changeAccount(alice);
  const mintResponse = await mp.mintMockUSDTTokens();
  expect(mintResponse).toBeDefined();
}, 1200000);
