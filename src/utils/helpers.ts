import { BigInt } from "@graphprotocol/graph-ts/index";

export function mapTitleEscrowStatusEnum(enumIdx: BigInt): string {
  if (enumIdx.equals(BigInt.fromI32(0))) {
    return "Uninitialised";
  }
  if (enumIdx.equals(BigInt.fromI32(1))) {
    return "InUse";
  }
  if (enumIdx.equals(BigInt.fromI32(2))) {
    return "Exited";
  }
  return "";
}

export function getTokenEntityId(tokenRegistryId: String, tokenId: BigInt): string {
  return `${tokenRegistryId}/${tokenId.toHex()}`;
}
