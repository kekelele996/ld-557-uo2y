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

  /**
   * 记录交易并结算现金账。
   * 先完成全部校验再落账：现金不足或可卖数量不够时抛错，交易记录与持仓均不变。
   */
  create(holdingId: number, dto: CreateTransactionDto, user: CurrentUser) {
    const holding = this.holdingsService.findOwned(holdingId, user);
    const fee = dto.fee ?? 0;
    const gross = dto.quantity * dto.price;

    if (dto.type !== TransactionType.DIVIDEND && dto.quantity <= 0) {
      throw new BadRequestException('quantity must be greater than 0');
    }
    if (dto.type === TransactionType.SELL && dto.quantity > holding.quantity) {
      throw new BadRequestException(`insufficient quantity: sell ${dto.quantity}, holding ${holding.quantity}`);
    }

    let realizedPnl = 0;
    if (dto.type === TransactionType.BUY) {
      // 买入按成交额 + 手续费扣款，现金不足时抛错、不产生任何变更
      this.portfoliosService.debitForBuy(holding.portfolioId, gross + fee);
      this.holdingsService.applyTransaction(holdingId, dto.quantity, dto.price, fee, dto.type, user);
    }
    if (dto.type === TransactionType.SELL) {
      // 卖出按平均成本结转已实现盈亏，净额（成交额 - 手续费）入账
      const result = this.holdingsService.applyTransaction(holdingId, dto.quantity, dto.price, fee, dto.type, user);
      realizedPnl = result.realizedPnl;
      this.portfoliosService.creditForSell(holding.portfolioId, gross - fee, realizedPnl);
    }
    if (dto.type === TransactionType.DIVIDEND) {
      // 分红增加现金，不改变持仓数量和成本
      this.portfoliosService.creditForDividend(holding.portfolioId, gross);
      this.holdingsService.applyTransaction(holdingId, dto.quantity, dto.price, fee, dto.type, user);
    }

    const transaction: TransactionRecord = {
      id: this.nextId++,
      holdingId,
      portfolioId: holding.portfolioId,
      type: dto.type,
      quantity: dto.quantity,
      price: dto.price,
      fee,
      executedAt: dto.executedAt ?? new Date().toISOString(),
    };
    this.transactions.push(transaction);
    return { ...transaction, realizedPnl };
  }
}
