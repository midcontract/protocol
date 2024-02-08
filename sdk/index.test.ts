import { describe, it, expect } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { MidcontractProtocol } from "./.";

const random = (min: number, max: number) => Math.round(Math.random() * (max - min) + min);
const getDepositId = () => BigInt(random(100000, 1000000));
const getData = () => getDepositId().toString();

const alice = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const bob = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");

const mp = MidcontractProtocol.buildByEnvironment("local");

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

  it("success flow", async () => {
    const depositId = getDepositId();
    const data = getData();
    const recipientData = await mp.escrowMakeDataHash(data);
    const amount = 100;
    const aliceBalance = await mp.tokenBalance(alice.address);
    const bobBalance = await mp.tokenBalance(bob.address);

    mp.changeAccount(alice);
    const depositStatus = await mp.escrowDeposit({
      depositId,
      amount,
      recipientData,
    });
    expect(depositStatus.status).toEqual("success");

    mp.changeAccount(bob);
    const escrowSubmitStatus = await mp.escrowSubmit(depositId, data);
    expect(escrowSubmitStatus.status).toEqual("success");

    mp.changeAccount(alice);
    const escrowApproveStatus = await mp.escrowApprove({
      depositId,
      valueApprove: amount,
      recipient: bob.address,
    });
    expect(escrowApproveStatus.status).toEqual("success");

    mp.changeAccount(bob);
    const escrowClaimStatus = await mp.escrowClaim(depositId);
    expect(escrowClaimStatus.status).toEqual("success");

    expect(await mp.tokenBalance(alice.address)).toBeLessThan(aliceBalance);
    expect(await mp.tokenBalance(bob.address)).toBeGreaterThan(bobBalance);
  });
});
