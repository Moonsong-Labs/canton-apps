#!/bin/bash
# Oracle script - fetches ETH price and updates vault share price

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT_DIR="$(dirname "$SCRIPT_DIR")"
INTERVAL=60  # seconds

while true; do
  # Fetch ETH price from CoinGecko (free, no API key)
  ETH_PRICE=$(curl -s "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd" \
    | jq -r '.ethereum.usd')
  
  if [ -n "$ETH_PRICE" ] && [ "$ETH_PRICE" != "null" ]; then
    # Divide by 1000 to get a smaller number
    SHARE_PRICE=$(echo "scale=6; $ETH_PRICE / 1000" | bc)
    echo "[$(date)] ETH: $ETH_PRICE USD -> Share Price: $SHARE_PRICE"
    
    cd "$VAULT_DIR"
    daml script --dar .daml/dist/vault-0.0.6.dar \
      --script-name "Scripts.UpdatePrice:updateSharePrice" \
      --input-file <(echo "$SHARE_PRICE") \
      --ide-ledger --static-time 2>/dev/null
  else
    echo "[$(date)] Failed to fetch ETH price"
  fi
  
  sleep $INTERVAL
done


