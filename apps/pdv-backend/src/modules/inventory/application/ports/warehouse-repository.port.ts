import type { Warehouse } from "@easypdv/shared-types";

export interface WarehouseRepositoryPort {
  findById(id: string): Promise<Warehouse | null>;
  findAll(): Promise<Warehouse[]>;
  create(name: string): Promise<Warehouse>;
}

export const WAREHOUSE_REPOSITORY = Symbol("WAREHOUSE_REPOSITORY");
