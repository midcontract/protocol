# Usecase

## Case Alice 3% Bob 5%

### Success flow
```text
trx1 event deposit $257.5 Alice
trx2 event refill $257.5 Alice
trx3 submit Bob
trx4* reject Alice
trx5* submit Bob
trx6 event approve $500 Alice
trx7 event fee $15 Alice
trx7 event claim $475 Bob
trx8 event fee $25 Bob
```
* — Optionally, communication can occur off-chain

### Fail flow
```text
trx1 event deposit $257.5 Alice
trx2 event refill $257.5 Alice
trx3 submit Bob
trx4 reject Alice
trx5 withdraw $515 Alice
```

## Case Alice 8% Bob 0%

### Success flow
```text
trx1 event deposit $270 Alice
trx2 event refill $270 Alice
trx3 submit Bob
trx4* reject Alice
trx5* submit Bob
trx6 event approve $500 Alice
trx6 event fee $40 Alice
trx7 event claim $500 Bob
```
* — Optionally, communication can occur off-chain

### Fail flow

```text
trx1 event deposit $270 Alice
trx2 event refill $270 Alice
trx3 submit Bob
trx4 reject Alice
trx5 withdraw $540 Alice
```
