import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  /** Portal the user selected on the login page */
  @IsOptional()
  @IsString()
  @IsIn(['HR', 'HOD', 'DEAN', 'PRINCIPAL', 'FACULTY'])
  expectedRole?: string;
}
