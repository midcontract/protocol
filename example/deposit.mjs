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
  const randomData = "" // TODO use random data in prod
  const recipientData = await mp.escrowMakeDataHash(randomData)
  console.log('data for deposit', {
    depositId,
    recipientData,
  })
  // make deposit
  let start = Date.now()
  const depositStatus = await mp.escrowDeposit({
    depositId,
    amount: 1,
    recipientData,
  }, false)
  let end = Date.now()
  console.log(`deposit ${end - start}ms`, {depositStatus})
  // get transaction
  start = Date.now()
  let transaction = await mp.transactionByHash(depositStatus.id)
  end = Date.now()
  console.log(`wait transaction ${end - start}ms`, {
    status: transaction.status,
    input: transaction.input,
  })
  // wait receipt
  start = Date.now()
  transaction = await mp.transactionByHashWait(depositStatus.id)
  end = Date.now()
  console.log(`wait transaction ${end - start}ms`, {
    status: transaction.status,
    url: mp.transactionUrl(depositStatus.id),
  })
  // transaction parse
  start = Date.now()
  const data = await mp.transactionParse(transaction)
  end = Date.now()
  console.log(`parse ${end - start}ms`, data.events)
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
