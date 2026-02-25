import { UserModel } from '../user.model';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { UpdateUserDto } from '../../users/dto/update-user.dto';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class UserMapper {
  static fromCreateDto(dto: CreateUserDto): UserModel {
    const now = new Date();
    return {
      id: '',
      username: dto.username,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role,
      isActive: dto.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
  }

  static applyUpdate(model: UserModel, dto: UpdateUserDto): UserModel {
    return {
      ...model,
      ...dto,
      updatedAt: new Date(),
    } as UserModel;
  }

  static toResponseDto(model: UserModel): UserResponseDto {
    return {
      id: model.id,
      username: model.username,
      firstName: model.firstName,
      lastName: model.lastName,
      role: model.role,
      isActive: model.isActive,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }
}
