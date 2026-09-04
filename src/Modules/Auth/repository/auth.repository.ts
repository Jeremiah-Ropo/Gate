import type { DbTransaction } from "core/db/postgres";
import type { IUserRepository } from "Modules/User/entity/user.interface";
import userRepository from "Modules/User/repository/user.repository";

class AuthRepository {
  private static instance: AuthRepository;
  public readonly users: IUserRepository;

  constructor(tx?: DbTransaction) {
    this.users = tx ? userRepository.withTx(tx) : userRepository;
  }

  public static getInstance(): AuthRepository {
    if (!this.instance) {
      this.instance = new AuthRepository();
    }
    return this.instance;
  }

  withTx(tx: DbTransaction): AuthRepository {
    return new AuthRepository(tx);
  }
}

export default AuthRepository.getInstance();
