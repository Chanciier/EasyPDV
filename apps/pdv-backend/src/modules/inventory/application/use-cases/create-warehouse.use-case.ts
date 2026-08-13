import { Inject, Injectable } from "@nestjs/common";
import type { Warehouse } from "@easypdv/shared-types";
import { WAREHOUSE_REPOSITORY, type WarehouseRepositoryPort } from "../ports/warehouse-repository.port.js";

@Injectable()
export class CreateWarehouseUseCase {
  constructor(@Inject(WAREHOUSE_REPOSITORY) private readonly warehouseRepository: WarehouseRepositoryPort) {}

  execute(name: string): Promise<Warehouse> {
    return this.warehouseRepository.create(name);
  }
}
