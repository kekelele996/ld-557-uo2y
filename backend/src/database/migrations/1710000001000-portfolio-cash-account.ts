import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortfolioCashAccount1710000001000 implements MigrationInterface {
  name = 'PortfolioCashAccount1710000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE portfolios ADD COLUMN cash DECIMAL(18,2) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE portfolios ADD COLUMN realized_pnl DECIMAL(18,2) NOT NULL DEFAULT 0`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE portfolios DROP COLUMN IF EXISTS cash, DROP COLUMN IF EXISTS realized_pnl`);
  }
}
