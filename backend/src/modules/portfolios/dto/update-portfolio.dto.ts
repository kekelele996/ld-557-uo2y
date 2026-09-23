import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreatePortfolioDto } from './create-portfolio.dto';

// 初始资金创建后不可修改，避免现金账与历史交易对不上
export class UpdatePortfolioDto extends PartialType(OmitType(CreatePortfolioDto, ['initialCash'] as const)) {}
