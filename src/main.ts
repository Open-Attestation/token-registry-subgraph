import { Address } from "@graphprotocol/graph-ts";
import { Transfer as TransferEvent } from "../generated/TradeTrustToken/TradeTrustToken";
import { TitleEscrow as TitleEscrowTemplate } from "../generated/templates";

export function handleTransfer(event: TransferEvent): void {
  if (event.params.from.equals(Address.zero())) {
    TitleEscrowTemplate.create(event.params.to);
  }
}
