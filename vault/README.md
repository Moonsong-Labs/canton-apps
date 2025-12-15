# Vault

A Daml Finance vault application for managing stablecoin deposits and share-based redemptions. Users deposit USD stablecoins into a vault, receive proportional vault shares, and can redeem shares at the current share price (which can be updated via an external oracle).

Built on Daml Finance v4 primitives: accounts, holdings, instruments, and settlements.

## Daml Scripts

| Script | Description |
|--------|-------------|
| `Scripts.Setup:setupVault` | Initializes parties, factories, instruments, accounts, and vault state |
| `Scripts.VaultDeposit:deposit` | Deposits USD stablecoins and receives vault shares |
| `Scripts.VaultRedeem:redeem` | Redeems vault shares for USD stablecoins at current price |
| `Scripts.UpdatePrice:updateSharePrice` | Updates the vault share price (oracle integration) |

## Integration Test

End-to-end test that builds the project, starts the sandbox, executes a deposit, fetches live ETH price from CoinGecko, updates the share price, and performs a redemption.

```bash
./integration_test/vault_oracle_test.sh
```

## Webapp

Requires `daml start` running in another terminal.

```bash
cd webapp
npm install
npm run build
npm run dev
```
