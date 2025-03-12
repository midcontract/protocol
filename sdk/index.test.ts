import { beforeAll, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { MidcontractProtocol } from "./.";
import { type Address, type Hash, toHex } from "viem";
import { DisputeWinner, FeeConfig, RefillType } from "./Deposit";
import { ethers } from "ethers";

const random = (min: number, max: number) => Math.round(Math.random() * (max - min) + min);
const getDepositId = () => BigInt(random(100000, 1000000));
const getData = () => getDepositId().toString();

let userEscrow: Address;
let userEscrowMilestone: Address;
let userEscrowHourly: Address;

const alicePK = "0x00000000000000000000";
const bobPK = "0x00000000000000000000";
const adminPK = "0x00000000000000000000";
const alice = privateKeyToAccount(alicePK);
const bob = privateKeyToAccount(bobPK);
const admin = privateKeyToAccount(adminPK);

const mp = MidcontractProtocol.buildByEnvironment("test", undefined, "https://rpc-amoy.polygon.technology");

interface SignSubmitPayload {
  contractId: bigint;
  milestoneId?: bigint;
  contractorAddress: Address;
  escrowAddress: Address;
  salt: Hash;
  data: string;
  expiration: number;
}

async function signSubmitPayload(payload: SignSubmitPayload) {
  const wallet = new ethers.Wallet(adminPK);

  let types;
  let values;

  const hexData = toHex(new TextEncoder().encode(payload.data));

  if (payload.milestoneId !== undefined && payload.milestoneId !== null) {
    types = ["uint256", "uint256", "address", "bytes", "bytes32", "uint256", "address"];
    values = [
      payload.contractId,
      payload.milestoneId,
      payload.contractorAddress,
      hexData,
      payload.salt,
      BigInt(payload.expiration),
      payload.escrowAddress,
    ];
  } else {
    types = ["uint256", "address", "bytes", "bytes32", "uint256", "address"];
    values = [
      payload.contractId,
      payload.contractorAddress,
      hexData,
      payload.salt,
      payload.expiration,
      payload.escrowAddress,
    ];
  }

  const rawHash = ethers.solidityPackedKeccak256(types, values);

  const finalHash = ethers.hashMessage(ethers.getBytes(rawHash));

  const rawSignature: ethers.Signature = wallet.signingKey.sign(finalHash);

  return ethers.Signature.from(rawSignature).serialized as `0x${string}`;
}

async function newData() {
  const depositId = getDepositId();
  const data = getData();
  const salt = mp.escrowMakeSalt(42);
  // const recipientData = "0x4b5722391bd845853b7bfbee672eda09e7bb5a6005ad66ebe057aac8b8349fd0" as `0x${string}`;
  const recipientData = await mp.escrowMakeDataHash(bob.address, data, salt);
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
      const coverageFeeDefault = await mp.getCoverageFee();

      expect(coverageFee).toBeDefined();
      expect(coverageFeeDefault).toBeDefined();
      expect(coverageFee).not.toBeNaN();
      expect(coverageFeeDefault).not.toBeNaN();
    }, 1200000);

    it("getClaimFee", async () => {
      const claimFee = await mp.getClaimFee(alice.address);
      const claimFeeDefault = await mp.getClaimFee();

      expect(claimFee).toBeDefined();
      expect(claimFeeDefault).toBeDefined();
      expect(claimFee).not.toBeNaN();
      expect(claimFeeDefault).not.toBeNaN();
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

  describe("Fees per contract", async () => {
    it("Set special fees per instance", async () => {
      const coverageFee = 3;
      const claimFee = 5;
      mp.changeAccount(alice);
      const { userEscrow } = await mp.deployEscrow();
      mp.changeEscrow(userEscrow);

      mp.changeAccount(admin);
      await mp.setInstanceFees(userEscrow, coverageFee, claimFee);

      const updatedCoverageFee = await mp.getCoverageFee(alice.address);
      const updatedClaimFee = await mp.getClaimFee(alice.address);

      expect(updatedClaimFee).toEqual(claimFee);
      expect(updatedCoverageFee).toEqual(coverageFee);
    });

    // it("Set special fees per contract", async () => {
    //   mp.changeAccount(alice);
    //   const { userEscrow } = await mp.deployEscrow();
    //   mp.changeEscrow(userEscrow);
    //   const coverageFee = 1;
    //   const claimFee = 2;
    //   const amount = 4;
    //   const amountToClaim = 0;
    //   const { recipientData } = await newData();
    //   const tokenSymbol = "MockUSDT";
    //
    //   const depositInput = {
    //     contractorAddress: bob.address,
    //     token: tokenSymbol,
    //     amount,
    //     amountToClaim,
    //     recipientData,
    //     feeConfig: FeeConfig.CLIENT_COVERS_ALL,
    //   };
    //
    //   const depositResponse = await mp.escrowDeposit(depositInput);
    //   expect(depositResponse).toBeDefined();
    //   expect(depositResponse.status).toEqual("success");
    //   expect(depositResponse.contractId).toBeDefined();
    //
    //   mp.changeAccount(admin);
    //   await mp.setContractSpecificFees(userEscrow, depositResponse.contractId, coverageFee, claimFee);
    //
    //   const updatedCoverageFee = await mp.getCoverageFee(alice.address, depositResponse.contractId);
    //   const updatedClaimFee = await mp.getClaimFee(alice.address, depositResponse.contractId);
    //
    //   expect(updatedClaimFee).toEqual(claimFee);
    //   expect(updatedCoverageFee).toEqual(coverageFee);
    // });
  }, 1200000);
});

