import type { DbExecutor } from "core/db/postgres";
import type { IUserRepository } from "Modules/User/entity/user.interface";
import userRepository from "Modules/User/repository/user.repository";

class AuthRepository {
  private static instance: AuthRepository;
  public readonly users: IUserRepository;

  constructor(executor?: DbExecutor) {
    this.users = executor ? userRepository.withExecutor(executor) : userRepository;
  }

  public static getInstance(): AuthRepository {
    if (!this.instance) {
      this.instance = new AuthRepository();
    }
    return this.instance;
  }

  withExecutor(executor: DbExecutor): AuthRepository {
    return new AuthRepository(executor);
  }
}

export default AuthRepository.getInstance();
