import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import type { PasswordHasherPort } from "../../application/ports/password-hasher.port.js";

const SALT_ROUNDS = 12;

@Injectable()
export class BcryptPasswordHasher implements PasswordHasherPort {
  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
