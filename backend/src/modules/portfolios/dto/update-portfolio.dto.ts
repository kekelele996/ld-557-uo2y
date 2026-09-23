import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreatePortfolioDto } from './create-portfolio.dto';

// 现金账只能通过交易变动，不允许直接编辑 initialCash
export class UpdatePortfolioDto extends PartialType(OmitType(CreatePortfolioDto, ['initialCash'] as const)) {}
