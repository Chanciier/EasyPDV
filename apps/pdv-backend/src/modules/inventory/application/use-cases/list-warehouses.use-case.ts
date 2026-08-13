import { Inject, Injectable } from "@nestjs/common";
import type { Warehouse } from "@easypdv/shared-types";
import { WAREHOUSE_REPOSITORY, type WarehouseRepositoryPort } from "../ports/warehouse-repository.port.js";

@Injectable()
export class ListWarehousesUseCase {
  constructor(@Inject(WAREHOUSE_REPOSITORY) private readonly warehouseRepository: WarehouseRepositoryPort) {}

  execute(): Promise<Warehouse[]> {
    return this.warehouseRepository.findAll();
  }
}
