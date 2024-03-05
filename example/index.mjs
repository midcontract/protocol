import {MidcontractProtocol} from "@midcontract/protocol"
import {privateKeyToAccount} from "viem/accounts"

const platform = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
const alice = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d")
const bob = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a")

const mp = MidcontractProtocol.buildByEnvironment("beta", alice)
const random = (min, max) => Math.round(Math.random() * (max - min) + min);
const makeDepositId = () => random(100000, 1000000);

async function main() {
  console.log("START")
  const depositId = 1
  const randomData = random()
  console.log({randomData})
  const recipientData = await mp.escrowMakeDataHash(randomData)
  console.log({recipientData})
  const depositStatus = await mp.escrowDeposit({
    depositId,
    amount: 100,
    recipientData,
  })
  console.log({depositStatus})
  //
  // mp.changeAccount(bob)
  // const escrowSubmitStatus = await mp.escrowSubmit(depositId, depositId.toString())
  // console.log({escrowSubmitStatus})
  //
  // mp.changeAccount(alice)
  // const escrowApproveStatus = await mp.escrowApprove({
  //   depositId,
  //   valueApprove: 100,
  //   recipient: bob.address,
  // })
  // console.log({escrowApproveStatus})
  //
  // mp.changeAccount(bob)
  // const escrowClaimStatus = await mp.escrowClaim(depositId)
  // console.log({escrowClaimStatus})
  //
  // await printBalance()
  console.log("END")
}

main().catch(error => {
  if (error instanceof Error) {
    console.log(error.message)
  } else {
    console.log(error)
  }
  process.exit(1)
})
