import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PortfolioType, RiskLevel } from '../../../constants/enums';

export class CreatePortfolioDto {
  @ApiProperty({ example: '长期价值组合' })
  @IsString()
  name: string;

  @ApiProperty({ example: '以低换手股票和指数基金为主', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: PortfolioType })
  @IsEnum(PortfolioType)
  type: PortfolioType;

  @ApiProperty({ enum: RiskLevel })
  @IsEnum(RiskLevel)
  riskLevel: RiskLevel;

  @ApiProperty({ example: 10000, required: false, description: '初始现金，默认 0' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialCash?: number;
}

