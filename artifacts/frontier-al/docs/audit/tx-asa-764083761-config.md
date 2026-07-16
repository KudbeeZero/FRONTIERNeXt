# ASCEND Token ASA Reconfiguration Audit

## Target Asset
- **Asset ID:** 764083761 (ASCEND Token)

## Parameter Change
- **assetURL:** `https://frontierprotocol.app/nft/metadata/ascend`

## Manual Ledger Checklist (Owner Action Required)

- [ ] Verify current ASA configuration via `goal clerk assetinfo --assetid 764083761`
- [ ] Confirm wallet holds manager role for ASA 764083761
- [ ] Prepare atomic transaction group with `assetConfig` operation
- [ ] Sign transaction with manager key
- [ ] Broadcast to TestNet (or MainNet as configured)
- [ ] Record Transaction ID / Hash: `[Transaction ID / Hash]`
- [ ] Record Timestamp: `[Timestamp]`
- [ ] Verify on-chain update via `goal clerk assetinfo` post-confirmation
- [ ] Update internal configuration references if needed

## Notes
This is an out-of-repo owner action. No signing scripts are staged in this repository.