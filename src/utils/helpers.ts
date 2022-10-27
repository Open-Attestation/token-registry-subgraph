import { BigInt, ethereum, Address } from "@graphprotocol/graph-ts";
import { TokenSnapshot, TitleEscrow, Token } from "../../generated/schema";

export function getTokenEntityId(tokenRegistryId: String, tokenId: BigInt): string {
  return `${tokenRegistryId}/${tokenId.toHex()}`;
}

export function getEventId(event: ethereum.Event): string {
  return `${event.transaction.hash.toHex()}-${event.logIndex.toString()}`;
}

export function createTokenSnapshot(event: ethereum.Event, titleEscrowEntity: TitleEscrow, tokenEntity: Token, actionType: string): TokenSnapshot {
  const snapshotEntityId = `${getEventId(event)}-${titleEscrowEntity.token}`

  const snapshotTokenEntity = new TokenSnapshot(snapshotEntityId);
  snapshotTokenEntity.timestamp = event.block.timestamp;
  snapshotTokenEntity.blockNumber = event.block.number;
  snapshotTokenEntity.token = titleEscrowEntity.token;
  snapshotTokenEntity.registry = titleEscrowEntity.registry;
  snapshotTokenEntity.beneficiary = titleEscrowEntity.beneficiary;
  snapshotTokenEntity.holder = titleEscrowEntity.holder;
  snapshotTokenEntity.nominee = titleEscrowEntity.nominee;
  snapshotTokenEntity.surrendered = tokenEntity.surrendered;
  snapshotTokenEntity.accepted = tokenEntity.accepted;
  snapshotTokenEntity.action = actionType;

  snapshotTokenEntity.save();

  return snapshotTokenEntity;
}

export function formatAddressValue(address: Address): string | null {
  if (address.equals(Address.zero())) return null;
  return address.toHex();
}
