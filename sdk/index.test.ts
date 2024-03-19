import { describe, it, expect } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { MidcontractProtocol } from "./.";

const random = (min: number, max: number) => Math.round(Math.random() * (max - min) + min);
const getDepositId = () => BigInt(random(100000, 1000000));
const getData = () => getDepositId().toString();

const alice = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const bob = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");

const mp = MidcontractProtocol.buildByEnvironment("local");

async function newData() {
  const depositId = getDepositId();
  const data = getData();
  const recipientData = await mp.escrowMakeDataHash(data);
  const aliceBalance = await mp.tokenBalance(alice.address);
  const bobBalance = await mp.tokenBalance(bob.address);
  return {
    depositId,
    data,
    recipientData,
    aliceBalance,
    bobBalance,
  };
}

describe("base", async () => {
  it("blockNumber", async () => {
    console.log(`blockNumber=${await mp.blockNumber}`);
    expect(await mp.blockNumber).greaterThan(1);
  });

  it("calcDepositAmount", async () => {
    expect(await mp.escrowDepositAmount(100, false)).toEqual({
      depositAmount: 103,
      fee: 0.03,
    });
    expect(await mp.escrowDepositAmount(100, true)).toEqual({
      depositAmount: 108,
      fee: 0.08,
    });
  });

  it("success flow Fixed Price", async () => {
    const amount = 100;
    const { depositId, data, recipientData, aliceBalance, bobBalance } = await newData();

    // new deposit
    mp.changeAccount(alice);
    const deposit = await mp.escrowDeposit({
      depositId,
      amount,
      recipientData,
      fullFee: true,
    });
    expect(deposit.status).toEqual("success");
    expect((await mp.getDepositList(depositId)).amount).toEqual(amount);

    // say address worker
    mp.changeAccount(bob);
    const escrowSubmit = await mp.escrowSubmit(depositId, data);
    expect(escrowSubmit.status).toEqual("success");

    // approve work
    mp.changeAccount(alice);
    const escrowApprove = await mp.escrowApprove({
      depositId,
      valueApprove: amount,
      recipient: bob.address,
    });
    expect(escrowApprove.status).toEqual("success");
    expect((await mp.getDepositList(depositId)).amountToClaim).toEqual(amount);

    // claim deposit
    mp.changeAccount(bob);
    const escrowClaim = await mp.escrowClaim(depositId);
    expect(escrowClaim.status).toEqual("success");

    expect(await mp.tokenBalance(alice.address)).toBeLessThan(aliceBalance);
    expect(await mp.tokenBalance(bob.address)).toEqual(bobBalance + amount);
  });

  it("success flow Milestone", async () => {
    const amount = 100;
    const { depositId, data, recipientData, aliceBalance, bobBalance } = await newData();

    // new deposit for milestone1
    mp.changeAccount(alice);
    const milestone1 = await mp.escrowDeposit({
      depositId,
      amount,
      recipientData,
      fullFee: true,
    });
    expect(milestone1.status).toEqual("success");
    expect((await mp.getDepositList(depositId)).amount).toEqual(amount);
    expect(await mp.tokenBalance(alice.address)).toBeLessThan(aliceBalance - amount);

    // new deposit for milestone2
    const milestone2 = await mp.escrowRefill(depositId, amount);
    expect(milestone2.status).toEqual("success");
    expect((await mp.getDepositList(depositId)).amount).toEqual(amount * 2);
    expect(await mp.tokenBalance(alice.address)).toBeLessThan(aliceBalance - amount * 2);

    // new deposit for milestone3
    const milestone3 = await mp.escrowRefill(depositId, amount);
    expect(milestone3.status).toEqual("success");
    expect((await mp.getDepositList(depositId)).amount).toEqual(amount * 3);
    expect(await mp.tokenBalance(alice.address)).toBeLessThan(aliceBalance - amount * 3);

    // say address worker
    mp.changeAccount(bob);
    const escrowSubmitStatus = await mp.escrowSubmit(depositId, data);
    expect(escrowSubmitStatus.status).toEqual("success");

    // approve and claim milestone1
    mp.changeAccount(alice);
    const milestone1Approve = await mp.escrowApprove({
      depositId,
      valueApprove: amount,
      recipient: bob.address,
    });
    expect(milestone1Approve.status).toEqual("success");
    expect((await mp.getDepositList(depositId)).amountToClaim).toEqual(amount);
    mp.changeAccount(bob);
    const milestone1Claim = await mp.escrowClaim(depositId);
    expect(milestone1Claim.status).toEqual("success");
    expect(await mp.tokenBalance(bob.address)).toEqual(bobBalance + amount);

    // approve and claim milestone2
    mp.changeAccount(alice);
    const milestone2Approve = await mp.escrowApprove({
      depositId,
      valueApprove: amount,
      recipient: bob.address,
    });
    expect(milestone2Approve.status).toEqual("success");
    expect((await mp.getDepositList(depositId)).amountToClaim).toEqual(amount);
    mp.changeAccount(bob);
    const milestone2Claim = await mp.escrowClaim(depositId);
    expect(milestone2Claim.status).toEqual("success");
    expect(await mp.tokenBalance(bob.address)).toEqual(bobBalance + amount * 2);

    // approve and claim milestone3
    mp.changeAccount(alice);
    const milestone3Approve = await mp.escrowApprove({
      depositId,
      valueApprove: amount,
      recipient: bob.address,
    });
    expect(milestone3Approve.status).toEqual("success");
    expect((await mp.getDepositList(depositId)).amountToClaim).toEqual(amount);
    mp.changeAccount(bob);
    const milestone3Claim = await mp.escrowClaim(depositId);
    expect(milestone3Claim.status).toEqual("success");
    expect(await mp.tokenBalance(bob.address)).toEqual(bobBalance + amount * 3);
  });
});
