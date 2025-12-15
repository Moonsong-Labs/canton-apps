#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT_DIR="$(dirname "$SCRIPT_DIR")"
DAR="$VAULT_DIR/.daml/dist/vault-0.0.6.dar"
LEDGER="--ledger-host localhost --ledger-port 6865"

echo "=== Starting Integration Test ==="

echo "[1/5] Building and Starting Sandbox..."
cd "$VAULT_DIR"
daml build
daml start &
DAML_START_PID=$!

cleanup() {
    echo "Cleaning up..."
    kill $DAML_START_PID 2>/dev/null || true
    pkill -f "daml sandbox" 2>/dev/null || true
    pkill -f "daml start" 2>/dev/null || true
}
trap cleanup EXIT

echo "Waiting for ledger..."
for i in {1..30}; do
    if nc -z localhost 6865 2>/dev/null; then
        echo "Ledger is ready!"
        break
    fi
    sleep 1
done
sleep 5

echo "[2/5] Running Deposit..."
daml script --dar "$DAR" $LEDGER --script-name "Scripts.VaultDeposit:deposit"

echo "[3/5] Fetching Oracle Price..."
ETH_PRICE=$(curl -sf --connect-timeout 10 "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd" | jq -r '.ethereum.usd')

if [ -z "$ETH_PRICE" ] || [ "$ETH_PRICE" == "null" ]; then
    echo "Warning: Failed to fetch live price, using mock value"
    ETH_PRICE="3500.00"
fi

SHARE_PRICE=$(echo "scale=6; $ETH_PRICE / 1000" | bc)
echo "ETH Price: $ETH_PRICE USD"
echo "New Share Price: $SHARE_PRICE"

echo "[4/5] Updating Share Price..."
UPDATE_PRICE_INPUT=$(cat <<EOF
{
  "vaultPartyName": "Vault",
  "vaultId": "vault-101",
  "newPrice": $SHARE_PRICE
}
EOF
)
daml script --dar "$DAR" $LEDGER \
  --script-name "Scripts.UpdatePrice:updateSharePrice" \
  --input-file <(echo "$UPDATE_PRICE_INPUT")

echo "[5/5] Redeeming and Verifying..."
daml script --dar "$DAR" $LEDGER --script-name "Scripts.VaultRedeem:redeem"

echo ""
echo "=== Integration Test Passed Successfully ==="
