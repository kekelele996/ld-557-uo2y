import { BadRequestException, Injectable } from '@nestjs/common';
import { TransactionType } from '../../constants/enums';
import { CurrentUser } from '../../types/request';
import { paginate } from '../../utils/pagination';
import { HoldingsService } from '../holdings/holdings.service';
import { PortfoliosService } from '../portfolios/portfolios.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

export interface TransactionRecord {
  id: number;
  holdingId: number;
  portfolioId: number;
  type: TransactionType;
  quantity: number;
  price: number;
  fee: number;
  /** 卖出时按平均成本结转的已实现盈亏，仅 SELL 有值 */
  realizedPnl?: number;
  executedAt: string;
}

@Injectable()
export class TransactionsService {
  private readonly transactions: TransactionRecord[] = [
    { id: 1, holdingId: 1, portfolioId: 1, type: TransactionType.BUY, quantity: 10, price: 180, fee: 1, executedAt: new Date().toISOString() },
  ];
  private nextId = 2;

  constructor(
    private readonly holdingsService: HoldingsService,
    private readonly portfoliosService: PortfoliosService,
  ) {}

  listByHolding(holdingId: number, user: CurrentUser) {
    this.holdingsService.findOwned(holdingId, user);
    return this.transactions.filter((item) => item.holdingId === holdingId);
  }

  listByPortfolio(portfolioId: number, user: CurrentUser, page = 1, pageSize = 20) {
    this.holdingsService.listByPortfolio(portfolioId, user);
    return paginate(this.transactions.filter((item) => item.portfolioId === portfolioId), page, pageSize);
  }

  create(holdingId: number, dto: CreateTransactionDto, user: CurrentUser) {
    const holding = this.holdingsService.findOwned(holdingId, user);
    const fee = dto.fee ?? 0;
    const gross = dto.quantity * dto.price;

    // 先校验再变更：现金不足或可卖数量不够时拒绝，交易记录和持仓都保持不变
    if (dto.type === TransactionType.BUY) {
      this.portfoliosService.assertSufficientCash(holding.portfolioId, gross + fee);
    }
    if (dto.type === TransactionType.SELL && dto.quantity > holding.quantity) {
      throw new BadRequestException(`insufficient quantity to sell: hold ${holding.quantity}, sell ${dto.quantity}`);
    }

    // 卖出按平均成本结转已实现盈亏：(卖出价 - 平均成本) * 数量 - 手续费
    const realizedPnl = dto.type === TransactionType.SELL
      ? Number(((dto.price - holding.avgCost) * dto.quantity - fee).toFixed(2))
      : undefined;

    const transaction: TransactionRecord = {
      id: this.nextId++,
      holdingId,
      portfolioId: holding.portfolioId,
      type: dto.type,
      quantity: dto.quantity,
      price: dto.price,
      fee,
      ...(realizedPnl !== undefined ? { realizedPnl } : {}),
      executedAt: dto.executedAt ?? new Date().toISOString(),
    };
    this.transactions.push(transaction);
    this.holdingsService.applyTransaction(holdingId, dto.quantity, dto.price, dto.type, user);

    // 现金账：买入按成交额+手续费扣款，卖出/分红按净额（成交额-手续费）入账
    if (dto.type === TransactionType.BUY) {
      this.portfoliosService.applyCashDelta(holding.portfolioId, -(gross + fee));
    } else {
      this.portfoliosService.applyCashDelta(holding.portfolioId, gross - fee);
    }
    if (realizedPnl !== undefined) {
      this.portfoliosService.addRealizedPnl(holding.portfolioId, realizedPnl);
    }
    return transaction;
  }
}
