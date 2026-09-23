import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PortfolioType, RiskLevel, UserRole } from '../../constants/enums';
import { ROLE_LIMITS } from '../../constants/permissions';
import { CurrentUser } from '../../types/request';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';

export interface PortfolioRecord {
  id: number;
  userId: number;
  name: string;
  description: string;
  type: PortfolioType;
  riskLevel: RiskLevel;
  cash: number;
  realizedPnl: number;
  /** 总市值，仅统计持仓市值，不含现金 */
  totalValue: number;
  createdAt: string;
}

@Injectable()
export class PortfoliosService {
  private readonly portfolios: PortfolioRecord[] = [
    // 初始现金 10000，种子交易买入 10 股 AAPL @180 手续费 1，现金余额 8199
    { id: 1, userId: 1, name: '长期价值组合', description: '宽基 ETF + 龙头股票', type: PortfolioType.MIXED, riskLevel: RiskLevel.MODERATE, cash: 8199, realizedPnl: 0, totalValue: 3000, createdAt: new Date().toISOString() },
  ];
  private nextId = 2;

  list(user: CurrentUser) {
    return user.role === UserRole.ADMIN ? this.portfolios : this.portfolios.filter((item) => item.userId === user.id);
  }

  findOwned(id: number, user: CurrentUser) {
    const portfolio = this.portfolios.find((item) => item.id === id);
    if (!portfolio) throw new NotFoundException('portfolio not found');
    if (user.role !== UserRole.ADMIN && portfolio.userId !== user.id) throw new ForbiddenException('not portfolio owner');
    return portfolio;
  }

  /** 组合详情：回读现金、持仓市值（totalValue，仅统计持仓）和累计已实现盈亏 */
  detail(id: number, user: CurrentUser) {
    return this.findOwned(id, user);
  }

  create(dto: CreatePortfolioDto, user: CurrentUser) {
    const ownedCount = this.portfolios.filter((item) => item.userId === user.id).length;
    if (ownedCount >= ROLE_LIMITS[user.role].maxPortfolios) throw new ForbiddenException('portfolio limit reached');

    const portfolio: PortfolioRecord = {
      id: this.nextId++,
      userId: user.id,
      name: dto.name,
      description: dto.description ?? '',
      type: dto.type,
      riskLevel: dto.riskLevel,
      cash: dto.initialCash ?? 0,
      realizedPnl: 0,
      totalValue: 0,
      createdAt: new Date().toISOString(),
    };
    this.portfolios.push(portfolio);
    return portfolio;
  }

  update(id: number, dto: UpdatePortfolioDto, user: CurrentUser) {
    const portfolio = this.findOwned(id, user);
    Object.assign(portfolio, dto);
    return portfolio;
  }

  delete(id: number, user: CurrentUser) {
    const portfolio = this.findOwned(id, user);
    const index = this.portfolios.findIndex((item) => item.id === portfolio.id);
    this.portfolios.splice(index, 1);
    return { deleted: true, id };
  }

  setTotalValue(id: number, value: number) {
    const portfolio = this.portfolios.find((item) => item.id === id);
    if (portfolio) portfolio.totalValue = Number(value.toFixed(2));
  }

  /** 买入扣款前校验现金是否充足，不足则抛错，组合状态不变 */
  assertSufficientCash(id: number, amount: number) {
    const portfolio = this.portfolios.find((item) => item.id === id);
    if (!portfolio) throw new NotFoundException('portfolio not found');
    if (portfolio.cash < amount) {
      throw new BadRequestException(`insufficient cash: need ${amount.toFixed(2)}, available ${portfolio.cash.toFixed(2)}`);
    }
  }

  /** 现金入账/扣款，delta 为正入账、为负扣款 */
  applyCashDelta(id: number, delta: number) {
    const portfolio = this.portfolios.find((item) => item.id === id);
    if (!portfolio) throw new NotFoundException('portfolio not found');
    portfolio.cash = Number((portfolio.cash + delta).toFixed(2));
    return portfolio;
  }

  /** 卖出结转后累计已实现盈亏 */
  addRealizedPnl(id: number, pnl: number) {
    const portfolio = this.portfolios.find((item) => item.id === id);
    if (!portfolio) throw new NotFoundException('portfolio not found');
    portfolio.realizedPnl = Number((portfolio.realizedPnl + pnl).toFixed(2));
    return portfolio;
  }

  performance(id: number, user: CurrentUser) {
    const portfolio = this.findOwned(id, user);
    return {
      portfolioId: portfolio.id,
      totalValue: portfolio.totalValue,
      daily: 0.38,
      weekly: 1.24,
      monthly: 3.9,
      yearly: 12.6,
      points: ['日', '周', '月', '年'].map((label, index) => ({ label, returnPercent: [0.38, 1.24, 3.9, 12.6][index] })),
    };
  }
}

