import type { CashRegister } from "@easypdv/shared-types";
import type { CashSession } from "../../domain/entities/cash-session.entity.js";

export interface OpenCashSessionData {
  cashRegisterId: string;
  operatorUserId: string;
  openingAmount: number;
  terminalId: string | null;
}

export interface RegisterCashMovementData {
  cashSessionId: string;
  type: "sangria" | "suprimento" | "ajuste";
  amount: number;
  reason: string | null;
  authorizedByUserId: string | null;
}

/** Registro interno (Date, não string) — a serialização pra ISO string acontece no HTTP, não aqui. */
export interface CashMovementRecord {
  id: string;
  cashSessionId: string;
  type: "sangria" | "suprimento" | "ajuste";
  amount: number;
  reason: string | null;
  authorizedByUserId: string | null;
  createdAt: Date;
}

export interface CashRepositoryPort {
  findRegisterById(id: string): Promise<CashRegister | null>;
  listRegisters(): Promise<CashRegister[]>;
  createRegister(name: string): Promise<CashRegister>;

  findOpenSessionByRegister(cashRegisterId: string): Promise<CashSession | null>;
  findOpenSessionByOperator(operatorUserId: string): Promise<CashSession | null>;
  findSessionById(id: string): Promise<CashSession | null>;
  openSession(data: OpenCashSessionData): Promise<CashSession>;
  closeSession(id: string, closingAmount: number, expectedAmount: number): Promise<CashSession>;

  registerMovement(data: RegisterCashMovementData): Promise<CashMovementRecord>;
  /** Mais recente primeiro (Sprint 9 — tela de Caixa). */
  listMovements(cashSessionId: string): Promise<CashMovementRecord[]>;
  sumMovements(cashSessionId: string): Promise<{ sangria: number; suprimento: number; ajuste: number }>;
}

export const CASH_REPOSITORY = Symbol("CASH_REPOSITORY");
