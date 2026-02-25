import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UserModel } from '../domain/user.model';
import { UserMapper } from '../domain/mappers/user.mapper';
import {
  UsersRepository,
  CreateUserData,
  UpdateUserData,
} from './users.repository';

/**
 * Service responsible for managing user operations including creation, retrieval,
 * updating, and deletion of user accounts.
 *
 * @class UsersService
 * @since 1.0.0
 */
@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  /**
   * Creates a new user account with the provided information.
   *
   * @async
   * @function create
   * @param {CreateUserDto} dto - User creation data including email, password, and profile info
   * @returns {Promise<UserModel>} The created user model
   * @throws {ConflictException} When email address is already in use
   *
   * @example
   * ```typescript
   * const user = await usersService.create({
   *   email: 'user@example.com',
   *   password: 'securePassword123',
   *   firstName: 'John',
   *   lastName: 'Doe',
   *   role: RoleEnum.USER,
   *   isActive: true
   * });
   * console.log(user.id); // Generated user ID
   * ```
   *
   * @since 1.0.0
   */
  async create(dto: CreateUserDto): Promise<UserModel> {
    const model = UserMapper.fromCreateDto(dto);
    const hashedPassword: string = await bcrypt.hash(model.password, 12);
    const createData: CreateUserData = {
      username: model.username,
      password: hashedPassword,
      firstName: model.firstName,
      lastName: model.lastName,
      role: model.role,
      isActive: model.isActive,
    };
    return this.repo.create(createData);
  }

  /**
   * Retrieves a user by their unique identifier.
   *
   * @async
   * @function findOne
   * @param {string} id - The unique identifier of the user
   * @returns {Promise<UserModel | undefined>} The user model if found, undefined otherwise
   *
   * @example
   * ```typescript
   * const user = await usersService.findOne('user-id-123');
   * if (user) {
   *   console.log(user.email); // User email
   * } else {
   *   console.log('User not found');
   * }
   * ```
   *
   * @since 1.0.0
   */
  async findOne(id: string): Promise<UserModel | undefined> {
    return this.repo.findById(id);
  }

  /**
   * Updates an existing user with the provided information. Only fields included
   * in the DTO will be updated, other fields remain unchanged.
   *
   * @async
   * @function update
   * @param {string} id - The unique identifier of the user to update
   * @param {UpdateUserDto} dto - Partial user data to update
   * @returns {Promise<UserModel | undefined>} The updated user model if found, undefined otherwise
   *
   * @example
   * ```typescript
   * const updatedUser = await usersService.update('user-id-123', {
   *   firstName: 'Jane',
   *   lastName: 'Smith',
   *   isActive: false
   * });
   * if (updatedUser) {
   *   console.log(updatedUser.firstName); // "Jane"
   * }
   * ```
   *
   * @since 1.0.0
   */
  async update(id: string, dto: UpdateUserDto): Promise<UserModel | undefined> {
    const existing = await this.repo.findById(id);
    if (!existing) return undefined;
    const updated = UserMapper.applyUpdate(existing, dto);
    const updateData: UpdateUserData = {
      username: updated.username,
      password: updated.password,
      firstName: updated.firstName,
      lastName: updated.lastName,
      role: updated.role,
      isActive: updated.isActive,
    };
    return this.repo.update(id, updateData);
  }

  /**
   * Permanently removes a user from the system. This operation cannot be undone.
   *
   * @async
   * @function remove
   * @param {string} id - The unique identifier of the user to remove
   * @returns {Promise<boolean>} True if user was successfully removed, false if user not found
   *
   * @example
   * ```typescript
   * const wasRemoved = await usersService.remove('user-id-123');
   * if (wasRemoved) {
   *   console.log('User successfully removed');
   * } else {
   *   console.log('User not found');
   * }
   * ```
   *
   * @warning This operation permanently deletes the user and cannot be undone
   * @since 1.0.0
   */
  async remove(id: string): Promise<boolean> {
    return this.repo.remove(id);
  }

  /**
   * Retrieves users with optional filtering and pagination support.
   *
   * @async
   * @function findAll
   * @param {UserQueryDto} query - Query parameters for filtering and pagination
   * @returns {Promise<UserModel[]>} Array of user models matching the criteria
   *
   * @example
   * ```typescript
   * const users = await usersService.findAll({
   *   role: 'USER',
   *   isActive: true,
   *   skip: 0,
   *   take: 10
   * });
   * console.log(users.length); // Number of users found
   * ```
   *
   * @since 1.0.0
   */
  async findAll(query: UserQueryDto): Promise<UserModel[]> {
    return this.repo.findAll(query);
  }
}
