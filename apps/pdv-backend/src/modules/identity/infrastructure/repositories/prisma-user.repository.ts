import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import { User } from "../../domain/entities/user.entity.js";
import type { CreateUserData, UserRepositoryPort } from "../../application/ports/user-repository.port.js";
import { toDomainUser } from "../mappers/user.mapper.js";

@Injectable()
export class PrismaUserRepository implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    return record ? toDomainUser(record) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { email } });
    return record ? toDomainUser(record) : null;
  }

  async create(data: CreateUserData): Promise<User> {
    const record = await this.prisma.user.create({ data });
    return toDomainUser(record);
  }

  async updateRole(id: string, role: User["role"]): Promise<User> {
    const record = await this.prisma.user.update({ where: { id }, data: { role } });
    return toDomainUser(record);
  }

  async findAll(): Promise<User[]> {
    const records = await this.prisma.user.findMany({ orderBy: { employeeCode: "asc" } });
    return records.map(toDomainUser);
  }

  async existsAny(): Promise<boolean> {
    const count = await this.prisma.user.count();
    return count > 0;
  }

  async getMaxEmployeeCode(): Promise<number> {
    const result = await this.prisma.user.aggregate({ _max: { employeeCode: true } });
    return result._max.employeeCode ?? 0;
  }
}
