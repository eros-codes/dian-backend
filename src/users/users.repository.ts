import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, Role as PrismaRole, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserModel } from '../domain/user.model';
import { UserQueryDto } from './dto/user-query.dto';
import { RoleEnum } from '../common/enums/role.enum';

export type CreateUserData = Omit<UserModel, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateUserData = Partial<CreateUserData>;

function mapDbToModel(row: User): UserModel {
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    firstName: row.firstName,
    lastName: row.lastName,
    role: row.role as RoleEnum,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUserData): Promise<UserModel> {
    try {
      const created = await this.prisma.user.create({
        data: {
          username: data.username,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role as PrismaRole,
          isActive: data.isActive,
        },
      });
      return mapDbToModel(created);
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const target = err.meta?.target as string[] | undefined;
        if (target?.includes('username')) {
          throw new ConflictException('User with this username already exists');
        }
      }
      throw err;
    }
  }

  async findById(id: string): Promise<UserModel | undefined> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? mapDbToModel(row) : undefined;
  }

  async findByUsername(username: string): Promise<UserModel | undefined> {
    const row = await this.prisma.user.findUnique({ where: { username } });
    return row ? mapDbToModel(row) : undefined;
  }

  async count(): Promise<number> {
    return this.prisma.user.count();
  }

  async update(
    id: string,
    data: UpdateUserData,
  ): Promise<UserModel | undefined> {
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        username: data.username,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role ? (data.role as PrismaRole) : undefined,
        isActive: data.isActive,
      },
    });
    return updated ? mapDbToModel(updated) : undefined;
  }

  async remove(id: string): Promise<boolean> {
    await this.prisma.user.delete({ where: { id } });
    return true;
  }

  async findAll(query: UserQueryDto): Promise<UserModel[]> {
    const where: Prisma.UserWhereInput = {};

    if (query.username)
      where.username = { contains: query.username, mode: 'insensitive' };
    if (query.firstName)
      where.firstName = { contains: query.firstName, mode: 'insensitive' };
    if (query.lastName)
      where.lastName = { contains: query.lastName, mode: 'insensitive' };
    if (query.role) where.role = query.role as PrismaRole;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const rows = await this.prisma.user.findMany({
      where,
      skip: query.skip,
      take: query.take,
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(mapDbToModel);
  }
}
