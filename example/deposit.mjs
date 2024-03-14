import 'dotenv/config'
import {MidcontractProtocol} from "@midcontract/protocol"
import {privateKeyToAccount} from "viem/accounts"
const random = (min, max) => Math.round(Math.random() * (max - min) + min);

// pnpm i
// create .env with ALICE_PK="0x..." and optional BLOCKCHAIN_RPC="http..."
// time node deposit.mjs <depositId>

async function main() {
  console.log("START")
  if (!process.env.ALICE_PK) {
    throw new Error('Env var ALICE_PK mot set use .env')
  }
  const alice = privateKeyToAccount(process.env.ALICE_PK)
  console.log({wallet: alice.address})
  const mp = MidcontractProtocol.buildByEnvironment(process.env.APP_ENV || "test", alice, process.env.BLOCKCHAIN_RPC)
  const depositId = BigInt(process.argv.slice(2).pop() || random(1000000, 2000000))
  console.log({depositId})
  const randomData = "" // TODO use random data in prod
  let start = Date.now()
  const recipientData = await mp.escrowMakeDataHash(randomData)
  console.log({recipientData})
  const depositStatus = await mp.escrowDeposit({
    depositId,
    amount: 1,
    recipientData,
  })
  let end = Date.now()
  console.log(`deposit ${end - start}ms`, {depositStatus})
  start = Date.now()
  const transaction = await mp.transactionByHashWait(depositStatus.id)
  console.log(mp.transactionUrl(depositStatus.id))
  end = Date.now()
  console.log(`transaction ${end - start}ms`, {
    transactionID: transaction.transaction.hash,
    receipt: transaction.receipt.status,
  })
  start = Date.now()
  const data = await mp.transactionParse(transaction)
  end = Date.now()
  console.log(`parse ${end - start}ms`, {data})
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
