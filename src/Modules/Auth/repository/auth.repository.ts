import userRepository from "Modules/User/repository/user.repository";

class AuthRepository {
  private static instance: AuthRepository;
  public readonly users = userRepository;

  public static getInstance(): AuthRepository {
    if (!this.instance) {
      this.instance = new AuthRepository();
    }
    return this.instance;
  }
}

export default AuthRepository.getInstance();