describe("base", async () => {
  describe("Fixed price flow", async () => {
    beforeAll(async () => {
      mp.changeAccount(alice);
      if (!userEscrow) {
        const deployEscrowResponse = await mp.deployEscrow();
        userEscrow = deployEscrowResponse.userEscrow;
        console.log("Fixed price contract deployed");
      }
      mp.changeEscrow(userEscrow);
    }, 1200000);
    it("success flow Fixed Price", async () => {
      const amount = 4;
      const amountToClaim = 0;
      const { salt, recipientData, data } = await newData();
      const tokenSymbol = "MockUSDC";

      mp.changeAccount(alice);

      //  create deposit
      const depositInput = {
        contractId: BigInt(1),
        contractorAddress: bob.address,
        token: tokenSymbol,
        amount,
        amountToClaim,
        recipientData,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };
      const preparedDeposit = await mp.prepareEscrowDepositPayload(depositInput);

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.signature = signature as Hash;

      const deposit = await mp.escrowDeposit(preparedDeposit);
      expect(deposit.status).toEqual("success");
      expect(deposit.contractId).toBeDefined();

      const contractId = deposit.contractId;
      expect((await mp.getDepositList(contractId)).amount).toEqual(amount);

      // say address worker
      mp.changeAccount(bob);

      const expiration = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
      const submitSignature = await signSubmitPayload({
        contractId,
        contractorAddress: bob.address,
        escrowAddress: userEscrow,
        data,
        salt,
        expiration,
      });
      const escrowSubmit = await mp.escrowSubmit(contractId, salt, data, submitSignature, expiration);
      expect(escrowSubmit.status).toEqual("success");

      // approve work
      mp.changeAccount(alice);
      const escrowApprove = await mp.escrowApprove({
        contractId,
        valueApprove: amount,
        recipient: bob.address,
      });
      expect(escrowApprove.status).toEqual("success");
      const contractAmountToClaim = (await mp.getDepositList(contractId)).amountToClaim;
      expect(contractAmountToClaim).toEqual(amount);

      // claim deposit
      mp.changeAccount(bob);
      const escrowClaim = await mp.escrowClaim(contractId);
      expect(escrowClaim.status).toEqual("success");

      // expect(await mp.tokenBalance(alice.address)).toBeLessThanOrEqual(aliceBalance);
      // expect(await mp.tokenBalance(bob.address)).toEqual(bobBalance + amount);
    }, 1200000);

    it("success flow cancel return request", async () => {
      const amount = 10;
      const amountToClaim = 0;
      const { data, salt, recipientData } = await newData();
      const tokenSymbol = "MockUSDT";

      mp.changeAccount(alice);

      // create deposit
      const depositInput = {
        contractId: BigInt(2),
        contractorAddress: bob.address,
        token: tokenSymbol,
        amount,
        amountToClaim,
        recipientData,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };
      const preparedDeposit = await mp.prepareEscrowDepositPayload(depositInput);

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.signature = signature as Hash;

      const deposit = await mp.escrowDeposit(preparedDeposit);
      expect(deposit.status).toEqual("success");
      expect(deposit.contractId).toBeDefined();

      const contractId = deposit.contractId;
      expect((await mp.getDepositList(contractId)).amount).toEqual(amount);

      // submit work
      mp.changeAccount(bob);
      const expiration = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
      const submitSignature = await signSubmitPayload({
        contractId,
        contractorAddress: bob.address,
        escrowAddress: userEscrow,
        data,
        salt,
        expiration,
      });
      const escrowSubmit = await mp.escrowSubmit(contractId, salt, data, submitSignature, expiration);
      expect(escrowSubmit.status).toEqual("success");

      mp.changeAccount(alice);
      const requestReturnResponse = await mp.requestReturn(contractId);
      expect(requestReturnResponse.status).toEqual("success");

      const cancelReturnResponse = await mp.cancelReturn(contractId);
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
        contractId: BigInt(3),
        contractorAddress: bob.address,
        token: tokenSymbol,
        amount,
        amountToClaim,
        recipientData,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };
      const preparedDeposit = await mp.prepareEscrowDepositPayload(depositInput);

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.signature = signature as Hash;

      const deposit = await mp.escrowDeposit(preparedDeposit);
      expect(deposit.status).toEqual("success");
      expect(deposit.contractId).toBeDefined();

      const contractId = deposit.contractId;
      expect((await mp.getDepositList(contractId)).amount).toEqual(amount);

      // submit work
      mp.changeAccount(bob);
      const expiration = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
      const submitSignature = await signSubmitPayload({
        contractId,
        contractorAddress: bob.address,
        escrowAddress: userEscrow,
        data,
        salt,
        expiration,
      });
      const escrowSubmit = await mp.escrowSubmit(contractId, salt, data, submitSignature, expiration);
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
        contractId: BigInt(4),
        contractorAddress: bob.address,
        token: tokenSymbol,
        amount,
        amountToClaim,
        recipientData,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };
      const preparedDeposit = await mp.prepareEscrowDepositPayload(depositInput);

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.signature = signature as Hash;

      const deposit = await mp.escrowDeposit(preparedDeposit);
      expect(deposit.status).toEqual("success");
      expect(deposit.contractId).toBeDefined();

      const contractId = deposit.contractId;
      expect((await mp.getDepositList(contractId)).amount).toEqual(amount);

      // submit work
      mp.changeAccount(bob);
      const expiration = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
      const submitSignature = await signSubmitPayload({
        contractId,
        contractorAddress: bob.address,
        escrowAddress: userEscrow,
        data,
        salt,
        expiration,
      });
      const escrowSubmit = await mp.escrowSubmit(contractId, salt, data, submitSignature, expiration);
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
        contractId: BigInt(5),
        contractorAddress: bob.address,
        token: tokenSymbol,
        amount,
        amountToClaim,
        recipientData,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };
      const preparedDeposit = await mp.prepareEscrowDepositPayload(depositInput);

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.signature = signature as Hash;

      const deposit = await mp.escrowDeposit(preparedDeposit);
      expect(deposit.status).toEqual("success");
      expect(deposit.contractId).toBeDefined();

      const contractId = deposit.contractId;
      expect((await mp.getDepositList(contractId)).amount).toEqual(amount);

      // submit work
      mp.changeAccount(bob);
      const expiration = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
      const submitSignature = await signSubmitPayload({
        contractId,
        contractorAddress: bob.address,
        escrowAddress: userEscrow,
        data,
        salt,
        expiration,
      });
      const escrowSubmit = await mp.escrowSubmit(contractId, salt, data, submitSignature, expiration);
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
        contractId: BigInt(6),
        contractorAddress: bob.address,
        token: tokenSymbol,
        amount,
        amountToClaim,
        recipientData,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };
      const preparedDeposit = await mp.prepareEscrowDepositPayload(depositInput);

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.signature = signature as Hash;

      const deposit = await mp.escrowDeposit(preparedDeposit);
      expect(deposit.status).toEqual("success");
      expect(deposit.contractId).toBeDefined();

      const contractId = deposit.contractId;
      expect((await mp.getDepositList(contractId)).amount).toEqual(amount);

      // submit work
      mp.changeAccount(bob);
      const expiration = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
      const submitSignature = await signSubmitPayload({
        contractId,
        contractorAddress: bob.address,
        escrowAddress: userEscrow,
        data,
        salt,
        expiration,
      });
      const escrowSubmit = await mp.escrowSubmit(contractId, salt, data, submitSignature, expiration);
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
        contractId: BigInt(7),
        contractorAddress: bob.address,
        token: tokenSymbol,
        amount,
        amountToClaim,
        recipientData,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };
      const preparedDeposit = await mp.prepareEscrowDepositPayload(depositInput);

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.signature = signature as Hash;

      const deposit = await mp.escrowDeposit(preparedDeposit);
      expect(deposit.status).toEqual("success");
      expect(deposit.contractId).toBeDefined();

      const contractId = deposit.contractId;
      expect((await mp.getDepositList(contractId)).amount).toEqual(amount);

      // submit work
      mp.changeAccount(bob);
      const expiration = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
      const submitSignature = await signSubmitPayload({
        contractId,
        contractorAddress: bob.address,
        escrowAddress: userEscrow,
        data,
        salt,
        expiration,
      });
      const escrowSubmit = await mp.escrowSubmit(contractId, salt, data, submitSignature, expiration);
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
        contractId: BigInt(8),
        contractorAddress: bob.address,
        token: tokenSymbol,
        amount,
        amountToClaim,
        recipientData,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };
      const preparedDeposit = await mp.prepareEscrowDepositPayload(depositInput);

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.signature = signature as Hash;

      const deposit = await mp.escrowDeposit(preparedDeposit);
      expect(deposit.status).toEqual("success");
      expect(deposit.contractId).toBeDefined();

      const contractId = deposit.contractId;
      expect((await mp.getDepositList(contractId)).amount).toEqual(amount);

      // submit work
      mp.changeAccount(bob);
      const expiration = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
      const submitSignature = await signSubmitPayload({
        contractId,
        contractorAddress: bob.address,
        escrowAddress: userEscrow,
        data,
        salt,
        expiration,
      });
      const escrowSubmit = await mp.escrowSubmit(contractId, salt, data, submitSignature, expiration);
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
      if (!userEscrowMilestone) {
        const deployEscrowMilestoneResponse = await mp.deployMilestoneEscrow();
        userEscrowMilestone = deployEscrowMilestoneResponse.userEscrow;
        console.log("Milestone contract deployed");
      }
      mp.changeEscrow(userEscrowMilestone);
    }, 1200000);

    it("success flow", async () => {
      const amount = 1;
      const amountToClaim = 0;
      const { data, salt, recipientData, aliceBalance } = await newData();
      const tokenSymbol = "MockUSDT";
      const escrowContractId = BigInt(1);

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

      let preparedDeposit = await mp.prepareMilestoneDepositPayload(depositInput, tokenSymbol, escrowContractId);

      const wallet = new ethers.Wallet(adminPK);

      let rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.depositPayload.signature);

      let signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.depositPayload.signature = signature as Hash;

      const milestone1 = await mp.escrowMilestoneDeposit(preparedDeposit);
      expect(milestone1.status).toEqual("success");
      expect(milestone1.contractId).toBeDefined();

      const contractId = milestone1.contractId;
      const milestone1Id = 0n;
      expect((await mp.getDepositListMilestone(contractId, milestone1Id)).amount).toEqual(amount);
      expect(await mp.tokenBalance(alice.address)).toBeLessThan(aliceBalance - amount);

      // submit freelancer
      mp.changeAccount(bob);

      let expiration = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
      let submitSignature = await signSubmitPayload({
        contractId,
        milestoneId: milestone1Id,
        contractorAddress: bob.address,
        escrowAddress: userEscrowMilestone,
        data,
        salt,
        expiration,
      });

      const escrowSubmitStatus = await mp.escrowSubmitMilestone(
        contractId,
        milestone1Id,
        salt,
        data,
        submitSignature,
        expiration
      );
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

      preparedDeposit = await mp.prepareMilestoneDepositPayload(deposit2Input, tokenSymbol, escrowContractId);
      rawSignature = wallet.signingKey.sign(preparedDeposit.depositPayload.signature);

      signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.depositPayload.signature = signature as Hash;

      const milestone2 = await mp.escrowMilestoneDeposit(preparedDeposit);
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

      preparedDeposit = await mp.prepareMilestoneDepositPayload(deposit3Input, tokenSymbol, escrowContractId);
      rawSignature = wallet.signingKey.sign(preparedDeposit.depositPayload.signature);

      signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.depositPayload.signature = signature as Hash;

      const milestone3 = await mp.escrowMilestoneDeposit(preparedDeposit);
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

      expiration = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
      submitSignature = await signSubmitPayload({
        contractId,
        milestoneId: milestone2Id,
        contractorAddress: bob.address,
        escrowAddress: userEscrowMilestone,
        data,
        salt,
        expiration,
      });

      const escrowSubmitMilestone2 = await mp.escrowSubmitMilestone(
        contractId,
        milestone2Id,
        salt,
        data,
        submitSignature,
        expiration
      );
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

      expiration = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
      submitSignature = await signSubmitPayload({
        contractId,
        milestoneId: milestone3Id,
        contractorAddress: bob.address,
        escrowAddress: userEscrowMilestone,
        data,
        salt,
        expiration,
      });
      const escrowSubmitMilestone3 = await mp.escrowSubmitMilestone(
        contractId,
        milestone3Id,
        salt,
        data,
        submitSignature,
        expiration
      );
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
      const escrowContractId = BigInt(2);
      const { data, salt, recipientData, aliceBalance, bobBalance } = await newData();
      const tokenSymbol = "MockUSDT";

      mp.changeAccount(alice);
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

      let preparedDeposit = await mp.prepareMilestoneDepositPayload(depositInput, tokenSymbol, escrowContractId);

      const wallet = new ethers.Wallet(adminPK);

      let rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.depositPayload.signature);

      let signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.depositPayload.signature = signature as Hash;

      const milestone1 = await mp.escrowMilestoneDeposit(preparedDeposit);
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
      let expiration = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
      let submitSignature = await signSubmitPayload({
        contractId,
        milestoneId: milestone1Id,
        contractorAddress: bob.address,
        escrowAddress: userEscrowMilestone,
        data,
        salt,
        expiration,
      });
      const escrowSubmitStatus = await mp.escrowSubmitMilestone(
        contractId,
        milestone1Id,
        salt,
        data,
        submitSignature,
        expiration
      );
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
      preparedDeposit = await mp.prepareMilestoneDepositPayload(deposit2Input, tokenSymbol, escrowContractId);
      rawSignature = wallet.signingKey.sign(preparedDeposit.depositPayload.signature);

      signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.depositPayload.signature = signature as Hash;

      const milestone2 = await mp.escrowMilestoneDeposit(preparedDeposit);
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
      preparedDeposit = await mp.prepareMilestoneDepositPayload(deposit3Input, tokenSymbol, escrowContractId);
      rawSignature = wallet.signingKey.sign(preparedDeposit.depositPayload.signature);

      signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.depositPayload.signature = signature as Hash;

      const milestone3 = await mp.escrowMilestoneDeposit(preparedDeposit);
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

      expiration = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
      submitSignature = await signSubmitPayload({
        contractId,
        milestoneId: milestone2Id,
        contractorAddress: bob.address,
        escrowAddress: userEscrowMilestone,
        data,
        salt,
        expiration,
      });

      const escrowSubmitMilestone2 = await mp.escrowSubmitMilestone(
        contractId,
        milestone2Id,
        salt,
        data,
        submitSignature,
        expiration
      );
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

      expiration = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
      submitSignature = await signSubmitPayload({
        contractId,
        milestoneId: milestone3Id,
        contractorAddress: bob.address,
        escrowAddress: userEscrowMilestone,
        data,
        salt,
        expiration,
      });

      const escrowSubmitMilestone3 = await mp.escrowSubmitMilestone(
        contractId,
        milestone3Id,
        salt,
        data,
        submitSignature,
        expiration
      );
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
      const escrowContractId = BigInt(3);
      const { data, salt, recipientData, aliceBalance } = await newData();
      const tokenSymbol = "MockUSDT";

      mp.changeAccount(alice);
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

      const preparedDeposit = await mp.prepareMilestoneDepositPayload(depositInput, tokenSymbol, escrowContractId);

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.depositPayload.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.depositPayload.signature = signature as Hash;

      const milestone1 = await mp.escrowMilestoneDeposit(preparedDeposit);
      expect(milestone1.status).toEqual("success");
      expect(milestone1.contractId).toBeDefined();

      const contractId = milestone1.contractId;
      const milestone1Id = 0n;
      expect((await mp.getDepositListMilestone(contractId, milestone1Id)).amount).toEqual(amount);
      expect(await mp.tokenBalance(alice.address)).toBeLessThan(aliceBalance - amount);

      // submit freelancer
      mp.changeAccount(bob);

      const expiration = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
      const submitSignature = await signSubmitPayload({
        contractId,
        milestoneId: milestone1Id,
        contractorAddress: bob.address,
        escrowAddress: userEscrowMilestone,
        data,
        salt,
        expiration,
      });

      const escrowSubmitStatus = await mp.escrowSubmitMilestone(
        contractId,
        milestone1Id,
        salt,
        data,
        submitSignature,
        expiration
      );
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
      const escrowContractId = BigInt(4);
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

      const preparedDeposit = await mp.prepareMilestoneDepositPayload(depositInput, tokenSymbol, escrowContractId);

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.depositPayload.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.depositPayload.signature = signature as Hash;

      const milestone1 = await mp.escrowMilestoneDeposit(preparedDeposit);

      expect(milestone1.status).toEqual("success");
      expect(milestone1.contractId).toBeDefined();
      const contractId = milestone1.contractId;
      const milestone1Id = 0n;

      // submit freelancer
      mp.changeAccount(bob);

      const expiration = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
      const submitSignature = await signSubmitPayload({
        contractId,
        milestoneId: milestone1Id,
        contractorAddress: bob.address,
        escrowAddress: userEscrowMilestone,
        data,
        salt,
        expiration,
      });

      const escrowSubmitStatus = await mp.escrowSubmitMilestone(
        contractId,
        milestone1Id,
        salt,
        data,
        submitSignature,
        expiration
      );
      expect(escrowSubmitStatus.status).toEqual("success");

      mp.changeAccount(alice);
      const requestReturnResponse = await mp.requestReturnMilestone(contractId, milestone1Id);
      expect(requestReturnResponse.status).toEqual("success");

      const approveReturnResponse = await mp.cancelReturnMilestone(contractId, milestone1Id);
      expect(approveReturnResponse.status).toEqual("success");
    }, 1200000);

    it("success flow create and approve return request with withdraw", async () => {
      const amount = 10;
      const amountToClaim = 0;
      const escrowContractId = BigInt(5);
      const { recipientData } = await newData();
      const tokenSymbol = "MockUSDT";

      /* new deposit for milestone1 */
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
      let preparedDeposit = await mp.prepareMilestoneDepositPayload(depositInput, tokenSymbol, escrowContractId);

      const wallet = new ethers.Wallet(adminPK);

      let rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.depositPayload.signature);

      let signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.depositPayload.signature = signature as Hash;

      const milestone1 = await mp.escrowMilestoneDeposit(preparedDeposit);
      expect(milestone1.status).toEqual("success");
      expect(milestone1.contractId).toBeDefined();
      const contractId = milestone1.contractId;
      const milestone1Id = 0n;

      // // submit freelancer
      // mp.changeAccount(bob);
      // const escrowSubmitStatus = await mp.escrowSubmitMilestone(contractId, milestone1Id, salt, data);
      // expect(escrowSubmitStatus.status).toEqual("success");

      /* Create escrow return request */
      mp.changeAccount(alice);
      const requestReturnResponse = await mp.requestReturnMilestone(contractId, milestone1Id);
      expect(requestReturnResponse.status).toEqual("success");

      /* Approve return request */
      mp.changeAccount(bob);
      const approveReturnResponse = await mp.approveReturnMilestone(contractId, milestone1Id);
      expect(approveReturnResponse.status).toEqual("success");

      // const aliceBalanceAfterReturnApprove = await mp.tokenBalance(alice.address, "MockUSDT");
      // expect(aliceBalanceAfterReturnApprove).toBeGreaterThan(aliceBalance);

      mp.changeAccount(alice);
      const withdrawResponse = await mp.escrowWithdrawMilestone(contractId, milestone1Id);
      expect(withdrawResponse.status).toEqual("success");

      /* Deposit second milestone */

      preparedDeposit = await mp.prepareMilestoneDepositPayload(depositInput, tokenSymbol, escrowContractId);
      rawSignature = wallet.signingKey.sign(preparedDeposit.depositPayload.signature);

      signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.depositPayload.signature = signature as Hash;

      const milestone2 = await mp.escrowMilestoneDeposit(preparedDeposit);
      expect(milestone2.status).toEqual("success");
      const milestone2Id = 1n;

      // // submit freelancer
      // mp.changeAccount(bob);
      // const escrowSubmitStatus = await mp.escrowSubmitMilestone(contractId, milestone1Id, salt, data);
      // expect(escrowSubmitStatus.status).toEqual("success");

      /* Create escrow return request */
      mp.changeAccount(alice);
      const requestReturnSecondMilestoneResponse = await mp.requestReturnMilestone(contractId, milestone2Id);
      expect(requestReturnSecondMilestoneResponse.status).toEqual("success");

      /* Approve return request */
      mp.changeAccount(bob);
      const approveReturnSecondMilestoneResponse = await mp.approveReturnMilestone(contractId, milestone2Id);
      expect(approveReturnSecondMilestoneResponse.status).toEqual("success");

      // const aliceBalanceAfterReturnApprove = await mp.tokenBalance(alice.address, "MockUSDT");
      // expect(aliceBalanceAfterReturnApprove).toBeGreaterThan(aliceBalance);

      mp.changeAccount(alice);
      const withdrawSecondMilestoneResponse = await mp.escrowWithdrawMilestone(contractId, milestone2Id);
      expect(withdrawSecondMilestoneResponse.status).toEqual("success");
    }, 1200000);

    it("success flow dispute - client won", async () => {
      const amount = 10;
      const amountToClaim = 0;
      const escrowContractId = BigInt(6);
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
      const preparedDeposit = await mp.prepareMilestoneDepositPayload(depositInput, tokenSymbol, escrowContractId);

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.depositPayload.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.depositPayload.signature = signature as Hash;

      const milestone1 = await mp.escrowMilestoneDeposit(preparedDeposit);
      expect(milestone1.status).toEqual("success");
      expect(milestone1.contractId).toBeDefined();
      const contractId = milestone1.contractId;
      const milestone1Id = 0n;

      // submit freelancer
      mp.changeAccount(bob);
      const expiration = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
      const submitSignature = await signSubmitPayload({
        contractId,
        milestoneId: milestone1Id,
        contractorAddress: bob.address,
        escrowAddress: userEscrowMilestone,
        data,
        salt,
        expiration,
      });

      const escrowSubmitStatus = await mp.escrowSubmitMilestone(
        contractId,
        milestone1Id,
        salt,
        data,
        submitSignature,
        expiration
      );
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
      const escrowContractId = BigInt(7);
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
      const preparedDeposit = await mp.prepareMilestoneDepositPayload(depositInput, tokenSymbol, escrowContractId);

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.depositPayload.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.depositPayload.signature = signature as Hash;

      const milestone1 = await mp.escrowMilestoneDeposit(preparedDeposit);
      expect(milestone1.status).toEqual("success");
      expect(milestone1.contractId).toBeDefined();
      const contractId = milestone1.contractId;
      const milestone1Id = 0n;

      // submit freelancer
      mp.changeAccount(bob);
      const expiration = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
      const submitSignature = await signSubmitPayload({
        contractId,
        milestoneId: milestone1Id,
        contractorAddress: bob.address,
        escrowAddress: userEscrowMilestone,
        data,
        salt,
        expiration,
      });
      const escrowSubmitStatus = await mp.escrowSubmitMilestone(
        contractId,
        milestone1Id,
        salt,
        data,
        submitSignature,
        expiration
      );
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
      const escrowContractId = BigInt(8);
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
      const preparedDeposit = await mp.prepareMilestoneDepositPayload(depositInput, tokenSymbol, escrowContractId);

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.depositPayload.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.depositPayload.signature = signature as Hash;

      const milestone1 = await mp.escrowMilestoneDeposit(preparedDeposit);
      expect(milestone1.status).toEqual("success");
      expect(milestone1.contractId).toBeDefined();
      const contractId = milestone1.contractId;
      const milestone1Id = 0n;

      // submit freelancer
      mp.changeAccount(bob);
      const expiration = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
      const submitSignature = await signSubmitPayload({
        contractId,
        milestoneId: milestone1Id,
        contractorAddress: bob.address,
        escrowAddress: userEscrowMilestone,
        data,
        salt,
        expiration,
      });
      const escrowSubmitStatus = await mp.escrowSubmitMilestone(
        contractId,
        milestone1Id,
        salt,
        data,
        submitSignature,
        expiration
      );
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
      const escrowContractId = BigInt(9);
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
      const preparedDeposit = await mp.prepareMilestoneDepositPayload(depositInput, tokenSymbol, escrowContractId);

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.depositPayload.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.depositPayload.signature = signature as Hash;

      const milestone1 = await mp.escrowMilestoneDeposit(preparedDeposit);
      expect(milestone1.status).toEqual("success");
      expect(milestone1.contractId).toBeDefined();
      const contractId = milestone1.contractId;
      const milestone1Id = 0n;

      const refillMilestoneResponse = await mp.escrowRefillMilestone(contractId, milestone1Id, amount);
      expect(refillMilestoneResponse.status).toEqual("success");
      expect((await mp.getDepositListMilestone(contractId, milestone1Id)).amount).toEqual(amount * 2);

      // submit freelancer
      mp.changeAccount(bob);
      const expiration = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
      const submitSignature = await signSubmitPayload({
        contractId,
        milestoneId: milestone1Id,
        contractorAddress: bob.address,
        escrowAddress: userEscrowMilestone,
        data,
        salt,
        expiration,
      });
      const escrowSubmitStatus = await mp.escrowSubmitMilestone(
        contractId,
        milestone1Id,
        salt,
        data,
        submitSignature,
        expiration
      );
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

    // it("success flow - 2 contracts should have different escrow contract id", async () => {
    //   const amount = 1;
    //   const amountToClaim = 0;
    //   const { recipientData } = await newData();
    //   const tokenSymbol = "MockUSDT";
    //
    //   // first contract deposit
    //   const contractInput = [
    //     {
    //       contractorAddress: bob.address as Address,
    //       token: tokenSymbol,
    //       amount,
    //       amountToClaim,
    //       recipientData: recipientData,
    //       feeConfig: FeeConfig.CLIENT_COVERS_ONLY,
    //     },
    //   ];
    //   const firstContract = await mp.escrowMilestoneDeposit(contractInput, tokenSymbol);
    //   expect(firstContract.status).toEqual("success");
    //   expect(firstContract.contractId).toBeDefined();
    //
    //   const contractId1 = firstContract.contractId;
    //
    //   // second contract deposit
    //   mp.changeAccount(alice);
    //   const contract2Input = [
    //     {
    //       contractorAddress: bob.address,
    //       token: tokenSymbol,
    //       amount,
    //       amountToClaim,
    //       recipientData,
    //       feeConfig: FeeConfig.CLIENT_COVERS_ALL,
    //     },
    //   ];
    //   const secondContract = await mp.escrowMilestoneDeposit(contract2Input, tokenSymbol);
    //   expect(secondContract.status).toEqual("success");
    //   const contractId2 = secondContract.contractId;
    //
    //   expect(contractId1).not.toEqual(contractId2);
    // }, 1200000);
  });

  describe("Hourly flow", async () => {
    beforeAll(async () => {
      mp.changeAccount(alice);
      if (!userEscrowHourly) {
        const deployEscrowHourlyResponse = await mp.deployHourlyEscrow();
        userEscrowHourly = deployEscrowHourlyResponse.userEscrow;
        console.log("Hourly contract deployed!");
      }
      mp.changeEscrow(userEscrowHourly);
    }, 1200000);
    it("success flow without prepayment", async () => {
      const amountToClaim = 10;
      const contractId = BigInt(1);
      // const { aliceBalance, bobBalance } = await newData();
      const tokenSymbol = "MockUSDT";

      // new deposit for week1
      mp.changeAccount(alice);
      const depositInput = {
        contractorAddress: bob.address,
        amountToClaim,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };

      const preparedDeposit = await mp.prepareEscrowDepositHourlyPayload(tokenSymbol, 0, contractId, depositInput);

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.signature = signature as Hash;

      const week1 = await mp.escrowDepositHourly(preparedDeposit);
      expect(week1.status).toEqual("success");
      expect(week1.contractId).toBeDefined();

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
      const escrowContractId = BigInt(2);
      // const { aliceBalance, bobBalance } = await newData();
      const tokenSymbol = "MockUSDT";

      // new deposit for week1
      mp.changeAccount(alice);
      const depositInput = {
        contractorAddress: bob.address,
        amountToClaim: 0,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };
      const preparedDeposit = await mp.prepareEscrowDepositHourlyPayload(
        tokenSymbol,
        prepaymentAmount,
        escrowContractId,
        depositInput
      );

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.signature = signature as Hash;
      const week1 = await mp.escrowDepositHourly(preparedDeposit);
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
      const escrowContractId = BigInt(3);
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
      const preparedDeposit = await mp.prepareEscrowDepositHourlyPayload(
        tokenSymbol,
        prepaymentAmount,
        escrowContractId,
        depositInput
      );

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.signature = signature as Hash;
      const prepayment = await mp.escrowDepositHourly(preparedDeposit);

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
      const escrowContractId = BigInt(4);
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
      const preparedDeposit = await mp.prepareEscrowDepositHourlyPayload(
        tokenSymbol,
        prepaymentAmount,
        escrowContractId,
        depositInput
      );

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.signature = signature as Hash;
      const prepayment = await mp.escrowDepositHourly(preparedDeposit);
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
      const escrowContractId = BigInt(5);
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
      const preparedDeposit = await mp.prepareEscrowDepositHourlyPayload(
        tokenSymbol,
        prepaymentAmount,
        escrowContractId,
        depositInput
      );

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.signature = signature as Hash;
      const prepayment = await mp.escrowDepositHourly(preparedDeposit);
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
      const escrowContractId = BigInt(6);
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
      const preparedDeposit = await mp.prepareEscrowDepositHourlyPayload(
        tokenSymbol,
        prepaymentAmount,
        escrowContractId,
        depositInput
      );

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.signature = signature as Hash;
      const prepayment = await mp.escrowDepositHourly(preparedDeposit);
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
      const requestReturn = await mp.requestReturnHourly(contractId);
      expect(requestReturn.status).toEqual("success");
      expect(requestReturn.id).toBeDefined();
      console.log("Return request created!");

      /* Approve return request */
      mp.changeAccount(bob);
      const approveReturn = await mp.approveReturnHourly(contractId);
      expect(approveReturn.status).toEqual("success");
      expect(approveReturn.id).toBeDefined();
      console.log("Return request approved!");
    }, 1200000);

    it("success flow with prepayment and escrow return request cancel", async () => {
      const prepaymentAmount = 10;
      const amountToClaim = 5;
      const escrowContractId = BigInt(7);
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
      const preparedDeposit = await mp.prepareEscrowDepositHourlyPayload(
        tokenSymbol,
        prepaymentAmount,
        escrowContractId,
        depositInput
      );

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.signature = signature as Hash;
      const prepayment = await mp.escrowDepositHourly(preparedDeposit);
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
      const requestReturn = await mp.requestReturnHourly(contractId);
      expect(requestReturn.status).toEqual("success");
      expect(requestReturn.id).toBeDefined();
      console.log("Return request created!");

      /* Approve return request */
      const cancelReturn = await mp.cancelReturnHourly(contractId);
      expect(cancelReturn.status).toEqual("success");
      expect(cancelReturn.id).toBeDefined();
      console.log("Return request approved!");
    }, 1200000);

    it("success flow - dispute, client win", async () => {
      const prepaymentAmount = 10;
      const amountToClaim = 5;
      const escrowContractId = BigInt(8);
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
      const preparedDeposit = await mp.prepareEscrowDepositHourlyPayload(
        tokenSymbol,
        prepaymentAmount,
        escrowContractId,
        depositInput
      );

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.signature = signature as Hash;
      const prepayment = await mp.escrowDepositHourly(preparedDeposit);
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
      const requestReturn = await mp.requestReturnHourly(contractId);
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
      expect(resolveDispute.status).toEqual("success"); //0xe181ae06ff36a14a17670fc0eac415a85750cb383c02d83b73ae33513db00791
      expect(resolveDispute.id).toBeDefined();

      mp.changeAccount(alice);
      const withdraw = await mp.escrowWithdrawHourly(contractId);
      expect(withdraw.status).toEqual("success");
      expect(withdraw.id).toBeDefined();
    }, 1200000);

    it("success flow - dispute, freelancer win", async () => {
      const prepaymentAmount = 10;
      const amountToClaim = 5;
      const escrowContractId = BigInt(9);
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
      const preparedDeposit = await mp.prepareEscrowDepositHourlyPayload(
        tokenSymbol,
        prepaymentAmount,
        escrowContractId,
        depositInput
      );

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.signature = signature as Hash;
      const prepayment = await mp.escrowDepositHourly(preparedDeposit);
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
      const requestReturn = await mp.requestReturnHourly(contractId);
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
      const escrowContractId = BigInt(10);
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
      const preparedDeposit = await mp.prepareEscrowDepositHourlyPayload(
        tokenSymbol,
        prepaymentAmount,
        escrowContractId,
        depositInput
      );

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.signature = signature as Hash;
      const prepayment = await mp.escrowDepositHourly(preparedDeposit);
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
      const requestReturn = await mp.requestReturnHourly(contractId);
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
      const withdraw = await mp.escrowWithdrawHourly(contractId);
      expect(withdraw.status).toEqual("success");
      expect(withdraw.id).toBeDefined();

      mp.changeAccount(bob);
      const claim = await mp.escrowClaimHourly(contractId, week1Id);
      expect(claim.status).toEqual("success");
      expect(claim.id).toBeDefined();
    }, 1200000);

    it("success flow - approve return request, refill and return request", async () => {
      const prepaymentAmount = 10;
      const escrowContractId = BigInt(11);
      const aliceBalance = await mp.tokenBalance(alice.address, "MockUSDT");
      const tokenSymbol = "MockUSDT";

      /* deposit prepayment */
      mp.changeAccount(alice);
      const depositInput = {
        contractorAddress: bob.address,
        amountToClaim: 0,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };
      const preparedDeposit = await mp.prepareEscrowDepositHourlyPayload(
        tokenSymbol,
        prepaymentAmount,
        escrowContractId,
        depositInput
      );

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.signature = signature as Hash;
      const prepayment = await mp.escrowDepositHourly(preparedDeposit);
      expect(prepayment.status).toEqual("success");
      expect(prepayment.contractId).toBeDefined();
      expect(await mp.tokenBalance(alice.address)).toBeLessThanOrEqual(aliceBalance - prepaymentAmount);

      const contractId = prepayment.contractId;

      /* Create escrow return request */
      mp.changeAccount(alice);
      const requestReturn = await mp.requestReturnHourly(contractId);
      expect(requestReturn.status).toEqual("success");
      expect(requestReturn.id).toBeDefined();

      /* Approve return request */
      mp.changeAccount(bob);
      const approveReturn = await mp.approveReturnHourly(contractId);
      expect(approveReturn.status).toEqual("success");
      expect(approveReturn.id).toBeDefined();

      /* withdraw prepayment */
      mp.changeAccount(alice);
      const withdraw = await mp.escrowWithdrawHourly(contractId);
      expect(withdraw.status).toEqual("success");
      expect(withdraw.id).toBeDefined();

      /* Refill prepayment */

      const refillPrepayment = await mp.escrowRefillHourly(contractId, 0n, prepaymentAmount, RefillType.PREPAYMENT);
      expect(refillPrepayment.status).toEqual("success");
      expect(refillPrepayment.id).toBeDefined();

      /* request return */

      const secondRequestReturn = await mp.requestReturnHourly(contractId);
      expect(secondRequestReturn.status).toEqual("success");
      expect(secondRequestReturn.id).toBeDefined();
    }, 1200000);

    it("success flow with prepayment and escrow return request, withdraw and approve", async () => {
      const prepaymentAmount = 10;
      const amountToClaim = 5;
      const escrowContractId = BigInt(12);
      const aliceBalance = await mp.tokenBalance(alice.address, "MockUSDT");
      const tokenSymbol = "MockUSDT";

      /* deposit prepayment */
      mp.changeAccount(alice);
      const depositInput = {
        contractorAddress: bob.address,
        amountToClaim: 0,
        feeConfig: FeeConfig.CLIENT_COVERS_ALL,
      };
      const preparedDeposit = await mp.prepareEscrowDepositHourlyPayload(
        tokenSymbol,
        prepaymentAmount,
        escrowContractId,
        depositInput
      );

      const wallet = new ethers.Wallet(adminPK);

      const rawSignature: ethers.Signature = wallet.signingKey.sign(preparedDeposit.signature);

      const signature = ethers.Signature.from(rawSignature).serialized as `0x${string}`;

      preparedDeposit.signature = signature as Hash;
      const prepayment = await mp.escrowDepositHourly(preparedDeposit);
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

      /* Create escrow return request */
      mp.changeAccount(alice);
      const requestReturn = await mp.requestReturnHourly(contractId);
      expect(requestReturn.status).toEqual("success");
      expect(requestReturn.id).toBeDefined();
      console.log("Return request created!");

      /* Approve return request */
      mp.changeAccount(bob);
      const approveReturn = await mp.approveReturnHourly(contractId);
      expect(approveReturn.status).toEqual("success");
      expect(approveReturn.id).toBeDefined();
      console.log("Return request approved!");

      /* Withdraw prepayment */
      mp.changeAccount(alice);
      const withdrawResponse = await mp.escrowWithdrawHourly(contractId);
      expect(withdrawResponse.status).toEqual("success");

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
      // expect(await mp.tokenBalance(alice.address)).toBeLessThanOrEqual(
      //   aliceBalance - (prepaymentAmount + amountToClaim)
      // );
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
      "0x182cd2212c5f6841395b42bf40d5175a50d158e5ea2cd2fb3a8e7622ddccb8e7",
      true
    );
    expect(transaction).toBeDefined();

    mp.changeEscrow("0x2f4626c0D31FDCD38eb1B2B8cD763EA922900128");
    const transactionData = await mp.transactionParseMilestone(transaction);
    expect(transactionData).toBeDefined();
  });
});

describe("Transaction parsing", async () => {
  it("Parse embedded transaction hourly", async () => {
    const transactionData = await mp.transactionByHashHourly(
      // "0x71dba92983a70850bc335b11be7a4411704c203521d8a5b723dc64933a915ce0"
      "0x962c56f38752695e2671fe050a172fead01423c4421bcbeb95cc8c12590c5ff3"
    );
    expect(transactionData).toBeDefined();

    // mp.changeEscrow("0x2F993eA91F9459b1E5997671072053F3262A3771");
    const transactionParse = await mp.transactionParseHourly(transactionData);
    expect(transactionParse).toBeDefined();
  }, 1200000);

  it("Parse embedded transaction fixed", async () => {
    const transactionData = await mp.transactionByHash(
      "0xb52ae2ff73dd1598ef14eb28f079d428811f42bf79b7a195b0234f401086d5c0"
    );
    expect(transactionData).toBeDefined();

    mp.changeEscrow("0x3D5bdDbec2F1e4949EE300879523B54CaCE3Ae4F");
    const transactionParse = await mp.transactionParse(transactionData);
    expect(transactionParse).toBeDefined();
  }, 1200000);
});
