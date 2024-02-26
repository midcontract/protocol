import 'dotenv/config'
import {MidcontractProtocol} from "@midcontract/protocol"
import {privateKeyToAccount} from "viem/accounts"
const random = (min, max) => Math.round(Math.random() * (max - min) + min);

// pnpm i
// create .env with ALICE_PK="0x..."
// time node deposit.mjs <depositId>

async function main() {
  console.log("START")
  if (!process.env.ALICE_PK) {
    throw new Error('Env var ALICE_PK mot set use .env')
  }
  const alice = privateKeyToAccount(process.env.ALICE_PK)
  console.log({wallet: alice.address})
  const mp = MidcontractProtocol.buildByEnvironment("beta", alice)
  const depositId = BigInt(process.argv.slice(2).pop() || random(1000, 1000000))
  console.log({depositId})
  const randomData = "" // TODO use random data in prod
  const recipientData = await mp.escrowMakeDataHash(randomData)
  console.log({recipientData})
  const depositStatus = await mp.escrowDeposit({
    depositId,
    amount: 1,
    recipientData,
  })
  console.log({depositStatus})
  const transaction = await mp.transactionByHashWait(depositStatus.id)
  console.log({
    transactionID: transaction.transaction.hash,
    receipt: transaction.receipt.status,
  })
  console.log("END")
}

main().catch(error => {
  if (error instanceof Error) {
    console.log(`Error: ${error.message}`)
  } else {
    console.log(error)
  }
  process.exit(1)
})
